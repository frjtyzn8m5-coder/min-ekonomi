import { useState, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { parseFiles } from '../utils/parsers';
import { formatSEK } from '../utils/calculations';
import { saveTxBatch, saveImport, deleteImport } from '../lib/db';
import type { Transaction, ImportBatch } from '../types';
import { Upload, FileText, Check, X, Trash2, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Pending upload card ────────────────────────────────────────────────────────

interface PendingUpload {
  id: string;
  filename: string;
  transactions: Transaction[];
  dateFrom: string;
  dateTo: string;
  account: string;
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
      className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{upload.filename}</p>
              <p className="text-xs text-gray-400 mt-0.5">{upload.dateFrom} → {upload.dateTo} · {upload.account}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              {upload.transactions.length} tr.
            </span>
          </div>
        </div>

        <div className="flex gap-4 mt-3 text-xs">
          <span className="text-green-600">+{formatSEK(income)}</span>
          <span className="text-gray-500">−{formatSEK(expense)}</span>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={handle}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            {saving ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={13} />
            )}
            {saving ? 'Sparar...' : 'Spara'}
          </button>
          <button
            onClick={onDiscard}
            className="px-3 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs rounded-xl transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {upload.transactions.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full px-4 py-2 bg-gray-50 text-xs text-gray-500 flex items-center justify-center gap-1 hover:bg-gray-100"
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
                <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
                  {upload.transactions.slice(0, 20).map(tx => (
                    <div key={tx.id} className="flex items-center justify-between px-4 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 truncate max-w-[200px]">{tx.description}</p>
                        <p className="text-[10px] text-gray-400">{tx.date} · {tx.category}</p>
                      </div>
                      <span className={`text-xs font-medium flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-green-600' : 'text-gray-700'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatSEK(tx.amount)}
                      </span>
                    </div>
                  ))}
                  {upload.transactions.length > 20 && (
                    <p className="text-center text-xs text-gray-400 py-2">
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
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
        <Check size={16} className="text-green-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{imp.filename}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {imp.txCount} transaktioner · {imp.dateFrom} → {imp.dateTo}
        </p>
      </div>
      {confirm ? (
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={handleDelete} disabled={deleting}
            className="text-xs px-2.5 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
            {deleting ? '...' : 'Ja, ta bort'}
          </button>
          <button onClick={() => setConfirm(false)}
            className="text-xs px-2.5 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">
            Avbryt
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)}
          className="flex-shrink-0 p-2 text-gray-300 hover:text-red-400 transition-colors">
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
        dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
      }`}
    >
      <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,.xls"
        className="hidden" onChange={e => e.target.files && onFiles(Array.from(e.target.files))} />
      <Upload size={32} className={`mx-auto mb-3 ${dragging ? 'text-blue-400' : 'text-gray-300'}`} />
      <p className="text-sm font-medium text-gray-600">Dra hit eller klicka för att välja filer</p>
      <p className="text-xs text-gray-400 mt-1">SEB CSV/XLSX · Avanza · Klarna · CSN</p>
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
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
        <Download size={13} /> Exportera
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-10 w-36">
          <button onClick={exportCSV} className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50">CSV</button>
          <button onClick={exportJSON} className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50">JSON (debug)</button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Import() {
  const { importBatches, addImportBatch, removeImportBatch } = useStore();
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
        // Tag each tx with importId
        const taggedTxs = txs.map(t => ({ ...t, importId: uploadId } as Transaction & { importId: string }));
        setPending(prev => [...prev, {
          id: uploadId,
          filename: file.name,
          transactions: taggedTxs,
          dateFrom: dates[0],
          dateTo: dates[dates.length - 1],
          account: accounts.join(', '),
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
    setPending(prev => prev.filter(p => p.id !== upload.id));
  };

  const handleDelete = async (importId: string) => {
    if (!user) return;
    await deleteImport(user.uid, importId);
    removeImportBatch(importId);
  };

  const newTxCount = pending.reduce((s, p) => s + p.transactions.length, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Importera</h1>
          <p className="text-sm text-gray-400 mt-0.5">Ladda upp kontoutdrag</p>
        </div>
        <ExportButton />
      </div>

      {/* Drop zone */}
      <DropZone onFiles={handleFiles} />

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Pending uploads */}
      <AnimatePresence>
        {pending.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Väntar på sparande
                <span className="ml-2 text-xs font-normal text-blue-500">{newTxCount} nya transaktioner</span>
              </h2>
              <button onClick={() => setPending([])}
                className="text-xs text-gray-400 hover:text-gray-600">
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

      {/* Saved imports */}
      {importBatches.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Sparade uppladdningar</h2>
          {importBatches.map(imp => (
            <SavedCard
              key={imp.id}
              imp={imp}
              onDelete={() => handleDelete(imp.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
