// list_manager.js
// Single source of truth for storage, formatting, and entry parsing.
// Used by popup.js and options.js (loaded via script tag).
// content/shared.js has its own inlined copy — changes here must be mirrored there.
//
// Entry format:  "Video Title <%CHANNEL%> ChannelName"
// Export format: "<%CATEGORY%> A\nVideo Title <%CHANNEL%> ChannelName"

// ─── Storage keys ─────────────────────────────────────────────────────────────

const YT_HIDER_KEYS = {
  NOT_INTERESTED: 'YT_HIDER_NOT_INTERESTED',
  REMOVED_COUNT:  'YT_HIDER_REMOVED_COUNT'
};

const YT_HIDER_SETTINGS_KEY = 'YT_HIDER_SETTINGS';

// ─── Separators ───────────────────────────────────────────────────────────────

const CHANNEL_SEP  = ' <%CHANNEL%> ';
const CATEGORY_TAG = '<%CATEGORY%>';

// ─── Entry parsing ────────────────────────────────────────────────────────────

function getTitlePart(entry) {
  var sep = entry.indexOf(CHANNEL_SEP);
  return sep !== -1 ? entry.substring(0, sep).trim() : entry.trim();
}

function getChannelPart(entry) {
  var sep = entry.indexOf(CHANNEL_SEP);
  return sep !== -1 ? entry.substring(sep + CHANNEL_SEP.length).trim() : null;
}

// ─── Category logic ───────────────────────────────────────────────────────────

function getCategory(entry) {
  var first = getTitlePart(entry).charAt(0);
  if (/[^a-zA-Z0-9]/.test(first)) return 'Special';
  if (/[0-9]/.test(first))        return 'Numerical';
  return first.toUpperCase();
}

function getCategories() {
  return ['Special', 'Numerical', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
}

// ─── Binary search ────────────────────────────────────────────────────────────

function binarySearchPosition(list, titleKey) {
  var lo = 0, hi = list.length;
  while (lo < hi) {
    var mid = (lo + hi) >>> 1;
    if (getTitlePart(list[mid]).toLowerCase().localeCompare(titleKey) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function entryExists(list, entry) {
  var titleKey = getTitlePart(entry).toLowerCase();
  var pos = binarySearchPosition(list, titleKey);
  for (var i = pos; i < list.length; i++) {
    var candidate = getTitlePart(list[i]).toLowerCase();
    if (candidate.localeCompare(titleKey) > 0) break;
    if (candidate === titleKey) return true;
  }
  return false;
}

function insertEntry(list, entry) {
  var trimmed  = entry.trim();
  var titleKey = getTitlePart(trimmed).toLowerCase();
  var pos = binarySearchPosition(list, titleKey);
  list.splice(pos, 0, trimmed);
  return list;
}

// ─── Storage read ─────────────────────────────────────────────────────────────

function readList(key, callback) {
  chrome.storage.local.get([key], function(result) {
    var data = result[key];
    if (Array.isArray(data)) {
      callback(data);
    } else {
      chrome.storage.local.set({ [key]: [] }, function() { callback([]); });
    }
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

function formatList(list) {
  var groups = {};
  list.forEach(function(entry) {
    var cat = getCategory(entry);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(entry);
  });
  var cats = getCategories().filter(function(c) { return groups[c]; });
  var lines = [];
  cats.forEach(function(cat, i) {
    if (i > 0) lines.push('');
    lines.push(CATEGORY_TAG + ' ' + cat);
    groups[cat].forEach(function(e) { lines.push(e); });
  });
  return lines.join('\n');
}

function exportList(key, filename) {
  readList(key, function(list) {
    if (list.length === 0) return;
    var content = formatList(list);
    var blob    = new Blob([content], { type: 'text/plain' });
    var url     = URL.createObjectURL(blob);
    chrome.downloads.download(
      { url: url, filename: filename, saveAs: false },
      function() { URL.revokeObjectURL(url); }
    );
  });
}

// ─── Remove single entry ──────────────────────────────────────────────────────

function removeEntry(key, index, callback) {
  readList(key, function(list) {
    if (index < 0 || index >= list.length) { if (callback) callback(); return; }
    list.splice(index, 1);
    chrome.storage.local.set({ [key]: list }, function() { if (callback) callback(); });
  });
}
