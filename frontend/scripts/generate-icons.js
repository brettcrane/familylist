/**
 * Generate PWA icons from SVG
 *
 * Run with: node scripts/generate-icons.js
 *
 * Requires: npm install sharp (already a vite dep via vite-plugin-pwa)
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const sizes = [192, 512];
const outputDir = path.join(process.cwd(), 'public', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Simple icon design - green background with list/check icon
function drawIcon(ctx, size) {
  const padding = size * 0.15;
  const cornerRadius = size * 0.15;

  // Background
  ctx.fillStyle = '#7CB067';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, cornerRadius);
  ctx.fill();

  // List lines
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.06;
  ctx.lineCap = 'round';

  const lineStartX = padding;
  const lineEndX = size - padding;
  const lineSpacing = size * 0.18;
  const startY = size * 0.3;

  // Line 1
  ctx.beginPath();
  ctx.moveTo(lineStartX, startY);
  ctx.lineTo(lineEndX, startY);
  ctx.stroke();

  // Line 2
  ctx.beginPath();
  ctx.moveTo(lineStartX, startY + lineSpacing);
  ctx.lineTo(lineEndX * 0.7, startY + lineSpacing);
  ctx.stroke();

  // Line 3
  ctx.beginPath();
  ctx.moveTo(lineStartX, startY + lineSpacing * 2);
  ctx.lineTo(lineEndX * 0.8, startY + lineSpacing * 2);
  ctx.stroke();

  // Checkmark circle
  const checkX = size * 0.75;
  const checkY = size * 0.7;
  const checkRadius = size * 0.12;

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(checkX, checkY, checkRadius, 0, Math.PI * 2);
  ctx.fill();

  // Checkmark
  ctx.strokeStyle = '#7CB067';
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.moveTo(checkX - checkRadius * 0.4, checkY);
  ctx.lineTo(checkX - checkRadius * 0.1, checkY + checkRadius * 0.35);
  ctx.lineTo(checkX + checkRadius * 0.5, checkY - checkRadius * 0.35);
  ctx.stroke();
}

// Generate icons
console.log('Generating PWA icons...');

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  drawIcon(ctx, size);

  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(outputDir, `icon-${size}.png`);

  fs.writeFileSync(filename, buffer);
  console.log(`  Created: ${filename}`);
}

console.log('Done!');
