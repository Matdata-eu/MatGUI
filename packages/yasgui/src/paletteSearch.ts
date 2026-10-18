/**
 * Match `query` against an item: every word of the query has to occur in the label, the detail or
 * the keywords. Returns a score (higher is better), or -1 when the item doesn't match.
 */
export function scorePaletteItem(item: { label: string; detail?: string; keywords?: string }, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const label = item.label.toLowerCase();
  const haystack = `${label} ${(item.detail || "").toLowerCase()} ${(item.keywords || "").toLowerCase()}`;
  let score = 0;
  for (const word of words) {
    const index = haystack.indexOf(word);
    if (index < 0) return -1;
    if (label.startsWith(word)) score += 3;
    else if (label.includes(` ${word}`)) score += 2;
    else if (index < label.length) score += 1;
  }
  return score;
}
