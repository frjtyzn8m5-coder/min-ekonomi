import type { Holding } from '../types';

function parseNum(s: string | undefined): number {
  if (!s || s.trim() === '') return 0;
  return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0;
}

interface AvanzaRow {
  date: string;
  account: string;
  type: string;
  name: string;
  antal: string;
  kurs: string;
  instrumentCurrency: string;
  isin: string;
}

function splitSemicolon(line: string): string[] {
  return line.split(';').map(s => s.trim());
}

function parseAvanzaRows(content: string): AvanzaRow[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => /datum/i.test(l) && /konto/i.test(l));
  if (headerIdx < 0) return [];
  const rows: AvanzaRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitSemicolon(lines[i]);
    if (cols.length < 12) continue;
    rows.push({
      date: cols[0],
      account: cols[1],
      type: cols[2],
      name: cols[3],
      antal: cols[4],
      kurs: cols[5],
      instrumentCurrency: cols[10] || 'SEK',
      isin: cols[11],
    });
  }
  return rows;
}

// Only these transaction types actually change the share count
const SHARE_CHANGING_TYPES = new Set([
  'Köp', 'Sälj', 'Byte', 'Inlösen', 'Avskiljning', 'Värdepappersuttag',
]);

export function computeHoldings(content: string): Holding[] {
  const rows = parseAvanzaRows(content);

  // Map ISIN::account → holding (shares + weighted avg price per account)
  const map = new Map<string, Holding>();

  for (const row of rows) {
    if (!row.isin) continue;
    if (!SHARE_CHANGING_TYPES.has(row.type)) continue; // skip Utdelning, Insättning, etc.
    const antal = parseNum(row.antal);
    if (antal === 0) continue;

    const key = `${row.isin}::${row.account}`;
    const existing: Holding = map.get(key) ?? {
      isin: row.isin,
      name: row.name || row.isin,
      shares: 0,
      avgBuyPrice: 0,
      currency: row.instrumentCurrency || 'SEK',
      account: row.account,
    };

    // Update weighted average only on purchases
    if (antal > 0 && row.type === 'Köp') {
      const kurs = parseNum(row.kurs);
      const prevCost = existing.avgBuyPrice * existing.shares;
      existing.shares += antal;
      existing.avgBuyPrice = existing.shares > 0
        ? (prevCost + kurs * antal) / existing.shares
        : 0;
    } else {
      // Sälj, Byte, Inlösen, Avskiljning, Värdepappersuttag – just adjust count
      existing.shares += antal;
    }

    // Keep most descriptive name
    if (row.name && row.name.length > existing.name.length) {
      existing.name = row.name;
    }

    map.set(key, existing);
  }

  // Only return active holdings (filter rounding noise)
  return [...map.values()].filter(h => h.shares > 0.0001);
}

export function computeHoldingsFromXLSX(rows: string[][]): Holding[] {
  const headerIdx = rows.findIndex(r => r.some(c => /datum/i.test(String(c))));
  if (headerIdx < 0) return [];

  const csvRows: AvanzaRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cols = rows[i].map(c => String(c ?? '').trim());
    if (cols.length < 12) continue;
    csvRows.push({
      date: cols[0],
      account: cols[1],
      type: cols[2],
      name: cols[3],
      antal: cols[4],
      kurs: cols[5],
      instrumentCurrency: cols[10] || 'SEK',
      isin: cols[11],
    });
  }

  return computeHoldings(
    ['Datum;Konto;Typ av transaktion;Värdepapper/beskrivning;Antal;Kurs;Belopp;Transaktionsvaluta;Courtage;Valutakurs;Instrumentvaluta;ISIN;Resultat',
      ...csvRows.map(r =>
        `${r.date};${r.account};${r.type};${r.name};${r.antal};${r.kurs};;;;;;;${r.isin};`
      )
    ].join('\n')
  );
}
