import { useRef, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { ParsedReceiptItem } from '../../types';
import { parseICAReceipt } from '../../utils/receiptParser';

interface Props {
  onParsed: (items: ParsedReceiptItem[]) => void;
  onClose: () => void;
}

type Status = 'idle' | 'parsing' | 'done' | 'error';

export default function ReceiptScanner({ onParsed, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Endast PDF-filer stöds');
      setStatus('error');
      return;
    }

    setFileName(file.name);
    setStatus('parsing');
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Send raw PDF bytes to serverless function
      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: arrayBuffer,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const { text } = await res.json();
      const items = parseICAReceipt(text);

      if (items.length === 0) {
        throw new Error('Inga produkter hittades. Kontrollera att det är ett ICA Kivra-kvitto.');
      }

      setStatus('done');
      onParsed(items);
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Kunde inte läsa kvittot');
      setStatus('error');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-green-600" />
            <h2 className="font-semibold text-gray-900">Scanna kvitto</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Ladda upp ett ICA-kvitto från Kivra (PDF) för att automatiskt lägga till priser i din prisdatabas.
          </p>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${status === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-green-400 hover:bg-green-50'}
            `}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleChange}
            />

            {status === 'idle' && (
              <>
                <Upload size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium text-gray-600">Dra och släpp PDF här</p>
                <p className="text-xs text-gray-400 mt-1">eller klicka för att välja fil</p>
              </>
            )}

            {status === 'parsing' && (
              <>
                <Loader2 size={32} className="mx-auto mb-3 text-green-500 animate-spin" />
                <p className="text-sm font-medium text-gray-600">Läser {fileName}…</p>
              </>
            )}

            {status === 'done' && (
              <>
                <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
                <p className="text-sm font-medium text-gray-700">{fileName}</p>
                <p className="text-xs text-gray-400 mt-1">Produkter hittades!</p>
              </>
            )}

            {status === 'error' && (
              <>
                <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
                <p className="text-sm font-medium text-red-600">{errorMsg}</p>
                <p className="text-xs text-gray-400 mt-2">Klicka för att försöka igen</p>
              </>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            Stöder ICA Supermarket, ICA Maxi och ICA Nära via Kivra
          </p>
        </div>
      </div>
    </div>
  );
}
