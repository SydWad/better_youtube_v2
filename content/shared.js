// content/shared.js
// Loaded first. Constants, settings, helpers, storage, cache, and mark/unhide.
// All other content scripts depend on this.

// ─── Constants ────────────────────────────────────────────────────────────────

var YT_HIDER_NOT_INTERESTED = 'YT_HIDER_NOT_INTERESTED';
var YT_HIDER_SETTINGS_KEY   = 'YT_HIDER_SETTINGS';
var CHANNEL_SEP = ' <%CHANNEL%> ';

// ─── Settings ─────────────────────────────────────────────────────────────────

var YTH_PAGE_KEYS = ['home', 'subs', 'sidebar', 'channel', 'search'];

var YTH_PAGE_SETTINGS_DEFAULT = {
  hide_shorts: false, hide_playlists: false, hide_members: false,
  hide_live: false, hide_autodub: false, hide_watched: false, hide_upcoming: false,
  blacklist_enabled: false, blacklist_words: '',
  length_min: '', length_max: '', view_count_min: 0
};

var ythSettings = {
  ext_enabled:       true,
  pw_enabled:        false,
  pw_threshold:      50,
  filter_home:       'on',
  filter_subs:       'on',
  filter_channel:    'off',
  filter_search:     'off',
  filter_sidebar:    'on',
  hide_shorts:       false,
  hide_members:      false,
  blacklist_enabled: false,
  blacklist_words:   '',
  rwh_enabled:       true,
  wl_disabled:       false,
  debug_enabled:     false,
  page_settings:  {
    home:    Object.assign({}, YTH_PAGE_SETTINGS_DEFAULT),
    subs:    Object.assign({}, YTH_PAGE_SETTINGS_DEFAULT),
    sidebar: Object.assign({}, YTH_PAGE_SETTINGS_DEFAULT),
    channel: Object.assign({}, YTH_PAGE_SETTINGS_DEFAULT),
    search:  Object.assign({}, YTH_PAGE_SETTINGS_DEFAULT)
  }
};

// Gate: set true once chrome.storage settings have been read
var ythSettingsLoaded = false;

// ─── Debug logging ────────────────────────────────────────────────────────────

function ythLog() {
  if (!ythSettings.debug_enabled) return;
  console.log.apply(console, arguments);
}

// ─── Page type detection ──────────────────────────────────────────────────────

function ythGetPageType() {
  var path = window.location.pathname;
  if (path === '/')                            return 'home';
  if (path.startsWith('/feed/subscriptions')) return 'subs';
  if (path.startsWith('/feed/history'))        return 'history';
  if (path.startsWith('/results'))             return 'search';
  if (path.startsWith('/watch'))               return 'sidebar';
  if (path.startsWith('/@') || path.startsWith('/channel') || path.startsWith('/c/')) return 'channel';
  return 'other';
}

function ythResolveFilterVal(val) {
  if (val === false || val === 'off') return 'off';
  if (val === true  || val === 'on')  return 'on';
  if (val === 'advanced')             return 'advanced';
  return 'off';
}

// Per-page settings accessor — branches on filter state:
//   'on'       → global popup toggles (shorts, members, blacklist only)
//   'advanced' → per-page settings from options
function ythGetPageSettings() {
  var page = ythGetPageType();
  var keyMap = {
    home: 'filter_home', subs: 'filter_subs', search: 'filter_search',
    sidebar: 'filter_sidebar', channel: 'filter_channel'
  };
  var filterKey = keyMap[page];
  var state = filterKey ? ythResolveFilterVal(ythSettings[filterKey]) : 'off';

  if (state === 'on') {
    return {
      hide_shorts:        !!ythSettings.hide_shorts,
      hide_playlists:     false,
      hide_members:       !!ythSettings.hide_members,
      hide_live:          false,
      hide_autodub:       false,
      hide_watched:       false,
      blacklist_enabled:  !!ythSettings.blacklist_enabled,
      blacklist_words:    ythSettings.blacklist_words || '',
      length_min:         '', length_max:         '',
      length_enabled:     false,
      view_count_min:     0,  view_count_enabled: false
    };
  }

  // 'advanced'
  var ps = (ythSettings.page_settings || {})[page];
  if (!ps) return Object.assign({ length_enabled: false, view_count_enabled: false }, YTH_PAGE_SETTINGS_DEFAULT);
  return {
    hide_shorts:        !!ps.hide_shorts,
    hide_playlists:     !!ps.hide_playlists,
    hide_members:       !!ps.hide_members,
    hide_live:          !!ps.hide_live,
    hide_autodub:       !!ps.hide_autodub,
    hide_watched:       !!ps.hide_watched,
    hide_upcoming:      !!ps.hide_upcoming,
    blacklist_enabled:  !!ps.blacklist_enabled,
    blacklist_words:    ps.blacklist_words || '',
    length_min:         ps.length_min || '',
    length_max:         ps.length_max || '',
    length_enabled:     !!(ps.length_min || ps.length_max),
    view_count_min:     ps.view_count_min || 0,
    view_count_enabled: (ps.view_count_min || 0) > 0
  };
}

// Full filter gate — history page always excluded
function ythIsPageFiltered() {
  var page = ythGetPageType();
  if (page === 'history') return false;
  var keyMap = {
    home: 'filter_home', subs: 'filter_subs', search: 'filter_search',
    sidebar: 'filter_sidebar', channel: 'filter_channel'
  };
  var key = keyMap[page];
  if (!key) return false;
  var state = ythResolveFilterVal(ythSettings[key]);
  return state === 'on' || state === 'advanced';
}

// Gate for shorts/playlists/members/live/autodub — subs and channel respect their toggles;
// all other filtered pages (home/sidebar/search) always pass if their own filter is on/advanced.
function ythIsShortPlaylistFilteredPage() {
  var page = ythGetPageType();
  if (page === 'history') return false;
  if (page === 'subs') {
    var s = ythResolveFilterVal(ythSettings.filter_subs);
    if (s === 'off') return false;
  }
  if (page === 'channel') {
    var c = ythResolveFilterVal(ythSettings.filter_channel);
    if (c === 'off') return false;
  }
  return true;
}

// ─── Duration parsing ─────────────────────────────────────────────────────────

function ythParseFilterTime(str) {
  if (!str || str.trim() === '' || str.trim() === '∞') return null;
  var parts = str.trim().split(':');
  if (parts.length === 2) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  return null;
}

function ythParseBadgeDuration(str) {
  if (!str) return null;
  str = str.trim();
  var parts = str.split(':');
  if (parts.length === 2) return (parseInt(parts[0]) || 0) + (parseInt(parts[1]) || 0) / 60;
  if (parts.length === 3) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0) + (parseInt(parts[2]) || 0) / 60;
  return null;
}

function ythParseViewCount(str) {
  if (!str) return null;
  str = str.trim().replace(/,/g, '');
  if (!str) return null;
  var multipliers = { 'k': 1e3, 'm': 1e6, 'b': 1e9 };
  var last = str[str.length - 1].toLowerCase();
  if (multipliers[last]) return parseFloat(str.slice(0, -1)) * multipliers[last];
  var n = parseFloat(str);
  return isNaN(n) ? null : n;
}

// ─── DOM extraction helpers ───────────────────────────────────────────────────

function ythExtractTitle(renderer) {
  var vwTitle = renderer.querySelector('.ytp-modern-videowall-still-info-title');
  if (vwTitle && vwTitle.textContent.trim()) return vwTitle.textContent.trim();

  var h3 = renderer.querySelector(
    'h3.yt-lockup-metadata-view-model__heading-reset, h3.ytLockupMetadataViewModelHeadingReset'
  );
  if (h3 && h3.getAttribute('title')) return h3.getAttribute('title').trim();
  var anchor = renderer.querySelector(
    'a.yt-lockup-metadata-view-model__title, a.ytLockupMetadataViewModelTitle'
  );
  if (anchor && anchor.getAttribute('title')) return anchor.getAttribute('title').trim();

  var titleLink = renderer.querySelector('a#video-title');
  if (titleLink && titleLink.getAttribute('title')) return titleLink.getAttribute('title').trim();

  var richLink = renderer.querySelector('a#video-title-link');
  if (richLink && richLink.getAttribute('title')) return richLink.getAttribute('title').trim();

  if (anchor) return anchor.textContent.trim();
  return null;
}

function ythExtractChannel(renderer) {
  var vwAuthor = renderer.querySelector('.ytp-modern-videowall-still-info-author');
  if (vwAuthor && vwAuthor.textContent.trim()) return vwAuthor.textContent.trim();

  var link = renderer.querySelector(
    '.yt-lockup-metadata-view-model__text-container a[href^="/@"], .ytLockupMetadataViewModelTextContainer a[href^="/@"]'
  );
  if (link) return link.textContent.trim();

  var chLink = renderer.querySelector('#channel-name a, ytd-channel-name a');
  if (chLink) return chLink.textContent.trim();

  var metaRow = renderer.querySelector(
    '.yt-content-metadata-view-model__metadata-row, .ytContentMetadataViewModelMetadataRow'
  );
  if (metaRow) {
    var span = metaRow.querySelector('span.yt-core-attributed-string, span.ytCoreAttributedString');
    if (span && span.textContent.trim()) return span.textContent.trim();
  }
  return null;
}

function ythExtractDuration(renderer) {
  var vwDur = renderer.querySelector('.ytp-modern-videowall-still-info-duration');
  if (vwDur) {
    var d = ythParseBadgeDuration(vwDur.textContent.trim());
    if (d !== null) return d;
  }
  var badges = renderer.querySelectorAll('.yt-badge-shape__text, .ytBadgeShapeText');
  for (var i = 0; i < badges.length; i++) {
    var txt = badges[i].textContent.trim();
    if (/^\d/.test(txt)) {
      var dur = ythParseBadgeDuration(txt);
      if (dur !== null) return dur;
    }
  }
  return null;
}

function ythExtractViewCount(renderer) {
  var vwVc = renderer.querySelector('.ytp-modern-videowall-still-view-count-and-date-info');
  if (vwVc) {
    var vcRaw = vwVc.textContent.split('•')[0].trim();
    var vcParsed = ythParseViewCount(vcRaw);
    if (vcParsed !== null) return vcParsed;
  }
  var rows = renderer.querySelectorAll(
    '.yt-content-metadata-view-model__metadata-row, .ytContentMetadataViewModelMetadataRow'
  );
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var icons = row.querySelectorAll(
      '.yt-content-metadata-view-model__leading-icon, .ytContentMetadataViewModelLeadingIcon'
    );
    for (var j = 0; j < icons.length; j++) {
      var next = icons[j].nextElementSibling;
      while (next) {
        if (next.classList && (
          next.classList.contains('yt-content-metadata-view-model__metadata-text') ||
          next.classList.contains('ytContentMetadataViewModelMetadataText')
        )) {
          var vtxt = next.textContent.trim();
          if (/^[\d,.]+[KMBkmb]?$/.test(vtxt)) {
            var count = ythParseViewCount(vtxt);
            if (count !== null) return count;
          }
          break;
        }
        if (!next.classList.contains('yt-content-metadata-view-model__delimiter') &&
            !next.classList.contains('ytContentMetadataViewModelDelimiter')) break;
        next = next.nextElementSibling;
      }
    }
  }
  return null;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function ythReadList(callback) {
  chrome.storage.local.get([YT_HIDER_NOT_INTERESTED], function(result) {
    var data = result[YT_HIDER_NOT_INTERESTED];
    if (Array.isArray(data)) {
      callback(data);
    } else {
      chrome.storage.local.set({ [YT_HIDER_NOT_INTERESTED]: [] }, function() { callback([]); });
    }
  });
}

function ythGetTitlePart(entry) {
  var sep = entry.indexOf(CHANNEL_SEP);
  return sep !== -1 ? entry.substring(0, sep).trim() : entry.trim();
}

function ythBinarySearchPosition(list, titleKey) {
  var lo = 0, hi = list.length;
  while (lo < hi) {
    var mid = (lo + hi) >>> 1;
    if (ythGetTitlePart(list[mid]).toLowerCase().localeCompare(titleKey) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function ythEntryExists(list, entry) {
  var titleKey = ythGetTitlePart(entry).toLowerCase();
  var pos = ythBinarySearchPosition(list, titleKey);
  for (var i = pos; i < list.length; i++) {
    var c = ythGetTitlePart(list[i]).toLowerCase();
    if (c.localeCompare(titleKey) > 0) break;
    if (c === titleKey) return true;
  }
  return false;
}

function ythInsertEntry(list, entry) {
  var trimmed  = entry.trim();
  var titleKey = ythGetTitlePart(trimmed).toLowerCase();
  var pos = ythBinarySearchPosition(list, titleKey);
  list.splice(pos, 0, trimmed);
  return list;
}

// ─── Batch save queue ─────────────────────────────────────────────────────────

var ythSaveQueue   = [];
var ythSavePending = false;

function ythFlushQueue() {
  if (ythSaveQueue.length === 0) { ythSavePending = false; return; }
  var toSave = ythSaveQueue.slice();
  ythSaveQueue   = [];
  ythSavePending = false;

  ythReadList(function(list) {
    var added = 0;
    toSave.forEach(function(entry) {
      if (!ythEntryExists(list, entry)) {
        ythInsertEntry(list, entry);
        added++;
        ythLog('[YT Hider] queued save:', entry);
      }
    });
    if (added === 0) return;
    chrome.storage.local.set({ [YT_HIDER_NOT_INTERESTED]: list }, function() {
      ythLog('[YT Hider] batch saved', added, 'entries');
      ythListDirty = true;
    });
  });
}

function ythSaveEntry(entry) {
  ythSaveQueue.push(entry);
  if (!ythSavePending) {
    ythSavePending = true;
    setTimeout(ythFlushQueue, 300);
  }
}

// ─── List cache ───────────────────────────────────────────────────────────────

var ythCachedList     = null;
var ythListDirty      = true;
var ythInitialScanDue = false;

function ythRefreshCache(callback) {
  if (!ythListDirty && ythCachedList !== null) { callback(ythCachedList); return; }
  if (ythCachedList !== null) {
    callback(ythCachedList);
    ythReadList(function(list) { ythCachedList = list; ythListDirty = false; });
    return;
  }
  ythReadList(function(list) {
    ythCachedList = list;
    ythListDirty  = false;
    callback(list);
    if (ythInitialScanDue) { ythInitialScanDue = false; ythScanAll(); }
  });
}

function ythEntryInList(list, title, channel) {
  var titleKey = title.toLowerCase();
  var pos = ythBinarySearchPosition(list, titleKey);
  for (var i = pos; i < list.length; i++) {
    var storedTitle = ythGetTitlePart(list[i]).toLowerCase();
    if (storedTitle.localeCompare(titleKey) > 0) break;
    if (storedTitle !== titleKey) continue;
    var storedChannel = null;
    var sep = list[i].indexOf(CHANNEL_SEP);
    if (sep !== -1) storedChannel = list[i].substring(sep + CHANNEL_SEP.length).trim().toLowerCase();
    if (storedChannel && channel) {
      if (storedChannel === channel.toLowerCase()) return true;
      continue;
    }
    return true;
  }
  return false;
}

// ─── Session removed count ────────────────────────────────────────────────────

var ythSessionRemovedCount = 0;

function ythIncrementRemovedCount() {
  ythSessionRemovedCount++;
}

// ─── Mark renderer ────────────────────────────────────────────────────────────

function ythMarkRenderer(renderer, reason) {
  var current = renderer.dataset.ythFlags;
  renderer.dataset.ythFlags = current ? current + ',' + reason : reason;
}

// ─── Unhide all ───────────────────────────────────────────────────────────────

function ythUnhideAll() {
  document.querySelectorAll('[data-yth-hidden]').forEach(function(el) {
    el.style.removeProperty('display');
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    var label = el.querySelector('.yth-dev-label');
    if (label) label.remove();
    delete el.dataset.ythHidden;
    delete el.dataset.ythFlags;
  });
  document.querySelectorAll('[data-yth-shelf-hidden]').forEach(function(el) {
    el.style.removeProperty('display');
    el.style.removeProperty('outline');
    delete el.dataset.ythShelfHidden;
  });
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function ythFindRenderer(el) {
  var node = el;
  for (var i = 0; i < 25; i++) {
    if (!node) return null;
    if (node.tagName && node.tagName.toLowerCase() === 'ytd-rich-item-renderer') return node;
    node = node.parentElement;
  }
  return null;
}

function ythIsTopLevelLockup(el) {
  var p = el.parentElement;
  while (p) {
    if (p.tagName && p.tagName.toLowerCase() === 'ytd-rich-item-renderer') return false;
    p = p.parentElement;
  }
  return true;
}

// ─── Renderer selector ────────────────────────────────────────────────────────

var YTH_RENDERER_SELECTOR =
  'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ' +
  'ytd-video-renderer, yt-lockup-view-model, a.ytp-modern-videowall-still';
