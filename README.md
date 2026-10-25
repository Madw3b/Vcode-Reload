
PROJECT SUMMARY
- A Manifest V3 Chrome extension + a small VS Code file watcher.
- The watcher watches the web root and pushes a {type:"reload"} message over a local
  WebSocket (default ws://127.0.0.1:5500/ws) when a file changes.
- The extension's content script (reload.js) connects to that WebSocket on matching
  pages and calls location.reload().
- The popup has THREE tabs: 1) Activity, 2) Ignore List, 3) Connect Settings.
- Dark theme, thin scrollbars, compact 390px popup.
- No build step. No npm. Four small files + a popup folder.

FILES
chrome-extension/
├── manifest.json
├── background.js        (service worker: config in chrome.storage.local, POST /config,
│                         broadcasts config-updated to content scripts, per-tab badge ON/OFF)
├── reload.js            (content script: WebSocket, matches siteUrls, location.reload)
├── img/icon{16,32,48,128}.png
└── popup/
    ├── popup.html       (three tab panels)
    ├── popup.css        (dark theme, thin scrollbars)
    └── popup.js         (tabs, polling /status + /log every 1.5s, ignore list, settings)

WATCHER HTTP API (server runs on http://127.0.0.1:5500 by default)
- GET  /status    -> { name:"dev-live-reload", enabled:bool, clients:int }
- GET  /log       -> { entries:[{id,t,status,file,event,reason}] }
                     status is one of: reload | idle | ignored | info
- POST /config    -> body { ignore:string[] }
- POST /clear-log -> clears activity log
- WS   /ws        -> emits { type:"reload" }

DEFAULT CONFIG (storage key "dev-live-reload-config-v3")
{
  "isEnable": true,
  "siteUrls": "http://127.0.0.1",
  "serverUrl": "http://127.0.0.1:5500",
  "ignore": ["storage","log","logs","*.log","*.{png,jpg,jpeg,gif,svg,webp,ico}"]
}

PERMISSIONS
- storage
- host_permissions: http://*/* and https://*/*
(No tabs permission.)

IMPORTANT DETAILS TO MENTION
- Site URLs are comma/space separated; a bare host like http://127.0.0.1 matches any
  port and path on that host.
- Ignore list is pushed to the watcher (POST /config) so ignored files never reach the
  browser.
- Master enable switch in the header disables reloads without losing settings.
- Content script retries WebSocket every 2s; popup polls every 1.5s.
- MV3 CSP forbids inline scripts: all popup JS must live in popup.js and be loaded with
  <script src="popup.js"></script>. No eval, no inline onclick handlers.
- If watcher is offline the popup shows "Offline" and nothing crashes.

LICENSE
Proprietary — All Rights Reserved. Copying, redistribution, selling, sublicensing and
derivative works are NOT permitted without explicit written permission from the author.

README SECTIONS TO INCLUDE (in this order)
1. Title + one-line pitch (blockquote)
2. What it does (bullet list)
3. Architecture (ASCII diagram + one-liner per file)
4. Install (extension, then watcher, with the HTTP API table)
5. Usage (Connect Settings tab, Ignore List tab, Activity tab — small tables)
6. Project layout (tree)
7. Configuration defaults (JSON block)
8. Permissions (table)
9. Security & CSP notes
10. Troubleshooting (table: symptom -> fix)
11. Development (reload steps, debugging tips)
12. Roadmap (checkbox list)
13. License (Proprietary, all rights reserved, link to LICENSE)

TONE
- Concise, technical, developer-facing.
- Use tables and small code blocks generously.
- No marketing fluff, no emojis.
- Output ONLY the README.md content, wrapped in a single ```markdown fenced block.
