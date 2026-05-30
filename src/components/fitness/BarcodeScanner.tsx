import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/browser';
import { X, Camera, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      try {
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices.length) {
          setError('Ingen kamera hittades.');
          return;
        }

        // Prefer back camera
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        ) ?? devices[devices.length - 1];

        if (!active || !videoRef.current) return;
        setScanning(true);

        await reader.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current,
          (result, err) => {
            if (!active) return;
            if (result) {
              onDetected(result.getText());
            }
            if (err && !(err instanceof NotFoundException)) {
              console.warn('Barcode scan error:', err);
            }
          }
        );
      } catch (e: unknown) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : 'Okänt fel';
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setError('Kameraåtkomst nekad. Tillåt kameraåtkomst i webbläsarinställningarna.');
        } else {
          setError(`Kunde inte starta kameran: ${msg}`);
        }
        setScanning(false);
      }
    }

    startScanner();

    return () => {
      active = false;
      readerRef.current?.reset();
    };
  }, [onDetected]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white">
          <div className="flex items-center gap-2">
            <Camera size={18} />
            <span className="font-medium text-sm">Skanna streckkod</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video */}
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Scanning overlay */}
          {scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-40 border-2 border-white rounded-xl relative">
                {/* Corner decorations */}
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-orange-400 rounded-tl-xl" />
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-orange-400 rounded-tr-xl" />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-orange-400 rounded-bl-xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-orange-400 rounded-br-xl" />
                {/* Scan line animation */}
                <motion.div
                  className="absolute left-2 right-2 h-0.5 bg-orange-400 rounded"
                  animate={{ top: ['10%', '85%', '10%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <p className="absolute bottom-12 text-white/80 text-sm">
                Rikta kameran mot streckkoden
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
              <div className="text-center">
                <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
                <p className="text-white text-sm">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-white/20 rounded-xl text-white text-sm"
                >
                  Stäng
                </button>
              </div>
            </div>
          )}

          {/* Loading state */}
          {!scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-sm animate-pulse">Startar kameran…</div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
