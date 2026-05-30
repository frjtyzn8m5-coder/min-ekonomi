import type { VercelRequest, VercelResponse } from '@vercel/node';
// Use the inner module directly to avoid pdf-parse's test-file loading
// which crashes in Vercel's serverless environment.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export const config = { api: { bodyParser: false } };

async function readBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);
    const data = await pdfParse(body);
    return res.status(200).json({ text: data.text });
  } catch (err: any) {
    console.error('parse-receipt error:', err);
    return res.status(500).json({ error: err.message ?? 'PDF parse failed' });
  }
}
