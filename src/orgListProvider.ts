import * as vscode from "vscode";
import * as cp from "child_process";
import { Org } from "./org";

interface OrgTree {
  result: {
    devHubs: Array<{
      alias: string;
      username: string;
      connectedStatus: string;
    }>;
    nonScratchOrgs: Array<{
      alias: string;
      username: string;
      connectedStatus: string;
    }>;
    scratchOrgs: Array<{
      alias: string;
      username: string;
      connectedStatus: string;
    }>;
  };
}

export class OrgListProvider
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this
    ._onDidChangeTreeData.event;

  private devHubs: Array<Org> = [];
  private scratchOrgs: Array<Org> = [];
  private nonScratchOrgs: Array<Org> = [];
  private context: vscode.ExtensionContext | undefined;
  private isLoading: boolean = true;

  constructor(context?: vscode.ExtensionContext) {
    this.context = context;
  }

  async init(): Promise<void> {
    this.isLoading = true;
    this._onDidChangeTreeData.fire(undefined);
    await this.loadOrgList();
    this.isLoading = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async reload(): Promise<void> {
    await this.loadOrgList();
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: Org): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      if (element.label === "Dev Hubs") {
        return this.sortOrgsByFavorite(this.devHubs);
      } else if (element.label === "Scratch Orgs") {
        return this.sortOrgsByFavorite(this.scratchOrgs);
      } else {
        return this.sortOrgsByFavorite(this.nonScratchOrgs);
      }
    } else {
      // Show loading state
      if (this.isLoading) {
        const loadingItem = new vscode.TreeItem("Loading orgs...", vscode.TreeItemCollapsibleState.None);
        loadingItem.iconPath = new vscode.ThemeIcon("loading");
        return [loadingItem];
      }
      
      const treeItems: vscode.TreeItem[] = [];
      
      // Add Dev Hubs first (on top)
      if (this.devHubs && this.devHubs.length > 0) {
        treeItems.push(
          new vscode.TreeItem(
            "Dev Hubs",
            vscode.TreeItemCollapsibleState.Expanded
          )
        );
      }
      
      // Add Sandboxes / Playgrounds
      if (this.nonScratchOrgs && this.nonScratchOrgs.length > 0) {
        treeItems.push(
          new vscode.TreeItem(
            "Sandboxes / Playgrounds",
            vscode.TreeItemCollapsibleState.Expanded
          )
        );
      }
      
      // Add Scratch Orgs last
      if (this.scratchOrgs && this.scratchOrgs.length > 0) {
        treeItems.push(
          new vscode.TreeItem(
            "Scratch Orgs",
            vscode.TreeItemCollapsibleState.Expanded
          )
        );
      }
      
      return treeItems;
    }
  }

  private sortOrgsByFavorite(orgs: Array<Org>): Array<Org> {
    return orgs.sort((a, b) => {
      // Favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      
      // Then alphabetically by name
      return a.orgName.localeCompare(b.orgName);
    });
  }

  async saveFavorites(): Promise<void> {
    if (!this.context) return;

    const favorites: string[] = [];
    
    // Collect all favorite usernames
    [...this.devHubs, ...this.nonScratchOrgs, ...this.scratchOrgs].forEach(org => {
      if (org.isFavorite) {
        favorites.push(org.username);
      }
    });

    // Save to extension storage
    await this.context.globalState.update('favoriteOrgs', favorites);
  }

  private async loadFavorites(): Promise<string[]> {
    if (!this.context) return [];
    
    const favorites = this.context.globalState.get<string[]>('favoriteOrgs', []);
    return favorites;
  }

  async loadOrgList(): Promise<void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Loading Org List",
        cancellable: false
      },
      async () => {
        return new Promise<void>((resolve, reject) => {
          cp.exec(
            "sf org list --json",
            async (error, stdout) => {
              if (error) {
                reject(new Error("Loading org list failed."));
                return;
              }
              try {
                const orgTree: OrgTree = JSON.parse(stdout.toString());
                const favorites = this.context ? await this.loadFavorites() : [];
                
                // Load Dev Hubs
                this.devHubs = [];
                if (orgTree.result.devHubs) {
                  for (const org of orgTree.result.devHubs) {
                    const orgInstance = new Org(
                      org.alias,
                      org.username,
                      org.connectedStatus,
                      "dev-hub",
                      this,
                      vscode.TreeItemCollapsibleState.None
                    );
                    orgInstance.isFavorite = favorites.includes(org.username);
                    orgInstance.label = orgInstance.displayName;
                    this.devHubs.push(orgInstance);
                  }
                }
                
                // Load Non Scratch Orgs (Sandboxes / Playgrounds) - exclude dev hubs
                this.nonScratchOrgs = [];
                for (const org of orgTree.result.nonScratchOrgs) {
                  // Skip if this org is already in dev hubs
                  const isDevHub = orgTree.result.devHubs.some(devHub => devHub.username === org.username);
                  if (isDevHub) {
                    continue;
                  }
                  
                  const orgInstance = new Org(
                    org.alias,
                    org.username,
                    org.connectedStatus,
                    "non-scratch",
                    this,
                    vscode.TreeItemCollapsibleState.None
                  );
                  orgInstance.isFavorite = favorites.includes(org.username);
                  orgInstance.label = orgInstance.displayName;
                  this.nonScratchOrgs.push(orgInstance);
                }
                
                // Load Scratch Orgs
                this.scratchOrgs = [];
                for (const org of orgTree.result.scratchOrgs) {
                  const orgInstance = new Org(
                    org.alias,
                    org.username,
                    org.connectedStatus,
                    "scratch",
                    this,
                    vscode.TreeItemCollapsibleState.None
                  );
                  orgInstance.isFavorite = favorites.includes(org.username);
                  orgInstance.label = orgInstance.displayName;
                  this.scratchOrgs.push(orgInstance);
                }
                resolve();
              } catch {
                reject(new Error("Failed to parse org list response."));
              }
            }
          );
        });
      }
    );
  }

  removeItem(org: Org): void {
    if (org.type === "dev-hub") {
      this.devHubs = this.devHubs.filter(
        (x) => x.username !== org.username
      );
    } else if (org.type === "non-scratch") {
      this.nonScratchOrgs = this.nonScratchOrgs.filter(
        (x) => x.username !== org.username
      );
    } else if (org.type === "scratch") {
      this.scratchOrgs = this.scratchOrgs.filter(
        (x) => x.username !== org.username
      );
    }
    this._onDidChangeTreeData.fire(undefined);
  }
}
