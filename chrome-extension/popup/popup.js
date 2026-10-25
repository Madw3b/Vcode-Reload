(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, (r) => res(r)));

  const PRESETS = [
    'storage', 'log', 'logs', 'cache', 'vendor', 'uploads',
    'node_modules', '.git', '*.log', '*.{png,jpg,jpeg,gif,svg,webp,ico}'
  ];
  const BADGES = { reload: 'RELOAD', idle: 'NO TAB', ignored: 'IGNORED', info: 'INFO' };

  let cfg = null;
  let online = false;
  let paused = false;
  let clients = 0;
  let entries = [];
  let filter = 'all';
  let renderedSig = '';

  /* ---------------- helpers ---------------- */

  function base() {
    let u = ((cfg && cfg.serverUrl) || '').trim() || 'http://127.0.0.1:5500';
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    return u.replace(/\/+$/, '');
  }

  async function api(pathname, opts = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1200);
    try {
      const r = await fetch(base() + pathname, { ...opts, signal: ctl.signal, cache: 'no-store' });
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function save() {
    cfg = await send({ req: 'set-config', data: cfg });
    renderIgnore();
    renderStatus();
  }

  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour12: false });

  /* ---------------- status ---------------- */

  function renderStatus() {
    let cls, text;
    if (!cfg.isEnable) { cls = 'disabled'; text = 'Disabled'; }
    else if (online && paused) { cls = 'paused'; text = 'Watcher paused'; }
    else if (online) { cls = 'online'; text = 'Online · ' + clients + (clients === 1 ? ' tab' : ' tabs'); }
    else { cls = 'offline'; text = 'Offline'; }
    $('dot').className = 'dot ' + cls;
    $('statusBar').className = 'statusbar ' + cls;
    $('statusText').textContent = text;
    $('statusHost').textContent = base().replace(/^https?:\/\//, '');
    $('footerHost').textContent = base().replace(/^https?:\/\//, '');
  }

  async function poll() {
    try {
      const s = await api('/status');
      if (!s || s.name !== 'dev-live-reload') throw new Error('not our watcher');
      online = true;
      paused = !s.enabled;
      clients = s.clients || 0;
      const l = await api('/log');
      entries = (l && l.entries) || [];
    } catch (e) {
      online = false;
      clients = 0;
    }
    renderStatus();
    renderLog();
  }

  /* ---------------- activity log ---------------- */

  function matchesFilter(e) {
    if (filter === 'all') return true;
    if (filter === 'reload') return e.status === 'reload' || e.status === 'idle';
    return e.status === filter;
  }

  function renderLog() {
    const last = entries.length ? entries[entries.length - 1].id : 0;
    const sig = [filter, online, entries.length, last].join('|');
    if (sig === renderedSig) return;
    renderedSig = sig;

    $('cntAll').textContent = entries.length;
    $('cntReload').textContent = entries.filter((e) => e.status === 'reload' || e.status === 'idle').length;
    $('cntIgnored').textContent = entries.filter((e) => e.status === 'ignored').length;

    const list = $('logList');
    const keep = list.scrollTop;
    list.textContent = '';

    const shown = entries.filter(matchesFilter).slice().reverse(); // newest first
    if (!shown.length) {
      const d = document.createElement('div');
      d.className = 'empty';
      d.textContent = online
        ? 'No activity yet. Save a file in your web root.'
        : 'Watcher is offline. Start VS Code with the watcher extension.';
      list.appendChild(d);
      return;
    }

    for (const en of shown) {
      const row = document.createElement('div');
      row.className = 'entry ' + en.status;

      const time = document.createElement('span');
      time.className = 'e-time';
      time.textContent = fmtTime(en.t);

      const badge = document.createElement('span');
      badge.className = 'e-badge';
      badge.textContent = BADGES[en.status] || en.status.toUpperCase();

      const main = document.createElement('div');
      if (en.file) {
        const f = document.createElement('div');
        f.className = 'e-file';
        f.textContent = en.file;
        f.title = en.file;
        main.appendChild(f);
      }
      const why = document.createElement('div');
      why.className = 'e-reason';
      why.textContent = (en.event ? en.event + ' · ' : '') + (en.reason || '');
      main.appendChild(why);

      row.append(time, badge, main);
      list.appendChild(row);
    }
    list.scrollTop = keep;
  }

  /* ---------------- ignore list ---------------- */

  function renderIgnore() {
    $('ignoreCount').textContent = cfg.ignore.length;

    const chips = $('chips');
    chips.textContent = '';
    if (!cfg.ignore.length) {
      const n = document.createElement('div');
      n.className = 'none';
      n.textContent = 'Nothing ignored yet.';
      chips.appendChild(n);
    }
    cfg.ignore.forEach((p, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      const t = document.createElement('span');
      t.textContent = p;
      const x = document.createElement('button');
      x.textContent = '×';
      x.title = 'Remove';
      x.addEventListener('click', async () => {
        cfg.ignore.splice(i, 1);
        await save();
      });
      chip.append(t, x);
      chips.appendChild(chip);
    });

    const presets = $('presets');
    presets.textContent = '';
    PRESETS.filter((p) => !cfg.ignore.includes(p)).forEach((p) => {
      const b = document.createElement('button');
      b.className = 'preset';
      b.textContent = '+ ' + p;
      b.addEventListener('click', () => addIgnore(p));
      presets.appendChild(b);
    });
  }

  async function addIgnore(value) {
    const v = String(value || '').trim();
    if (!v || cfg.ignore.includes(v)) return;
    cfg.ignore.push(v);
    $('ignoreInput').value = '';
    await save();
  }

  /* ---------------- tabs ---------------- */

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((b) =>
    b.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === b));
      const tab = b.dataset.tab;
      $('panel-activity').classList.toggle('hidden', tab !== 'activity');
      $('panel-ignore').classList.toggle('hidden', tab !== 'ignore');
      $('panel-connect').classList.toggle('hidden', tab !== 'connect');
    })
  );
}

  /* ---------------- init ---------------- */

  async function init() {
    cfg = await send({ req: 'get-config' });
    if (!cfg) cfg = { isEnable: true, siteUrls: '', serverUrl: '', ignore: [] };

    $('enable').checked = cfg.isEnable;
    $('siteUrls').value = cfg.siteUrls;
    $('serverUrl').value = cfg.serverUrl;

    $('enable').addEventListener('change', async () => {
      cfg.isEnable = $('enable').checked;
      await save();
    });

    const dirty = () => { $('saveBtn').disabled = false; };
    $('siteUrls').addEventListener('input', dirty);
    $('serverUrl').addEventListener('input', dirty);

    $('saveBtn').addEventListener('click', async () => {
      cfg.siteUrls = $('siteUrls').value.trim();
      cfg.serverUrl = $('serverUrl').value.trim();
      await save();
      $('saveBtn').disabled = true;
      const m = $('saveMsg');
      m.textContent = 'Saved ✓';
      m.classList.add('show');
      setTimeout(() => m.classList.remove('show'), 1600);
      poll();
    });

    $('resetBtn').addEventListener('click', async () => {
      cfg = await send({ req: 'reset-config' });
      $('enable').checked = cfg.isEnable;
      $('siteUrls').value = cfg.siteUrls;
      $('serverUrl').value = cfg.serverUrl;
      $('saveBtn').disabled = true;
      renderIgnore();
      renderStatus();
      poll();
    });

    document.querySelectorAll('.pill').forEach((b) =>
      b.addEventListener('click', () => {
        filter = b.dataset.filter;
        document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === b));
        renderedSig = '';
        renderLog();
      })
    );

    $('clearLog').addEventListener('click', async () => {
      try { await api('/clear-log', { method: 'POST', headers: { 'X-Reload-Client': '1' } }); } catch (e) {}
      entries = [];
      renderedSig = '';
      renderLog();
    });

    $('addIgnore').addEventListener('click', () => addIgnore($('ignoreInput').value));
    $('ignoreInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addIgnore($('ignoreInput').value);
    });

    // Buy Me a Coffee link — open via chrome.tabs for reliability in popups
    const bmcLink = $('bmcLink');
    if (bmcLink) {
      bmcLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://buymeacoffee.com/madgizmo' });
      });
    }

    setupTabs();

    renderIgnore();
    renderStatus();
    poll();
    setInterval(poll, 1500);
  }

  init();
})();