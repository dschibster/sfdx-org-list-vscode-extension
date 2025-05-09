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
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(alias, collapsibleState);
  }

  get tooltip(): string {
    return `Status: ${this.status}`;
  }

  get description(): string {
    return this.username;
  }

  get orgName(): string {
    return (this.alias != null) ? this.alias : this.username;
  }

  open() {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Opening ${this.orgName}.`,
        cancellable: false
      },
      () => {
        return new Promise((resolve, reject) => {
          cp.exec(
            "sf org open -o " + this.username,
            null,
            (error, stdout, stderr) => {
              if (error) {
                vscode.window.showErrorMessage(`Error opening ${this.orgName}.`);
                reject();
              }
              resolve();
            }
          );
        });
      }
    );
  }

  rename() {
    vscode.window.showInputBox().then(name => {
      if (name) {
        this.alias = name;
        this.label = name;
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Changing alias for ${this.username} to ${this.alias}.`,
            cancellable: false
          },
          () => {
            return new Promise((resolve, reject) => {
              cp.exec(
                `sf alias set ${this.alias}=${this.username}`,
                null,
                (error, stdout, stderr) => {
                  if (error) {
                    vscode.window.showErrorMessage(
                      `Error changing alias for ${this.username}.`
                    );
                    reject();
                  }
                  this.orgListProvider.reload();
                  resolve();
                }
              );
            });
          }
        );
      }
    });
  }

  logout() {
    vscode.window
      .showInformationMessage(
        `Are you sure you want to log out of ${this.orgName}?`,
        "Cancel",
        "Logout"
      )
      .then(selection => {
        if (selection === "Logout") {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Logging out ${this.orgName}.`,
              cancellable: false
            },
            () => {
              return new Promise((resolve, reject) => {
                cp.exec(
                  "sf org logout --no-prompt -o " + this.username,
                  null,
                  (error, stdout, stderr) => {
                    if (error) {
                      vscode.window.showErrorMessage(
                        `Error logging out of ${this.orgName}.`
                      );
                      reject();
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
      });
  }

  delete() {
    vscode.window
      .showInformationMessage(
        `Are you sure you want to delete ${this.orgName}?`,
        "Cancel",
        "Delete"
      )
      .then(selection => {
        if (selection === "Delete") {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Deleting ${this.orgName}.`,
              cancellable: false
            },
            () => {
              return new Promise((resolve, reject) => {
                cp.exec(
                  "sf org delete scratch --no-prompt -o " + this.username,
                  null,
                  (error, stdout, stderr) => {
                    if (error) {
                      vscode.window.showErrorMessage(
                        `Error deleting ${this.orgName}.`
                      );
                      reject();
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
      });
  }

  iconPath = {
    light: path.join(__filename, "..", "..", "media", "cloud.png"),
    dark: path.join(__filename, "..", "..", "media", "cloud.png")
  };

  get contextValue() {
    return this.type + "-org";
  }
}
