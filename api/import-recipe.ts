import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SchemaRecipe {
  name?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<{ text?: string } | string>;
  recipeYield?: string | number | string[];
  image?: string | { url?: string } | Array<{ url?: string } | string>;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  keywords?: string | string[];
  url?: string;
}

function extractJson(html: string): SchemaRecipe | null {
  // Find all application/ld+json blocks
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      // Handle both single object and @graph array
      const candidates: any[] = Array.isArray(parsed)
        ? parsed
        : parsed['@graph']
          ? parsed['@graph']
          : [parsed];

      for (const obj of candidates) {
        if (obj['@type'] === 'Recipe' || obj['@type']?.includes?.('Recipe')) {
          return obj as SchemaRecipe;
        }
      }
    } catch {
      // Not valid JSON, skip
    }
  }
  return null;
}

function parseYield(raw?: string | number | string[]): number {
  if (!raw) return 4;
  const s = Array.isArray(raw) ? raw[0] : String(raw);
  const n = parseInt(s, 10);
  return isNaN(n) ? 4 : n;
}

function parseImage(image?: SchemaRecipe['image']): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === 'string') return first;
    return first?.url;
  }
  return (image as { url?: string }).url;
}

function parseInstructions(raw?: SchemaRecipe['recipeInstructions']): string[] {
  if (!raw) return [];
  return raw.map(step =>
    typeof step === 'string' ? step : step.text ?? '',
  ).filter(Boolean);
}

function parseTags(raw?: string | string[]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.flatMap(k => k.split(',').map(s => s.trim())).filter(Boolean);
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url in request body' });
  }

  let html: string;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VardagshubBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (err: any) {
    return res.status(502).json({ error: `Could not fetch URL: ${err.message}` });
  }

  const schema = extractJson(html);
  if (!schema) {
    return res.status(422).json({ error: 'No Recipe schema.org data found on this page' });
  }

  return res.status(200).json({
    name: schema.name ?? 'Importerat recept',
    servings: parseYield(schema.recipeYield),
    ingredients: schema.recipeIngredient ?? [],
    instructions: parseInstructions(schema.recipeInstructions),
    imageUrl: parseImage(schema.image),
    tags: parseTags(schema.keywords),
    source: url,
  });
}
