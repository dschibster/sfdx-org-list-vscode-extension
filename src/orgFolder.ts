import * as vscode from "vscode";

export interface FolderData {
  id: string;
  name: string;
  orgUsernames: string[];
}

export class OrgFolder extends vscode.TreeItem {
  public orgUsernames: string[];

  constructor(
    public readonly folderId: string,
    public folderName: string,
    orgUsernames: string[] = []
  ) {
    super(folderName, vscode.TreeItemCollapsibleState.Expanded);
    this.orgUsernames = orgUsernames;
    this.contextValue = "org-folder";
    this.iconPath = new vscode.ThemeIcon("folder");
    this.updateTooltip();
  }

  updateTooltip(): void {
    this.tooltip = `${this.folderName} — ${this.orgUsernames.length} org(s)`;
  }

  toData(): FolderData {
    return {
      id: this.folderId,
      name: this.folderName,
      orgUsernames: this.orgUsernames,
    };
  }
}
