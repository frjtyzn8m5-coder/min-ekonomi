import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart, Line, Scatter, ReferenceLine, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { ArrowLeft, Plus, Minus, ChevronDown, ChevronUp, Camera, Info, ChevronLeft, ChevronRight, X, Columns2, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { saveBodyEntry, loadBodyLog } from '../../lib/fitnessDb';
import type { BodyEntry, BodyMeasurements } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const base = dateStr.split('__')[0]; // handle "2026-05-30__Framsida" compound keys
  const d = new Date(base + 'T00:00:00');
  return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

function calcEMA(values: number[], alpha = 0.3): number[] {
  const result: number[] = [];
  values.forEach((v, i) => {
    result.push(i === 0 ? v : alpha * v + (1 - alpha) * result[i - 1]);
  });
  return result;
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// Navy-metoden för kroppsfett
function calcBodyFat(
  gender: 'male' | 'female',
  heightCm: number,
  measurements: BodyMeasurements,
): number | null {
  const { waist, neck, hips } = measurements;
  if (!waist || !neck || heightCm <= 0) return null;
  if (gender === 'male') {
    const denom = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm);
    return Math.max(0, 495 / denom - 450);
  } else {
    if (!hips) return null;
    const denom = 1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(heightCm);
    return Math.max(0, 495 / denom - 450);
  }
}

function compressImage(file: File, maxKB = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxPx = 1200;
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > maxKB * 1024 * 1.37 && quality > 0.3) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Time range filter ────────────────────────────────────────────────────────

type Range = '2V' | '1M' | '3M' | '6M' | '1Å' | 'Allt';
const RANGES: Range[] = ['2V', '1M', '3M', '6M', '1Å', 'Allt'];

function filterByRange(entries: BodyEntry[], range: Range): BodyEntry[] {
  if (range === 'Allt') return entries;
  const days: Record<Range, number> = { '2V': 14, '1M': 30, '3M': 90, '6M': 180, '1Å': 365, 'Allt': 9999 };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days[range]);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return entries.filter(e => e.date >= cutoffStr);
}

// ─── Measurement field config ─────────────────────────────────────────────────

const MEASUREMENT_FIELDS: { key: keyof BodyMeasurements; label: string }[] = [
  { key: 'waist',      label: 'Midja (cm)' },
  { key: 'hips',       label: 'Höfter (cm)' },
  { key: 'neck',       label: 'Hals (cm)' },
  { key: 'chest',      label: 'Bröst (cm)' },
  { key: 'armLeft',    label: 'Vänster arm (cm)' },
  { key: 'armRight',   label: 'Höger arm (cm)' },
  { key: 'thighLeft',  label: 'Vänster lår (cm)' },
  { key: 'thighRight', label: 'Höger lår (cm)' },
  { key: 'calf',       label: 'Vader (cm)' },
];

// ─── Body part categories for photos ─────────────────────────────────────────

const BODY_PARTS = ['Framsida', 'Ryggsida', 'Sida', 'Armar', 'Ben', 'Ansikte'] as const;
type BodyPart = typeof BODY_PARTS[number];

// ─── Photo comparison slider ──────────────────────────────────────────────────

interface PhotoSliderProps {
  urlA: string;
  labelA: string;
  urlB: string;
  labelB: string;
}

function PhotoSlider({ urlA, labelA, urlB, labelB }: PhotoSliderProps) {
  const [sliderX, setSliderX] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function getPercent(clientX: number): number {
    if (!containerRef.current) return 50;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none cursor-ew-resize"
      onPointerDown={e => { dragging.current = true; (e.target as Element).setPointerCapture(e.pointerId); setSliderX(getPercent(e.clientX)); }}
      onPointerMove={e => { if (dragging.current) setSliderX(getPercent(e.clientX)); }}
      onPointerUp={() => { dragging.current = false; }}
    >
      <img src={urlA} alt="Före" className="absolute inset-0 w-full h-full object-contain" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}>
        <img src={urlB} alt="Efter" className="absolute inset-0 w-full h-full object-contain" />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none" style={{ left: `${sliderX}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
            <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
          </div>
        </div>
      </div>
      <span className="absolute bottom-3 left-3 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">{labelA}</span>
      <span className="absolute bottom-3 right-3 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">{labelB}</span>
    </div>
  );
}

// ─── Photo Lightbox ───────────────────────────────────────────────────────────

interface LightboxProps {
  entries: BodyEntry[];
  currentIndex: number;
  compareA: string | null;
  compareB: string | null;
  onSelectA: (date: string) => void;
  onSelectB: (date: string) => void;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

function PhotoLightbox({ entries, currentIndex, compareA, compareB, onSelectA, onSelectB, onNavigate, onClose }: LightboxProps) {
  const entry = entries[currentIndex];
  if (!entry?.photoUrl) return null;

  const isA = compareA === entry.date;
  const isB = compareB === entry.date;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <div className="text-white text-sm font-medium">
          {formatDate(entry.date)}{entry.notes ? ` · ${entry.notes}` : ''}
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 relative flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <img src={entry.photoUrl} alt="" className="max-h-full max-w-full object-contain" />

        {/* Nav arrows */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60"
          >
            <ChevronLeft size={22} className="text-white" />
          </button>
        )}
        {currentIndex < entries.length - 1 && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60"
          >
            <ChevronRight size={22} className="text-white" />
          </button>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="flex gap-3 px-4 py-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onSelectA(entry.date)}
          className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors ${
            isA ? 'bg-blue-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
        >
          {isA ? '✓ Vald som A' : 'Välj som A'}
        </button>
        <button
          onClick={() => onSelectB(entry.date)}
          className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors ${
            isB ? 'bg-orange-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
        >
          {isB ? '✓ Vald som B' : 'Välj som B'}
        </button>
      </div>

      {/* Index dots */}
      {entries.length > 1 && (
        <div className="flex justify-center gap-1 pb-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {entries.slice(0, Math.min(entries.length, 12)).map((_, i) => (
            <button
              key={i}
              onClick={() => onNavigate(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
          {entries.length > 12 && <span className="text-white/40 text-xs ml-1">+{entries.length - 12}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Compare Modal ────────────────────────────────────────────────────────────

interface CompareModalProps {
  entryA: BodyEntry;
  entryB: BodyEntry;
  layout: 'side' | 'slider';
  onLayoutChange: (l: 'side' | 'slider') => void;
  onClose: () => void;
}

function CompareModal({ entryA, entryB, layout, onLayoutChange, onClose }: CompareModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => onLayoutChange('side')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              layout === 'side' ? 'bg-white text-black' : 'bg-white/15 text-white'
            }`}
          >
            <Columns2 size={13} /> Sida vid sida
          </button>
          <button
            onClick={() => onLayoutChange('slider')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              layout === 'slider' ? 'bg-white text-black' : 'bg-white/15 text-white'
            }`}
          >
            <SlidersHorizontal size={13} /> Slider
          </button>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* Comparison area */}
      <div className="flex-1 overflow-hidden">
        {layout === 'side' ? (
          <div className="h-full grid grid-cols-2 gap-1">
            {[entryA, entryB].map((e, i) => (
              <div key={i} className="relative h-full">
                <img src={e.photoUrl!} alt="" className="w-full h-full object-contain" />
                <span className={`absolute bottom-3 ${i === 0 ? 'left-3' : 'right-3'} text-xs font-semibold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-orange-500'} text-white`}>
                  {i === 0 ? 'A' : 'B'} · {formatDate(e.date)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <PhotoSlider
            urlA={entryA.photoUrl!}
            labelA={`A · ${formatDate(entryA.date)}`}
            urlB={entryB.photoUrl!}
            labelB={`B · ${formatDate(entryB.date)}`}
          />
        )}
      </div>
    </div>
  );
}

// ─── Measurement instructions ──────────────────────────────────────────────────

function MeasurementInstructions() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-blue-50 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <Info size={16} className="text-blue-500 flex-shrink-0" />
        <span className="text-sm text-blue-700 font-medium">Råd för konsekventa mätningar</span>
        {open ? <ChevronUp size={14} className="ml-auto text-blue-400" /> : <ChevronDown size={14} className="ml-auto text-blue-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-blue-800 space-y-1.5 leading-relaxed">
          <p>📅 <strong>Mät samma dag varje vecka</strong> — t.ex. alltid måndag morgon.</p>
          <p>🌅 <strong>Mät på morgonen</strong> — innan frukost och efter toa.</p>
          <p>👕 <strong>Mät utan kläder</strong> eller i samma tunna kläder varje gång.</p>
          <p>📍 <strong>Midja:</strong> på navelhöjd, andas ut lugnt och mät utan att dra in magen.</p>
          <p>📍 <strong>Höfter:</strong> på den bredaste punkten runt skinkor och höfter.</p>
          <p>📍 <strong>Hals:</strong> under struphuvudet, horisontellt runt halsen.</p>
          <p>📸 <strong>Foton:</strong> mät och fotografera vid samma tidpunkt i samma ljus.</p>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeightLog() {
  const { setFitnessPage, fitnessProfile } = useStore();
  const { user } = useAuthStore();

  const [entries, setEntries] = useState<BodyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<Range>('3M');

  // Quick log
  const [weightInput, setWeightInput] = useState('');

  // Measurements
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [measurements, setMeasurements] = useState<Partial<BodyMeasurements>>({});
  const [calcBF, setCalcBF] = useState<number | null>(null);

  // Photo comparison
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const photoCompareInitialized = useRef(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [compareLayout, setCompareLayout] = useState<'side' | 'slider'>('side');
  const [showCompare, setShowCompare] = useState(false);
  const [uploadBodyPart, setUploadBodyPart] = useState<BodyPart>('Framsida');
  const [filterBodyPart, setFilterBodyPart] = useState<BodyPart | 'Alla'>('Alla');
  const [photoDate, setPhotoDate] = useState(today());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    loadBodyLog(user.uid, 400)
      .then(data => {
        setEntries(data);
        // Pre-fill weight input with last logged weight
        const last = [...data].reverse().find(e => e.weight);
        if (last?.weight) setWeightInput(last.weight.toFixed(1));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // ── Auto-init photo comparison: latest (A) vs oldest (B) ─────────────────────

  useEffect(() => {
    if (photoCompareInitialized.current) return;
    const photos = entries.filter(e => e.photoUrl).reverse(); // newest first
    if (photos.length >= 2) {
      setCompareA(photos[0].date);
      setCompareB(photos[photos.length - 1].date);
      photoCompareInitialized.current = true;
    }
  }, [entries]);

  // ── Save weight ───────────────────────────────────────────────────────────────

  const handleLogWeight = useCallback(async () => {
    const w = parseFloat(weightInput);
    if (!w || !user) return;
    setSaving(true);
    const dateStr = today();
    const entry: BodyEntry = { date: dateStr, weight: w };
    try {
      await saveBodyEntry(user.uid, entry);
      setEntries(prev => {
        const without = prev.filter(e => e.date !== dateStr);
        return [...without, { ...prev.find(e => e.date === dateStr), ...entry }]
          .sort((a, b) => a.date.localeCompare(b.date));
      });
    } finally {
      setSaving(false);
    }
  }, [weightInput, user]);

  // ── Save measurements ────────────────────────────────────────────────────────

  const handleSaveMeasurements = useCallback(async () => {
    if (!user || Object.keys(measurements).length === 0) return;
    setSaving(true);
    const dateStr = today();
    const bf = calcBodyFat(fitnessProfile.gender, fitnessProfile.height, measurements as BodyMeasurements);
    const leanMass = bf && entries.find(e => e.weight && e.date <= dateStr)?.weight
      ? ((100 - bf) / 100) * (entries.findLast(e => e.weight)?.weight ?? 0)
      : undefined;
    const entry: BodyEntry = {
      date: dateStr,
      measurements: measurements as BodyMeasurements,
      ...(bf != null && { bodyFatPercent: parseFloat(bf.toFixed(1)) }),
      ...(leanMass != null && { leanMass: parseFloat(leanMass.toFixed(1)) }),
    };
    try {
      await saveBodyEntry(user.uid, entry);
      setEntries(prev => {
        const existing = prev.find(e => e.date === dateStr);
        const without = prev.filter(e => e.date !== dateStr);
        return [...without, { ...existing, ...entry }].sort((a, b) => a.date.localeCompare(b.date));
      });
      setCalcBF(bf);
    } finally {
      setSaving(false);
    }
  }, [measurements, user, fitnessProfile, entries]);

  // ── Photo upload ─────────────────────────────────────────────────────────────

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setSaving(true);
    try {
      const dataUrl = await compressImage(file);
      // Key: date__bodyPart — allows multiple photos per day, one per body part
      const docKey = `${photoDate}__${uploadBodyPart}`;
      const entry: BodyEntry = { date: docKey, photoUrl: dataUrl, notes: uploadBodyPart };
      await saveBodyEntry(user.uid, entry);
      setEntries(prev => {
        const without = prev.filter(e => e.date !== docKey);
        return [...without, entry].sort((a, b) => a.date.localeCompare(b.date));
      });
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [user, uploadBodyPart, photoDate]);

  // ── Derived chart data ────────────────────────────────────────────────────────

  const filtered = filterByRange(entries, range);
  const weightEntries = filtered.filter(e => e.weight);

  const chartData = (() => {
    if (weightEntries.length === 0) return [];
    const weights = weightEntries.map(e => e.weight!);
    const emas = calcEMA(weights, 0.3);
    const xs = weightEntries.map((_, i) => i);
    const { slope, intercept } = linearRegression(xs, emas);

    // Extend 4 weeks into the future
    const futureDays = 28;
    const result: any[] = weightEntries.map((e, i) => ({
      date: e.date,
      label: formatDate(e.date),
      actual: e.weight,
      ema: parseFloat(emas[i].toFixed(2)),
    }));

    // Add forecast points
    const lastDate = new Date(weightEntries[weightEntries.length - 1].date + 'T00:00:00');
    for (let d = 1; d <= futureDays; d += 3) {
      const fd = new Date(lastDate);
      fd.setDate(fd.getDate() + d);
      const dateStr = fd.toISOString().split('T')[0];
      const xFuture = weightEntries.length - 1 + d / 1;
      const forecast = parseFloat((slope * xFuture + intercept).toFixed(2));
      result.push({ date: dateStr, label: formatDate(dateStr), forecast });
    }
    return result;
  })();

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const allWeights = entries.filter(e => e.weight).map(e => e.weight!);
  const emaAll = calcEMA(allWeights, 0.3);
  const currentEMA = emaAll[emaAll.length - 1] ?? null;
  const startWeight = allWeights[0] ?? null;
  const changeTotal = currentEMA != null && startWeight != null ? currentEMA - startWeight : null;

  const fourWeekIdx = Math.max(0, allWeights.length - 28);
  const change4W = currentEMA != null && allWeights[fourWeekIdx] != null
    ? currentEMA - calcEMA(allWeights.slice(0, fourWeekIdx + 1), 0.3).at(-1)!
    : null;

  const latestBF = [...entries].reverse().find(e => e.bodyFatPercent)?.bodyFatPercent ?? null;
  const latestWeight = [...entries].reverse().find(e => e.weight)?.weight ?? null;
  const latestLeanMass = latestBF != null && latestWeight != null
    ? ((100 - latestBF) / 100) * latestWeight
    : null;

  // Prognosis
  const { slope: weeklySlope } = (() => {
    if (emaAll.length < 14) return { slope: 0 };
    const recent = emaAll.slice(-28);
    const xs = recent.map((_, i) => i);
    return linearRegression(xs, recent);
  })();
  const weeklyChange = weeklySlope * 7; // kg/vecka
  const daysToTarget = fitnessProfile.targetWeight && currentEMA && weeklySlope !== 0
    ? Math.abs((fitnessProfile.targetWeight - currentEMA) / weeklySlope)
    : null;

  // Radar chart for measurements
  const latestMeasurements = [...entries].reverse().find(e => e.measurements)?.measurements;
  const firstMeasurements = entries.find(e => e.measurements)?.measurements;
  const radarData = MEASUREMENT_FIELDS
    .filter(f => latestMeasurements?.[f.key] && firstMeasurements?.[f.key])
    .map(f => ({
      subject: f.label.split(' (')[0],
      current: latestMeasurements![f.key]!,
      start: firstMeasurements![f.key]!,
      // Normalize so lower is always outward for measurements (inverted scale)
      change: parseFloat(((latestMeasurements![f.key]! - firstMeasurements![f.key]!) / firstMeasurements![f.key]! * 100).toFixed(1)),
    }));

  // Photos with a url
  const photoEntries = entries.filter(e => e.photoUrl).reverse();
  const daysSinceLastPhoto = photoEntries[0]
    ? Math.floor((Date.now() - new Date(photoEntries[0].date + 'T00:00:00').getTime()) / 86400000)
    : null;

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24 lg:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setFitnessPage('home')}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">Vikt & Kropp</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* ── Quick log ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Logga vikt idag</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeightInput(v => String(Math.max(0, parseFloat(v || '0') - 0.1).toFixed(1)))}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Minus size={16} className="text-gray-600" />
            </button>
            <div className="flex-1 relative">
              <input
                type="number"
                step="0.1"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                placeholder="0.0"
                className="w-full text-center text-3xl font-bold text-gray-900 border-none outline-none bg-transparent"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">kg</span>
            </div>
            <button
              onClick={() => setWeightInput(v => String((parseFloat(v || '0') + 0.1).toFixed(1)))}
              className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <Plus size={16} className="text-gray-600" />
            </button>
          </div>

          {latestWeight && (
            <p className="text-center text-xs text-gray-400 mt-1">
              Senast loggat: {latestWeight.toFixed(1)} kg
              {currentEMA && latestWeight && (
                <span className={`ml-2 font-medium ${latestWeight < currentEMA ? 'text-emerald-500' : 'text-rose-400'}`}>
                  ({latestWeight < currentEMA ? '▼' : '▲'} {Math.abs(latestWeight - currentEMA).toFixed(1)} vs. trend)
                </span>
              )}
            </p>
          )}

          <button
            onClick={handleLogWeight}
            disabled={!weightInput || saving}
            className="mt-4 w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Logga vikt
          </button>
        </div>

        {/* ── Measurements ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            onClick={() => setShowMeasurements(v => !v)}
          >
            <span className="text-sm font-semibold text-gray-900">Kroppsmått</span>
            {showMeasurements ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          <AnimatePresence>
            {showMeasurements && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 space-y-3 border-t border-gray-50">
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {MEASUREMENT_FIELDS.map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-400 mb-1">{label}</label>
                        <input
                          type="number"
                          step="0.1"
                          value={measurements[key] ?? ''}
                          onChange={e => setMeasurements(prev => ({
                            ...prev,
                            [key]: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))}
                          placeholder="–"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Navy calculation preview */}
                  {(() => {
                    const bf = calcBodyFat(fitnessProfile.gender, fitnessProfile.height, measurements as BodyMeasurements);
                    if (!bf) return null;
                    const lm = latestWeight ? ((100 - bf) / 100) * latestWeight : null;
                    return (
                      <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                        <p className="text-xs font-medium text-blue-700">Navy-metoden</p>
                        <p className="text-sm text-blue-900 mt-0.5">
                          Kroppsfett: <strong>{bf.toFixed(1)}%</strong>
                          {lm && <span className="ml-3">Muskelmassa: <strong>{lm.toFixed(1)} kg</strong></span>}
                        </p>
                      </div>
                    );
                  })()}

                  <button
                    onClick={handleSaveMeasurements}
                    disabled={Object.keys(measurements).length === 0 || saving}
                    className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Spara mätningar
                  </button>

                  {calcBF != null && (
                    <p className="text-center text-xs text-emerald-600 font-medium">
                      ✓ Sparat – kroppsfett {calcBF.toFixed(1)}%
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Weight chart ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-900">Viktkurva</p>
            <div className="flex gap-1">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                    range === r ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {chartData.length < 2 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              Logga minst 2 viktvärden för att se grafen
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  interval="preserveStartEnd"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={v => `${v}`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb' }}
                  formatter={(v: any, name: string) => {
                    const labels: Record<string, string> = { actual: 'Vikt', ema: 'Trend (EMA)', forecast: 'Prognos' };
                    return [`${Number(v).toFixed(1)} kg`, labels[name] ?? name];
                  }}
                />
                {/* Actual weights */}
                <Scatter dataKey="actual" fill="#93c5fd" opacity={0.6} name="actual" />
                {/* EMA trend */}
                <Line
                  dataKey="ema"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  name="ema"
                  connectNulls
                />
                {/* Forecast */}
                <Line
                  dataKey="forecast"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  name="forecast"
                  connectNulls
                />
                {/* Target weight line */}
                {fitnessProfile.targetWeight && (
                  <ReferenceLine
                    y={fitnessProfile.targetWeight}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: `Mål ${fitnessProfile.targetWeight} kg`, fontSize: 10, fill: '#10b981', position: 'insideTopRight' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          <div className="flex gap-4 mt-2 justify-center">
            {[
              { color: '#93c5fd', label: 'Faktisk vikt' },
              { color: '#3b82f6', label: 'Trend (EMA)' },
              { color: '#3b82f6', label: 'Prognos', dashed: true },
            ].map(({ color, label, dashed }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`h-0.5 w-4 ${dashed ? 'border-t-2 border-dashed' : ''}`}
                  style={{ backgroundColor: dashed ? 'transparent' : color, borderColor: color }} />
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: 'Nuvarande (trend)',
              value: currentEMA ? `${currentEMA.toFixed(1)} kg` : '–',
              sub: latestWeight ? `Råvärde ${latestWeight.toFixed(1)} kg` : undefined,
              color: 'text-blue-600',
            },
            {
              label: 'Förändring (4v)',
              value: change4W != null ? `${change4W >= 0 ? '+' : ''}${change4W.toFixed(1)} kg` : '–',
              sub: changeTotal != null ? `Totalt ${changeTotal >= 0 ? '+' : ''}${changeTotal.toFixed(1)} kg` : undefined,
              color: change4W != null ? (change4W < 0 ? 'text-emerald-600' : 'text-rose-500') : 'text-gray-600',
            },
            {
              label: 'Kroppsfett',
              value: latestBF != null ? `${latestBF.toFixed(1)}%` : '–',
              sub: latestBF ? 'Navy-metoden' : 'Logga mätningar',
              color: 'text-violet-600',
            },
            {
              label: 'Muskelmassa',
              value: latestLeanMass != null ? `${latestLeanMass.toFixed(1)} kg` : '–',
              sub: latestBF ? `${(100 - latestBF).toFixed(1)}% av kroppsvikt` : undefined,
              color: 'text-emerald-600',
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Prognosis ─────────────────────────────────────────────────────── */}
        {currentEMA != null && emaAll.length >= 14 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">Prognos</p>
            <div className="space-y-2">
              {[4, 8, 12].map(weeks => {
                const predicted = currentEMA + weeklyChange * weeks;
                return (
                  <div key={weeks} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">Om {weeks} veckor</span>
                    <span className="text-sm font-semibold text-gray-900">{predicted.toFixed(1)} kg</span>
                  </div>
                );
              })}
              {daysToTarget && fitnessProfile.targetWeight && (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-gray-500">Beräknad målvikt ({fitnessProfile.targetWeight} kg)</span>
                  <span className="text-sm font-semibold text-emerald-600">
                    {Math.round(daysToTarget)} dagar
                  </span>
                </div>
              )}
              {Math.abs(weeklyChange) > latestWeight! * 0.01 && (
                <div className="mt-2 p-3 bg-amber-50 rounded-xl">
                  <p className="text-xs text-amber-700">
                    ⚠️ Takten ({Math.abs(weeklyChange).toFixed(2)} kg/vecka) överstiger 1% av kroppsvikten – risk för muskelmassaförlust.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Measurement instructions ───────────────────────────────────────── */}
        <MeasurementInstructions />

        {/* ── Progress photos ───────────────────────────────────────────────── */}
        {(() => {
          const filteredPhotos = photoEntries.filter(
            e => filterBodyPart === 'Alla' || e.notes === filterBodyPart,
          );
          const entryA = photoEntries.find(e => e.date === compareA);
          const entryB = photoEntries.find(e => e.date === compareB);
          const canCompare = !!(entryA?.photoUrl && entryB?.photoUrl);

          return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Progress-foton</p>
                <div className="flex gap-2 flex-wrap justify-end">
                  {canCompare && (
                    <>
                      <button
                        onClick={() => { setCompareLayout('side'); setShowCompare(true); }}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                      >
                        <Columns2 size={12} /> Sida vid sida
                      </button>
                      <button
                        onClick={() => { setCompareLayout('slider'); setShowCompare(true); }}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                      >
                        <SlidersHorizontal size={12} /> Slider
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    <Camera size={13} /> Foto
                  </button>
                </div>
              </div>

              {/* Selected A/B strip */}
              {(compareA || compareB) && (
                <div className="flex gap-2 mb-3">
                  {compareA && entryA && (
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-2 py-1.5 flex-1 min-w-0">
                      <img src={entryA.photoUrl!} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-blue-700">A</p>
                        <p className="text-[10px] text-blue-600 truncate">{formatDate(entryA.date)}</p>
                      </div>
                      <button onClick={() => setCompareA(null)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {!compareA && (
                    <div className="flex items-center justify-center gap-1 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl px-3 py-2 flex-1 text-xs text-gray-400">
                      Klicka ett foto → Välj som A
                    </div>
                  )}
                  {compareB && entryB && (
                    <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 flex-1 min-w-0">
                      <img src={entryB.photoUrl!} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-orange-700">B</p>
                        <p className="text-[10px] text-orange-600 truncate">{formatDate(entryB.date)}</p>
                      </div>
                      <button onClick={() => setCompareB(null)} className="text-orange-400 hover:text-orange-600 flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {!compareB && (
                    <div className="flex items-center justify-center gap-1 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl px-3 py-2 flex-1 text-xs text-gray-400">
                      Klicka ett foto → Välj som B
                    </div>
                  )}
                </div>
              )}

              {/* Upload controls */}
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {BODY_PARTS.map(part => (
                  <button
                    key={part}
                    onClick={() => setUploadBodyPart(part)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      uploadBodyPart === part ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {part}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400">Datum:</span>
                <input
                  type="date"
                  value={photoDate}
                  max={today()}
                  onChange={e => setPhotoDate(e.target.value || today())}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

              {daysSinceLastPhoto !== null && daysSinceLastPhoto > 14 && (
                <div className="mb-3 p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-700">📸 Dags för ett progress-foto! Senaste var för {daysSinceLastPhoto} dagar sedan.</p>
                </div>
              )}

              {photoEntries.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-gray-400">Inga foton ännu. Välj kroppsdel, välj datum och ladda upp ditt första foto!</p>
                  <p className="text-[10px] text-gray-300">Klicka ett foto → välj som A eller B → jämför med Sida vid sida eller Slider.</p>
                </div>
              ) : (
                <>
                  {/* Filter by body part */}
                  <div className="flex gap-1.5 mb-3 flex-wrap">
                    {(['Alla', ...BODY_PARTS] as const).map(part => (
                      <button
                        key={part}
                        onClick={() => setFilterBodyPart(part)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                          filterBodyPart === part ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {part}
                      </button>
                    ))}
                  </div>

                  {/* Photo grid — click to open lightbox */}
                  <div className="grid grid-cols-3 gap-2">
                    {filteredPhotos.slice(0, 12).map(e => {
                      const isA = compareA === e.date;
                      const isB = compareB === e.date;
                      const idx = photoEntries.findIndex(p => p.date === e.date);
                      return (
                        <button
                          key={`${e.date}-${e.notes}`}
                          className="relative group focus:outline-none"
                          onClick={() => setLightboxIndex(idx)}
                        >
                          <img
                            src={e.photoUrl}
                            alt={e.date}
                            className={`w-full aspect-square object-cover rounded-xl transition-opacity ${
                              (compareA || compareB) && !isA && !isB ? 'opacity-60' : 'opacity-100'
                            }`}
                          />
                          {/* A/B badge */}
                          {isA && (
                            <span className="absolute top-1 left-1 text-[10px] font-bold bg-blue-500 text-white w-5 h-5 flex items-center justify-center rounded-full shadow">A</span>
                          )}
                          {isB && (
                            <span className="absolute top-1 left-1 text-[10px] font-bold bg-orange-500 text-white w-5 h-5 flex items-center justify-center rounded-full shadow">B</span>
                          )}
                          <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                            {formatDate(e.date)}
                          </span>
                          {e.notes && (
                            <span className="absolute top-1 right-1 text-[8px] bg-blue-500/70 text-white px-1.5 py-0.5 rounded-full">
                              {e.notes}
                            </span>
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </button>
                      );
                    })}
                  </div>
                  {filteredPhotos.length > 12 && (
                    <p className="text-xs text-gray-400 text-center mt-2">+{filteredPhotos.length - 12} fler foton</p>
                  )}

                  {!compareA && !compareB && (
                    <p className="text-[10px] text-gray-400 text-center mt-2">
                      Klicka ett foto för att se det i helskärm och välja det för jämförelse
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <PhotoLightbox
            entries={photoEntries}
            currentIndex={lightboxIndex}
            compareA={compareA}
            compareB={compareB}
            onSelectA={date => { setCompareA(date); }}
            onSelectB={date => { setCompareB(date); }}
            onNavigate={setLightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}

        {/* Compare modal */}
        {showCompare && compareA && compareB && (() => {
          const entryA = photoEntries.find(e => e.date === compareA);
          const entryB = photoEntries.find(e => e.date === compareB);
          if (!entryA?.photoUrl || !entryB?.photoUrl) return null;
          return (
            <CompareModal
              entryA={entryA}
              entryB={entryB}
              layout={compareLayout}
              onLayoutChange={setCompareLayout}
              onClose={() => setShowCompare(false)}
            />
          );
        })()}

        {/* ── Measurement radar ─────────────────────────────────────────────── */}
        {radarData.length >= 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-1">Mätningstrend</p>
            <p className="text-xs text-gray-400 mb-4">Procentuell förändring sedan start</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#f0f0f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="Start" dataKey="start" stroke="#d1d5db" fill="#d1d5db" fillOpacity={0.3} />
                <Radar name="Nu" dataKey="current" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Profile settings ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Profilinställningar</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Kön</label>
              <select
                value={fitnessProfile.gender}
                onChange={e => useStore.getState().setFitnessProfile({ gender: e.target.value as 'male' | 'female' })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              >
                <option value="male">Man</option>
                <option value="female">Kvinna</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Längd (cm)</label>
              <input
                type="number"
                value={fitnessProfile.height}
                onChange={e => useStore.getState().setFitnessProfile({ height: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ålder</label>
              <input
                type="number"
                value={fitnessProfile.age}
                onChange={e => useStore.getState().setFitnessProfile({ age: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Målvikt (kg)</label>
              <input
                type="number"
                step="0.5"
                value={fitnessProfile.targetWeight ?? ''}
                onChange={e => useStore.getState().setFitnessProfile({ targetWeight: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="–"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
