// content/advanced/flag_autodubed.js

function ythIsAutoDub(renderer) {
  // New-style badge shapes (rich grid, lockup)
  var badges = renderer.querySelectorAll('.yt-badge-shape__text, .ytBadgeShapeText');
  for (var i = 0; i < badges.length; i++) {
    if (badges[i].textContent.trim().toLowerCase() === 'auto-dubbed') return true;
  }
  // Metadata row labels — compact/sidebar view shows autodub as a text label, not a badge
  var metaTexts = renderer.querySelectorAll(
    '.yt-content-metadata-view-model__metadata-text, .ytContentMetadataViewModelMetadataText'
  );
  for (var i = 0; i < metaTexts.length; i++) {
    if (metaTexts[i].textContent.trim().toLowerCase() === 'auto-dubbed') return true;
  }
  // Legacy badge renderer (older YouTube renderer paths)
  var legacyBadges = renderer.querySelectorAll('ytd-badge-supported-renderer');
  for (var i = 0; i < legacyBadges.length; i++) {
    if (legacyBadges[i].textContent.trim().toLowerCase().indexOf('dubbed') !== -1) return true;
  }
  return false;
}

function ythFlagAutodub(renderer) {
  if (!ythIsPageFiltered() || !ythGetPageSettings().hide_autodub) return;
  if (ythIsAutoDub(renderer)) ythMarkRenderer(renderer, 'autodub');
}
