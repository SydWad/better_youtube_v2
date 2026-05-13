// history_overlay.js
// Loaded on /feed/history as a permanent content script.
// Only activates when YTH_RETRIEVE_PENDING flag is set in storage.

var YTH_LIST_KEY = 'YT_HIDER_NOT_INTERESTED';
var CHANNEL_SEP  = ' <%CHANNEL%> ';

chrome.storage.local.get(['YTH_RETRIEVE_PENDING'], function(r) {
  if (!r.YTH_RETRIEVE_PENDING) return;
  chrome.storage.local.remove('YTH_RETRIEVE_PENDING', function() {
    setTimeout(initOverlay, 1200);
  });
});

function initOverlay() {
  var running      = false;
  var startTime    = null;
  var elapsedMs    = 0;
  var addedCount   = 0;
  var timerHandle  = null;
  var scrapeHandle = null;
  var stallHandle  = null;
  var saveQueue    = [];
  var saveTimer    = null;
  var scrapedSet   = new Set();
  var storedSet    = new Set();
  var storedSetReady = false;
  var domObserver  = null;
  var lastScrollY  = -1;
  var stallSeconds = 0;

  // ─── Build UI ─────────────────────────────────────────────────────────────────

  var overlay = document.createElement('div');
  overlay.id  = '__yth_overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'background:rgba(0,0,0,0.85)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif'
  ].join(';');

  var box = document.createElement('div');
  box.id = '__yth_box';
  box.style.cssText = [
    'background:#111', 'border:1px solid #333', 'border-radius:12px',
    'padding:42px 48px', 'width:630px', 'text-align:center', 'color:#fff'
  ].join(';');

  // Icon wrap
  var iconWrap = document.createElement('div');
  iconWrap.id = '__yth_icon_wrap';
  iconWrap.style.marginBottom = '24px';

  var iconEl = document.createElement('img');
  iconEl.id = '__yth_icon';
  iconEl.style.cssText = 'width:108px;height:108px;object-fit:contain;display:block;margin:0 auto';
  iconEl.src = '';

  var iconFb = document.createElement('div');
  iconFb.id = '__yth_icon_fb';
  iconFb.style.cssText = 'display:none;font-size:78px;font-weight:700;color:#ff4444;line-height:1';
  iconFb.textContent = '!';

  iconWrap.appendChild(iconEl);
  iconWrap.appendChild(iconFb);
  box.appendChild(iconWrap);

  // Message
  var msgEl = document.createElement('div');
  msgEl.id = '__yth_msg';
  msgEl.style.cssText = 'font-size:21px;line-height:1.6;color:#e0e0e0;margin-bottom:33px';
  msgEl.textContent = 'Would you like to load your entire YouTube history right now?';
  var msgBr = document.createElement('br');
  var msgSub = document.createElement('span');
  msgSub.style.cssText = 'font-size:18px;color:#888';
  msgSub.textContent = 'This may take several minutes to an hour.';
  msgEl.appendChild(msgBr);
  msgEl.appendChild(msgSub);
  box.appendChild(msgEl);

  // Timer row
  var timerRowEl = document.createElement('div');
  timerRowEl.id = '__yth_timer_row';
  timerRowEl.style.cssText = 'display:none;margin-bottom:24px';

  var timerLbl1 = document.createElement('span');
  timerLbl1.style.cssText = 'font-size:19px;color:#aaa';
  timerLbl1.textContent = 'Time elapsed: ';

  var timerEl = document.createElement('span');
  timerEl.id = '__yth_timer';
  timerEl.style.cssText = 'font-size:19px;font-weight:700;color:#fff';
  timerEl.textContent = '0:00';

  var timerLbl2 = document.createElement('span');
  timerLbl2.style.cssText = 'font-size:19px;color:#aaa;margin-left:30px';
  timerLbl2.textContent = 'Added: ';

  var countEl = document.createElement('span');
  countEl.id = '__yth_count';
  countEl.style.cssText = 'font-size:19px;font-weight:700;color:#4a9';
  countEl.textContent = '0';

  timerRowEl.appendChild(timerLbl1);
  timerRowEl.appendChild(timerEl);
  timerRowEl.appendChild(timerLbl2);
  timerRowEl.appendChild(countEl);
  box.appendChild(timerRowEl);

  // Button row
  var btnRowEl = document.createElement('div');
  btnRowEl.id = '__yth_btn_row';
  btnRowEl.style.cssText = 'display:flex;gap:15px;justify-content:center;flex-wrap:wrap';

  var yesBtn = document.createElement('button');
  yesBtn.id = '__yth_yes';
  yesBtn.style.cssText = [
    'padding:15px 48px', 'background:#44aa44', 'border:none', 'border-radius:6px',
    'color:#fff', 'font-size:19px', 'font-weight:700', 'cursor:pointer', 'font-family:inherit'
  ].join(';');
  yesBtn.textContent = 'Yes';

  var laterBtn = document.createElement('button');
  laterBtn.id = '__yth_later';
  laterBtn.style.cssText = [
    'padding:15px 48px', 'background:#2a2a2a', 'border:1px solid #555', 'border-radius:6px',
    'color:#ccc', 'font-size:19px', 'font-weight:600', 'cursor:pointer', 'font-family:inherit'
  ].join(';');
  laterBtn.textContent = 'Maybe Later';

  btnRowEl.appendChild(yesBtn);
  btnRowEl.appendChild(laterBtn);
  box.appendChild(btnRowEl);

  // Stall warning
  var stallWarning = document.createElement('div');
  stallWarning.id = '__yth_stall';
  stallWarning.style.cssText = 'display:none;margin-top:14px;font-size:13px;color:#882222';
  stallWarning.textContent = 'Page not loading — end of history or network problems?';
  box.appendChild(stallWarning);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  iconEl.onerror = function() { iconEl.style.display = 'none'; iconFb.style.display = 'block'; };
  iconEl.src = chrome.runtime.getURL('icons/icon128.png');

  yesBtn.addEventListener('click', startRunning);
  laterBtn.addEventListener('click', function() { stopAll(); window.close(); });

  // ─── DOM cleaner (speeds up scraping by removing thumbnails) ─────────────────
  var REMOVE_SEL = [
    'a.yt-lockup-view-model__content-image',
    'yt-thumbnail-overlay-progress-bar-view-model',
    'yt-thumbnail-badge-view-model',
    'yt-thumbnail-view-model',
    'ytd-thumbnail',
    'yt-thumbnail-bottom-overlay-view-model'
  ];

  function cleanEl(root) {
    REMOVE_SEL.forEach(function(s) {
      (root.querySelectorAll ? root.querySelectorAll(s) : []).forEach(function(el) { el.remove(); });
    });
  }

  function startDomCleaner() {
    cleanEl(document);
    domObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE) cleanEl(node);
        });
      });
    });
    domObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopDomCleaner() {
    if (domObserver) { domObserver.disconnect(); domObserver = null; }
  }

  // ─── Stall detection ─────────────────────────────────────────────────────────
  function startStallDetector() {
    lastScrollY = window.scrollY; stallSeconds = 0; stallWarning.style.display = 'none';
    if (stallHandle) clearInterval(stallHandle);
    stallHandle = setInterval(function() {
      if (!running) return;
      var currentY = window.scrollY;
      if (currentY === lastScrollY) {
        stallSeconds++;
        if (stallSeconds >= 10) stallWarning.style.display = 'block';
      } else {
        stallSeconds = 0; lastScrollY = currentY; stallWarning.style.display = 'none';
      }
    }, 1000);
  }

  function stopStallDetector() {
    if (stallHandle) { clearInterval(stallHandle); stallHandle = null; }
    stallWarning.style.display = 'none';
  }

  // ─── Run state ────────────────────────────────────────────────────────────────
  function startRunning() {
    running = true; startTime = Date.now() - elapsedMs;
    chrome.runtime.sendMessage({ action: 'yth_enable_blocker' });
    startDomCleaner();
    msgEl.style.display = 'none'; timerRowEl.style.display = 'block';

    var stopBtn = document.createElement('button');
    stopBtn.id = '__yth_stop';
    stopBtn.style.cssText = [
      'width:100%', 'padding:15px', 'background:#cc3333', 'border:none', 'border-radius:6px',
      'color:#fff', 'font-size:21px', 'font-weight:700', 'cursor:pointer', 'font-family:inherit',
      'letter-spacing:0.05em'
    ].join(';');
    stopBtn.textContent = 'Stop';
    stopBtn.addEventListener('click', pauseRunning);
    btnRowEl.replaceChildren(stopBtn);

    chrome.runtime.sendMessage({ action: 'yth_scroll_start' });
    timerHandle  = setInterval(tickTimer, 500);
    scrapeHandle = setInterval(function() { if (running) scrapeVisible(); }, 200);
    startStallDetector();
  }

  function pauseRunning() {
    running = false; elapsedMs = Date.now() - startTime;
    chrome.runtime.sendMessage({ action: 'yth_scroll_stop' });
    stopDomCleaner(); stopStallDetector();
    clearInterval(timerHandle); clearInterval(scrapeHandle);

    var continueBtn = document.createElement('button');
    continueBtn.id = '__yth_continue';
    continueBtn.style.cssText = [
      'flex:1', 'padding:15px 30px', 'background:#44aa44', 'border:none', 'border-radius:6px',
      'color:#fff', 'font-size:19px', 'font-weight:700', 'cursor:pointer', 'font-family:inherit'
    ].join(';');
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', startRunning);

    var quitBtn = document.createElement('button');
    quitBtn.id = '__yth_quit';
    quitBtn.style.cssText = [
      'flex:1', 'padding:15px 30px', 'background:#cc3333', 'border:none', 'border-radius:6px',
      'color:#fff', 'font-size:19px', 'font-weight:700', 'cursor:pointer', 'font-family:inherit'
    ].join(';');
    quitBtn.textContent = 'Quit';
    quitBtn.addEventListener('click', function() { stopAll(); window.close(); });

    btnRowEl.replaceChildren(continueBtn, quitBtn);
  }

  function stopAll() {
    running = false;
    chrome.runtime.sendMessage({ action: 'yth_scroll_stop' });
    chrome.runtime.sendMessage({ action: 'yth_disable_blocker' });
    stopDomCleaner(); stopStallDetector();
    clearInterval(timerHandle); clearInterval(scrapeHandle);
    flushQueue();
  }

  // ─── Timer ────────────────────────────────────────────────────────────────────
  function tickTimer() {
    var ms = Date.now() - startTime;
    var s  = Math.floor(ms / 1000);
    timerEl.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  // ─── Scraping ─────────────────────────────────────────────────────────────────
  function scrapeVisible() {
    document.querySelectorAll('yt-lockup-view-model').forEach(function(el) {
      var p = el.parentElement;
      while (p) {
        if (p.tagName && p.tagName.toLowerCase() === 'ytd-rich-item-renderer') return;
        p = p.parentElement;
      }
      var h3 = el.querySelector(
        'h3.yt-lockup-metadata-view-model__heading-reset, h3.ytLockupMetadataViewModelHeadingReset'
      );
      var title = h3 ? h3.getAttribute('title') : null;
      if (!title || scrapedSet.has(title)) return;
      scrapedSet.add(title);
      var channel = null;
      var chLink = el.querySelector(
        '.yt-lockup-metadata-view-model__text-container a[href^="/@"], ' +
        '.ytLockupMetadataViewModelTextContainer a[href^="/@"]'
      );
      if (chLink) {
        channel = chLink.textContent.trim();
      } else {
        var metaRow = el.querySelector(
          '.yt-content-metadata-view-model__metadata-row, .ytContentMetadataViewModelMetadataRow'
        );
        if (metaRow) {
          var span = metaRow.querySelector('span.yt-core-attributed-string, span.ytCoreAttributedString');
          if (span) channel = span.textContent.trim();
        }
      }
      queueEntry(channel ? (title + CHANNEL_SEP + channel) : title);
    });
  }

  // ─── Batch save ───────────────────────────────────────────────────────────────
  function getTitlePart(entry) {
    var sep = entry.indexOf(CHANNEL_SEP);
    return sep !== -1 ? entry.substring(0, sep).trim() : entry.trim();
  }

  function binInsert(list, entry) {
    var key = getTitlePart(entry).toLowerCase();
    var lo = 0, hi = list.length;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (getTitlePart(list[mid]).toLowerCase().localeCompare(key) < 0) lo = mid + 1;
      else hi = mid;
    }
    list.splice(lo, 0, entry);
  }

  function queueEntry(entry) {
    saveQueue.push(entry);
    if (!saveTimer) saveTimer = setTimeout(flushQueue, 300);
  }

  function flushQueue() {
    saveTimer = null;
    if (saveQueue.length === 0) return;
    var toSave = saveQueue.slice(); saveQueue = [];
    chrome.storage.local.get([YTH_LIST_KEY], function(r) {
      var list = Array.isArray(r[YTH_LIST_KEY]) ? r[YTH_LIST_KEY] : [];
      if (!storedSetReady) {
        list.forEach(function(e) { storedSet.add(getTitlePart(e).toLowerCase()); });
        storedSetReady = true;
      }
      var added = 0;
      toSave.forEach(function(entry) {
        var key = getTitlePart(entry).toLowerCase();
        if (storedSet.has(key)) return;
        storedSet.add(key);
        binInsert(list, entry);
        added++;
      });
      if (added === 0) return;
      chrome.storage.local.set({ [YTH_LIST_KEY]: list }, function() {
        addedCount += added;
        countEl.textContent = addedCount;
      });
    });
  }
}
