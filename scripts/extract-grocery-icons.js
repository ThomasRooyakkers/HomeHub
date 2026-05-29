#!/usr/bin/env node
/**
 * Extracts individual icons from the grocery sprite sheet.
 *
 * Usage:
 *   node scripts/extract-grocery-icons.js <path-to-sprite.png>
 *
 * Output: frontend/public/images/grocery/*.png
 *
 * The sprite is a 6-column × 7-row grid. Adjust COLS, ROWS, and
 * PADDING_FRAC below if the extracted icons look misaligned.
 */

const path = require("path");
const fs   = require("fs");

// ── Grid configuration ──────────────────────────────────────────────────────
// Layout order (row-major, left→right, top→bottom):
const ICON_NAMES = [
  // Row 1 – fruits
  "apple", "banana", "strawberry", "green_grapes", "purple_grapes", "watermelon",
  // Row 2 – vegetables
  "carrot", "tomato", "broccoli", "potato", "baguette", "corn",
  // Row 3 – dairy / bakery
  "bread", "croissant", "milk", "cheese", "egg", "beer_mug",
  // Row 4 – beverages
  "water_bottle", "cola", "coffee", "wine", "beer_foam", "can_red",
  // Row 5 – meat / fish
  "steak", "chicken_leg", "fish", "bacon", "can_chips", "can_tuna",
  // Row 6 – pantry
  "can_beans", "jar_honey", "oil_bottle", "salt_pepper", "spices", "chips_bag",
  // Row 7 – household
  "shopping_cart", "grocery_bag", "toilet_paper", "cleaning", "soap", "checklist",
];

const COLS = 6;
const ROWS = 7;

// Fraction of a cell to trim on each side (0 = no trim, 0.05 = trim 5%).
// Increase if you see grid-line bleed; decrease if icons are getting cropped.
const PADDING_FRAC = 0.04;

// ── Paths ───────────────────────────────────────────────────────────────────
const spriteArg = process.argv[2];
if (!spriteArg) {
  console.error("Usage: node scripts/extract-grocery-icons.js <path-to-sprite.png>");
  process.exit(1);
}

const spritePath = path.resolve(spriteArg);
if (!fs.existsSync(spritePath)) {
  console.error(`File not found: ${spritePath}`);
  process.exit(1);
}

const outDir = path.resolve(__dirname, "../frontend/public/images/grocery");
fs.mkdirSync(outDir, { recursive: true });

// ── Jimp (installed in /tmp/icon-extract) ───────────────────────────────────
let Jimp;
try {
  Jimp = require("jimp");
} catch {
  // Try local /tmp install
  try {
    Jimp = require("/tmp/icon-extract/node_modules/jimp");
  } catch {
    console.error(
      "jimp not found. Run:\n" +
      "  cd /tmp/icon-extract && npm install jimp\n" +
      "then re-run this script."
    );
    process.exit(1);
  }
}

// ── Extract ──────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Loading sprite: ${spritePath}`);
  const sprite = await Jimp.read(spritePath);

  const imgW = sprite.bitmap.width;
  const imgH = sprite.bitmap.height;
  const cellW = imgW / COLS;
  const cellH = imgH / ROWS;
  const padX  = Math.round(cellW * PADDING_FRAC);
  const padY  = Math.round(cellH * PADDING_FRAC);
  const cropW = Math.round(cellW - padX * 2);
  const cropH = Math.round(cellH - padY * 2);

  console.log(`Image: ${imgW}×${imgH} → cell: ${cellW.toFixed(1)}×${cellH.toFixed(1)}, crop: ${cropW}×${cropH}`);
  console.log(`Output dir: ${outDir}\n`);

  let count = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx  = row * COLS + col;
      const name = ICON_NAMES[idx];
      if (!name) continue;

      const x = Math.round(col * cellW) + padX;
      const y = Math.round(row * cellH) + padY;

      const icon = sprite.clone().crop(x, y, cropW, cropH);
      const dest = path.join(outDir, `${name}.png`);
      await icon.writeAsync(dest);
      console.log(`  ✓ ${name}.png`);
      count++;
    }
  }

  console.log(`\nDone — ${count} icons written to ${outDir}`);
  console.log("\nIf any icons look off, adjust PADDING_FRAC in this script and re-run.");
})().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
