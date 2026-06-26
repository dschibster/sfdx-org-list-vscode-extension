# Salesforce Org List

Displays a list of authenticated Salesforce orgs for quick login access and management.
Runs on `sf` CLI commands.

![Extension Screenshot](/media/preview.jpg)

## Features

### Pinned Orgs
Pin any org for instant access. Pinned orgs appear as clickable pill buttons at the top of the sidebar. Right-click a pill to access the full context menu, or hover and click ✕ to unpin.

### Org Folders
Create named folders to group orgs by project or client. Orgs not assigned to a folder appear in the **Ungrouped** bucket. Right-click a folder to rename or delete it.

### Color-Coded Status Icons
Each org displays a cloud icon colored by its connection status:
- 🟢 Connected
- 🔴 Disconnected / Auth error
- 🟡 Expired
- ⚫ Unknown

### Type Emojis
Org type is indicated directly in the label:
- ⚙️ Dev Hub
- 🧪 Sandbox / Playground
- ⚡ Scratch Org

Within folders and Ungrouped, orgs sort automatically: Dev Hubs → Sandboxes → Scratch Orgs, then alphabetically.

### Actions
Right-click any org for:
- **Open** — launch the org in a browser
- **Set Default** — set as the default target org
- **Change Alias** — rename the org alias via the SF CLI
- **Pin / Unpin** — add or remove from the pinned bar
- **Move to Folder** — assign to a named folder
- **Remove from Folder** — move back to Ungrouped
- **Hide / Show** — hide noisy orgs; reveal them again with the toolbar toggle
- **Copy Auth URL** — copies the SFDX auth URL to the clipboard
- **Copy Login Command** — copies `echo "…" | sf org login sfdx-url -a [alias] --sfdx-url-stdin` to the clipboard
- **Logout** (non-scratch) / **Delete** (scratch)

## Requirements

- VS Code 1.99.0 or higher
- Salesforce CLI (`sf`) installed and authenticated
