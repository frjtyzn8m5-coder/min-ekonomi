import type { ParsedReceiptItem } from '../types';

// ─── ICA Supermarket receipt parser ──────────────────────────────────────────
// Parses text extracted from Kivra PDF receipts.
// Uses original "Pris" column (not discounted "Summa").
// Skips Pant (bottle deposits) and non-food discount lines.

const SKIP_NAMES = ['pant', 'plastpåse', 'kasse', 'presentkort', 'lotter', 'tidning'];

function parsePrice(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

export function parseICAReceipt(text: string): ParsedReceiptItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Find the item table header
  const headerIdx = lines.findIndex(l =>
    l.toLowerCase().includes('beskrivning') && l.toLowerCase().includes('artikelnummer')
  );
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;

  // Pattern: (optional *)(name)(6-8 digit article nr)(pris)(amount)(st|kg)(summa)
  // pdf-parse may produce single or double spaces between columns
  const itemRe = /^(\*\s*)?(.+?)\s+(\d{6,8})\s+([\d,]+)\s+([\d,]+)\s+(st|kg)\s+([\d,]+)/i;

  // Fallback: no summa column at end (some lines omit it)
  const itemRe2 = /^(\*\s*)?(.+?)\s+(\d{6,8})\s+([\d,]+)\s+([\d,]+)\s+(st|kg)/i;

  const seen = new Map<string, ParsedReceiptItem>();

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Stop at payment/summary section
    if (/^(betalat|moms\s*%|betalnings|erhållen|avrundning|kort\s+\d|köp\s+\d)/i.test(line)) break;

    const match = line.match(itemRe) || line.match(itemRe2);
    if (!match) continue;

    const star = match[1] || '';
    const rawName = match[2].trim();
    const articleNumber = match[3];
    const pris = parsePrice(match[4]);
    const amount = parsePrice(match[5]);
    const unit = match[6].toLowerCase() as 'st' | 'kg';

    // Skip non-food items
    const nameLower = rawName.toLowerCase();
    if (SKIP_NAMES.some(s => nameLower.includes(s))) continue;
    if (pris <= 0) continue;

    const hasDiscount = star.includes('*');

    const item: ParsedReceiptItem = {
      name: rawName,
      articleNumber,
      pris,
      amount,
      unit,
      hasDiscount,
      selected: true,
    };

    // If same articleNumber seen before as * and now without *, prefer non-* (full original price)
    if (seen.has(articleNumber)) {
      const prev = seen.get(articleNumber)!;
      if (prev.hasDiscount && !hasDiscount) {
        seen.set(articleNumber, item);
      }
      // If both are *, keep first
    } else {
      seen.set(articleNumber, item);
    }
  }

  return Array.from(seen.values());
}

// ─── Derive price per 100g from a pantry/receipt item ────────────────────────
export function derivePricePer100g(
  pris: number,
  unit: 'st' | 'kg',
  unitWeightGrams?: number
): number | null {
  if (unit === 'kg') return pris / 10; // kr/kg → kr/100g
  if (unit === 'st' && unitWeightGrams) return (pris / unitWeightGrams) * 100;
  return null;
}
