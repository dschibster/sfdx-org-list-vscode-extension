import * as vscode from "vscode";
import * as cp from "child_process";
import { OrgListProvider } from "./orgListProvider";

const TYPE_EMOJI: Record<string, string> = {
  "dev-hub": "⚙️",
  "non-scratch": "🧪",
  "scratch": "⚡",
};

function statusIcon(status: string): vscode.ThemeIcon {
  switch ((status ?? "").toLowerCase()) {
    case "connected":
      return new vscode.ThemeIcon("cloud", new vscode.ThemeColor("testing.iconPassed"));
    case "disconnected":
    case "refreshtokenaautherror":
      return new vscode.ThemeIcon("cloud", new vscode.ThemeColor("testing.iconFailed"));
    case "expired":
      return new vscode.ThemeIcon("cloud", new vscode.ThemeColor("testing.iconQueued"));
    default:
      return new vscode.ThemeIcon("cloud", new vscode.ThemeColor("disabledForeground"));
  }
}

export class Org extends vscode.TreeItem {
  public isHidden: boolean = false;
  public isPinned: boolean = false;

  constructor(
    public alias: string,
    public username: string,
    public status: string,
    public type: string,
    private orgListProvider: OrgListProvider,
    public override readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(alias == null ? username : alias, collapsibleState);
    this.iconPath = statusIcon(status);
    this.tooltip = new vscode.MarkdownString(
      `**${alias ?? username}**\n\n${username}\n\nStatus: ${status}`
    );
    this.description = this.username;
    this.contextValue = this.type + "-org";
  }

  get orgName(): string {
    return this.alias != null ? this.alias : this.username;
  }

  get typeEmoji(): string {
    return TYPE_EMOJI[this.type] ?? "";
  }

  get displayName(): string {
    return `${this.typeEmoji} ${this.orgName}`;
  }

  async toggleHidden(): Promise<void> {
    this.isHidden = !this.isHidden;
    await this.orgListProvider.saveHiddenOrgs();
    this.orgListProvider.refresh();
    const action = this.isHidden ? "hidden" : "shown";
    vscode.window.showInformationMessage(`${this.orgName} is now ${action}.`);
  }

  async togglePin(): Promise<void> {
    this.isPinned = !this.isPinned;
    await this.orgListProvider.savePinnedOrgs();
    this.orgListProvider.refresh();
    const action = this.isPinned ? "pinned" : "unpinned";
    vscode.window.showInformationMessage(`${this.orgName} ${action}.`);
  }

  async open(): Promise<void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Opening ${this.orgName}.`,
        cancellable: false,
      },
      async () => {
        return new Promise<void>((resolve, reject) => {
          cp.exec("sf org open -o " + this.orgName, (error) => {
            if (error) {
              vscode.window.showErrorMessage(`Error opening ${this.orgName}.`);
              reject(error);
              return;
            }
            resolve();
          });
        });
      }
    );
  }

  async rename(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: "Enter new alias",
      value: this.alias,
    });
    if (name) {
      this.alias = name;
      this.label = this.displayName;
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Changing alias for ${this.username} to ${this.alias}.`,
          cancellable: false,
        },
        async () => {
          return new Promise<void>((resolve, reject) => {
            cp.exec(`sf alias set ${this.alias}=${this.username}`, (error) => {
              if (error) {
                vscode.window.showErrorMessage(
                  `Error changing alias for ${this.username}.`
                );
                reject(error);
                return;
              }
              this.orgListProvider.reload();
              resolve();
            });
          });
        }
      );
    }
  }

  async default(): Promise<void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Setting ${this.orgName} as default.`,
        cancellable: false,
      },
      async () => {
        return new Promise<void>((resolve, reject) => {
          cp.exec("sf config set target-org=" + this.orgName, (error) => {
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
          });
        });
      }
    );
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
          cancellable: false,
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

  private async fetchAuthUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      cp.exec(
        `sf org display --verbose --json -o ${this.orgName}`,
        (error, stdout) => {
          if (error) {
            reject(new Error(`Failed to retrieve org info for ${this.orgName}.`));
            return;
          }
          try {
            const result = JSON.parse(stdout);
            const url: string | undefined = result?.result?.sfdxAuthUrl;
            if (!url) {
              reject(new Error(`No SFDX auth URL found for ${this.orgName}. The org may need to be reconnected.`));
            } else {
              resolve(url);
            }
          } catch {
            reject(new Error("Failed to parse org display response."));
          }
        }
      );
    });
  }

  async copyAuthUrl(): Promise<void> {
    try {
      const url = await this.fetchAuthUrl();
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage(`Auth URL for ${this.orgName} copied to clipboard.`);
    } catch (e: unknown) {
      vscode.window.showErrorMessage(e instanceof Error ? e.message : `Failed to get auth URL for ${this.orgName}.`);
    }
  }

  async copyLoginCommand(): Promise<void> {
    try {
      const url = await this.fetchAuthUrl();
      const cmd = `echo "${url}" | sf org login sfdx-url -a ${this.orgName} --sfdx-url-stdin`;
      await vscode.env.clipboard.writeText(cmd);
      vscode.window.showInformationMessage(`Login command for ${this.orgName} copied to clipboard.`);
    } catch (e: unknown) {
      vscode.window.showErrorMessage(e instanceof Error ? e.message : `Failed to get login command for ${this.orgName}.`);
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
          cancellable: false,
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
