#!/usr/bin/env node
// Generate PWA icons from a single source PNG using sharp
// Usage: node scripts/generate-icons.mjs [sourcePath]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  const src = process.argv[2] || path.join(process.cwd(), 'public', 'apple-touch-icon.png');
  const absSrc = path.isAbsolute(src) ? src : path.join(process.cwd(), src);
  const exists = await fileExists(absSrc);
  if (!exists) {
    console.error(`Source icon not found: ${absSrc}`);
    console.error('Provide a square PNG (preferably >=512x512). Example:');
    console.error('  node scripts/generate-icons.mjs public/apple-touch-icon.png');
    process.exit(1);
  }

  const outputs = [
    { out: path.join(process.cwd(), 'public', 'icon-192.png'), size: 192 },
    { out: path.join(process.cwd(), 'public', 'icon-512.png'), size: 512 },
    { out: path.join(process.cwd(), 'public', 'apple-touch-icon.png'), size: 180 },
  ];

  for (const { out, size } of outputs) {
    await ensureDir(out);
    await sharp(absSrc)
      .resize(size, size, { fit: 'cover' })
      .png({ quality: 90 })
      .toFile(out);
    console.log(`Wrote ${out} (${size}x${size})`);
  }

  console.log('Done. Verify icons in DevTools → Application → Manifest.');
}

main().catch((e) => { console.error(e); process.exit(1); });
