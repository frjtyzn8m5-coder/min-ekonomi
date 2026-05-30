import { useRef, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { ParsedReceiptItem } from '../../types';
import { parseICAReceipt } from '../../utils/receiptParser';

interface Props {
  onParsed: (items: ParsedReceiptItem[]) => void;
  onClose: () => void;
}

type Status = 'idle' | 'parsing' | 'done' | 'error';

// ─── PDF text extraction via pdfjs-dist (runs fully in the browser) ───────────

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  // Dynamic import to keep the initial bundle small
  const pdfjsLib = await import('pdfjs-dist');

  // Point to the bundled worker via Vite's asset URL resolution
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Reconstruct lines by grouping items with the same y-position
    const items = content.items as Array<{ str: string; transform: number[] }>;

    // Sort top→bottom, left→right
    items.sort((a, b) => {
      const dy = b.transform[5] - a.transform[5];
      if (Math.abs(dy) > 1.5) return dy;
      return a.transform[4] - b.transform[4];
    });

    // Group by rounded y
    const lineMap = new Map<number, string[]>();
    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item.str);
    }

    // Emit lines in order
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      pageTexts.push(lineMap.get(y)!.join(' '));
    }
  }

  return pageTexts.join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

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
      const arrayBuffer = await file.arrayBuffer();
      const text = await extractTextFromPDF(arrayBuffer);
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
            onClick={() => {
              if (status !== 'parsing') {
                setStatus('idle');
                fileRef.current?.click();
              }
            }}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${status === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-green-400 hover:bg-green-50'}
              ${status === 'parsing' ? 'cursor-default' : ''}
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
                <p className="text-xs text-gray-400 mt-1">Analyserar kvitto direkt i webbläsaren</p>
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
