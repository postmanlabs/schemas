#!/usr/bin/env node
/**
 * Generates favicon assets from the Postman logo SVG so the app has a proper
 * icon in browser tabs / bookmarks:
 *
 *   public/favicon.ico          (multi-size: 16/32/48, for legacy browsers)
 *   public/favicon-16x16.png
 *   public/favicon-32x32.png
 *   public/apple-touch-icon.png (180x180, iOS home screen)
 *
 * The SVG itself is still referenced directly as a modern `image/svg+xml` icon;
 * these rasterized assets are the fallbacks. Outputs are git-ignored and
 * regenerated as part of `pnpm generate` (predev/prebuild).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC_SVG = path.join(ROOT, 'public', 'assets', 'postman-logo-orange.svg');
const PUBLIC_DIR = path.join(ROOT, 'public');

// A high density rasterizes the vector crisply before downscaling to icon sizes.
const DENSITY = 384;
const ICO_SIZES = [16, 32, 48];

/** @param {number} size */
async function renderPng(size) {
  return sharp(SRC_SVG, { density: DENSITY })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SRC_SVG)) {
    throw new Error(`Source SVG not found: ${path.relative(ROOT, SRC_SVG)}`);
  }

  const [png16, png32, png48, png180] = await Promise.all([
    renderPng(16),
    renderPng(32),
    renderPng(48),
    renderPng(180),
  ]);

  const ico = await pngToIco([png16, png32, png48]);

  const outputs = /** @type {const} */ ([
    ['favicon.ico', ico],
    ['favicon-16x16.png', png16],
    ['favicon-32x32.png', png32],
    ['apple-touch-icon.png', png180],
  ]);

  for (const [name, buffer] of outputs) {
    fs.writeFileSync(path.join(PUBLIC_DIR, name), buffer);
  }

  console.info(
    'Generated %s',
    outputs.map(([name]) => `public/${name}`).join(', '),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
