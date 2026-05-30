import type { ParsedReceiptItem } from '../types';

// ─── ICA Supermarket receipt parser ──────────────────────────────────────────
// pdf-parse extracts ICA Kivra receipts column-by-column, NOT row-by-row.
// Strategy: extract each column (names, articles, prices, quantities) separately,
// then zip them together by position.

const SKIP_NAMES = new Set(['pant', 'plastpåse', 'kasse', 'presentkort', 'lotter', 'tidning']);
const META_NAMES = new Set(['datum', 'tid', 'org nr', 'kvitto nr', 'kassa', 'kassör']);

function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.').replace(/\s/g, ''));
}

/** Extract text between two markers (first occurrence of each). */
function between(text: string, startMarker: string, endMarker: string): string {
  const si = text.indexOf(startMarker);
  if (si < 0) return '';
  const from = si + startMarker.length;
  const ei = text.indexOf(endMarker, from);
  return ei < 0 ? text.slice(from) : text.slice(from, ei);
}

export function parseICAReceipt(text: string): ParsedReceiptItem[] {
  // ── 1. Names column ─────────────────────────────────────────────────────────
  // Sits between "Beskrivning" and "Artikelnummer"
  const nameSection = between(text, 'Beskrivning', 'Artikelnummer');
  const nameGroups = nameSection.split(/\n{2,}/).map(g => g.trim()).filter(Boolean);

  const names: Array<{ name: string; star: boolean }> = [];
  for (const group of nameGroups) {
    const first = group.split('\n')[0].trim();
    if (!first) continue;
    if (META_NAMES.has(first.toLowerCase())) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(first)) continue; // date metadata
    if (/^\d{2}:\d{2}/.test(first)) continue;        // time metadata
    if (/^SE\d+/.test(first)) continue;               // org number metadata
    const star = first.startsWith('*');
    const name = first.replace(/^\*\s*/, '').trim();
    if (name) names.push({ name, star });
  }

  // ── 2. Article numbers column ───────────────────────────────────────────────
  const articleSection = between(text, 'Artikelnummer', '\nPris');
  const articles: string[] = (articleSection.match(/\b\d{6,8}\b/g) ?? []);

  // ── 3. Prices column ────────────────────────────────────────────────────────
  // Between "\nPris\n" and "\nMängd\n"; only positive decimal numbers
  const priceSection = between(text, '\nPris\n', '\nMängd');
  const prices: number[] = (priceSection.match(/\b\d+,\d+\b/g) ?? [])
    .map(s => parseNum(s));

  // ── 4. Quantities column ────────────────────────────────────────────────────
  // After "Summa(SEK)" — quantities have "st" or "kg" suffix
  const afterSumma = text.slice(text.indexOf('Summa(SEK)') + 'Summa(SEK)'.length);
  const qtyMatches = [...afterSumma.matchAll(/([\d,]+)\s+(st|kg)/gi)];
  const quantities = qtyMatches.map(m => ({
    amount: parseNum(m[1]),
    unit: m[2].toLowerCase() as 'st' | 'kg',
  }));

  // ── 5. Zip columns ──────────────────────────────────────────────────────────
  // Names and prices include Pant; articles and quantities exclude it.
  // Walk names in order: skip SKIP items (don't advance art/qty index).
  const result: ParsedReceiptItem[] = [];
  let artIdx = 0;
  let qtyIdx = 0;

  for (let i = 0; i < names.length; i++) {
    const { name, star } = names[i];
    const pris = prices[i] ?? 0;

    if (SKIP_NAMES.has(name.toLowerCase())) continue;

    const articleNumber = articles[artIdx++] ?? '';
    const qty = quantities[qtyIdx++];

    if (!articleNumber || pris <= 0 || !qty) continue;

    result.push({
      name,
      articleNumber,
      pris,
      amount: qty.amount,
      unit: qty.unit,
      hasDiscount: star,
      selected: true,
    });
  }

  // ── 6. Deduplicate by articleNumber ─────────────────────────────────────────
  // For items that appear twice (starred + unstarred), keep the non-starred (full price).
  const seen = new Map<string, ParsedReceiptItem>();
  for (const item of result) {
    const prev = seen.get(item.articleNumber);
    if (!prev || (prev.hasDiscount && !item.hasDiscount)) {
      seen.set(item.articleNumber, item);
    }
  }

  return Array.from(seen.values());
}

// ─── Derive price per 100g from a pantry/receipt item ────────────────────────
export function derivePricePer100g(
  pris: number,
  unit: 'st' | 'kg',
  unitWeightGrams?: number,
): number | null {
  if (unit === 'kg') return pris / 10;
  if (unit === 'st' && unitWeightGrams) return (pris / unitWeightGrams) * 100;
  return null;
}
