import * as vscode from "vscode";
import { OrgListProvider } from "./orgListProvider";
import { Org } from "./org";

export function activate(context: vscode.ExtensionContext): void {
  const orgListProvider = new OrgListProvider(context);
  
  // Register the tree data provider immediately so the view is available
  vscode.window.registerTreeDataProvider("org-list", orgListProvider);
  
  // Register commands immediately
  context.subscriptions.push(
    vscode.commands.registerCommand("org-list.reload", () =>
      orgListProvider.reload()
    ),
    vscode.commands.registerCommand("org-list.toggleShowHidden", () =>
      orgListProvider.toggleShowHiddenOrgs()
    ),
    vscode.commands.registerCommand("org.open", (org: Org) => org.open()),
    vscode.commands.registerCommand("org.default", (org: Org) => org.default()),
    vscode.commands.registerCommand("org.rename", (org: Org) => org.rename()),
    vscode.commands.registerCommand("org.logout", (org: Org) => org.logout()),
    vscode.commands.registerCommand("org.delete", (org: Org) => org.delete()),
    vscode.commands.registerCommand("org.toggleFavorite", (org: Org) => org.toggleFavorite()),
    vscode.commands.registerCommand("org.toggleHidden", (org: Org) => org.toggleHidden())
  );
  
  // Load the org list immediately when VS Code starts
  // Use setTimeout to ensure VS Code is fully initialized
  setTimeout(() => {
    orgListProvider.init().catch((error) => {
      vscode.window.showErrorMessage(`Failed to load org list: ${error.message}`);
    });
  }, 100);
}

export function deactivate(): void {
  // Cleanup code if needed
}
