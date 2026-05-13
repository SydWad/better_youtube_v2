// content/advanced/flag_length.js

function ythFlagLength(renderer) {
  if (!ythIsPageFiltered()) return;
  var ps = ythGetPageSettings();
  if (!ps.length_enabled) return;
  var dur = ythExtractDuration(renderer);
  if (dur === null) return;
  var minMins = ythParseFilterTime(ps.length_min);
  var maxMins = ythParseFilterTime(ps.length_max);
  if ((minMins !== null && dur < minMins) || (maxMins !== null && dur > maxMins)) {
    ythLog('[YT Hider] flagging by length (' + dur.toFixed(1) + 'min):', ythExtractTitle(renderer));
    ythMarkRenderer(renderer, 'length');
  }
}
