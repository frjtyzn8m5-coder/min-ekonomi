import * as XLSX from 'xlsx';
import type { Transaction, Category } from '../types';
import { autoCat, autoIsTransfer } from './categorize';

function hashId(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(36);
}

function makeTx(date: string, desc: string, amount: number, account: string, source: Transaction['source']): Transaction {
  const isTransfer = autoIsTransfer(desc);
  const category: Category = isTransfer ? 'Överföring' : autoCat(desc);
  return {
    id: hashId(`${date}${desc}${amount}${account}`),
    date,
    description: desc.trim(),
    amount,
    category,
    account,
    type: isTransfer ? 'transfer' : amount >= 0 ? 'income' : 'expense',
    isTransfer,
    source,
  };
}

function splitCSV(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === sep && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function parseDate(s: string): string {
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  return s;
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0;
}

export function parseSEBCSV(content: string, accountName = 'SEB Konto'): Transaction[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => l.includes('Bokföringsdatum'));
  if (headerIdx < 0) return [];
  const txs: Transaction[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSV(lines[i], ';');
    if (cols.length < 5) continue;
    const date = parseDate(cols[0]);
    const desc = cols[3] || '';
    const amount = parseAmount(cols[4]);
    if (!date || isNaN(amount)) continue;
    txs.push(makeTx(date, desc, amount, accountName, 'seb_csv'));
  }
  return txs;
}

export function parseSEBXLSX(buffer: ArrayBuffer, accountName = 'SEB Lönekonto'): Transaction[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const headerIdx = rows.findIndex(r => r.some(c => String(c).includes('Bokföringsdatum')));
  if (headerIdx < 0) return [];
  const txs: Transaction[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length < 5) continue;
    const date = parseDate(String(cols[0] || ''));
    const desc = String(cols[3] || '');
    const amount = parseAmount(String(cols[4] || '0'));
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}/)) continue;
    txs.push(makeTx(date, desc, amount, accountName, 'seb_xlsx'));
  }
  return txs;
}

function avanzaTxFromRow(cols: string[]): Transaction | null {
  if (cols.length < 7) return null;
  const date = parseDate(cols[0] || '');
  const accountRaw = (cols[1] || 'Avanza').trim();
  const typeTx = (cols[2] || '').trim();
  const desc = (cols[3] || typeTx).trim();
  const amount = parseAmount((cols[6] || '0').trim());
  if (!date || !date.match(/^\d{4}-\d{2}-\d{2}/) || isNaN(amount)) return null;

  const isTransferTx = /insättning|deposit|uttag|withdrawal|överföring/i.test(typeTx);
  const isInternal = /köp|buy|sälj|sell/i.test(typeTx);

  let category: Category = 'Investering';
  if (isTransferTx) category = 'Överföring';
  else if (/köp|buy/i.test(typeTx)) category = 'Investering';
  else if (/sälj|sell/i.test(typeTx)) category = 'Investeringsvinst';
  else if (/utdelning|dividend/i.test(typeTx)) category = 'Investeringsvinst';
  else if (/ränta/i.test(typeTx)) category = 'Investeringsvinst';

  const label = `${typeTx}: ${desc}`.replace(/^:\s*/, '').trim();
  return {
    id: hashId(`${date}${typeTx}${desc}${amount}${accountRaw}`),
    date,
    description: label,
    amount,
    category,
    account: `Avanza ${accountRaw}`,
    type: (isTransferTx || isInternal) ? 'transfer' : amount >= 0 ? 'income' : 'expense',
    isTransfer: isTransferTx || isInternal,
    source: 'avanza',
  };
}

export function parseAvanzaCSV(content: string): Transaction[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => /^datum/i.test(l));
  if (headerIdx < 0) return [];
  const txs: Transaction[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSV(lines[i], ';');
    const tx = avanzaTxFromRow(cols);
    if (tx) txs.push(tx);
  }
  return txs;
}

export function parseAvanzaXLSX(buffer: ArrayBuffer): Transaction[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const headerIdx = rows.findIndex(r => r.some(c => /^datum$/i.test(String(c).trim())));
  if (headerIdx < 0) return [];
  const txs: Transaction[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cols = (rows[i] || []).map(c => String(c ?? ''));
    const tx = avanzaTxFromRow(cols);
    if (tx) txs.push(tx);
  }
  return txs;
}

export function parseKlarnaCSV(content: string): Transaction[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCSV(lines[0], ',').map(h => h.toLowerCase().replace(/"/g, ''));
  const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('datum'));
  const descIdx = headers.findIndex(h => h.includes('merchant') || h.includes('description') || h.includes('butik'));
  const amtIdx = headers.findIndex(h => h.includes('amount') || h.includes('belopp'));
  if (dateIdx < 0 || amtIdx < 0) return [];
  const txs: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSV(lines[i], ',');
    if (cols.length <= amtIdx) continue;
    const date = parseDate(cols[dateIdx]);
    const desc = descIdx >= 0 ? cols[descIdx] : 'Klarna';
    const amount = -Math.abs(parseAmount(cols[amtIdx]));
    if (!date) continue;
    txs.push(makeTx(date, desc, amount, 'Klarna', 'klarna'));
  }
  return txs;
}

export function parseCSNCSV(content: string): Transaction[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const txs: Transaction[] = [];
  for (const line of lines) {
    if (/datum|^#/i.test(line)) continue;
    const cols = line.includes(';') ? splitCSV(line, ';') : splitCSV(line, ',');
    const date = cols.find(c => /\d{4}-\d{2}-\d{2}/.test(c)) || '';
    const amountStr = cols.find(c => /^-?[\d\s.,]+$/.test(c.trim()) && c.trim().length > 0);
    if (!date || !amountStr) continue;
    const amount = Math.abs(parseAmount(amountStr));
    const isLan = /lån|tillägg/i.test(line);
    const category: Category = isLan ? 'CSN Lån' : 'CSN Bidrag';
    const desc = isLan ? 'CSN Studielån' : 'CSN Studiestöd';
    txs.push({
      id: hashId(`${date}${desc}${amount}`),
      date,
      description: desc,
      amount,
      category,
      account: 'CSN',
      type: 'income',
      isTransfer: false,
      source: 'csn',
    });
  }
  return txs;
}

export function mergeTxs(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  const ids = new Set(existing.map(t => t.id));
  return [...existing, ...incoming.filter(t => !ids.has(t.id))];
}

export async function parseFiles(files: File[]): Promise<Transaction[]> {
  const results: Transaction[] = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.csv')) {
        const text = await file.text();
        const lower = text.toLowerCase();
        if (lower.includes('avanza')) {
          results.push(...parseAvanzaCSV(text));
        } else if (lower.includes('bokföringsdatum') || lower.includes('transaktionsdatum') || lower.includes('bokföringsdag')) {
          results.push(...parseSEBCSV(text, file.name.replace(/\.[^.]+$/, '')));
        } else if (lower.includes('transaktionsbelopp') || lower.includes('klarna')) {
          results.push(...parseKlarnaCSV(text));
        } else if (lower.includes('csn') || lower.includes('studielån')) {
          results.push(...parseCSNCSV(text));
        } else {
          results.push(...parseSEBCSV(text, file.name.replace(/\.[^.]+$/, '')));
        }
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        if (name.includes('avanza')) {
          results.push(...parseAvanzaXLSX(buf));
        } else {
          results.push(...parseSEBXLSX(buf, file.name.replace(/\.[^.]+$/, '')));
        }
      }
    } catch (e) {
      console.error('Parse error for', file.name, e);
    }
  }
  return results;
}
