// ─── Reference grocery prices (SEK/kg) ─────────────────────────────────────────
// Rough Swedish grocery averages (ICA/Coop normalpris, ~2025) used ONLY as a last
// fallback so recipe/shopping cost estimates work out-of-the-box before the user has
// scanned any receipts. Real priceDB/pantry prices always take precedence. These are
// ESTIMATES — surface them as such in the UI.

export const REFERENCE_PRICES_SEK_PER_KG: Record<string, number> = {
  // Protein
  'köttfärs': 90, 'nötfärs': 120, 'blandfärs': 95, 'fläskfärs': 85,
  'kyckling': 85, 'kycklingfilé': 110, 'kycklinglårfilé': 80,
  'fläskkotlett': 90, 'fläskkarré': 80, 'bacon': 120, 'korv': 70, 'falukorv': 55,
  'nötkött': 160, 'biff': 230, 'oxfilé': 420, 'skinka': 120,
  'lax': 180, 'laxfilé': 200, 'torsk': 170, 'räkor': 220, 'fiskpinnar': 70,
  'ägg': 40, 'tofu': 55, 'halloumi': 120, 'quorn': 110,
  // Dairy
  'mjölk': 13, 'standardmjölk': 13, 'mellanmjölk': 13, 'grädde': 35, 'vispgrädde': 40,
  'crème fraiche': 55, 'gräddfil': 40, 'smör': 90, 'margarin': 35,
  'ost': 90, 'riven ost': 100, 'parmesan': 240, 'fetaost': 110, 'keso': 45,
  'yoghurt': 20, 'kvarg': 45,
  // Pantry / carbs
  'pasta': 20, 'spaghetti': 20, 'makaroner': 18, 'ris': 22, 'jasminris': 28, 'basmatiris': 30,
  'bulgur': 30, 'couscous': 30, 'quinoa': 60, 'mjöl': 15, 'vetemjöl': 15, 'havregryn': 18,
  'potatis': 12, 'sötpotatis': 25, 'linser': 35, 'kikärtor': 25, 'bönor': 25, 'krossade tomater': 15,
  'tomatpuré': 40, 'kokosmjölk': 35, 'buljong': 60, 'olja': 35, 'olivolja': 90,
  // Produce
  'gul lök': 15, 'rödlök': 20, 'vitlök': 60, 'morot': 15, 'paprika': 45, 'tomat': 35,
  'gurka': 25, 'sallad': 60, 'spenat': 70, 'broccoli': 35, 'blomkål': 30, 'champinjoner': 60,
  'zucchini': 35, 'aubergine': 40, 'purjolök': 30, 'ingefära': 90, 'citron': 40, 'lime': 60,
  'äpple': 25, 'banan': 22, 'bär': 60, 'frysta bär': 55,
  // Misc
  'socker': 18, 'honung': 90, 'senap': 60, 'ketchup': 35, 'soja': 50, 'sojasås': 50,
};

/** Best-effort reference price (SEK/kg) for an ingredient name, or null if unknown. */
export function referencePricePerKg(name: string): number | null {
  const lower = name.toLowerCase().trim();
  if (REFERENCE_PRICES_SEK_PER_KG[lower] != null) return REFERENCE_PRICES_SEK_PER_KG[lower];
  let best: { k: string; v: number } | null = null;
  for (const k of Object.keys(REFERENCE_PRICES_SEK_PER_KG)) {
    if (lower.includes(k) || k.includes(lower)) {
      if (!best || k.length > best.k.length) best = { k, v: REFERENCE_PRICES_SEK_PER_KG[k] };
    }
  }
  return best ? best.v : null;
}
