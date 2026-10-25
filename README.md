# Dev Live Reload

**Instant browser refresh for local web development.**

A lightweight Chrome extension and local file watcher that automatically reload matching browser tabs whenever your project files change. Configure your websites, exclude unwanted files, and monitor activity from a compact popup.

No npm. No build tools. No external services.

---

## Overview

| Feature | Description |
|---|---|
| Automatic Reload | Refresh matching browser tabs when files change. |
| Website Matching | Configure multiple local or remote development URLs. |
| Ignore Patterns | Exclude directories, logs, images, and other files. |
| Activity Monitor | Track reloads, ignored files, and watcher events. |
| Connection Status | Check whether the local watcher is online. |
| Master Switch | Disable reloading without losing your configuration. |
| Tab Indicators | Display an ON/OFF badge for each browser tab. |
| Persistent Settings | Store configuration locally using Chrome Storage. |
| Automatic Reconnection | Retry disconnected WebSocket connections every 2 seconds. |
| Lightweight Architecture | Use native browser APIs without a frontend build process. |

## How It Works

The extension communicates with a local file watcher over HTTP and WebSocket.

```text
┌───────────────────────────────┐
│       Local Web Project       │
│                               │
│ PHP · HTML · CSS · JS · Files │
└───────────────┬───────────────┘
                │
                │ File changes
                ▼
┌───────────────────────────────┐
│          File Watcher         │
│                               │
│ Detects changes               │
│ Applies ignore patterns       │
│ Records activity               │
└───────────────┬───────────────┘
                │
                │ WebSocket notification
                ▼
┌───────────────────────────────┐
│       Chrome Extension        │
│                               │
│ Background service worker     │
│ Content script                │
│ Configuration                 │
└───────────────┬───────────────┘
                │
                │ Matching website
                ▼
┌───────────────────────────────┐
│         Browser Tab           │
│                               │
│       location.reload()       │
└───────────────────────────────┘
