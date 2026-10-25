(function () {
  'use strict';

  let cfg = null;
  let socket = null;
  let retryTimer = null;

  function normUrl(u) {
    return String(u || '').trim().replace(/\/+$/, '').toLowerCase();
  }

  // Does the current page belong to one of the configured site URLs?
  // "http://127.0.0.1" also matches any port and path on that host.
  function matchesSite(c) {
    const here = location.href.toLowerCase();
    return String(c.siteUrls || '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .some((raw) => {
        const u = normUrl(raw);
        return (
          here === u ||
          here.startsWith(u + '/') ||
          here.startsWith(u + ':') ||
          here.startsWith(u + '?') ||
          here.startsWith(u + '#')
        );
      });
  }

  function wsAddress(c) {
    let u = String(c.serverUrl || '').trim() || 'http://127.0.0.1:5500';
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    return u.replace(/\/+$/, '').replace(/^http/i, 'ws') + '/ws';
  }

  function report(online, matched) {
    try {
      chrome.runtime.sendMessage({ req: 'ws-state', online, matched }).catch(() => {});
    } catch (e) { /* extension was reloaded; this page needs a refresh */ }
  }

  function disconnect() {
    clearTimeout(retryTimer);
    if (socket) {
      const s = socket;
      socket = null;
      try { s.close(); } catch (e) {}
    }
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 2000);
  }

  function connect() {
    disconnect();
    if (!cfg || !cfg.isEnable || !matchesSite(cfg)) {
      report(false, false);
      return;
    }
    let ws;
    try {
      ws = new WebSocket(wsAddress(cfg));
    } catch (e) {
      report(false, true);
      scheduleRetry();
      return;
    }
    socket = ws;
    ws.onopen = () => report(true, true);
    ws.onmessage = (ev) => {
      let m = {};
      try { m = JSON.parse(ev.data); } catch (e) { m = { type: String(ev.data) }; }
      if (m.type === 'reload' && cfg && cfg.isEnable) location.reload();
    };
    ws.onclose = () => {
      if (socket === ws) {
        socket = null;
        report(false, true);
        scheduleRetry(); // keeps trying, so the status turns ON as soon as the watcher starts
      }
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.req === 'config-updated') {
      cfg = msg.data;
      connect();
    }
  });

  chrome.runtime.sendMessage({ req: 'get-config' }, (c) => {
    if (chrome.runtime.lastError || !c) return;
    cfg = c;
    connect();
  });
})();
