'use strict';

const KEY = 'dev-live-reload-config-v3';

const DEFAULTS = {
  isEnable: true,
  siteUrls: 'http://127.0.0.1',          // pages that get reloaded (comma separated)
  serverUrl: 'http://127.0.0.1:5500',    // the VS Code watcher
  ignore: ['storage', 'log', 'logs', '*.log', '*.{png,jpg,jpeg,gif,svg,webp,ico}']
};

async function getConfig() {
  const r = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(r[KEY] || {}) };
}

async function setConfig(data) {
  const c = { ...DEFAULTS, ...(data || {}) };
  c.ignore = [...new Set((c.ignore || []).map((s) => String(s).trim()).filter(Boolean))];
  await chrome.storage.local.set({ [KEY]: c });
  return c;
}

function serverBase(c) {
  let u = (c.serverUrl || '').trim() || DEFAULTS.serverUrl;
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
  return u.replace(/\/+$/, '');
}

// Sends the ignore list to the VS Code watcher (it applies it to file events).
async function pushConfig(c) {
  try {
    await fetch(serverBase(c) + '/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Reload-Client': '1' },
      body: JSON.stringify({ ignore: c.ignore })
    });
  } catch (e) { /* watcher offline */ }
}

async function notifyTabs(c) {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    chrome.tabs.sendMessage(t.id, { req: 'config-updated', data: c }).catch(() => {});
  }
}

function setBadge(tabId, state) {
  if (tabId == null) return;
  if (!state.matched) {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    return;
  }
  chrome.action.setBadgeText({ tabId, text: state.online ? 'ON' : 'OFF' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: state.online ? '#16a34a' : '#dc2626' }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  getConfig().then(setConfig);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  switch (msg.req) {
    case 'get-config':
      getConfig().then(sendResponse);
      return true;

    case 'set-config':
      setConfig(msg.data).then((c) => {
        notifyTabs(c);
        pushConfig(c);
        sendResponse(c);
      });
      return true;

    case 'reset-config':
      setConfig(DEFAULTS).then((c) => {
        notifyTabs(c);
        pushConfig(c);
        sendResponse(c);
      });
      return true;

    case 'ws-state':
      setBadge(sender.tab && sender.tab.id, msg);
      if (msg.online) getConfig().then(pushConfig); // watcher (re)started -> resync ignore list
      break;
  }
});
