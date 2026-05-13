// content/advanced/flag_upcoming-scheduled.js

function ythIsUpcoming(renderer) {
  // Thumbnail overlay
  var overlay = renderer.querySelector('ytd-thumbnail-overlay-time-status-renderer');
  if (overlay && overlay.getAttribute('overlay-style') === 'UPCOMING') return true;
  // New-style badge shapes
  var badges = renderer.querySelectorAll('.yt-badge-shape__text, .ytBadgeShapeText');
  for (var i = 0; i < badges.length; i++) {
    if (badges[i].textContent.trim() === 'Upcoming') return true;
  }
  // Metadata row labels — "Upcoming" or "Scheduled for <date>"
  var metaTexts = renderer.querySelectorAll(
    '.yt-content-metadata-view-model__metadata-text, .ytContentMetadataViewModelMetadataText'
  );
  for (var i = 0; i < metaTexts.length; i++) {
    var t = metaTexts[i].textContent.trim();
    if (t === 'Upcoming' || t.indexOf('Scheduled for') === 0) return true;
  }
  // "Notify me" button — unique to scheduled/upcoming videos
  var btnLabels = renderer.querySelectorAll('.ytSpecButtonShapeNextButtonTextContent');
  for (var i = 0; i < btnLabels.length; i++) {
    if (btnLabels[i].textContent.trim() === 'Notify me') return true;
  }
  // Legacy badge renderer
  var legacyBadges = renderer.querySelectorAll('ytd-badge-supported-renderer');
  for (var i = 0; i < legacyBadges.length; i++) {
    if (legacyBadges[i].textContent.trim() === 'Upcoming') return true;
  }
  return false;
}

function ythFlagUpcoming(renderer) {
  if (!ythIsPageFiltered() || !ythGetPageSettings().hide_upcoming) return;
  if (ythIsUpcoming(renderer)) ythMarkRenderer(renderer, 'upcoming');
}
