// content/advanced/flag_playlists.js

function ythIsPlaylist(renderer) {
  if (ythGetPageType() === 'channel') return false;
  // Structural indicators
  if (renderer.querySelector('ytd-playlist-thumbnail')) return true;
  if (renderer.querySelector('ytd-thumbnail-overlay-side-panel-renderer')) return true;
  if (renderer.classList && renderer.classList.contains('yt-lockup-view-model--collection-stack-2')) return true;
  if (renderer.querySelector('yt-collection-thumbnail-view-model')) return true;
  // New-style badge shapes
  var badges = renderer.querySelectorAll('.yt-badge-shape__text, .ytBadgeShapeText');
  for (var i = 0; i < badges.length; i++) {
    var t = badges[i].textContent.trim();
    if (t === 'Mix' || t === 'Playlist') return true;
  }
  // Legacy badge renderer
  var legacyBadges = renderer.querySelectorAll('ytd-badge-supported-renderer');
  for (var i = 0; i < legacyBadges.length; i++) {
    var lt = legacyBadges[i].textContent.trim();
    if (lt === 'Mix' || lt === 'Playlist') return true;
  }
  return false;
}

function ythFlagPlaylists(renderer) {
  if (!ythIsPageFiltered() || !ythGetPageSettings().hide_playlists) return;
  if (ythIsPlaylist(renderer)) ythMarkRenderer(renderer, 'playlist');
}
