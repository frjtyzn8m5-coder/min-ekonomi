import type { ParsedReceiptItem } from '../types';

// ─── ICA receipt parser ────────────────────────────────────────────────────────
//
// Handles ICA Supermarket receipts from Kivra (PDF → text via pdf-parse).
//
// pdf-parse may extract text in two ways depending on PDF structure:
//   ROW-BASED  (most common): each product on one line
//     "*Avocado 1393031 12,50 2,00 st 30,18"
//   COLUMN-BASED (older Kivra format): each column extracted separately
//     "Beskrivning\n*Avocado\nBlandfärs..." then "Artikelnummer\n1393031..."
//
// We try row-based first, then fall back to column-based.

const SKIP_NAMES = new Set([
  'pant', 'plastpåse', 'kasse', 'presentkort', 'lotter', 'tidning',
]);
const META_NAMES = new Set(['datum', 'tid', 'org nr', 'kvitto nr', 'kassa', 'kassör']);

function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.').replace(/\s/g, ''));
}

function between(text: string, startMarker: string, endMarker: string): string {
  const si = text.indexOf(startMarker);
  if (si < 0) return '';
  const from = si + startMarker.length;
  const ei = text.indexOf(endMarker, from);
  return ei < 0 ? text.slice(from) : text.slice(from, ei);
}

// ─── Row-based parser ─────────────────────────────────────────────────────────

function parseRowBased(text: string): ParsedReceiptItem[] {
  // Find the table section — between header row and "Betalat"
  const headerIdx = text.search(/beskrivning\s+artikelnummer/i);
  const footerIdx = text.search(/\nBetalat\s+[\d,]+/);
  const tableText = headerIdx >= 0
    ? text.slice(headerIdx, footerIdx > 0 ? footerIdx : undefined)
    : text;

  const lines = tableText.split('\n').map(l => l.trim()).filter(Boolean);
  const items: ParsedReceiptItem[] = [];

  for (const line of lines) {
    if (/^beskrivning/i.test(line)) continue;
    // Skip lines without a 6-8 digit article number
    if (!/\b\d{6,8}\b/.test(line)) continue;
    // Skip discount continuation lines (no own article nr, negative sum)
    if (/^[-–]/.test(line)) continue;

    // Full pattern: [*]NAME ARTICLE UNIT_PRICE AMOUNT (st|kg) TOTAL
    const m = line.match(
      /^(\*?)(.+?)\s+(\d{6,8})\s+([\d,]+)\s+([\d,]+)\s+(st|kg)\s+([\d,]+)$/i,
    );
    if (m) {
      const name = m[2].trim().replace(/^\*/, '').trim();
      if (SKIP_NAMES.has(name.toLowerCase())) continue;
      const articleNumber = m[3];
      const amount = parseNum(m[5]);
      const unit = m[6].toLowerCase() as 'st' | 'kg';
      const summa = parseNum(m[7]);
      // Use paid sum / amount for effective per-unit price (includes discounts)
      const pris = amount > 0 ? summa / amount : parseNum(m[4]);
      if (pris <= 0) continue;
      const hasDiscount = m[1] === '*';
      items.push({ name, articleNumber, pris, amount, unit, hasDiscount, selected: true });
      continue;
    }

    // Simpler pattern without unit token: NAME ARTICLE PRICE1 PRICE2 TOTAL
    const m2 = line.match(/^(\*?)(.+?)\s+(\d{6,8})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$/i);
    if (m2) {
      const name = m2[2].trim().replace(/^\*/, '').trim();
      if (SKIP_NAMES.has(name.toLowerCase())) continue;
      const articleNumber = m2[3];
      const amount = parseNum(m2[4]);
      const summa = parseNum(m2[5]);
      if (summa <= 0 || amount <= 0) continue;
      items.push({
        name, articleNumber,
        pris: summa / amount,
        amount, unit: 'st',
        hasDiscount: m2[1] === '*',
        selected: true,
      });
    }
  }

  return dedup(items);
}

// ─── Column-based parser (ICA Kivra legacy format) ───────────────────────────

function parseColumnBased(text: string): ParsedReceiptItem[] {
  // ── Names column (between "Beskrivning" and "Artikelnummer") ──
  const nameSection = between(text, 'Beskrivning', 'Artikelnummer');
  const nameGroups = nameSection.split(/\n{2,}/).map(g => g.trim()).filter(Boolean);

  const names: Array<{ name: string; star: boolean }> = [];
  for (const group of nameGroups) {
    const first = group.split('\n')[0].trim();
    if (!first) continue;
    if (META_NAMES.has(first.toLowerCase())) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(first)) continue;
    if (/^\d{2}:\d{2}/.test(first)) continue;
    if (/^SE\d+/.test(first)) continue;
    const star = first.startsWith('*');
    const name = first.replace(/^\*\s*/, '').trim();
    if (name) names.push({ name, star });
  }

  // ── Article numbers ──
  const articleSection = between(text, 'Artikelnummer', '\nPris');
  const articles: string[] = articleSection.match(/\b\d{6,8}\b/g) ?? [];

  // ── Prices ──
  const priceSection = between(text, '\nPris\n', '\nMängd');
  const prices: number[] = (priceSection.match(/\b\d+[,.]\d+\b/g) ?? []).map(parseNum);

  // ── Quantities (after Summa(SEK)) ──
  const afterSumma = text.slice(text.indexOf('Summa(SEK)') + 'Summa(SEK)'.length);
  const qtyMatches = [...afterSumma.matchAll(/([\d,]+)\s+(st|kg)/gi)];
  const quantities = qtyMatches.map(m => ({
    amount: parseNum(m[1]),
    unit: m[2].toLowerCase() as 'st' | 'kg',
  }));

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
      name, articleNumber, pris,
      amount: qty.amount,
      unit: qty.unit,
      hasDiscount: star,
      selected: true,
    });
  }

  return dedup(result);
}

// ─── Last-resort: scan all lines ─────────────────────────────────────────────

function parseFallback(text: string): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (!/\d{7}/.test(line)) continue;
    if (!/\d+[,.]\d+/.test(line)) continue;
    const artM = line.match(/\b(\d{6,8})\b/);
    const priceM = line.match(/\b(\d{2,4}[,.]\d{2})\b/);
    const nameM = line.match(/^(\*?)([A-Za-zÅÄÖåäö%][A-Za-zÅÄÖåäö\s/\-&%.0-9]*?)\s+\d{6,8}/);
    if (artM && priceM && nameM) {
      const name = nameM[2].trim();
      if (!name || SKIP_NAMES.has(name.toLowerCase())) continue;
      items.push({
        name, articleNumber: artM[1],
        pris: parseNum(priceM[1]),
        amount: 1, unit: 'st',
        hasDiscount: nameM[1] === '*',
        selected: true,
      });
    }
  }
  return dedup(items);
}

// ─── Dedup: for items appearing twice (discounted), keep the one with actual price ──

function dedup(items: ParsedReceiptItem[]): ParsedReceiptItem[] {
  const seen = new Map<string, ParsedReceiptItem>();
  for (const item of items) {
    const prev = seen.get(item.articleNumber);
    if (!prev || (prev.hasDiscount && !item.hasDiscount)) {
      seen.set(item.articleNumber, item);
    }
  }
  return Array.from(seen.values());
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function parseICAReceipt(text: string): ParsedReceiptItem[] {
  const rowItems = parseRowBased(text);
  if (rowItems.length > 0) return rowItems;

  const colItems = parseColumnBased(text);
  if (colItems.length > 0) return colItems;

  return parseFallback(text);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function derivePricePer100g(
  pris: number,
  unit: 'st' | 'kg',
  unitWeightGrams?: number,
): number | null {
  if (unit === 'kg') return pris / 10;
  if (unit === 'st' && unitWeightGrams) return (pris / unitWeightGrams) * 100;
  return null;
}
