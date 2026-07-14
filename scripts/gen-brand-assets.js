// One-off: rasterize the editable SVG brand sources into the PNGs the <head> needs.
// The SVGs (src/assets/favicon.svg, src/assets/og-default.svg) are the source of truth;
// re-run this after editing them. Needs sharp, which is NOT a project dependency:
//   npm install --no-save sharp   &&   node scripts/gen-brand-assets.js
// Rendered at 2x density then downscaled for crisp text/edges.
const sharp = require('sharp');
const path = require('path');

const A = (p) => path.join(__dirname, '..', 'src', 'assets', p);

async function run() {
  // Default social-share card
  await sharp(A('og-default.svg'), { density: 144 })
    .resize(1200, 630)
    .png()
    .toFile(A('images/og-default.png'));

  // Favicon rasters (from the monogram SVG)
  await sharp(A('favicon.svg'), { density: 384 }).resize(180, 180).png().toFile(A('apple-touch-icon.png'));
  await sharp(A('favicon.svg'), { density: 384 }).resize(32, 32).png().toFile(A('favicon-32.png'));

  console.log('Wrote og-default.png, apple-touch-icon.png, favicon-32.png');
}

run().catch((e) => { console.error(e); process.exit(1); });
