import { useState, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { parseFiles } from '../utils/parsers';
import { computeHoldings, mergeHoldings } from '../utils/parseHoldings';
import { formatSEK } from '../utils/calculations';
import { saveTxBatch, saveImport, deleteImport, saveHoldings } from '../lib/db';
import type { Transaction, ImportBatch } from '../types';
import { Upload, FileText, Check, X, Trash2, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageBanner from '../components/ui/PageBanner';

// ── Pending upload card ────────────────────────────────────────────────────────

interface PendingUpload {
  id: string;
  filename: string;
  transactions: Transaction[];
  dateFrom: string;
  dateTo: string;
  account: string;
  avanzaContent?: string; // raw CSV for holdings computation
}

function PendingCard({ upload, onSave, onDiscard }: {
  upload: PendingUpload;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const income  = upload.transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = upload.transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const handle = async () => {
    setSaving(true);
    await onSave();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="vh-card overflow-hidden"
      style={{ border: '1px solid rgba(233,193,120,.35)' }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="vh-tile vh-tile--gold w-10 h-10 text-[#2a1d08]">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{upload.filename}</p>
              <p className="text-xs text-faint mt-0.5">{upload.dateFrom} → {upload.dateTo} · {upload.account}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-gold px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(233,193,120,.12)' }}>
              {upload.transactions.length} tr.
            </span>
          </div>
        </div>

        <div className="flex gap-4 mt-3 text-xs">
          <span className="text-cyan">+{formatSEK(income)}</span>
          <span className="text-mut">−{formatSEK(expense)}</span>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={handle}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[#2a1d08] text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            {saving ? (
              <span className="w-3 h-3 border border-[#2a1d08] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={13} />
            )}
            {saving ? 'Sparar...' : 'Spara'}
          </button>
          <button
            onClick={onDiscard}
            className="px-3 py-2 border border-line text-mut hover:bg-soft text-xs rounded-xl transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {upload.transactions.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full px-4 py-2 bg-soft text-xs text-mut flex items-center justify-center gap-1 hover:bg-card"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? 'Dölj' : 'Förhandsgranska'}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="divide-y divide-line max-h-52 overflow-y-auto">
                  {upload.transactions.slice(0, 20).map(tx => (
                    <div key={tx.id} className="flex items-center justify-between px-4 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-mut truncate max-w-[200px]">{tx.description}</p>
                        <p className="text-[10px] text-faint">{tx.date} · {tx.category}</p>
                      </div>
                      <span className={`text-xs font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-cyan' : 'text-ink'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatSEK(tx.amount)}
                      </span>
                    </div>
                  ))}
                  {upload.transactions.length > 20 && (
                    <p className="text-center text-xs text-faint py-2">
                      +{upload.transactions.length - 20} fler...
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

// ── Saved import card ─────────────────────────────────────────────────────────

function SavedCard({ imp, onDelete }: { imp: ImportBatch; onDelete: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
  };

  return (
    <div className="vh-card p-4 flex items-center gap-3">
      <div className="vh-tile vh-tile--cyan w-9 h-9 text-[#2a1d08]">
        <Check size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{imp.filename}</p>
        <p className="text-xs text-faint mt-0.5">
          {imp.txCount} transaktioner · {imp.dateFrom} → {imp.dateTo}
        </p>
      </div>
      {confirm ? (
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={handleDelete} disabled={deleting}
            className="text-xs px-2.5 py-1.5 text-[#2a1d08] rounded-lg disabled:opacity-50"
            style={{ background: 'var(--coral)' }}>
            {deleting ? '...' : 'Ja, ta bort'}
          </button>
          <button onClick={() => setConfirm(false)}
            className="text-xs px-2.5 py-1.5 border border-line text-mut rounded-lg hover:bg-soft">
            Avbryt
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)}
          className="flex-shrink-0 p-2 text-faint hover:text-coral transition-colors">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFiles(Array.from(e.dataTransfer.files));
  }, [onFiles]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
        dragging ? 'bg-soft' : 'border-line hover:bg-soft'
      }`}
      style={dragging ? { borderColor: 'rgba(233,193,120,.5)' } : undefined}
    >
      <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,.xls"
        className="hidden" onChange={e => e.target.files && onFiles(Array.from(e.target.files))} />
      <Upload size={32} className={`mx-auto mb-3 ${dragging ? 'text-gold' : 'text-faint'}`} />
      <p className="text-sm font-medium text-mut">Dra hit eller klicka för att välja filer</p>
      <p className="text-xs text-faint mt-1">SEB CSV/XLSX · Avanza · Klarna · CSN</p>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

function ExportButton() {
  const { transactions, budgets, assets, debts } = useStore();
  const [open, setOpen] = useState(false);

  const exportCSV = () => {
    const BOM = '﻿';
    const headers = 'Datum,Beskrivning,Belopp,Kategori,Konto,Källa';
    const rows = transactions.map(t =>
      `${t.date},"${t.description.replace(/"/g, '""')}",${t.amount},${t.category},${t.account},${t.source}`
    );
    const blob = new Blob([BOM + [headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ekonomi_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    setOpen(false);
  };

  const exportJSON = () => {
    const data = { transactions, budgets, assets, debts, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ekonomi_debug_${new Date().toISOString().slice(0,10)}.json`; a.click();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-mut hover:text-ink border border-line rounded-lg px-3 py-1.5">
        <Download size={13} /> Exportera
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-card border border-line rounded-xl shadow-lg overflow-hidden z-10 w-36">
          <button onClick={exportCSV} className="w-full text-left px-4 py-2.5 text-xs text-ink hover:bg-soft">CSV</button>
          <button onClick={exportJSON} className="w-full text-left px-4 py-2.5 text-xs text-ink hover:bg-soft">JSON (debug)</button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Import() {
  const { importBatches, addImportBatch, removeImportBatch, setHoldings } = useStore();
  const { user } = useAuthStore();
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    setError(null);
    for (const file of files) {
      try {
        const txs = await parseFiles([file]);
        if (!txs.length) continue;
        const dates = txs.map(t => t.date).sort();
        const accounts = [...new Set(txs.map(t => t.account))];
        const uploadId = `import_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
        const taggedTxs = txs.map(t => ({ ...t, importId: uploadId } as Transaction & { importId: string }));

        // If this looks like an Avanza file, store raw content for holdings
        const name = file.name.toLowerCase();
        let avanzaContent: string | undefined;
        if (name.includes('avanza') || name.includes('transaktioner')) {
          avanzaContent = await file.text();
        }

        setPending(prev => [...prev, {
          id: uploadId,
          filename: file.name,
          transactions: taggedTxs,
          dateFrom: dates[0],
          dateTo: dates[dates.length - 1],
          account: accounts.join(', '),
          avanzaContent,
        }]);
      } catch (e: any) {
        setError(`Kunde inte tolka ${file.name}: ${e.message}`);
      }
    }
  };

  const handleSave = async (upload: PendingUpload) => {
    if (!user) return;
    const imp: ImportBatch = {
      id: upload.id,
      filename: upload.filename,
      uploadedAt: Date.now(),
      txCount: upload.transactions.length,
      dateFrom: upload.dateFrom,
      dateTo: upload.dateTo,
      account: upload.account,
    };
    await saveTxBatch(user.uid, upload.transactions, upload.id);
    await saveImport(user.uid, imp);
    addImportBatch(imp, upload.transactions);

    // If Avanza file – compute holdings and MERGE into existing (never wipe
    // holdings missing from this file; an export often covers only a date range).
    if (upload.avanzaContent) {
      const computed = computeHoldings(upload.avanzaContent);
      if (computed.length) {
        const merged = mergeHoldings(useStore.getState().holdings, computed);
        setHoldings(merged);
        await saveHoldings(user.uid, merged);
      }
    }

    setPending(prev => prev.filter(p => p.id !== upload.id));
  };

  const handleDelete = async (importId: string) => {
    if (!user) return;
    await deleteImport(user.uid, importId);
    removeImportBatch(importId);
  };

  const newTxCount = pending.reduce((s, p) => s + p.transactions.length, 0);

  return (
    <div className="min-h-full bg-bg text-ink">
      <PageBanner
        img="/img/f-fin.jpg"
        eyebrow="Ekonomi"
        title="Importera"
        subtitle="Ladda upp kontoutdrag från bank, Avanza, Klarna och CSN"
        action={<ExportButton />}
      />

      <div className="max-w-[1600px] mx-auto w-full p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">

          {/* Left column: drop zone + pending */}
          <div className="space-y-5">
            {/* Drop zone */}
            <DropZone onFiles={handleFiles} />

            {error && (
              <p className="text-sm text-coral rounded-xl px-4 py-3" style={{ background: 'rgba(255,143,122,.12)' }}>{error}</p>
            )}

            {/* Pending uploads */}
            <AnimatePresence>
              {pending.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm text-ink">
                      Väntar på sparande
                      <span className="ml-2 text-xs font-normal text-gold">{newTxCount} nya transaktioner</span>
                    </h2>
                    <button onClick={() => setPending([])}
                      className="text-xs text-faint hover:text-ink">
                      Rensa alla
                    </button>
                  </div>
                  {pending.map(upload => (
                    <PendingCard
                      key={upload.id}
                      upload={upload}
                      onSave={() => handleSave(upload)}
                      onDiscard={() => setPending(prev => prev.filter(p => p.id !== upload.id))}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right column: saved imports */}
          <div className="space-y-2">
            <h2 className="font-display text-sm text-ink">Sparade uppladdningar</h2>
            {importBatches.length > 0 ? (
              importBatches.map(imp => (
                <SavedCard
                  key={imp.id}
                  imp={imp}
                  onDelete={() => handleDelete(imp.id)}
                />
              ))
            ) : (
              <div className="vh-card p-8 text-center text-sm text-faint">
                Inga sparade uppladdningar ännu. Dra in en fil till vänster för att komma igång.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
