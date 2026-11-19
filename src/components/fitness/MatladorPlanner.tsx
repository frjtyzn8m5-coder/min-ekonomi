import { useMemo, useState } from 'react';
import { Box, Flame, Beef, Wheat, Droplets, Scale, Info } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { macrosPerPortion } from '../../utils/shoppingEngine';
import { scaleRecipe } from '../../utils/scaleRecipe';
import type { Recipe } from '../../types';

// ─── Matlådor / makron per portion (#21) ────────────────────────────────────────
// Batchlagning utan våg: välj recept + hur många matlådor du delar upp det i, se
// exakt makron per låda + totalt, och hur många gram av varje ingrediens som
// hamnar i varje låda. Allt deterministiskt via shoppingEngine.macrosPerPortion
// och scaleRecipe (ingen LLM, ingen nätverk). Kopplas till ditt dagliga kalorimål.

const fmt = (n: number, d = 0) => n.toLocaleString('sv-SE', { maximumFractionDigits: d });

function MacroPill({ icon: Icon, label, value, tint }: {
  icon: typeof Flame; label: string; value: string; tint: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center py-2.5 rounded-xl" style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}>
      <Icon size={15} />
      <span className="text-sm font-semibold mt-1 tnum">{value}</span>
      <span className="text-[10px] opacity-80">{label}</span>
    </div>
  );
}

export default function MatladorPlanner({ recipes }: { recipes: Recipe[] }) {
  const { userProfile } = useStore();
  const [recipeId, setRecipeId] = useState<string>(recipes[0]?.id ?? '');
  const [batches, setBatches] = useState(1);
  const [portions, setPortions] = useState<number>(recipes[0]?.servings ?? 4);

  const recipe = recipes.find(r => r.id === recipeId) ?? null;

  // Per-portion + total makron (ren uträkning).
  const macros = useMemo(
    () => (recipe ? macrosPerPortion(recipe, portions, batches) : null),
    [recipe, portions, batches],
  );

  // Gram per matlåda, per ingrediens: skala receptet till (servings × batches) och
  // dela varje ingrediens på antalet lådor. "Ingen våg behövs" vid uppdelning.
  const perBoxIngredients = useMemo(() => {
    if (!recipe) return [];
    const scaled = scaleRecipe(recipe, Math.max(1, recipe.servings * batches));
    const p = Math.max(1, portions);
    return scaled.ingredients
      .map(ing => ({ name: ing.name, grams: Math.round(ing.amount / p) }))
      .filter(i => i.grams > 0);
  }, [recipe, portions, batches]);

  const kcalTarget = userProfile?.dailyCalorieTarget;
  const proteinTarget = userProfile?.proteinTargetG;
  const coverageKcal = macros && kcalTarget ? Math.round((macros.perPortion.kcal / kcalTarget) * 100) : null;
  const coverageProtein = macros && proteinTarget ? Math.round((macros.perPortion.protein / proteinTarget) * 100) : null;

  if (recipes.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-line">
        <p className="text-faint text-sm">Inga recept ännu</p>
        <p className="text-faint text-xs mt-1">Importera eller skapa recept för att planera matlådor.</p>
      </div>
    );
  }

  const noNutrition = recipe != null && recipe.nutritionPerServing.kcal === 0;

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
      {/* ── Val ── */}
      <div className="vh-card p-5 space-y-5">
        <h3 className="font-display text-lg text-ink flex items-center gap-2">
          <Box size={18} className="text-cyan" /> Matlådor
        </h3>

        <div>
          <label className="text-xs font-semibold text-mut">Recept</label>
          <select
            value={recipeId}
            onChange={e => {
              setRecipeId(e.target.value);
              const r = recipes.find(x => x.id === e.target.value);
              if (r) setPortions(Math.max(1, r.servings));
            }}
            className="w-full mt-2 border border-line bg-soft text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          >
            {recipes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Antal satser */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-mut">Satser (koka receptet)</p>
            <p className="text-[11px] text-faint">Receptet ger {recipe?.servings ?? 0} port/sats</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setBatches(b => Math.max(1, b - 1))}
              className="w-9 h-9 rounded-xl bg-soft flex items-center justify-center text-mut hover:bg-white/10 text-lg">−</button>
            <span className="w-8 text-center font-display text-ink tnum">{batches}</span>
            <button onClick={() => setBatches(b => b + 1)}
              className="w-9 h-9 rounded-xl bg-soft flex items-center justify-center text-mut hover:bg-white/10 text-lg">+</button>
          </div>
        </div>

        {/* Antal matlådor */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-mut">Antal matlådor</p>
            <p className="text-[11px] text-faint">Dela upp hela satsen i N lådor</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPortions(p => Math.max(1, p - 1))}
              className="w-9 h-9 rounded-xl bg-soft flex items-center justify-center text-mut hover:bg-white/10 text-lg">−</button>
            <span className="w-8 text-center font-display text-ink tnum">{portions}</span>
            <button onClick={() => setPortions(p => p + 1)}
              className="w-9 h-9 rounded-xl bg-soft flex items-center justify-center text-mut hover:bg-white/10 text-lg">+</button>
          </div>
        </div>

        {noNutrition && (
          <div className="flex gap-2 text-[11px] text-faint bg-soft rounded-xl p-3">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            Receptet saknar näringsvärden — makron per låda kan inte beräknas. Grammängderna nedan stämmer ändå.
          </div>
        )}
      </div>

      {/* ── Resultat ── */}
      <div className="space-y-5">
        {macros && !noNutrition && (
          <div className="vh-card p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-display text-lg text-ink">Per matlåda</h3>
              <span className="text-xs text-faint tnum">{portions} lådor · {batches} sats{batches > 1 ? 'er' : ''}</span>
            </div>
            <div className="flex gap-2">
              <MacroPill icon={Flame} label="kcal" value={fmt(macros.perPortion.kcal)} tint="var(--gold)" />
              <MacroPill icon={Beef} label="protein" value={`${fmt(macros.perPortion.protein)}g`} tint="var(--cyan)" />
              <MacroPill icon={Wheat} label="kolh" value={`${fmt(macros.perPortion.carbs)}g`} tint="var(--lime)" />
              <MacroPill icon={Droplets} label="fett" value={`${fmt(macros.perPortion.fat)}g`} tint="var(--violet)" />
            </div>

            {/* Koppling till dagsmål */}
            {(coverageKcal != null || coverageProtein != null) && (
              <div className="mt-4 bg-[rgba(233,193,120,0.08)] border border-gold/20 rounded-xl p-3">
                <p className="text-sm text-mut">
                  En låda täcker{' '}
                  {coverageKcal != null && <span className="font-semibold text-ink tnum">{coverageKcal}%</span>}
                  {coverageKcal != null && ' av dagsmålet'}
                  {coverageKcal != null && coverageProtein != null && ' och '}
                  {coverageProtein != null && <span className="font-semibold text-ink tnum">{coverageProtein}%</span>}
                  {coverageProtein != null && ' av proteinmålet'}
                  .
                </p>
              </div>
            )}

            {/* Totalt för hela satsen */}
            <div className="mt-4 pt-4 border-t border-line grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[10px] text-faint uppercase tracking-wide">Totalt</p>
                <p className="font-display text-sm text-ink tnum">{fmt(macros.totalCooked.kcal)}</p>
                <p className="text-[10px] text-faint">kcal</p>
              </div>
              <div>
                <p className="text-[10px] text-faint uppercase tracking-wide">Protein</p>
                <p className="font-display text-sm text-cyan tnum">{fmt(macros.totalCooked.protein)}g</p>
              </div>
              <div>
                <p className="text-[10px] text-faint uppercase tracking-wide">Kolh</p>
                <p className="font-display text-sm text-lime tnum">{fmt(macros.totalCooked.carbs)}g</p>
              </div>
              <div>
                <p className="text-[10px] text-faint uppercase tracking-wide">Fett</p>
                <p className="font-display text-sm text-violet tnum">{fmt(macros.totalCooked.fat)}g</p>
              </div>
            </div>
          </div>
        )}

        {/* Gram per låda, per ingrediens */}
        <div className="vh-card p-5">
          <h3 className="font-display text-lg text-ink flex items-center gap-2 mb-1">
            <Scale size={18} className="text-gold" /> Så mycket i varje låda
          </h3>
          <p className="text-xs text-faint mb-3">
            Dela hela satsen ({recipe ? recipe.servings * batches : 0} portioner) jämnt i {portions} lådor — ingen våg behövs.
          </p>
          <div className="bg-card rounded-xl divide-y divide-line overflow-hidden border border-line">
            {perBoxIngredients.map((ing, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-ink capitalize">{ing.name}</span>
                <span className="text-sm font-semibold text-gold tnum">{fmt(ing.grams)} g</span>
              </div>
            ))}
            {perBoxIngredients.length === 0 && (
              <p className="text-faint text-center text-sm py-4">Inga ingredienser med mängd.</p>
            )}
          </div>
        </div>

        <p className="text-[11px] text-faint text-center">
          Utkast — kontrollera mängder innan du lagar och förvarar maten säkert.
        </p>
      </div>
    </div>
  );
}
