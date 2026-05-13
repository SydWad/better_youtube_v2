// content/flag_watched.js
// Progress bar detection: saves to watch history only.
// History list lookup: flags for hiding when per-page "Watched Videos" toggle is on.

function ythFlagWatched(renderer, list) {
  // Progress bar — save to history list; hiding is handled by the history lookup below
  if (ythSettings.pw_enabled) {
    var bar = renderer.querySelector('#progress') ||
              renderer.querySelector('.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment');
    if (bar) {
      var pct = parseInt(bar.style.width) || 0;
      if (pct >= ythSettings.pw_threshold) {
        if (!ythSettings.wl_disabled) {
          var pwTitle   = ythExtractTitle(renderer);
          var pwChannel = ythExtractChannel(renderer);
          if (pwTitle) {
            ythLog('[YT Hider] partially watched (' + pct + '%):', pwTitle);
            ythSaveEntry(pwChannel ? (pwTitle + CHANNEL_SEP + pwChannel) : pwTitle);
          }
        }
      }
    }
  }

  // History list lookup — hide only when per-page "Watched Videos" toggle is on
  if (ythGetPageSettings().hide_watched && !ythSettings.wl_disabled && list) {
    if (ythIsPageFiltered()) {
      var title   = ythExtractTitle(renderer);
      var channel = ythExtractChannel(renderer);
      if (title && ythEntryInList(list, title, channel)) {
        ythLog('[YT Hider] flagging watched:', title, channel ? ('(' + channel + ')') : '');
        ythMarkRenderer(renderer, 'watched');
      }
    }
  }
}
