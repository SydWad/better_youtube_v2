// content/flag_membersonly.js

function ythIsMembersOnly(renderer) {
  // New-style badge shapes with commerce class
  var badges = renderer.querySelectorAll('badge-shape');
  for (var i = 0; i < badges.length; i++) {
    var b = badges[i];
    if (b.classList && (
      b.classList.contains('yt-badge-shape--commerce') ||
      b.classList.contains('ytBadgeShapeCommerce')
    )) {
      var txt = b.querySelector(
        '.yt-badge-shape__text, .ytBadgeShapeText, .ytBadgeShapeTextHasMultipleBadgesInRow'
      );
      if (txt && txt.textContent.trim().toLowerCase().indexOf('members') !== -1) return true;
    }
    if (b.getAttribute('aria-label') === 'Members only') return true;
  }
  // Metadata row labels — compact/sidebar view
  var metaTexts = renderer.querySelectorAll(
    '.yt-content-metadata-view-model__metadata-text, .ytContentMetadataViewModelMetadataText'
  );
  for (var i = 0; i < metaTexts.length; i++) {
    if (metaTexts[i].textContent.trim().toLowerCase().indexOf('members') !== -1) return true;
  }
  // Legacy badge renderer
  var legacyBadges = renderer.querySelectorAll('ytd-badge-supported-renderer');
  for (var i = 0; i < legacyBadges.length; i++) {
    if (legacyBadges[i].textContent.trim().toLowerCase().indexOf('members') !== -1) return true;
  }
  return false;
}

function ythFlagMembers(renderer) {
  if (!ythIsPageFiltered() || !ythGetPageSettings().hide_members) return;
  if (ythIsMembersOnly(renderer)) ythMarkRenderer(renderer, 'members');
}
