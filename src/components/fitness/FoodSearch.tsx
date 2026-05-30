import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ScanLine, X, Plus, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FoodItem } from '../../types';
import BarcodeScanner from './BarcodeScanner';

// ─── Livsmedelsverket local data ─────────────────────────────────────────────

let _lvData: FoodItem[] | null = null;
async function getLvData(): Promise<FoodItem[]> {
  if (_lvData) return _lvData;
  const res = await fetch('/data/livsmedelsverket.json');
  const raw = await res.json();
  _lvData = raw.map((item: {
    id: string; name: string; energy_kcal: number;
    protein: number; fat: number; carbs: number; fiber?: number;
  }) => ({
    id: item.id,
    name: item.name,
    energy_kcal: item.energy_kcal,
    protein: item.protein,
    fat: item.fat,
    carbs: item.carbs,
    fiber: item.fiber,
    source: 'livsmedelsverket' as const,
  }));
  return _lvData!;
}

function searchLv(data: FoodItem[], query: string): FoodItem[] {
  const q = query.toLowerCase().trim();
  return data
    .filter(item => item.name.toLowerCase().includes(q))
    .slice(0, 10);
}

// ─── Open Food Facts ──────────────────────────────────────────────────────────

interface OFFProduct {
  id: string;
  product_name?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
    fiber_100g?: number;
  };
  code?: string;
}

function offToFoodItem(p: OFFProduct): FoodItem | null {
  const name = p.product_name?.trim();
  const n = p.nutriments;
  if (!name || !n) return null;
  const kcal = n['energy-kcal_100g'];
  if (!kcal) return null;
  return {
    id: `off-${p.id || p.code}`,
    name,
    energy_kcal: kcal,
    protein: n.proteins_100g ?? 0,
    fat: n.fat_100g ?? 0,
    carbs: n.carbohydrates_100g ?? 0,
    fiber: n.fiber_100g,
    source: 'openfoodfacts',
    barcode: p.code,
  };
}

async function searchOFF(query: string): Promise<FoodItem[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=id,product_name,nutriments,code`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('OFF fetch failed');
  const data = await res.json();
  return (data.products ?? [])
    .map(offToFoodItem)
    .filter(Boolean) as FoodItem[];
}

async function lookupBarcodeOFF(barcode: string): Promise<FoodItem | null> {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json?fields=product_name,nutriments,code`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1) return null;
  return offToFoodItem({ ...data.product, id: barcode });
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface SelectedFood {
  item: FoodItem;
  amount: number; // gram
}

interface FoodSearchProps {
  onSelect: (food: SelectedFood) => void;
  onClose: () => void;
}

export default function FoodSearch({ onSelect, onClose }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [amount, setAmount] = useState('100');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [lvData, offResults] = await Promise.allSettled([
        getLvData().then(data => searchLv(data, q)),
        searchOFF(q),
      ]);
      const lv = lvData.status === 'fulfilled' ? lvData.value : [];
      const off = offResults.status === 'fulfilled' ? offResults.value : [];
      // Merge: LV first, then OFF, deduplicate by name (case-insensitive)
      const seen = new Set(lv.map(i => i.name.toLowerCase()));
      const merged = [
        ...lv,
        ...off.filter(i => !seen.has(i.name.toLowerCase())),
      ];
      setResults(merged);
    } catch {
      setError('Sökning misslyckades. Kontrollera nätverksanslutning.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  async function handleBarcode(code: string) {
    setShowScanner(false);
    setLoading(true);
    setError(null);
    try {
      const item = await lookupBarcodeOFF(code);
      if (item) {
        setSelected(item);
        setResults([]);
        setQuery(item.name);
      } else {
        // Product not found — scanner will show add-product form
        setError(`Streckkod ${code} hittades inte. Scanna igen och välj "Lägg till manuellt" för att registrera produkten.`);
      }
    } catch {
      setError('Kunde inte slå upp streckkoden.');
    } finally {
      setLoading(false);
    }
  }

  function handleAddProduct(barcode: string, name: string, nutrition: {
    energy_kcal: number; protein: number; fat: number; carbs: number; fiber?: number;
  }) {
    const item: FoodItem = {
      id: `custom-${barcode || Date.now()}`,
      name,
      energy_kcal: nutrition.energy_kcal,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
      fiber: nutrition.fiber,
      source: 'custom',
      barcode: barcode || undefined,
    };
    setSelected(item);
    setResults([]);
    setQuery(name);
    setShowScanner(false);
  }

  function handleConfirm() {
    if (!selected) return;
    const g = parseFloat(amount);
    if (isNaN(g) || g <= 0) return;
    onSelect({ item: selected, amount: g });
    onClose();
  }

  if (showScanner) {
    return (
      <BarcodeScanner
        onDetected={handleBarcode}
        onClose={() => setShowScanner(false)}
        allowAddProduct
        onAddProduct={handleAddProduct}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-40 bg-white flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Sök livsmedel…"
            className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setSelected(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500"
        >
          <ScanLine size={18} />
        </button>
      </div>

      {/* Amount picker (shown when item selected) */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-orange-50 border-b border-orange-100">
              <p className="text-sm font-semibold text-gray-900 mb-1">{selected.name}</p>
              <p className="text-xs text-gray-500 mb-3">
                {selected.energy_kcal} kcal / 100g · P {selected.protein}g · F {selected.fat}g · K {selected.carbs}g
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Mängd (gram)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="1"
                    max="5000"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-orange-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Totalt</p>
                  <p className="text-sm font-bold text-orange-500">
                    {Math.round(selected.energy_kcal * parseFloat(amount || '0') / 100)} kcal
                  </p>
                </div>
              </div>
              {/* Quick gram buttons */}
              <div className="flex gap-2 mt-2">
                {[50, 100, 150, 200].map(g => (
                  <button
                    key={g}
                    onClick={() => setAmount(String(g))}
                    className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                      amount === String(g)
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {g}g
                  </button>
                ))}
              </div>
              <button
                onClick={handleConfirm}
                className="w-full mt-3 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Lägg till
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-orange-400 animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2 p-4 text-red-500 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {!loading && !error && results.length === 0 && query.trim() && (
          <p className="text-center text-gray-400 text-sm py-12">
            Inga träffar för "{query}"
          </p>
        )}
        {!loading && !error && results.length === 0 && !query.trim() && (
          <div className="p-6 text-center text-gray-400 text-sm">
            <ScanLine size={32} className="mx-auto mb-2 text-gray-300" />
            <p>Sök på livsmedelsnamn eller skanna streckkod</p>
          </div>
        )}
        {results.map(item => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className={`w-full p-4 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${
              selected?.id === item.id ? 'bg-orange-50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.source === 'livsmedelsverket' ? 'Livsmedelsverket' : 'Open Food Facts'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">{item.energy_kcal} kcal</p>
                <p className="text-[10px] text-gray-400">per 100g</p>
              </div>
            </div>
            <div className="flex gap-3 mt-1.5 text-[11px] text-gray-500">
              <span>P {item.protein}g</span>
              <span>F {item.fat}g</span>
              <span>K {item.carbs}g</span>
              {item.fiber != null && <span>Fiber {item.fiber}g</span>}
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
