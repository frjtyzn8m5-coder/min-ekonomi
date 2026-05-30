import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { loadPantry, savePantryItem, deletePantryItem, adjustPantryStock, upsertPantryItems, upsertPriceEntries } from '../../lib/pantryDb';
import { getLvData, matchToLV } from '../../utils/matchNutrition';
import type { PantryItem, ParsedReceiptItem, PriceEntry, FoodItem } from '../../types';
import ReceiptScanner from '../../components/fitness/ReceiptScanner';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import {
  Package, Plus, Trash2, ScanBarcode, FileText, Search, ChevronDown,
  AlertTriangle, Edit2, Check, X, ArrowLeft,
} from 'lucide-react';
import { nanoid } from 'nanoid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilExpiry(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function expiryColor(days: number | null): string {
  if (days === null) return '';
  if (days <= 0) return 'text-red-600 bg-red-50';
  if (days <= 3) return 'text-orange-500 bg-orange-50';
  if (days <= 7) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}

// ─── Receipt import dialog ────────────────────────────────────────────────────

interface ReceiptReviewProps {
  items: ParsedReceiptItem[];
  onConfirm: (selected: ParsedReceiptItem[]) => void;
  onClose: () => void;
}

function ReceiptReview({ items, onConfirm, onClose }: ReceiptReviewProps) {
  const [selected, setSelected] = useState<ParsedReceiptItem[]>(
    items.map(i => ({ ...i, selected: true })),
  );

  function toggle(idx: number) {
    setSelected(prev =>
      prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item),
    );
  }

  const count = selected.filter(s => s.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">Välj produkter att lägga till</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {selected.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${item.selected ? '' : 'opacity-40'}`}
              onClick={() => toggle(idx)}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.selected ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                {item.selected && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                <p className="text-xs text-gray-400">Art.nr {item.articleNumber}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-gray-800">{item.pris.toFixed(2)} kr</p>
                <div className="flex items-center gap-1 justify-end">
                  <p className="text-xs text-gray-400">{item.amount} {item.unit}</p>
                  {item.hasDiscount && (
                    <span className="text-[10px] font-medium bg-red-100 text-red-600 px-1 rounded">REA</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Avbryt
          </button>
          <button
            onClick={() => onConfirm(selected.filter(s => s.selected))}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            Lägg till {count} produkter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manual add dialog ────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  'Mejeri', 'Kött & Fisk', 'Grönsaker', 'Frukt', 'Bröd & Spannmål',
  'Konserver', 'Frysvara', 'Kryddor', 'Dryck', 'Snacks', 'Övrigt',
];

interface ManualAddProps {
  onSave: (item: PantryItem) => void;
  onClose: () => void;
  prefill?: Partial<PantryItem>;
  existingItems?: PantryItem[];
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function ManualAdd({ onSave, onClose, prefill, existingItems = [] }: ManualAddProps) {
  const [name, setName] = useState(prefill?.name ?? '');
  const [amount, setAmount] = useState(String(prefill?.amount ?? ''));
  const [unit, setUnit] = useState<'g' | 'st'>(prefill?.unit ?? 'g');
  const [unitWeight, setUnitWeight] = useState(String(prefill?.unitWeightGrams ?? ''));
  const [pricePerUnit, setPricePerUnit] = useState(String(prefill?.pricePerUnit ?? ''));
  const [expiry, setExpiry] = useState(prefill?.expiryDate ?? todayStr());
  const [category, setCategory] = useState(prefill?.category ?? '');
  const [foodId, setFoodId] = useState(prefill?.foodId ?? '');

  // Combined suggestions: existing pantry items + LV database
  const [suggestions, setSuggestions] = useState<Array<{ label: string; sub: string; onSelect: () => void }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matchedLv, setMatchedLv] = useState<FoodItem | null>(null);

  // Category dropdown state
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const filteredCats = CATEGORY_OPTIONS.filter(c =>
    !category || c.toLowerCase().includes(category.toLowerCase()),
  );

  async function handleNameChange(val: string) {
    setName(val);
    setMatchedLv(null);
    setFoodId('');
    if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }

    const q = val.toLowerCase();

    // Existing pantry items first (top priority)
    const pantryMatches = existingItems
      .filter(i => i.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map(i => ({
        label: i.name,
        sub: `${i.amount} ${i.unit}${i.pricePerUnit ? ` · ${i.pricePerUnit} kr` : ''}`,
        onSelect: () => {
          setName(i.name);
          setUnit(i.unit);
          setAmount(String(i.amount));
          if (i.pricePerUnit) setPricePerUnit(String(i.pricePerUnit));
          if (i.unitWeightGrams) setUnitWeight(String(i.unitWeightGrams));
          if (i.category) setCategory(i.category);
          if (i.foodId) setFoodId(i.foodId);
          setSuggestions([]); setShowSuggestions(false);
        },
      }));

    // LV database
    const lv = await getLvData();
    const lvMatches = lv
      .filter(i => i.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(i => ({
        label: i.name,
        sub: `${i.energy_kcal} kcal · ${i.protein}g P · ${i.fat}g F · ${i.carbs}g KH`,
        onSelect: () => {
          setName(i.name);
          setFoodId(i.id);
          setMatchedLv(i);
          setSuggestions([]); setShowSuggestions(false);
        },
      }));

    const all = [...pantryMatches, ...lvMatches].slice(0, 7);
    setSuggestions(all);
    setShowSuggestions(all.length > 0);
  }

  function handleSave() {
    if (!name.trim() || !amount) return;
    const priceNum = pricePerUnit ? parseFloat(pricePerUnit) : undefined;
    const weightNum = unitWeight ? parseFloat(unitWeight) : undefined;
    const item: PantryItem = {
      id: prefill?.id ?? nanoid(),
      name: name.trim(),
      amount: parseFloat(amount),
      unit,
      unitWeightGrams: weightNum,
      pricePerUnit: priceNum,
      pricePerKg: priceNum && weightNum ? (priceNum / weightNum) * 1000 : undefined,
      expiryDate: expiry || undefined,
      category: category || undefined,
      addedAt: prefill?.addedAt ?? Date.now(),
      source: prefill?.source ?? 'manual',
      foodId: foodId || undefined,
    };
    onSave(item);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{prefill?.id ? 'Redigera' : 'Lägg till manuellt'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {/* Name field with combined autocomplete */}
          <div className="relative">
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Namn * (börja skriva för förslag)"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onMouseDown={s.onSelect}
                    className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium text-gray-800 block">{s.label}</span>
                    <span className="text-xs text-gray-400">{s.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Matched LV nutrition */}
          {matchedLv && (
            <div className="bg-green-50 rounded-xl px-3 py-2 flex items-center gap-2">
              <Check size={14} className="text-green-600 flex-shrink-0" />
              <span className="text-xs text-green-700">
                {matchedLv.energy_kcal} kcal/100g · {matchedLv.protein}g P · {matchedLv.fat}g F · {matchedLv.carbs}g KH
              </span>
            </div>
          )}

          {/* Amount + unit */}
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Mängd *"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <select
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              value={unit}
              onChange={e => setUnit(e.target.value as 'g' | 'st')}
            >
              <option value="g">gram</option>
              <option value="st">st</option>
            </select>
          </div>
          {unit === 'st' && (
            <input
              type="number"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Gram per förpackning (t.ex. 500)"
              value={unitWeight}
              onChange={e => setUnitWeight(e.target.value)}
            />
          )}

          {/* Price — visually required */}
          <div className="relative">
            <input
              type="number"
              step="0.01"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${
                pricePerUnit ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'
              }`}
              placeholder="Pris per förpackning (kr) *"
              value={pricePerUnit}
              onChange={e => setPricePerUnit(e.target.value)}
            />
            {!pricePerUnit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-orange-500">
                Viktigt!
              </span>
            )}
          </div>
          {!pricePerUnit && (
            <p className="text-[11px] text-orange-500 -mt-1">
              Pris behövs för receptkostnader och inköpslista.
            </p>
          )}

          {/* Expiry date — pre-filled with today */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Bäst före</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
            />
          </div>

          {/* Category — dropdown with filter */}
          <div className="relative">
            <label className="text-xs text-gray-500 mb-1 block">Kategori</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Välj eller skriv kategori…"
              value={category}
              onChange={e => { setCategory(e.target.value); setShowCatDropdown(true); }}
              onFocus={() => setShowCatDropdown(true)}
              onBlur={() => setTimeout(() => setShowCatDropdown(false), 150)}
            />
            {showCatDropdown && filteredCats.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                {filteredCats.map(cat => (
                  <button
                    key={cat}
                    onMouseDown={() => { setCategory(cat); setShowCatDropdown(false); }}
                    className={`w-full text-left px-3 py-2 hover:bg-green-50 text-sm border-b border-gray-50 last:border-0 ${
                      category === cat ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !amount}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40"
          >
            Spara
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Pantry page ─────────────────────────────────────────────────────────

type View = 'list' | 'barcode';

export default function Pantry() {
  const { user } = useAuthStore();
  const { setFitnessPage } = useStore();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ParsedReceiptItem[] | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  // Load pantry
  useEffect(() => {
    if (!user) return;
    loadPantry(user.uid).then(data => {
      setItems(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  // Barcode scanner
  useEffect(() => {
    if (view !== 'barcode' || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();

    reader.decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
      if (!result) return;
      const barcode = result.getText();
      controlsRef.current?.stop();
      setView('list');

      // Look up barcode in Open Food Facts
      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,nutriments,quantity`);
        const json = await res.json();
        if (json.status === 1) {
          const p = json.product;
          setShowManual(true);
          setEditItem({
            id: nanoid(),
            name: p.product_name ?? barcode,
            barcode,
            amount: 1,
            unit: 'st',
            addedAt: Date.now(),
            source: 'barcode',
          } as PantryItem);
        }
      } catch {
        setShowManual(true);
        setEditItem({ id: nanoid(), name: '', barcode, amount: 1, unit: 'st', addedAt: Date.now(), source: 'barcode' } as PantryItem);
      }
    }).then(controls => { controlsRef.current = controls; }).catch(() => {});

    return () => { controlsRef.current?.stop(); };
  }, [view]);

  async function handleSaveItem(item: PantryItem) {
    if (!user) return;
    await savePantryItem(user.uid, item);
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? item : i);
      return [item, ...prev];
    });
    setShowManual(false);
    setEditItem(null);
  }

  async function handleDelete(itemId: string) {
    if (!user) return;
    await deletePantryItem(user.uid, itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  }

  async function handleAdjust(item: PantryItem, delta: number) {
    if (!user) return;
    const newAmount = Math.max(0, item.amount + delta);
    await adjustPantryStock(user.uid, item, delta);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, amount: newAmount } : i));
  }

  async function handleReceiptConfirm(selected: ParsedReceiptItem[]) {
    if (!user) return;

    const today = new Date().toISOString().slice(0, 10);

    // Pre-load LV data for nutrition matching
    const lvData = await getLvData();

    // Dedup: if article number already in pantry, update amount+price; else create new
    const updatedItems: PantryItem[] = [];
    const newItems: PantryItem[] = [];

    for (const ri of selected) {
      const existing = items.find(i => i.articleNumber && i.articleNumber === ri.articleNumber);
      const incomingAmount = ri.unit === 'kg' ? ri.amount * 1000 : ri.amount;
      const incomingUnit: 'g' | 'st' = ri.unit === 'kg' ? 'g' : 'st';

      if (existing) {
        const merged: PantryItem = {
          ...existing,
          amount: existing.amount + incomingAmount,
          // Only update price if not a sale price; prefer regularPris when discounted
          pricePerUnit: ri.unit === 'st'
            ? (ri.regularPris ?? ri.pris)
            : existing.pricePerUnit,
          pricePerKg: ri.unit === 'kg'
            ? (ri.regularPris ?? ri.pris)
            : existing.pricePerKg,
        };
        updatedItems.push(merged);
      } else {
        // Try to match to LV database for nutrition info
        const lvMatch = matchToLV(ri.name, lvData);
        newItems.push({
          id: nanoid(),
          name: ri.name,
          articleNumber: ri.articleNumber,
          amount: incomingAmount,
          unit: incomingUnit,
          pricePerUnit: ri.unit === 'st' ? ri.pris : undefined,
          pricePerKg: ri.unit === 'kg' ? ri.pris : undefined,
          foodId: lvMatch?.id,
          addedAt: Date.now(),
          source: 'receipt' as const,
        });
      }
    }

    // Price DB stores the REGULAR (non-sale) price for accurate cost tracking
    const priceEntries: PriceEntry[] = selected.map(ri => ({
      name: ri.name,
      articleNumber: ri.articleNumber,
      // Use regularPris when discounted, otherwise use pris
      pricePerUnit: ri.unit === 'st' ? (ri.regularPris ?? ri.pris) : undefined,
      pricePerKg: ri.unit === 'kg' ? (ri.regularPris ?? ri.pris) : undefined,
      store: 'ICA',
      lastUpdated: today,
    }));

    try {
      await upsertPantryItems(user.uid, [...updatedItems, ...newItems]);
      await upsertPriceEntries(user.uid, priceEntries);
      setItems(prev => [
        ...newItems,
        ...prev.map(i => updatedItems.find(u => u.id === i.id) ?? i),
      ]);
      setReceiptItems(null);
    } catch (err) {
      console.error('Kunde inte spara kvittoprodukter:', err);
      alert('Något gick fel vid sparandet. Kontrollera anslutningen och försök igen.');
    }
  }

  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by category
  const grouped = filtered.reduce<Record<string, PantryItem[]>>((acc, item) => {
    const key = item.category ?? 'Övrigt';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const expiringSoon = items.filter(i => {
    const d = daysUntilExpiry(i.expiryDate);
    return d !== null && d <= 3;
  });

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setFitnessPage('recipes')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 -ml-1">
                <ArrowLeft size={18} className="text-gray-600" />
              </button>
              <Package size={20} className="text-green-600" />
              <h1 className="text-lg font-bold text-gray-900">Skafferi</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView(v => v === 'barcode' ? 'list' : 'barcode')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'barcode' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <ScanBarcode size={15} />
                Skanna
              </button>
              <button
                onClick={() => setShowReceipt(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-medium"
              >
                <FileText size={15} />
                Kvitto
              </button>
              <button
                onClick={() => { setEditItem(null); setShowManual(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium"
              >
                <Plus size={15} />
                Lägg till
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
              placeholder="Sök i skafferiet…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Barcode scanner overlay */}
      {view === 'barcode' && (
        <div className="fixed inset-0 z-40 bg-black flex flex-col items-center justify-center">
          <video ref={videoRef} className="w-full max-w-sm rounded-xl" />
          <button
            onClick={() => setView('list')}
            className="mt-6 px-6 py-3 bg-white rounded-full text-sm font-medium text-gray-800"
          >
            Avbryt
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Expiring soon banner */}
        {expiringSoon.length > 0 && (
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
            <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-700">Går snart ut</p>
              <p className="text-xs text-orange-600 mt-0.5">
                {expiringSoon.map(i => i.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-gray-400 text-sm">Laddar skafferi…</div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <Package size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Skafferiet är tomt</p>
            <p className="text-gray-400 text-sm mt-1">Lägg till varor via kvitto, streckkod eller manuellt</p>
          </div>
        )}

        {/* Grouped list */}
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'sv')).map(([cat, catItems]) => (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat}</h3>
            <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden shadow-sm">
              {catItems.map(item => {
                const days = daysUntilExpiry(item.expiryDate);
                const expColor = expiryColor(days);
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                        {days !== null && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${expColor}`}>
                            {days <= 0 ? 'Utgånget' : `${days}d`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.pricePerKg ? `${item.pricePerKg.toFixed(0)} kr/kg` : item.pricePerUnit ? `${item.pricePerUnit.toFixed(2)} kr/st` : ''}
                        {item.articleNumber ? ` · ${item.articleNumber}` : ''}
                      </p>
                    </div>

                    {/* Amount controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleAdjust(item, item.unit === 'g' ? -100 : -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-lg leading-none"
                      >−</button>
                      <span className="w-16 text-center text-sm font-medium text-gray-800">
                        {item.amount}{item.unit}
                      </span>
                      <button
                        onClick={() => handleAdjust(item, item.unit === 'g' ? 100 : 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-lg leading-none"
                      >+</button>
                    </div>

                    <button
                      onClick={() => { setEditItem(item); setShowManual(true); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {showReceipt && (
        <ReceiptScanner
          onParsed={parsed => { setReceiptItems(parsed); setShowReceipt(false); }}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {receiptItems && (
        <ReceiptReview
          items={receiptItems}
          onConfirm={handleReceiptConfirm}
          onClose={() => setReceiptItems(null)}
        />
      )}

      {showManual && (
        <ManualAdd
          prefill={editItem ?? undefined}
          existingItems={items}
          onSave={handleSaveItem}
          onClose={() => { setShowManual(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}
