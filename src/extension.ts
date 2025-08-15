import * as vscode from "vscode";
import { OrgListProvider } from "./orgListProvider";
import { Org } from "./org";

export function activate(context: vscode.ExtensionContext): void {
  const orgListProvider = new OrgListProvider();
  
  orgListProvider.init().then(() => {
    vscode.window.registerTreeDataProvider("org-list", orgListProvider);
    
    context.subscriptions.push(
      vscode.commands.registerCommand("org-list.reload", () =>
        orgListProvider.reload()
      ),
      vscode.commands.registerCommand("org.open", (org: Org) => org.open()),
      vscode.commands.registerCommand("org.default", (org: Org) => org.default()),
      vscode.commands.registerCommand("org.rename", (org: Org) => org.rename()),
      vscode.commands.registerCommand("org.logout", (org: Org) => org.logout()),
      vscode.commands.registerCommand("org.delete", (org: Org) => org.delete())
    );
  });
}

export function deactivate(): void {
  // Cleanup code if needed
}
