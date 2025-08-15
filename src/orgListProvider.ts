import * as vscode from "vscode";
import * as cp from "child_process";
import { Org } from "./org";

interface OrgTree {
  result: {
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

  private scratchOrgs: Array<Org> = [];
  private nonScratchOrgs: Array<Org> = [];

  constructor() {}

  async init(): Promise<void> {
    return this.loadOrgList();
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
      return element.label === "Scratch Orgs"
        ? this.scratchOrgs
        : this.nonScratchOrgs;
    } else {
      const treeItems: vscode.TreeItem[] = [];
      if (this.nonScratchOrgs && this.nonScratchOrgs.length > 0) {
        treeItems.push(
          new vscode.TreeItem(
            "Non Scratch Orgs",
            vscode.TreeItemCollapsibleState.Expanded
          )
        );
      }
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
            (error, stdout) => {
              if (error) {
                reject(new Error("Loading org list failed."));
                return;
              }
              try {
                const orgTree: OrgTree = JSON.parse(stdout.toString());
                this.nonScratchOrgs = [];
                for (const org of orgTree.result.nonScratchOrgs) {
                  this.nonScratchOrgs.push(
                    new Org(
                      org.alias,
                      org.username,
                      org.connectedStatus,
                      "non-scratch",
                      this,
                      vscode.TreeItemCollapsibleState.None
                    )
                  );
                }
                this.scratchOrgs = [];
                for (const org of orgTree.result.scratchOrgs) {
                  this.scratchOrgs.push(
                    new Org(
                      org.alias,
                      org.username,
                      org.connectedStatus,
                      "scratch",
                      this,
                      vscode.TreeItemCollapsibleState.None
                    )
                  );
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
    if (org.type === "non-scratch") {
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
