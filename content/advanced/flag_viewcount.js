// content/advanced/flag_viewcount.js

function ythFlagViewCount(renderer) {
  if (!ythIsPageFiltered()) return;
  var ps = ythGetPageSettings();
  if (!ps.view_count_enabled || ps.view_count_min <= 0) return;
  var views = ythExtractViewCount(renderer);
  if (views !== null && views < ps.view_count_min) {
    ythLog('[YT Hider] flagging by view count (' + views + '):', ythExtractTitle(renderer));
    ythMarkRenderer(renderer, 'views');
  }
}
