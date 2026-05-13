// background.js
// 1. Relays scroll start/stop messages from history_overlay.js to history_scroller.js
// 2. Enables/disables the thumbnail-blocking network ruleset for the retrieve flow

function enableBlocker() {
  chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds:  ['ruleset_1'],
    disableRulesetIds: []
  });
}

function disableBlocker() {
  chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds:  [],
    disableRulesetIds: ['ruleset_1']
  });
}

chrome.runtime.onMessage.addListener(function(msg, sender) {
  if (msg.action === 'yth_scroll_start' || msg.action === 'yth_scroll_stop') {
    chrome.tabs.query({ url: 'https://www.youtube.com/feed/history*' }, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.tabs.sendMessage(tab.id, { action: msg.action });
      });
    });
  }
  if (msg.action === 'yth_enable_blocker')  enableBlocker();
  if (msg.action === 'yth_disable_blocker') disableBlocker();
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
  if (changeInfo.url && !changeInfo.url.includes('youtube.com/feed/history')) {
    disableBlocker();
  }
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  chrome.tabs.query({ url: 'https://www.youtube.com/feed/history*' }, function(tabs) {
    if (tabs.length === 0) disableBlocker();
  });
});
