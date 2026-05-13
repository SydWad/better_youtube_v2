// UI/options.js — all advanced settings.
// Depends on ../list_manager.js loaded first.

var togglePW         = document.getElementById('toggle-pw');
var sliderPW         = document.getElementById('slider-pw');
var sliderPct        = document.getElementById('slider-pct');
var toggleRWH        = document.getElementById('toggle-rwh');
var toggleDev        = document.getElementById('toggle-dev');
var toggleDebug      = document.getElementById('toggle-debug');
var btnWLState       = document.getElementById('btn-wl-state');
var devExtras        = document.getElementById('dev-extras');
var devVideoWrap     = document.getElementById('dev-video-wrap');
var devVideo         = document.getElementById('dev-video');
var expandBtn        = document.getElementById('expand-watch-list');
var expandArrow      = document.getElementById('expand-arrow');
var watchListPanel   = document.getElementById('watch-list-panel');
var watchListInner   = document.getElementById('watch-list-inner');
var optThemeBtn      = document.getElementById('opt-theme-btn');

var THEME_CYCLE = ['auto', 'light', 'dark'];
var THEME_TEXT  = { auto: 'AUTO', light: 'LIGHT', dark: 'DARK' };

var PAGE_DEFS = [
  { key: 'home',    label: 'Home Page',       filterKey: 'filter_home',    defaultState: 'on'  },
  { key: 'subs',    label: 'Subscriptions',   filterKey: 'filter_subs',    defaultState: 'on'  },
  { key: 'sidebar', label: 'Video Sidebars',  filterKey: 'filter_sidebar', defaultState: 'on'  },
  { key: 'channel', label: 'Channel Pages',   filterKey: 'filter_channel', defaultState: 'off' },
  { key: 'search',  label: 'Search Results',  filterKey: 'filter_search',  defaultState: 'off' }
];

var OPT_STATE_CYCLE = ['off', 'on', 'advanced'];
var OPT_STATE_TEXT  = { off: 'OFF', on: 'ON', advanced: 'ADV' };
var OPT_STATE_LABEL = { off: 'OFF', on: 'ON', advanced: 'ADVANCED' };

var listLoaded   = false;
var panelOpen    = false;
var _saving      = false;
var _savingTimer = null;
var _toastTimers = {};

// ─── Inline toast ─────────────────────────────────────────────────────────────

function showInlineToast(id, text) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(_toastTimers[id]);
  _toastTimers[id] = setTimeout(function() { el.classList.remove('visible'); }, 2000);
}

function bindOptToggle(el, toastId) {
  el.addEventListener('change', function() {
    showInlineToast(toastId, el.checked ? 'ON' : 'OFF');
    saveSettings();
  });
}

// ─── Filter state btn helpers ─────────────────────────────────────────────────

function applyFilterBtnState(btn, state) {
  btn.dataset.state = state;
  btn.textContent   = OPT_STATE_TEXT[state];
}

// ─── Dev video ────────────────────────────────────────────────────────────────

function isDesktop() { return window.innerWidth >= 1000 && !navigator.maxTouchPoints; }

function updateDevVideo(enabled) {
  if (!isDesktop()) { devVideoWrap.classList.remove('visible'); devVideo.pause(); return; }
  if (enabled) { devVideoWrap.classList.add('visible'); devVideo.play(); }
  else { devVideoWrap.classList.remove('visible'); devVideo.pause(); }
}

document.addEventListener('visibilitychange', function() {
  if (!devVideoWrap.classList.contains('visible')) return;
  if (document.hidden) devVideo.pause(); else devVideo.play();
});

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  if (optThemeBtn) {
    optThemeBtn.textContent = THEME_TEXT[theme] || 'AUTO';
    optThemeBtn.dataset.theme = theme || 'auto';
  }
}

optThemeBtn.addEventListener('click', function() {
  var current = optThemeBtn.dataset.theme || 'auto';
  var idx  = THEME_CYCLE.indexOf(current);
  var next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  applyTheme(next);
  chrome.storage.local.get([YT_HIDER_SETTINGS_KEY], function(result) {
    var s = result[YT_HIDER_SETTINGS_KEY] || {};
    s.theme = next;
    chrome.storage.local.set({ [YT_HIDER_SETTINGS_KEY]: s });
  });
});

// ─── Duration helpers (for per-page length inputs) ────────────────────────────

function formatDuration(val) {
  var raw = val.replace(/[^0-9]/g, '').replace(/^0+/, '') || '';
  if (!raw) return '';
  if (raw.length > 4) raw = raw.slice(-4);
  if (raw.length === 1) return '0:0' + raw;
  if (raw.length === 2) return '0:' + raw;
  if (raw.length === 3) return raw[0] + ':' + raw.slice(1);
  return raw.slice(0, 2) + ':' + raw.slice(2);
}

function parseViewCountInput(val) {
  if (!val || !val.trim()) return 0;
  var n = parseInt(val.replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function formatViewCount(n) {
  if (!n) return '';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─── Build per-page filter panels ─────────────────────────────────────────────

function copyPagePanel(fromKey, toKey) {
  var fromPfx = 'pg-' + fromKey + '-';
  var toPfx   = 'pg-' + toKey   + '-';
  ['hide-shorts','hide-playlists','hide-members','hide-live',
   'hide-autodub','hide-upcoming','hide-watched','blacklist-enabled'].forEach(function(f) {
    var src = document.getElementById(fromPfx + f);
    var dst = document.getElementById(toPfx   + f);
    if (src && dst) dst.checked = src.checked;
  });
  ['blacklist-words','length-min','length-max','view-count'].forEach(function(f) {
    var src = document.getElementById(fromPfx + f);
    var dst = document.getElementById(toPfx   + f);
    if (src && dst) dst.value = src.value;
  });
}

function buildPagePanel(key) {
  var p = 'pg-' + key + '-';
  var frag = document.createDocumentFragment();

  function makeSection(text) {
    var el = document.createElement('div');
    el.className = 'panel-section-label';
    el.textContent = text;
    return el;
  }

  function makeToggleRow(id, label) {
    var row = document.createElement('div');
    row.className = 'panel-toggle-row';
    var lbl = document.createElement('span');
    lbl.className = 'panel-toggle-label';
    lbl.textContent = label;
    var wrap = document.createElement('div');
    wrap.className = 'state-wrap';
    var toast = document.createElement('span');
    toast.className = 'state-toast';
    toast.id = 'toast-' + id;
    var toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle';
    var inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.id = id;
    var track = document.createElement('div');
    track.className = 'toggle-track';
    toggleLabel.appendChild(inp);
    toggleLabel.appendChild(track);
    wrap.appendChild(toast);
    wrap.appendChild(toggleLabel);
    row.appendChild(lbl);
    row.appendChild(wrap);
    return row;
  }

  var copyWrap = document.createElement('div');
  copyWrap.className = 'panel-copy-wrap';
  var copyBtn = document.createElement('button');
  copyBtn.className = 'panel-copy-btn';
  copyBtn.id = 'copy-btn-' + key;
  copyBtn.textContent = 'Copy Values:';
  var copyMenu = document.createElement('div');
  copyMenu.className = 'panel-copy-menu';
  copyMenu.id = 'copy-menu-' + key;
  PAGE_DEFS.forEach(function(d) {
    if (d.key === key) return;
    var opt = document.createElement('button');
    opt.className = 'panel-copy-option';
    opt.dataset.from = d.key;
    opt.textContent = d.label;
    copyMenu.appendChild(opt);
  });
  copyWrap.appendChild(copyBtn);
  copyWrap.appendChild(copyMenu);
  frag.appendChild(copyWrap);

  frag.appendChild(makeSection('Hide'));
  frag.appendChild(makeToggleRow(p + 'hide-shorts',       'Shorts'));
  frag.appendChild(makeToggleRow(p + 'hide-playlists',    'Playlists'));
  frag.appendChild(makeToggleRow(p + 'hide-members',      'Members Only'));
  frag.appendChild(makeToggleRow(p + 'hide-live',         'Live Streams'));
  frag.appendChild(makeToggleRow(p + 'hide-autodub',      'Auto-Dubbed'));
  frag.appendChild(makeToggleRow(p + 'hide-upcoming',     'Upcoming / Scheduled'));
  frag.appendChild(makeToggleRow(p + 'hide-watched',      'Watched Videos'));

  frag.appendChild(makeSection('Word Blacklist'));
  frag.appendChild(makeToggleRow(p + 'blacklist-enabled', 'Enable Blacklist'));
  var taRow = document.createElement('div');
  taRow.className = 'panel-textarea-row';
  var ta = document.createElement('textarea');
  ta.id = p + 'blacklist-words';
  ta.placeholder = 'Words, comma separated';
  ta.className = 'panel-textarea';
  taRow.appendChild(ta);
  frag.appendChild(taRow);

  frag.appendChild(makeSection('Filter by Length (H:MM)'));
  var lenRow = document.createElement('div');
  lenRow.className = 'panel-inputs-row';
  var lenMin = document.createElement('input');
  lenMin.className = 'text-input';
  lenMin.id = p + 'length-min';
  lenMin.type = 'text';
  lenMin.placeholder = '∞';
  lenMin.maxLength = 5;
  var dash = document.createElement('span');
  dash.className = 'input-dash';
  dash.textContent = '—';
  var lenMax = document.createElement('input');
  lenMax.className = 'text-input';
  lenMax.id = p + 'length-max';
  lenMax.type = 'text';
  lenMax.placeholder = '∞';
  lenMax.maxLength = 5;
  lenRow.appendChild(lenMin);
  lenRow.appendChild(dash);
  lenRow.appendChild(lenMax);
  frag.appendChild(lenRow);

  frag.appendChild(makeSection('Minimum View Count'));
  var vcRow = document.createElement('div');
  vcRow.className = 'panel-inputs-row';
  var vcInput = document.createElement('input');
  vcInput.className = 'text-input wide';
  vcInput.id = p + 'view-count';
  vcInput.type = 'text';
  vcInput.placeholder = '';
  vcInput.maxLength = 15;
  var vcHint = document.createElement('span');
  vcHint.className = 'input-hint';
  vcHint.textContent = 'views';
  vcRow.appendChild(vcInput);
  vcRow.appendChild(vcHint);
  frag.appendChild(vcRow);

  return frag;
}

function wirePagePanel(key) {
  var p = 'pg-' + key + '-';

  // Copy Values button
  var copyBtn  = document.getElementById('copy-btn-'  + key);
  var copyMenu = document.getElementById('copy-menu-' + key);
  if (copyBtn && copyMenu) {
    copyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      copyMenu.style.display = copyMenu.style.display === 'block' ? 'none' : 'block';
    });
    copyMenu.querySelectorAll('.panel-copy-option').forEach(function(opt) {
      opt.addEventListener('click', function() {
        copyMenu.style.display = 'none';
        copyPagePanel(opt.dataset.from, key);
        autoAdvance();
        saveSettings();
      });
    });
  }

  function autoAdvance() {
    var btn = document.getElementById('opt-btn-filter-' + key);
    if (btn && btn.dataset.state === 'on') applyFilterBtnState(btn, 'advanced');
  }

  ['hide-shorts', 'hide-playlists', 'hide-members', 'hide-live', 'hide-autodub', 'hide-upcoming', 'hide-watched', 'blacklist-enabled'].forEach(function(f) {
    var el = document.getElementById(p + f);
    if (!el) return;
    el.addEventListener('change', function() {
      showInlineToast('toast-' + p + f, el.checked ? 'ON' : 'OFF');
      autoAdvance();
      saveSettings();
    });
  });

  var bw = document.getElementById(p + 'blacklist-words');
  if (bw) {
    var bwTimer = null;
    bw.addEventListener('input', function() {
      clearTimeout(bwTimer);
      bwTimer = setTimeout(function() { autoAdvance(); saveSettings(); }, 600);
    });
  }

  ['length-min', 'length-max'].forEach(function(f) {
    var el = document.getElementById(p + f);
    if (!el) return;
    el.addEventListener('blur', function() { el.value = formatDuration(el.value); autoAdvance(); saveSettings(); });
    el.addEventListener('keydown', function(e) { if (e.key === 'Enter') { el.value = formatDuration(el.value); el.blur(); } });
  });

  var vc = document.getElementById(p + 'view-count');
  if (vc) {
    vc.addEventListener('blur', function() {
      var n = parseViewCountInput(vc.value);
      vc.value = n > 0 ? formatViewCount(n) : '';
      autoAdvance();
      saveSettings();
    });
    vc.addEventListener('keydown', function(e) { if (e.key === 'Enter') vc.blur(); });
  }
}

function buildFilterSection() {
  var container = document.getElementById('filter-section-body');

  // Close all copy menus when clicking outside any panel-copy-wrap
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.panel-copy-wrap')) {
      PAGE_DEFS.forEach(function(d) {
        var m = document.getElementById('copy-menu-' + d.key);
        if (m) m.style.display = 'none';
      });
    }
  });

  PAGE_DEFS.forEach(function(def) {
    var key = def.key;

    // Header row
    var row = document.createElement('div');
    row.className = 'filter-page-row';

    var expandBtnEl = document.createElement('button');
    expandBtnEl.className = 'filter-expand-btn';
    expandBtnEl.id = 'fexp-' + key;
    expandBtnEl.setAttribute('aria-label', 'Expand');
    expandBtnEl.textContent = '▶';
    row.appendChild(expandBtnEl);

    var filterLabel = document.createElement('span');
    filterLabel.className = 'filter-label';
    filterLabel.textContent = def.label;
    row.appendChild(filterLabel);

    var stateWrap = document.createElement('div');
    stateWrap.className = 'state-wrap';
    var toastSpan = document.createElement('span');
    toastSpan.className = 'state-toast';
    toastSpan.id = 'opt-toast-filter-' + key;
    stateWrap.appendChild(toastSpan);
    var stateBtn = document.createElement('button');
    stateBtn.className = 'state-btn';
    stateBtn.id = 'opt-btn-filter-' + key;
    stateBtn.dataset.state = def.defaultState;
    stateBtn.textContent = OPT_STATE_TEXT[def.defaultState];
    stateWrap.appendChild(stateBtn);
    row.appendChild(stateWrap);

    container.appendChild(row);

    // Settings panel
    var panel = document.createElement('div');
    panel.className = 'filter-page-panel';
    panel.id = 'fpanel-' + key;
    panel.style.display = 'none';
    panel.appendChild(buildPagePanel(key));
    container.appendChild(panel);

    // Entire row (except state-btn) toggles expand; only one panel open at a time
    row.addEventListener('click', function(e) {
      if (e.target.closest('.state-btn')) return;
      var open = panel.style.display !== 'none';
      if (!open) {
        PAGE_DEFS.forEach(function(d) {
          if (d.key === key) return;
          var op = document.getElementById('fpanel-' + d.key);
          var ob = document.getElementById('fexp-'   + d.key);
          if (op) op.style.display = 'none';
          if (ob) ob.textContent = '▶';
        });
      }
      panel.style.display = open ? 'none' : 'block';
      expandBtnEl.textContent = open ? '▶' : '▼';
    });

    // State btn click
    stateBtn.addEventListener('click', function() {
      var idx  = OPT_STATE_CYCLE.indexOf(stateBtn.dataset.state);
      var next = OPT_STATE_CYCLE[(idx + 1) % OPT_STATE_CYCLE.length];
      applyFilterBtnState(stateBtn, next);
      showInlineToast('opt-toast-filter-' + key, OPT_STATE_LABEL[next]);
      saveSettings();
    });

    wirePagePanel(key);
  });
}

// ─── Load / Save settings ─────────────────────────────────────────────────────

function loadSettings() {
  chrome.storage.local.get([YT_HIDER_SETTINGS_KEY], function(result) {
    var s = result[YT_HIDER_SETTINGS_KEY] || {};
    applyTheme(s.theme || 'auto');

    togglePW.checked         = !!s.pw_enabled;
    sliderPW.value           = typeof s.pw_threshold === 'number' ? s.pw_threshold : 50;
    sliderPct.textContent    = sliderPW.value + '%';
    toggleRWH.checked        = s.rwh_enabled !== false;
    toggleDev.checked        = !!s.dev_tools_enabled;
    toggleDebug.checked      = !!s.debug_enabled;
    devExtras.style.display  = s.dev_tools_enabled ? 'block' : 'none';
    updateDevVideo(!!s.dev_tools_enabled);

    // Watch List System button
    btnWLState.dataset.state = s.wl_disabled ? 'disabled' : 'enabled';
    btnWLState.textContent   = s.wl_disabled ? 'DISABLED' : 'ENABLED';

    // Per-page filter states + per-page settings
    var ps = s.page_settings || {};
    PAGE_DEFS.forEach(function(def) {
      var key = def.key;
      var stateBtn = document.getElementById('opt-btn-filter-' + key);
      if (stateBtn) {
        var raw = s[def.filterKey];
        var state = (raw === 'on' || raw === 'advanced' || raw === 'off')
          ? raw : (raw === false ? 'off' : def.defaultState);
        applyFilterBtnState(stateBtn, state);
      }

      var pagePs = ps[key] || {};
      var pfx = 'pg-' + key + '-';
      [
        [pfx + 'hide-shorts',       pagePs.hide_shorts],
        [pfx + 'hide-playlists',    pagePs.hide_playlists],
        [pfx + 'hide-members',      pagePs.hide_members],
        [pfx + 'hide-live',         pagePs.hide_live],
        [pfx + 'hide-autodub',      pagePs.hide_autodub],
        [pfx + 'hide-upcoming',     pagePs.hide_upcoming],
        [pfx + 'hide-watched',      pagePs.hide_watched],
        [pfx + 'blacklist-enabled', pagePs.blacklist_enabled]
      ].forEach(function(pair) {
        var el = document.getElementById(pair[0]);
        if (el) el.checked = !!pair[1];
      });

      var bw = document.getElementById(pfx + 'blacklist-words');
      if (bw) bw.value = pagePs.blacklist_words || '';
      var lmin = document.getElementById(pfx + 'length-min');
      if (lmin) lmin.value = pagePs.length_min || '';
      var lmax = document.getElementById(pfx + 'length-max');
      if (lmax) lmax.value = pagePs.length_max || '';
      var vc = document.getElementById(pfx + 'view-count');
      if (vc) vc.value = pagePs.view_count_min ? formatViewCount(pagePs.view_count_min) : '';
    });
  });
}

function saveSettings() {
  _saving = true;
  clearTimeout(_savingTimer);
  _savingTimer = setTimeout(function() { _saving = false; }, 1000);
  chrome.storage.local.get([YT_HIDER_SETTINGS_KEY], function(result) {
    var s = result[YT_HIDER_SETTINGS_KEY] || {};

    s.pw_enabled        = togglePW.checked;
    s.pw_threshold      = parseInt(sliderPW.value);
    s.rwh_enabled       = toggleRWH.checked;
    s.dev_tools_enabled = toggleDev.checked;
    s.debug_enabled     = toggleDebug.checked;
    s.wl_disabled       = btnWLState.dataset.state === 'disabled';

    // Per-page filter states + settings
    var ps = s.page_settings || {};
    PAGE_DEFS.forEach(function(def) {
      var key = def.key;
      var stateBtn = document.getElementById('opt-btn-filter-' + key);
      if (stateBtn) s[def.filterKey] = stateBtn.dataset.state;

      var pagePs = ps[key] || {};
      var pfx = 'pg-' + key + '-';

      [
        ['hide_shorts',      pfx + 'hide-shorts'],
        ['hide_playlists',   pfx + 'hide-playlists'],
        ['hide_members',     pfx + 'hide-members'],
        ['hide_live',        pfx + 'hide-live'],
        ['hide_autodub',     pfx + 'hide-autodub'],
        ['hide_upcoming',    pfx + 'hide-upcoming'],
        ['hide_watched',     pfx + 'hide-watched'],
        ['blacklist_enabled',pfx + 'blacklist-enabled']
      ].forEach(function(pair) {
        var el = document.getElementById(pair[1]);
        if (el) pagePs[pair[0]] = el.checked;
      });

      var bw = document.getElementById(pfx + 'blacklist-words');
      if (bw) pagePs.blacklist_words = bw.value;
      var lmin = document.getElementById(pfx + 'length-min');
      if (lmin) pagePs.length_min = lmin.value.trim();
      var lmax = document.getElementById(pfx + 'length-max');
      if (lmax) pagePs.length_max = lmax.value.trim();
      var vc = document.getElementById(pfx + 'view-count');
      if (vc) pagePs.view_count_min = parseViewCountInput(vc.value);

      ps[key] = pagePs;
    });
    s.page_settings = ps;

    chrome.storage.local.set({ [YT_HIDER_SETTINGS_KEY]: s });
  });
}

// ─── Change listeners ─────────────────────────────────────────────────────────

sliderPW.addEventListener('input',  function() { sliderPct.textContent = sliderPW.value + '%'; });
sliderPW.addEventListener('change', saveSettings);

bindOptToggle(togglePW,    'opt-toast-pw');
bindOptToggle(toggleRWH,   'opt-toast-rwh');
bindOptToggle(toggleDebug, 'opt-toast-debug');

toggleDev.addEventListener('change', function() {
  showInlineToast('opt-toast-dev', toggleDev.checked ? 'ON' : 'OFF');
  devExtras.style.display = toggleDev.checked ? 'block' : 'none';
  updateDevVideo(toggleDev.checked);
  saveSettings();
});

// ─── Watch List System button ─────────────────────────────────────────────────

var modalOverlay    = document.getElementById('modal-overlay');
var modalBtnDisable = document.getElementById('modal-btn-disable');
var modalBtnCancel  = document.getElementById('modal-btn-cancel');
var modalBtnDelete  = document.getElementById('modal-btn-delete');

function showModal() { modalOverlay.classList.add('visible'); }
function hideModal() { modalOverlay.classList.remove('visible'); }

btnWLState.addEventListener('click', function() {
  if (btnWLState.dataset.state === 'enabled') {
    showModal();
  } else {
    btnWLState.dataset.state = 'enabled';
    btnWLState.textContent   = 'ENABLED';
    showInlineToast('opt-toast-wl', 'ENABLED');
    saveSettings();
  }
});

modalBtnDisable.addEventListener('click', function() {
  hideModal();
  btnWLState.dataset.state = 'disabled';
  btnWLState.textContent   = 'DISABLED';
  showInlineToast('opt-toast-wl', 'DISABLED');
  saveSettings();
});
modalBtnCancel.addEventListener('click', hideModal);
modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) hideModal(); });

modalBtnDelete.addEventListener('click', function() {
  hideModal();
  if (confirm('Wipe all Watch History? This cannot be undone.')) {
    chrome.storage.local.set({ [YT_HIDER_KEYS.NOT_INTERESTED]: [] }, function() {
      btnWLState.dataset.state = 'disabled';
      btnWLState.textContent   = 'DISABLED';
      showInlineToast('opt-toast-wl', 'DISABLED');
      saveSettings();
      updateWhCount(0);
      listLoaded = false;
      if (panelOpen) buildWatchList();
    });
  }
});

// ─── Export / Retrieve / Dev ──────────────────────────────────────────────────

document.getElementById('btn-export-options').addEventListener('click', function() {
  exportList(YT_HIDER_KEYS.NOT_INTERESTED, 'Watched_Videos.txt');
});

document.getElementById('btn-retrieve').addEventListener('click', function() {
  if (!confirm('You are about to be taken to the YouTube history page.')) return;
  chrome.storage.local.set({ YTH_RETRIEVE_PENDING: true }, function() {
    chrome.tabs.create({ url: 'https://www.youtube.com/feed/history' });
  });
});

document.getElementById('btn-wipe').addEventListener('click', function() {
  if (!confirm('Wipe all Watch History? This cannot be undone.')) return;
  chrome.storage.local.set({ [YT_HIDER_KEYS.NOT_INTERESTED]: [] }, function() {
    updateWhCount(0); listLoaded = false; if (panelOpen) buildWatchList();
  });
});

document.getElementById('btn-reload').addEventListener('click', function() { chrome.runtime.reload(); });

// ─── Watch list viewer ────────────────────────────────────────────────────────

function updateWhCount(n) {
  var el = document.getElementById('wh-count');
  if (el) el.textContent = n + ' entr' + (n === 1 ? 'y' : 'ies');
}

expandBtn.addEventListener('click', function() {
  panelOpen = !panelOpen;
  watchListPanel.style.display = panelOpen ? 'block' : 'none';
  expandArrow.classList.toggle('open', panelOpen);
  if (panelOpen && !listLoaded) { listLoaded = true; buildWatchList(); }
});

document.getElementById('watch-list-search').addEventListener('input', function() {
  var q = this.value.trim().toLowerCase();
  watchListInner.querySelectorAll('.entry-row').forEach(function(row) {
    var text = row.querySelector('.entry-text') ? row.querySelector('.entry-text').textContent.toLowerCase() : '';
    row.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
  watchListInner.querySelectorAll('.cat-header').forEach(function(header) {
    var next = header.nextElementSibling;
    var anyVisible = false;
    while (next && !next.classList.contains('cat-header')) {
      if (next.style.display !== 'none') anyVisible = true;
      next = next.nextElementSibling;
    }
    header.style.display = anyVisible ? '' : 'none';
  });
});

function buildWatchList() {
  readList(YT_HIDER_KEYS.NOT_INTERESTED, function(list) {
    watchListInner.innerHTML = '';
    if (list.length === 0) {
      watchListInner.innerHTML = '<div class="list-empty">No entries recorded yet.</div>'; return;
    }
    var groups = {};
    list.forEach(function(entry, index) {
      var cat = getCategory(entry);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ entry: entry, index: index });
    });
    getCategories().filter(function(c) { return groups[c]; }).forEach(function(cat) {
      var header = document.createElement('div');
      header.className = 'cat-header';
      header.textContent = 'CATEGORY: ' + cat;
      watchListInner.appendChild(header);
      groups[cat].forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'entry-row';
        var removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', (function(idx, rowEl) {
          return function() { onRemove(idx, rowEl); };
        })(item.index, row));
        var text = document.createElement('div');
        text.className = 'entry-text';
        text.textContent = getTitlePart(item.entry);
        var ch = getChannelPart(item.entry);
        if (ch) {
          var chEl = document.createElement('span');
          chEl.className = 'entry-channel';
          chEl.textContent = '  Channel: ' + ch;
          text.appendChild(chEl);
        }
        row.appendChild(removeBtn);
        row.appendChild(text);
        watchListInner.appendChild(row);
      });
    });
  });
}

function onRemove(index, rowEl) {
  removeEntry(YT_HIDER_KEYS.NOT_INTERESTED, index, function() {
    rowEl.remove();
    listLoaded = false; buildWatchList(); listLoaded = true;
    readList(YT_HIDER_KEYS.NOT_INTERESTED, function(list) { updateWhCount(list.length); });
  });
}

// ─── Import ───────────────────────────────────────────────────────────────────

var btnUpload  = document.getElementById('btn-upload');
var uploadZone = document.getElementById('upload-zone');
var fileInput  = document.getElementById('file-input');
var toast      = document.getElementById('toast');
var toastTitle = document.getElementById('toast-title');
var toastSub   = document.getElementById('toast-sub');
var toastTimer = null;

function showToast(type, title, sub) {
  if (toastTimer) clearTimeout(toastTimer);
  toast.className = type;
  toastTitle.textContent = title;
  toastSub.textContent   = sub || '';
  toast.classList.remove('visible');
  void toast.offsetWidth;
  toast.classList.add('visible');
  toastTimer = setTimeout(function() { toast.classList.remove('visible'); }, 4000);
}

btnUpload.addEventListener('click', function(e) { e.stopPropagation(); fileInput.value = ''; fileInput.click(); });
uploadZone.addEventListener('click', function() { fileInput.value = ''; fileInput.click(); });

fileInput.addEventListener('change', function() {
  var file = fileInput.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onerror = function() { showToast('error', 'Upload Failed!', ''); };
  reader.onload = function(e) {
    try {
      var parsed = parseWatchedFile(e.target.result);
      if (!parsed) { showToast('error', 'Upload Failed!', 'Unrecognized file format.'); return; }
      importEntries(parsed);
    } catch (err) { showToast('error', 'Upload Failed!', ''); }
  };
  reader.readAsText(file);
});

function parseWatchedFile(text) {
  if (!text || !text.trim()) return null;
  var lines = text.split(/\r?\n/), entries = [], valid = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('<%CATEGORY%>') || line.startsWith('CATEGORY:')) { valid = true; continue; }
    entries.push(line);
  }
  return valid ? entries : null;
}

function importEntries(entries) {
  if (!entries || !entries.length) { showToast('error', 'Upload Failed!', ''); return; }
  readList(YT_HIDER_KEYS.NOT_INTERESTED, function(existing) {
    // O(1) lookup set instead of linear scan per entry
    var seen = {};
    existing.forEach(function(e) { seen[getTitlePart(e).toLowerCase()] = true; });

    var toAdd = [];
    entries.forEach(function(entry) {
      var k = getTitlePart(entry).toLowerCase();
      if (!k || seen[k]) return;
      seen[k] = true;
      toAdd.push(entry.trim());
    });

    if (!toAdd.length) {
      showToast('success', 'Watch History Uploaded!', '0 new entries added.');
      return;
    }

    // Single sort over merged array — O(n log n) not O(n²)
    var merged = existing.concat(toAdd);
    merged.sort(function(a, b) {
      return getTitlePart(a).toLowerCase().localeCompare(getTitlePart(b).toLowerCase());
    });

    chrome.storage.local.set({ [YT_HIDER_KEYS.NOT_INTERESTED]: merged }, function() {
      showToast('success', 'Watch History Uploaded!', toAdd.length + ' new entries added.');
      readList(YT_HIDER_KEYS.NOT_INTERESTED, function(list) { updateWhCount(list.length); });
      listLoaded = false;
      if (panelOpen) buildWatchList();
    });
  });
}

// ─── Cross-link: sync when popup changes filter states or theme ───────────────

chrome.storage.onChanged.addListener(function(changes, area) {
  if (_saving || area !== 'local' || !changes[YT_HIDER_SETTINGS_KEY]) return;
  var s = changes[YT_HIDER_SETTINGS_KEY].newValue || {};
  applyTheme(s.theme || 'auto');
  togglePW.checked      = !!s.pw_enabled;
  if (document.activeElement !== sliderPW) {
    sliderPW.value        = typeof s.pw_threshold === 'number' ? s.pw_threshold : 50;
    sliderPct.textContent = sliderPW.value + '%';
  }
  PAGE_DEFS.forEach(function(def) {
    var btn = document.getElementById('opt-btn-filter-' + def.key);
    if (!btn) return;
    var raw   = s[def.filterKey];
    var state = (raw === 'on' || raw === 'advanced' || raw === 'off')
      ? raw : (raw === false ? 'off' : def.defaultState);
    applyFilterBtnState(btn, state);
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────

buildFilterSection();
readList(YT_HIDER_KEYS.NOT_INTERESTED, function(list) { updateWhCount(list.length); });
loadSettings();
