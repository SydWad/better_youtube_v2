// content/advanced/flag_livestreams.js

function ythIsLive(renderer) {
  // Polymer attribute (ytd-rich-item-renderer, ytd-video-renderer)
  if (renderer.getAttribute && renderer.getAttribute('data-is-live') === 'true') return true;
  // Thumbnail overlay
  var overlay = renderer.querySelector('ytd-thumbnail-overlay-time-status-renderer');
  if (overlay && overlay.getAttribute('overlay-style') === 'LIVE') return true;
  // New-style badge shapes
  var badges = renderer.querySelectorAll('.yt-badge-shape__text, .ytBadgeShapeText');
  for (var i = 0; i < badges.length; i++) {
    if (badges[i].textContent.trim() === 'LIVE') return true;
  }
  // Metadata row labels — compact/sidebar view
  var metaTexts = renderer.querySelectorAll(
    '.yt-content-metadata-view-model__metadata-text, .ytContentMetadataViewModelMetadataText'
  );
  for (var i = 0; i < metaTexts.length; i++) {
    if (metaTexts[i].textContent.trim() === 'LIVE') return true;
  }
  // Legacy badge renderer
  var legacyBadges = renderer.querySelectorAll('ytd-badge-supported-renderer');
  for (var i = 0; i < legacyBadges.length; i++) {
    if (legacyBadges[i].textContent.trim() === 'LIVE') return true;
  }
  return false;
}

function ythFlagLive(renderer) {
  if (!ythIsPageFiltered() || !ythGetPageSettings().hide_live) return;
  if (ythIsLive(renderer)) ythMarkRenderer(renderer, 'live');
}
