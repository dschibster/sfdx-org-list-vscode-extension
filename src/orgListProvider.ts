import * as vscode from "vscode";
import * as cp from "child_process";
import { Org } from "./org";
import { OrgFolder, FolderData } from "./orgFolder";

interface OrgTree {
  result: {
    devHubs: Array<{ alias: string; username: string; connectedStatus: string }>;
    nonScratchOrgs: Array<{ alias: string; username: string; connectedStatus: string }>;
    scratchOrgs: Array<{ alias: string; username: string; connectedStatus: string }>;
  };
}

/** Category node used for "Ungrouped" routing in getChildren. */
class CategoryNode extends vscode.TreeItem {
  constructor(label: string, public readonly categoryId: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = `category-${categoryId}`;
  }
}

export class OrgListProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private devHubs: Org[] = [];
  private scratchOrgs: Org[] = [];
  private nonScratchOrgs: Org[] = [];
  private folders: OrgFolder[] = [];
  private context: vscode.ExtensionContext | undefined;
  private isLoading = true;
  private showHiddenOrgs = false;

  /** Called after every refresh so the webview tile grid stays in sync. */
  private onRefreshCallback?: () => void;

  constructor(context?: vscode.ExtensionContext) {
    this.context = context;
  }

  setRefreshCallback(cb: () => void): void {
    this.onRefreshCallback = cb;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this.isLoading = true;
    this._onDidChangeTreeData.fire(undefined);
    await this.loadOrgList();
    this.isLoading = false;
    this._onDidChangeTreeData.fire(undefined);
    this.onRefreshCallback?.();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
    this.onRefreshCallback?.();
  }

  async reload(): Promise<void> {
    await this.loadOrgList();
    this._onDidChangeTreeData.fire(undefined);
    this.onRefreshCallback?.();
  }

  // ─── TreeDataProvider ─────────────────────────────────────────────────────

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    if (element instanceof OrgFolder) {
      return this.getFolderChildren(element);
    }
    if (element instanceof CategoryNode && element.categoryId === "ungrouped") {
      return this.sortOrgs(this.allOrgs().filter((o) => !this.isInAnyFolder(o)));
    }
    return [];
  }

  private getRootItems(): vscode.TreeItem[] {
    if (this.isLoading) {
      const item = new vscode.TreeItem("Loading orgs…", vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon("loading~spin");
      return [item];
    }

    const items: vscode.TreeItem[] = [];

    for (const folder of this.folders) {
      folder.updateTooltip();
      items.push(folder);
    }

    const unfoldered = this.allOrgs().filter((o) => !this.isInAnyFolder(o));
    if (unfoldered.length > 0) {
      const ungrouped = new CategoryNode("📦 Ungrouped", "ungrouped");
      ungrouped.iconPath = new vscode.ThemeIcon("inbox");
      items.push(ungrouped);
    }

    return items;
  }

  private getFolderChildren(folder: OrgFolder): Org[] {
    const orgs: Org[] = [];
    for (const username of folder.orgUsernames) {
      const org = this.findOrgByUsername(username);
      if (org) {
        org.contextValue = org.type + "-org-in-folder";
        orgs.push(org);
      }
    }
    return this.sortOrgs(orgs);
  }

  private sortOrgs(orgs: Org[]): Org[] {
    const TYPE_ORDER: Record<string, number> = { "dev-hub": 0, "non-scratch": 1, "scratch": 2 };
    const visible = this.showHiddenOrgs ? orgs : orgs.filter((o) => !o.isHidden);
    for (const o of visible) {
      if (!o.contextValue?.endsWith("-in-folder")) {
        o.contextValue = o.type + "-org";
      }
    }
    return visible.slice().sort((a, b) => {
      const typeA = TYPE_ORDER[a.type] ?? 99;
      const typeB = TYPE_ORDER[b.type] ?? 99;
      if (typeA !== typeB) return typeA - typeB;
      return a.orgName.localeCompare(b.orgName);
    });
  }

  // ─── Public helpers for webview / commands ────────────────────────────────

  getPinnedOrgs(): Org[] {
    return this.allOrgs()
      .filter((o) => o.isPinned)
      .sort((a, b) => a.orgName.localeCompare(b.orgName));
  }

  findOrgByUsername(username: string): Org | undefined {
    return this.allOrgs().find((o) => o.username === username);
  }

  private allOrgs(): Org[] {
    return [...this.devHubs, ...this.nonScratchOrgs, ...this.scratchOrgs];
  }

  private isInAnyFolder(org: Org): boolean {
    return this.folders.some((f) => f.orgUsernames.includes(org.username));
  }

  // ─── Org loading ──────────────────────────────────────────────────────────

  async loadOrgList(): Promise<void> {
    return vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Loading Org List", cancellable: false },
      async () =>
        new Promise<void>((resolve, reject) => {
          cp.exec("sf org list --json", async (error, stdout) => {
            if (error) {
              reject(new Error("Loading org list failed."));
              return;
            }
            try {
              const orgTree: OrgTree = JSON.parse(stdout.toString());
              const hiddenOrgs = await this.loadHiddenOrgs();
              const pinnedOrgs = await this.loadPinnedOrgs();

              const makeOrg = (
                raw: { alias: string; username: string; connectedStatus: string },
                type: string
              ): Org => {
                const org = new Org(
                  raw.alias,
                  raw.username,
                  raw.connectedStatus,
                  type,
                  this,
                  vscode.TreeItemCollapsibleState.None
                );
                org.isHidden = hiddenOrgs.includes(raw.username);
                org.isPinned = pinnedOrgs.includes(raw.username);
                org.label = org.displayName;
                return org;
              };

              this.devHubs = (orgTree.result.devHubs ?? []).map((o) => makeOrg(o, "dev-hub"));
              const devHubUsernames = new Set(this.devHubs.map((o) => o.username));
              this.nonScratchOrgs = (orgTree.result.nonScratchOrgs ?? [])
                .filter((o) => !devHubUsernames.has(o.username))
                .map((o) => makeOrg(o, "non-scratch"));
              this.scratchOrgs = (orgTree.result.scratchOrgs ?? []).map((o) => makeOrg(o, "scratch"));

              await this.loadFolders();
              resolve();
            } catch {
              reject(new Error("Failed to parse org list response."));
            }
          });
        })
    );
  }

  removeItem(org: Org): void {
    this.devHubs = this.devHubs.filter((x) => x.username !== org.username);
    this.nonScratchOrgs = this.nonScratchOrgs.filter((x) => x.username !== org.username);
    this.scratchOrgs = this.scratchOrgs.filter((x) => x.username !== org.username);
    for (const folder of this.folders) {
      folder.orgUsernames = folder.orgUsernames.filter((u) => u !== org.username);
    }
    this._onDidChangeTreeData.fire(undefined);
    this.onRefreshCallback?.();
  }

  // ─── Visibility ───────────────────────────────────────────────────────────

  async toggleShowHiddenOrgs(): Promise<void> {
    this.showHiddenOrgs = !this.showHiddenOrgs;
    this.refresh();
    const action = this.showHiddenOrgs ? "showing" : "hiding";
    vscode.window.showInformationMessage(`${action} hidden orgs.`);
  }

  // ─── Persistence: hidden / pinned ────────────────────────────────────────

  async saveHiddenOrgs(): Promise<void> {
    if (!this.context) return;
    const list = this.allOrgs().filter((o) => o.isHidden).map((o) => o.username);
    await this.context.globalState.update("hiddenOrgs", list);
  }

  async savePinnedOrgs(): Promise<void> {
    if (!this.context) return;
    const list = this.allOrgs().filter((o) => o.isPinned).map((o) => o.username);
    await this.context.globalState.update("pinnedOrgs", list);
  }

  private async loadHiddenOrgs(): Promise<string[]> {
    return this.context?.globalState.get<string[]>("hiddenOrgs", []) ?? [];
  }

  private async loadPinnedOrgs(): Promise<string[]> {
    return this.context?.globalState.get<string[]>("pinnedOrgs", []) ?? [];
  }

  // ─── Persistence: folders ─────────────────────────────────────────────────

  private async saveFolders(): Promise<void> {
    if (!this.context) return;
    const data: FolderData[] = this.folders.map((f) => f.toData());
    await this.context.globalState.update("orgFolders", data);
  }

  private async loadFolders(): Promise<void> {
    if (!this.context) {
      this.folders = [];
      return;
    }
    const data = this.context.globalState.get<FolderData[]>("orgFolders", []);
    this.folders = data.map((d) => new OrgFolder(d.id, d.name, d.orgUsernames));
  }

  // ─── Folder commands ──────────────────────────────────────────────────────

  async createFolder(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: "Folder name",
      placeHolder: "e.g. Client A",
    });
    if (!name?.trim()) return;
    const folder = new OrgFolder(`folder-${Date.now()}`, name.trim(), []);
    this.folders.push(folder);
    await this.saveFolders();
    this._onDidChangeTreeData.fire(undefined);
  }

  async renameFolder(folder: OrgFolder): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: "New folder name",
      value: folder.folderName,
    });
    if (!name?.trim()) return;
    folder.folderName = name.trim();
    folder.label = folder.folderName;
    folder.updateTooltip();
    await this.saveFolders();
    this._onDidChangeTreeData.fire(undefined);
  }

  async deleteFolder(folder: OrgFolder): Promise<void> {
    const answer = await vscode.window.showInformationMessage(
      `Delete folder "${folder.folderName}"? The orgs inside will move to Ungrouped.`,
      "Cancel",
      "Delete"
    );
    if (answer !== "Delete") return;
    this.folders = this.folders.filter((f) => f.folderId !== folder.folderId);
    await this.saveFolders();
    this._onDidChangeTreeData.fire(undefined);
  }

  async assignOrgToFolder(org: Org): Promise<void> {
    if (this.folders.length === 0) {
      const create = await vscode.window.showInformationMessage(
        "No folders yet. Create one first?",
        "Create Folder",
        "Cancel"
      );
      if (create === "Create Folder") await this.createFolder();
      return;
    }
    const picks = this.folders.map((f) => ({ label: f.folderName, folderId: f.folderId }));
    const chosen = await vscode.window.showQuickPick(picks, {
      placeHolder: `Move "${org.orgName}" to folder…`,
    });
    if (!chosen) return;
    for (const f of this.folders) {
      f.orgUsernames = f.orgUsernames.filter((u) => u !== org.username);
    }
    const target = this.folders.find((f) => f.folderId === chosen.folderId);
    if (target) {
      target.orgUsernames.push(org.username);
      target.updateTooltip();
    }
    await this.saveFolders();
    this._onDidChangeTreeData.fire(undefined);
  }

  async removeOrgFromFolder(org: Org): Promise<void> {
    for (const f of this.folders) {
      f.orgUsernames = f.orgUsernames.filter((u) => u !== org.username);
      f.updateTooltip();
    }
    org.contextValue = org.type + "-org";
    await this.saveFolders();
    this._onDidChangeTreeData.fire(undefined);
  }

  async showPinnedOrgContextMenu(username: string): Promise<void> {
    const org = this.findOrgByUsername(username);
    if (!org) return;

    type Action = { label: string; fn: () => Promise<void> };
    const actions: Action[] = [
      { label: "$(link-external)  Open",            fn: () => org.open() },
      { label: "$(pinned)  Unpin",                   fn: () => org.togglePin() },
      { label: "$(edit)  Change Alias",              fn: () => org.rename() },
      { label: "$(target)  Set Default",             fn: () => org.default() },
      { label: "$(folder)  Move to Folder…",         fn: () => this.assignOrgToFolder(org) },
      { label: "$(eye-closed)  Hide/Show",           fn: () => org.toggleHidden() },
      { label: "$(key)  Copy Auth URL",              fn: () => org.copyAuthUrl() },
      { label: "$(terminal)  Copy Login Command",    fn: () => org.copyLoginCommand() },
    ];
    if (org.type !== "scratch") {
      actions.push({ label: "$(sign-out)  Logout", fn: () => org.logout() });
    }
    if (org.type === "scratch") {
      actions.push({ label: "$(trash)  Delete", fn: () => org.delete() });
    }

    const picked = await vscode.window.showQuickPick(
      actions.map((a) => a.label),
      { placeHolder: org.orgName }
    );
    if (!picked) return;
    await actions.find((a) => a.label === picked)?.fn();
  }
}
