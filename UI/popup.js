// UI/popup.js — quick-access controls: enable/disable, quick toggles, page filters.
// Depends on ../list_manager.js loaded first.

var extToggleBtn     = document.getElementById('ext-toggle-btn');
var extToggleLabel   = document.getElementById('ext-toggle-label');
var countEl          = document.getElementById('count-watched');
var countRemoved     = document.getElementById('count-removed');
var wlDisabledNotice = document.getElementById('wl-disabled-notice');
var settingsBtn      = document.getElementById('settings-btn');
var settingsIconImg  = document.getElementById('settings-icon-img');
var settingsFallback = document.getElementById('settings-icon-fallback');
var themeBtn         = document.getElementById('theme-btn');

var pToggleShorts    = document.getElementById('p-toggle-shorts');
var pToggleMembers   = document.getElementById('p-toggle-members');
var pTogglePW        = document.getElementById('p-toggle-pw');
var pSliderPW        = document.getElementById('p-slider-pw');
var pSliderPct       = document.getElementById('p-slider-pct');
var pToggleBlacklist = document.getElementById('p-toggle-blacklist');
var pBlacklistWords  = document.getElementById('p-blacklist-words');
var pBtnRetrieve     = document.getElementById('p-btn-retrieve');

var PAGE_FILTER_KEYS = ['filter_home', 'filter_subs', 'filter_sidebar', 'filter_channel', 'filter_search'];
var STATE_CYCLE = ['off', 'on', 'advanced'];
var STATE_TEXT  = { off: 'OFF', on: 'ON', advanced: 'ADV' };
var STATE_LABEL = { off: 'OFF', on: 'ON', advanced: 'ADVANCED' };
var THEME_CYCLE = ['auto', 'light', 'dark'];
var THEME_TEXT  = { auto: 'AUTO', light: 'LIGHT', dark: 'DARK' };
var toastTimers = {};
var ythPort = null;

function notifyChanged() {
  if (!ythPort) return;
  try { ythPort.postMessage({ type: 'YTH_SETTINGS_CHANGED' }); } catch (e) {}
}

// ─── Settings icon ────────────────────────────────────────────────────────────

function loadSettingsIcon() {
  var candidates = ['icons/settings.png'];
  var index = 0;
  function tryNext() {
    if (index >= candidates.length) {
      settingsIconImg.style.display = 'none';
      settingsFallback.style.display = '';
      return;
    }
    settingsIconImg.src = chrome.runtime.getURL(candidates[index]);
    settingsIconImg.onload = function() {
      settingsIconImg.style.display = 'block';
      settingsFallback.style.display = 'none';
    };
    settingsIconImg.onerror = function() { index++; tryNext(); };
  }
  tryNext();
}

settingsBtn.addEventListener('click', function() { chrome.runtime.openOptionsPage(); });
document.getElementById('btn-advanced').addEventListener('click', function() { chrome.runtime.openOptionsPage(); });

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  themeBtn.textContent = THEME_TEXT[theme] || 'AUTO';
  themeBtn.dataset.theme = theme || 'auto';
}

themeBtn.addEventListener('click', function() {
  var current = themeBtn.dataset.theme || 'auto';
  var idx  = THEME_CYCLE.indexOf(current);
  var next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  applyTheme(next);
  chrome.storage.local.get([YT_HIDER_SETTINGS_KEY], function(result) {
    var s = result[YT_HIDER_SETTINGS_KEY] || {};
    s.theme = next;
    chrome.storage.local.set({ [YT_HIDER_SETTINGS_KEY]: s });
  });
});

// ─── Enable/disable ───────────────────────────────────────────────────────────

function updateExtToggleUI(enabled) {
  extToggleBtn.classList.toggle('disabled', !enabled);
  extToggleLabel.textContent = enabled ? 'ENABLED' : 'DISABLED';
}

extToggleBtn.addEventListener('click', function() {
  chrome.storage.local.get([YT_HIDER_SETTINGS_KEY], function(result) {
    var s = result[YT_HIDER_SETTINGS_KEY] || {};
    s.ext_enabled = !(s.ext_enabled !== false);
    chrome.storage.local.set({ [YT_HIDER_SETTINGS_KEY]: s }, function() {
      updateExtToggleUI(s.ext_enabled);
      notifyChanged();
    });
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

function loadCount() {
  chrome.storage.local.get([YT_HIDER_SETTINGS_KEY], function(result) {
    var s = result[YT_HIDER_SETTINGS_KEY] || {};
    if (s.wl_disabled) {
      wlDisabledNotice.style.display = 'block';
      countEl.textContent = '—';
    } else {
      readList(YT_HIDER_KEYS.NOT_INTERESTED, function(list) {
        var n = list.length;
        countEl.textContent = n + ' entr' + (n === 1 ? 'y' : 'ies');
      });
    }
  });
  countRemoved.textContent = '0 items';
}

// ─── Advanced-settings incompatibility warnings ───────────────────────────────

function updateAdvancedWarnings() {
  var hasAdv = PAGE_FILTER_KEYS.some(function(key) {
    var btn = document.getElementById('btn-' + key.replace(/_/g, '-'));
    return btn && btn.dataset.state === 'advanced';
  });
  ['warn-hide-videos', 'warn-word-blacklist'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = hasAdv ? 'inline' : 'none';
  });
}

// ─── 3-state toggle helpers ───────────────────────────────────────────────────

function applyBtnState(btn, state) {
  btn.dataset.state = state;
  btn.textContent   = STATE_TEXT[state];
}

function showToast(key, state) {
  var toast = document.getElementById('toast-' + key.replace(/_/g, '-'));
  if (!toast) return;
  toast.textContent = STATE_LABEL[state];
  toast.classList.add('visible');
  clearTimeout(toastTimers[key]);
  toastTimers[key] = setTimeout(function() {
    toast.classList.remove('visible');
  }, 2000);
}

// ─── Load settings ────────────────────────────────────────────────────────────

function loadSettings() {
  chrome.storage.local.get([YT_HIDER_SETTINGS_KEY], function(result) {
    var s = result[YT_HIDER_SETTINGS_KEY] || {};

    updateExtToggleUI(s.ext_enabled !== false);
    applyTheme(s.theme || 'auto');

    pToggleShorts.checked    = !!s.hide_shorts;
    pToggleMembers.checked   = !!s.hide_members;
    pTogglePW.checked        = !!s.pw_enabled;
    pSliderPW.value          = typeof s.pw_threshold === 'number' ? s.pw_threshold : 50;
    pSliderPct.textContent   = pSliderPW.value + '%';
    pToggleBlacklist.checked = !!s.blacklist_enabled;
    pBlacklistWords.value    = s.blacklist_words !== undefined ? s.blacklist_words : '';

    var PAGE_FILTER_DEFAULTS = { filter_channel: 'off', filter_search: 'off' };
    PAGE_FILTER_KEYS.forEach(function(key) {
      var btn = document.getElementById('btn-' + key.replace('_', '-'));
      if (!btn) return;
      var raw = s[key];
      var fallback = PAGE_FILTER_DEFAULTS[key] || 'on';
      var state = (raw === 'on' || raw === 'advanced' || raw === 'off')
        ? raw
        : (raw === false ? 'off' : fallback);
      applyBtnState(btn, state);
    });
    updateAdvancedWarnings();
  });
}

// ─── Save settings ────────────────────────────────────────────────────────────

function saveSettings() {
  chrome.storage.local.get([YT_HIDER_SETTINGS_KEY], function(result) {
    var s = result[YT_HIDER_SETTINGS_KEY] || {};

    s.hide_shorts       = pToggleShorts.checked;
    s.hide_members      = pToggleMembers.checked;
    s.pw_enabled        = pTogglePW.checked;
    s.pw_threshold      = parseInt(pSliderPW.value);
    s.blacklist_enabled = pToggleBlacklist.checked;
    s.blacklist_words   = pBlacklistWords.value;

    PAGE_FILTER_KEYS.forEach(function(key) {
      var btn = document.getElementById('btn-' + key.replace('_', '-'));
      if (btn) s[key] = btn.dataset.state;
    });
    chrome.storage.local.set({ [YT_HIDER_SETTINGS_KEY]: s });
    notifyChanged();
  });
}

// ─── Quick toggle listeners ───────────────────────────────────────────────────

var toggleToastTimers = {};
function showToggleToast(toastId, checked) {
  var toast = document.getElementById(toastId);
  if (!toast) return;
  toast.textContent = checked ? 'ON' : 'OFF';
  toast.classList.add('visible');
  clearTimeout(toggleToastTimers[toastId]);
  toggleToastTimers[toastId] = setTimeout(function() { toast.classList.remove('visible'); }, 2000);
}

function bindToggle(el, toastId) {
  el.addEventListener('change', function() {
    showToggleToast(toastId, el.checked);
    saveSettings();
  });
}

bindToggle(pTogglePW,        'toast-p-pw');
bindToggle(pToggleShorts,    'toast-p-shorts');
bindToggle(pToggleMembers,   'toast-p-members');
bindToggle(pToggleBlacklist, 'toast-p-blacklist');

pSliderPW.addEventListener('input',  function() { pSliderPct.textContent = pSliderPW.value + '%'; });
pSliderPW.addEventListener('change', saveSettings);

var pBlacklistDebounce = null;
pBlacklistWords.addEventListener('input', function() {
  clearTimeout(pBlacklistDebounce);
  pBlacklistDebounce = setTimeout(saveSettings, 600);
});

pBtnRetrieve.addEventListener('click', function() {
  if (!confirm('You are about to be taken to the YouTube history page.')) return;
  chrome.storage.local.set({ YTH_RETRIEVE_PENDING: true }, function() {
    chrome.tabs.create({ url: 'https://www.youtube.com/feed/history' });
  });
});

// ─── 3-state toggle click handler ────────────────────────────────────────────

PAGE_FILTER_KEYS.forEach(function(key) {
  var btn = document.getElementById('btn-' + key.replace('_', '-'));
  if (!btn) return;
  btn.addEventListener('click', function() {
    var current = btn.dataset.state;
    var idx  = STATE_CYCLE.indexOf(current);
    var next = STATE_CYCLE[(idx + 1) % STATE_CYCLE.length];
    applyBtnState(btn, next);
    showToast(key, next);
    updateAdvancedWarnings();
    saveSettings();
  });
});

// ─── Port — removed count ─────────────────────────────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  if (!tabs[0]) return;
  try {
    ythPort = chrome.tabs.connect(tabs[0].id, { name: 'YTH_POPUP' });
    ythPort.onMessage.addListener(function(msg) {
      if (msg.type === 'YTH_SESSION_COUNT') {
        var n = msg.count || 0;
        countRemoved.textContent = n + ' item' + (n === 1 ? '' : 's');
      }
    });
  } catch (e) {}
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadSettingsIcon();
loadCount();
loadSettings();
