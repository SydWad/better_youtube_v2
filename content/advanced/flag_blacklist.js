// content/advanced/flag_blacklist.js
// Hides matching titles without saving to watch history.

function ythFlagBlacklist(renderer) {
  if (!ythIsPageFiltered()) return;
  var ps = ythGetPageSettings();
  if (!ps.blacklist_enabled || !ps.blacklist_words) return;
  var title = ythExtractTitle(renderer);
  if (!title) return;
  var lower = title.toLowerCase();
  var words = ps.blacklist_words.split(',');
  for (var i = 0; i < words.length; i++) {
    var word = words[i].trim().toLowerCase();
    if (word && lower.indexOf(word) !== -1) {
      ythLog('[YT Hider] flagging by blacklist (' + word + '):', title);
      ythMarkRenderer(renderer, 'blacklist');
      return;
    }
  }
}
