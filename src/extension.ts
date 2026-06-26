import * as vscode from "vscode";
import { OrgListProvider } from "./orgListProvider";
import { PinnedWebviewProvider } from "./pinnedWebviewProvider";
import { Org } from "./org";
import { OrgFolder } from "./orgFolder";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new OrgListProvider(context);
  const pinnedWebview = new PinnedWebviewProvider(provider);

  provider.setRefreshCallback(() => pinnedWebview.refresh());

  vscode.window.registerTreeDataProvider("org-list", provider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PinnedWebviewProvider.viewId, pinnedWebview)
  );

  context.subscriptions.push(
    // ── View toolbar ──────────────────────────────────────────────────────
    vscode.commands.registerCommand("org-list.reload", () => provider.reload()),
    vscode.commands.registerCommand("org-list.toggleShowHidden", () =>
      provider.toggleShowHiddenOrgs()
    ),
    vscode.commands.registerCommand("org-list.createFolder", () =>
      provider.createFolder()
    ),

    // ── Org actions ───────────────────────────────────────────────────────
    vscode.commands.registerCommand("org.open", (org: Org) => org.open()),
    vscode.commands.registerCommand("org.default", (org: Org) => org.default()),
    vscode.commands.registerCommand("org.rename", (org: Org) => org.rename()),
    vscode.commands.registerCommand("org.logout", (org: Org) => org.logout()),
    vscode.commands.registerCommand("org.delete", (org: Org) => org.delete()),
    vscode.commands.registerCommand("org.toggleHidden", (org: Org) =>
      org.toggleHidden()
    ),
    vscode.commands.registerCommand("org.togglePin", (org: Org) => org.togglePin()),
    vscode.commands.registerCommand("org.copyAuthUrl", (org: Org) =>
      org.copyAuthUrl()
    ),
    vscode.commands.registerCommand("org.copyLoginCommand", (org: Org) =>
      org.copyLoginCommand()
    ),
    vscode.commands.registerCommand("org.assignToFolder", (org: Org) =>
      provider.assignOrgToFolder(org)
    ),
    vscode.commands.registerCommand("org.removeFromFolder", (org: Org) =>
      provider.removeOrgFromFolder(org)
    ),

    // ── Folder actions ────────────────────────────────────────────────────
    vscode.commands.registerCommand("orgFolder.rename", (folder: OrgFolder) =>
      provider.renameFolder(folder)
    ),
    vscode.commands.registerCommand("orgFolder.delete", (folder: OrgFolder) =>
      provider.deleteFolder(folder)
    )
  );

  setTimeout(() => {
    provider.init().catch((error) => {
      vscode.window.showErrorMessage(`Failed to load org list: ${error.message}`);
    });
  }, 100);
}

export function deactivate(): void {
  // no-op
}
