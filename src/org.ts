import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";
import { OrgListProvider } from "./orgListProvider";

export class Org extends vscode.TreeItem {
  constructor(
    public alias: string,
    public username: string,
    public status: string,
    public type: string,
    private orgListProvider: OrgListProvider,
    public override readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(alias == null ? username : alias, collapsibleState);
    
    // Set icon path using the new VS Code API pattern
    this.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, "..", "..", "media", "cloud.png")),
      dark: vscode.Uri.file(path.join(__dirname, "..", "..", "media", "cloud.png"))
    };
    
    // Set properties
    this.tooltip = `Status: ${this.status}`;
    this.description = this.username;
    this.contextValue = this.type + "-org";
  }

  get orgName(): string {
    return this.alias != null ? this.alias : this.username;
  }

  async open(): Promise<void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Opening ${this.orgName}.`,
        cancellable: false
      },
      async () => {
        return new Promise<void>((resolve, reject) => {
          cp.exec(
            "sf org open -o " + this.orgName,
            (error) => {
              if (error) {
                vscode.window.showErrorMessage(`Error opening ${this.orgName}.`);
                reject(error);
                return;
              }
              resolve();
            }
          );
        });
      }
    );
  }

  async rename(): Promise<void> {
    const name = await vscode.window.showInputBox();
    if (name) {
      this.alias = name;
      this.label = name;
      
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Changing alias for ${this.username} to ${this.alias}.`,
          cancellable: false
        },
        async () => {
          return new Promise<void>((resolve, reject) => {
            cp.exec(
              `sf alias set ${this.alias}=${this.username}`,
              (error) => {
                if (error) {
                  vscode.window.showErrorMessage(
                    `Error changing alias for ${this.username}.`
                  );
                  reject(error);
                  return;
                }
                this.orgListProvider.reload();
                resolve();
              }
            );
          });
        }
      );
    }
  }

  async default(): Promise<void> {
    const selection = await vscode.window.showInformationMessage(
      `Do you want to set ${this.orgName} as your default Org?`,
      "No",
      "Yes"
    );
    
    if (selection === "Yes") {
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Setting ${this.orgName} as default.`,
          cancellable: false
        },
        async () => {
          return new Promise<void>((resolve, reject) => {
            cp.exec(
              "sf config set target-org=" + this.orgName,
              (error) => {
                if (error) {
                  vscode.window.showErrorMessage(
                    `Error setting default to ${this.orgName}.`
                  );
                  reject(error);
                  return;
                }
                vscode.window.showInformationMessage(
                  `Set ${this.orgName} to default.`
                );
                resolve();
              }
            );
          });
        }
      );
    }
  }

  async logout(): Promise<void> {
    const selection = await vscode.window.showInformationMessage(
      `Are you sure you want to log out of ${this.orgName}?`,
      "Cancel",
      "Logout"
    );
    
    if (selection === "Logout") {
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Logging out ${this.orgName}.`,
          cancellable: false
        },
        async () => {
          return new Promise<void>((resolve, reject) => {
            cp.exec(
              "sf org logout --no-prompt -o " + this.orgName,
              (error) => {
                if (error) {
                  vscode.window.showErrorMessage(
                    `Error logging out of ${this.orgName}.`
                  );
                  reject(error);
                  return;
                }
                vscode.window.showInformationMessage(
                  `Logged out of ${this.orgName}.`
                );
                this.orgListProvider.removeItem(this);
                resolve();
              }
            );
          });
        }
      );
    }
  }

  async delete(): Promise<void> {
    const selection = await vscode.window.showInformationMessage(
      `Are you sure you want to delete ${this.orgName}?`,
      "Cancel",
      "Delete"
    );
    
    if (selection === "Delete") {
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Deleting ${this.orgName}.`,
          cancellable: false
        },
        async () => {
          return new Promise<void>((resolve, reject) => {
            cp.exec(
              "sf org delete scratch --no-prompt -o " + this.orgName,
              (error) => {
                if (error) {
                  vscode.window.showErrorMessage(
                    `Error deleting ${this.orgName}.`
                  );
                  reject(error);
                  return;
                }
                vscode.window.showInformationMessage(
                  `Deleted ${this.orgName}.`
                );
                this.orgListProvider.removeItem(this);
                resolve();
              }
            );
          });
        }
      );
    }
  }
}
