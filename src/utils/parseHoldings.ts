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
  belopp: string;
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
      belopp: cols[6],
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
      totalCostSEK: 0,
      realizedGainSEK: 0,
    };

    // SEK amount of this trade at trade time. Prefer the export's 'Belopp'
    // (already in SEK, fx applied at trade time); fall back to kurs*antal.
    const kurs = parseNum(row.kurs);
    const belopp = parseNum(row.belopp);
    const amountSEK = belopp !== 0 ? Math.abs(belopp) : Math.abs(kurs * antal);

    // Update weighted average only on purchases
    if (antal > 0 && row.type === 'Köp') {
      const prevCost = existing.avgBuyPrice * existing.shares;
      existing.shares += antal;
      existing.avgBuyPrice = existing.shares > 0
        ? (prevCost + kurs * antal) / existing.shares
        : 0;
      // Accurate SEK cost basis using the trade's actual SEK amount.
      existing.totalCostSEK = (existing.totalCostSEK ?? 0) + amountSEK;
      if (!existing.firstBuyDate) existing.firstBuyDate = row.date;
    } else if (antal < 0 && row.type === 'Sälj') {
      // Sale: reduce shares, remove cost proportionally, book realized gain.
      const sharesSold = Math.min(-antal, existing.shares);
      const costPerShare = existing.shares > 0
        ? (existing.totalCostSEK ?? 0) / existing.shares
        : 0;
      const costRemoved = costPerShare * sharesSold;
      existing.shares += antal; // antal is negative
      existing.totalCostSEK = Math.max(0, (existing.totalCostSEK ?? 0) - costRemoved);
      // Proceeds come from the Sälj row's SEK amount; prorate if partial fill.
      const proceeds = -antal > 0 ? amountSEK * (sharesSold / -antal) : amountSEK;
      existing.realizedGainSEK = (existing.realizedGainSEK ?? 0) + (proceeds - costRemoved);
    } else {
      // Byte, Inlösen, Avskiljning, Värdepappersuttag – just adjust count.
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

/**
 * Upsert incoming holdings into existing by ISIN+account. Holdings NOT present in
 * the incoming file are KEPT (never wiped) — an Avanza export often covers only a
 * date range, so replacing the whole list would delete older holdings. Incoming
 * entries win for keys they cover.
 */
export function mergeHoldings(existing: Holding[], incoming: Holding[]): Holding[] {
  const map = new Map<string, Holding>();
  for (const h of existing) map.set(`${h.isin}::${h.account}`, h);
  for (const h of incoming) map.set(`${h.isin}::${h.account}`, h);
  return [...map.values()];
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
      belopp: cols[6],
      instrumentCurrency: cols[10] || 'SEK',
      isin: cols[11],
    });
  }

  return computeHoldings(
    ['Datum;Konto;Typ av transaktion;Värdepapper/beskrivning;Antal;Kurs;Belopp;Transaktionsvaluta;Courtage;Valutakurs;Instrumentvaluta;ISIN;Resultat',
      ...csvRows.map(r =>
        `${r.date};${r.account};${r.type};${r.name};${r.antal};${r.kurs};${r.belopp};;;;${r.instrumentCurrency};${r.isin};`
      )
    ].join('\n')
  );
}
