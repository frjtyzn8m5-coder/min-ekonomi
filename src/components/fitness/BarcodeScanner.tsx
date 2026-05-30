import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { X, Camera, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      try {
        const reader = new BrowserMultiFormatReader();

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

        const controls = await reader.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current,
          (result, err) => {
            if (!active) return;
            if (result) {
              onDetected(result.getText());
            }
            // err is non-null every frame without a code — only log unexpected errors
            if (err && err.name !== 'NotFoundException') {
              console.warn('Barcode scan error:', err);
            }
          }
        );

        controlsRef.current = controls;
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
      controlsRef.current?.stop();
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
        <div className="flex items-center justify-between px-4 py-3 bg-black/80">
          <div className="flex items-center gap-2 text-white">
            <Camera size={20} />
            <span className="font-medium text-sm">Skanna streckkod</span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Camera feed */}
        <div className="flex-1 relative flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />

          {/* Scan frame overlay */}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-64 h-48">
                {/* Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-orange-400 rounded-tl-lg" style={{ borderWidth: 3 }} />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-orange-400 rounded-tr-lg" style={{ borderWidth: 3 }} />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-orange-400 rounded-bl-lg" style={{ borderWidth: 3 }} />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-orange-400 rounded-br-lg" style={{ borderWidth: 3 }} />
                {/* Scan line */}
                <div className="absolute left-2 right-2 h-0.5 bg-orange-400 opacity-80 animate-pulse" style={{ top: '50%' }} />
              </div>
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

        <p className="text-center text-white/60 text-xs py-3">
          Rikta kameran mot streckkoden
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
