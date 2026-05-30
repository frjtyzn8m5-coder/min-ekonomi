import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { X, Camera, AlertCircle, CheckCircle, Focus, Plus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
  /** If true, show "add product" form when barcode not found */
  allowAddProduct?: boolean;
  onAddProduct?: (barcode: string, name: string, nutrition: {
    energy_kcal: number; protein: number; fat: number; carbs: number; fiber?: number;
  }) => void;
}

// ─── Sharpness detection via Laplacian variance ──────────────────────────────

function measureSharpness(video: HTMLVideoElement): number {
  try {
    const canvas = document.createElement('canvas');
    const size = 64; // small sample for perf
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    // Sample center of frame
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    // Laplacian kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
    let variance = 0;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = (y * size + x) * 4;
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const neighbors = [
          (((y - 1) * size + (x - 1)) * 4),
          (((y - 1) * size + x) * 4),
          (((y - 1) * size + (x + 1)) * 4),
          ((y * size + (x - 1)) * 4),
          ((y * size + (x + 1)) * 4),
          (((y + 1) * size + (x - 1)) * 4),
          (((y + 1) * size + x) * 4),
          (((y + 1) * size + (x + 1)) * 4),
        ];
        const lap = 8 * gray - neighbors.reduce((s, ni) => s + (data[ni] + data[ni + 1] + data[ni + 2]) / 3, 0);
        variance += lap * lap;
      }
    }
    return variance / ((size - 2) * (size - 2));
  } catch {
    return 0;
  }
}

// ─── Add Product Form ─────────────────────────────────────────────────────────

interface AddProductFormProps {
  barcode: string;
  onSave: (name: string, nutrition: { energy_kcal: number; protein: number; fat: number; carbs: number; fiber?: number }) => void;
  onCancel: () => void;
}

function AddProductForm({ barcode, onSave, onCancel }: AddProductFormProps) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fiber, setFiber] = useState('');
  const [searching, setSearching] = useState(false);
  const [lvResults, setLvResults] = useState<{ id: string; name: string; energy_kcal: number; protein: number; fat: number; carbs: number }[]>([]);
  const [lvQuery, setLvQuery] = useState('');

  async function searchLv(q: string) {
    if (!q.trim()) { setLvResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch('/data/livsmedelsverket.json');
      const data: any[] = await res.json();
      const lq = q.toLowerCase();
      setLvResults(data.filter(i => i.name.toLowerCase().includes(lq)).slice(0, 8));
    } finally {
      setSearching(false);
    }
  }

  function fillFromLv(item: any) {
    setName(item.name);
    setKcal(String(item.energy_kcal));
    setProtein(String(item.protein));
    setFat(String(item.fat));
    setCarbs(String(item.carbs));
    setFiber(item.fiber != null ? String(item.fiber) : '');
    setLvResults([]);
    setLvQuery('');
  }

  function handleSave() {
    if (!name.trim() || !kcal) return;
    onSave(name.trim(), {
      energy_kcal: parseFloat(kcal) || 0,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
      carbs: parseFloat(carbs) || 0,
      fiber: fiber ? parseFloat(fiber) : undefined,
    });
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white p-4 space-y-4">
      <div>
        <p className="text-xs text-gray-400 mb-1">Streckkod</p>
        <p className="text-sm font-mono font-semibold text-gray-700">{barcode}</p>
      </div>

      {/* Search LV DB */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1">Sök i Livsmedelsverkets databas</p>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="T.ex. filmjölk, havregryn..."
            value={lvQuery}
            onChange={e => { setLvQuery(e.target.value); searchLv(e.target.value); }}
          />
        </div>
        {lvResults.length > 0 && (
          <div className="mt-1 border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            {lvResults.map(item => (
              <button
                key={item.id}
                onClick={() => fillFromLv(item)}
                className="w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-orange-50 transition-colors"
              >
                <p className="text-sm text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-400">{item.energy_kcal} kcal · P {item.protein}g · F {item.fat}g · K {item.carbs}g</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Produktnamn *</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="T.ex. Oatly havre dryck"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <p className="text-xs font-semibold text-gray-500">Näringsvärde per 100g</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Kalorier (kcal) *', val: kcal, set: setKcal },
            { label: 'Protein (g)', val: protein, set: setProtein },
            { label: 'Fett (g)', val: fat, set: setFat },
            { label: 'Kolhydrater (g)', val: carbs, set: setCarbs },
            { label: 'Fiber (g)', val: fiber, set: setFiber },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                value={val}
                onChange={e => set(e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">
          Avbryt
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !kcal}
          className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Spara produkt
        </button>
      </div>
    </div>
  );
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────

export default function BarcodeScanner({
  onDetected,
  onClose,
  allowAddProduct,
  onAddProduct,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sharpnessRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sharpness, setSharpness] = useState(0);
  const [detected, setDetected] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [missedBarcode, setMissedBarcode] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (sharpnessRef.current) clearInterval(sharpnessRef.current);
  }, []);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      try {
        // Request high-res camera with continuous autofocus
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // @ts-ignore — focusMode is non-standard but widely supported
            advanced: [{ focusMode: 'continuous' }],
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const reader = new BrowserMultiFormatReader();
        if (!videoRef.current) return;
        setScanning(true);

        const controls = await reader.decodeFromStream(stream, videoRef.current, (result, err) => {
          if (!active) return;
          if (result) {
            const code = result.getText();
            setDetected(code);
            stopCamera();
            setTimeout(() => {
              onDetected(code);
            }, 400); // brief flash of success state
          }
          if (err && err.name !== 'NotFoundException') {
            console.warn('Scan error:', err.name);
          }
        });

        controlsRef.current = controls;

        // Measure sharpness every 500ms
        sharpnessRef.current = setInterval(() => {
          if (videoRef.current && active) {
            setSharpness(measureSharpness(videoRef.current));
          }
        }, 500);

      } catch (e: unknown) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : 'Okänt fel';
        if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('NotFoundError')) {
          setError('Kameraåtkomst nekad. Tillåt kameraåtkomst i webbläsarinställningarna.');
        } else {
          setError(`Kunde inte starta kameran: ${msg}`);
        }
        setScanning(false);
      }
    }

    startScanner();
    return () => { active = false; stopCamera(); };
  }, [onDetected, stopCamera]);

  // Sharpness label
  const SHARP_THRESHOLD = 200;
  const isSharp = sharpness > SHARP_THRESHOLD;
  const sharpLabel = !scanning
    ? ''
    : detected
      ? '✓ Streckkod läst'
      : isSharp
        ? 'Bra fokus — håll still'
        : 'Fokusera kameran mot streckkoden';

  function handleNotFound(barcode: string) {
    setMissedBarcode(barcode);
    setAddMode(true);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
          <div className="flex items-center gap-2 text-white">
            <Camera size={20} />
            <span className="font-medium text-sm">
              {addMode ? 'Lägg till produkt' : 'Skanna streckkod'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {addMode && missedBarcode && onAddProduct ? (
          <AddProductForm
            barcode={missedBarcode}
            onSave={(name, nutrition) => {
              onAddProduct(missedBarcode, name, nutrition);
              onClose();
            }}
            onCancel={() => { setAddMode(false); setMissedBarcode(null); }}
          />
        ) : (
          <>
            {/* Camera feed */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />

              {/* Scan frame + focus indicator */}
              {scanning && !detected && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-48">
                    {/* Corner brackets */}
                    {(['tl', 'tr', 'bl', 'br'] as const).map(pos => (
                      <div
                        key={pos}
                        className={`absolute w-8 h-8 ${
                          pos.includes('t') ? 'top-0' : 'bottom-0'
                        } ${pos.includes('l') ? 'left-0' : 'right-0'}`}
                        style={{
                          borderTop:    pos.includes('t') ? `3px solid ${isSharp ? '#34c759' : '#ff9f0a'}` : 'none',
                          borderBottom: pos.includes('b') ? `3px solid ${isSharp ? '#34c759' : '#ff9f0a'}` : 'none',
                          borderLeft:   pos.includes('l') ? `3px solid ${isSharp ? '#34c759' : '#ff9f0a'}` : 'none',
                          borderRight:  pos.includes('r') ? `3px solid ${isSharp ? '#34c759' : '#ff9f0a'}` : 'none',
                          borderRadius: pos === 'tl' ? '6px 0 0 0' : pos === 'tr' ? '0 6px 0 0' : pos === 'bl' ? '0 0 0 6px' : '0 0 6px 0',
                        }}
                      />
                    ))}
                    {/* Animated scan line */}
                    <div
                      className="absolute left-2 right-2 h-0.5 opacity-80"
                      style={{
                        backgroundColor: isSharp ? '#34c759' : '#ff9f0a',
                        top: '50%',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Success flash */}
              {detected && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                  <CheckCircle size={64} className="text-green-400" />
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-6 text-center">
                  <AlertCircle size={40} className="text-red-400 mb-3" />
                  <p className="text-white text-sm">{error}</p>
                  <button
                    onClick={onClose}
                    className="mt-4 px-4 py-2 bg-white text-gray-800 rounded-full text-sm font-medium"
                  >
                    Stäng
                  </button>
                </div>
              )}
            </div>

            {/* Bottom status bar */}
            <div className="bg-black/80 px-4 py-4 flex-shrink-0">
              {/* Focus bar */}
              {scanning && !detected && (
                <div className="mb-3">
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (sharpness / (SHARP_THRESHOLD * 2)) * 100)}%`,
                        backgroundColor: isSharp ? '#34c759' : '#ff9f0a',
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${
                  detected ? 'text-green-400' :
                  isSharp ? 'text-green-400' : 'text-amber-400'
                }`}>
                  {sharpLabel || (error ? '' : 'Startar kamera…')}
                </p>

                {/* Manually enter / add product */}
                {allowAddProduct && !detected && scanning && (
                  <button
                    onClick={() => { setMissedBarcode(''); setAddMode(true); }}
                    className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
                  >
                    <Plus size={14} />
                    Lägg till manuellt
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
