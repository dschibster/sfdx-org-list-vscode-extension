import * as vscode from "vscode";
import { OrgListProvider } from "./orgListProvider";

export class PinnedWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "org-list-pinned";

  private _view?: vscode.WebviewView;

  constructor(private readonly orgListProvider: OrgListProvider) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const org = this.orgListProvider.findOrgByUsername(message.username);
      if (!org) return;

      switch (message.command) {
        case "open":
          await org.open();
          break;
        case "unpin":
          org.isPinned = false;
          await this.orgListProvider.savePinnedOrgs();
          this.orgListProvider.refresh();
          break;
        case "contextMenu":
          await this.orgListProvider.showPinnedOrgContextMenu(message.username);
          break;
      }
    });

    this.refresh();
  }

  refresh(): void {
    if (!this._view) return;
    this._view.webview.html = this.buildHtml(this.orgListProvider.getPinnedOrgs());
  }

  private buildHtml(
    orgs: Array<{ username: string; orgName: string; typeEmoji: string; status: string }>
  ): string {
    const nonce = randomNonce();
    const tilesJson = JSON.stringify(
      orgs.map((o) => ({
        username: o.username,
        name: o.orgName,
        emoji: o.typeEmoji,
        status: o.status,
      }))
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    padding: 6px;
    background: transparent;
    font-family: var(--vscode-font-family, sans-serif);
  }
  .wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--pill-accent);
    background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.06));
    color: var(--vscode-foreground);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: background 0.1s;
  }
  .pill:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .pill:active { opacity: 0.75; }
  .emoji { font-size: 13px; line-height: 1; }
  .name { line-height: 1.2; }
  .unpin {
    display: none;
    align-items: center;
    justify-content: center;
    margin-left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    border: none;
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
    padding: 0;
  }
  .pill:hover .unpin { display: inline-flex; }
  .unpin:hover { color: var(--vscode-foreground); }
  .empty {
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    font-style: italic;
    padding: 2px 0;
    line-height: 1.5;
  }
  .legend {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
  }
  .legend span { white-space: nowrap; }
</style>
</head>
<body>
<div class="wrap" id="wrap"></div>
<div class="legend">
  <span>⚙️ Dev Hub</span>
  <span>🧪 Sandbox</span>
  <span>⚡ Scratch</span>
</div>
<script nonce="${nonce}">
(function() {
  const vscode = acquireVsCodeApi();
  const ORGS = ${tilesJson};

  function statusColor(s) {
    switch ((s || '').toLowerCase()) {
      case 'connected':              return 'var(--vscode-testing-iconPassed, #3fb950)';
      case 'disconnected':
      case 'refreshtokenaautherror': return 'var(--vscode-testing-iconFailed, #f85149)';
      case 'expired':                return 'var(--vscode-testing-iconQueued, #d29922)';
      default:                       return 'var(--vscode-disabledForeground, #8b949e)';
    }
  }

  const wrap = document.getElementById('wrap');

  if (ORGS.length === 0) {
    wrap.innerHTML = '<span class="empty">No pinned orgs — right-click any org to pin it.</span>';
    return;
  }

  ORGS.forEach(function(org) {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.title = org.username + '  •  ' + org.status;
    pill.style.setProperty('--pill-accent', statusColor(org.status));

    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = org.emoji;

    const nameEl = document.createElement('span');
    nameEl.className = 'name';
    nameEl.textContent = org.name;

    const unpinBtn = document.createElement('button');
    unpinBtn.className = 'unpin';
    unpinBtn.title = 'Unpin';
    unpinBtn.textContent = '✕';
    unpinBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      vscode.postMessage({ command: 'unpin', username: org.username });
    });

    pill.appendChild(emoji);
    pill.appendChild(nameEl);
    pill.appendChild(unpinBtn);

    pill.addEventListener('click', function() {
      vscode.postMessage({ command: 'open', username: org.username });
    });

    pill.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      vscode.postMessage({ command: 'contextMenu', username: org.username });
    });

    wrap.appendChild(pill);
  });
})();
</script>
</body>
</html>`;
  }
}

function randomNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}
