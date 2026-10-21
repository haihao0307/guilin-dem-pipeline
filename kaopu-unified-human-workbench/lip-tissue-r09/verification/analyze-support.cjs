#!/usr/bin/env node
'use strict';
// Read native data PNGs only. No render, geometry, material, or image edits.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { PNG } = require('pngjs');
const out = path.resolve(process.argv[2] || '');
assert(process.argv[2], 'Expected data evidence directory');
const anchorPath = path.resolve(__dirname, '../research/ROOT_CAUSE_PROBE_ANCHOR.json');
const anchor = JSON.parse(fs.readFileSync(anchorPath, 'utf8'));
const qa = JSON.parse(fs.readFileSync(path.join(out, 'qa.json'), 'utf8'));
assert.equal(qa.completed, true);
assert.equal(qa.gpuContext.attributes.alpha, true);
assert.equal(qa.gpuContext.alphaBits, 8);
assert.equal(qa.visualAcceptance, false);
assert.equal(qa.productionReady, false);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const specs = [
  { id: 'data-only-frozen-b-support', heightShaderMetres: 1e-9, normalDegrees: .01 },
  { id: 'data-only-frozen-b-larger-response', heightShaderMetres: 1e-6, normalDegrees: .1 }
];
const arrays = [];
const measurements = specs.map(spec => {
  const name = 'neutral-macro-' + spec.id;
  const bytes = fs.readFileSync(path.join(out, name + '.png'));
  const png = PNG.sync.read(bytes);
  assert.equal(png.width, 640); assert.equal(png.height, 512);
  const frame = qa.frames.find(x => x.name === name);
  assert(frame && frame.saved);
  assert.equal(sha(bytes), frame.pngSHA256);
  const raw = Buffer.alloc(png.data.length);
  for (let y = 0; y < png.height; y++) {
    png.data.copy(raw, (png.height - 1 - y) * png.width * 4,
      y * png.width * 4, (y + 1) * png.width * 4);
  }
  assert.equal(sha(raw), frame.sha256);
  arrays.push(png.data);
  const windows = {};
  for (const [key, rect] of Object.entries(anchor.preselectedWindowsTopLeftPixels)) {
    assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 640 && rect.y + rect.height <= 512);
    let marked = 0, native = 0, uncertain = 0, full = 0;
    let alphaMin = 255, alphaMax = 0, rSum = 0, gSum = 0, bSum = 0, fullR = 0, fullG = 0;
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const at = (y * 640 + x) * 4;
        const [r, g, b, a] = png.data.subarray(at, at + 4);
        alphaMin = Math.min(alphaMin, a); alphaMax = Math.max(alphaMax, a);
        if (a < 191 || a > 243) { if (a === 255) native++; else uncertain++; continue; }
        marked++; rSum += r; gSum += g; bSum += b;
        assert(r <= b + 1 && g <= b + 1, 'Threshold response exceeds ownership');
        if (b === 255) { full++; fullR += r; fullG += g; }
      }
    }
    assert(bSum > 0 && full > 0);
    windows[key] = {
      rect, pixels: rect.width * rect.height, markerPixels: marked,
      excludedNativePixels: native, excludedAmbiguousAlphaPixels: uncertain,
      alphaRange: [alphaMin, alphaMax], ownershipSumDN: bSum,
      weightedHeightThresholdResponse: rSum / bSum,
      weightedNormalThresholdResponse: gSum / bSum,
      fullOwnershipPixels: full,
      fullOwnershipHeightResponse: fullR / (255 * full),
      fullOwnershipNormalResponse: fullG / (255 * full)
    };
  }
  return { ...spec, name, pngSHA256: frame.pngSHA256, rawSHA256: frame.sha256, windows };
});
let ownershipEqual = true, markerEqual = true, heightReversals = 0, normalReversals = 0;
for (let at = 0; at < arrays[0].length; at += 4) {
  ownershipEqual &&= arrays[0][at + 2] === arrays[1][at + 2];
  markerEqual &&= arrays[0][at + 3] === arrays[1][at + 3];
  if (arrays[1][at] > arrays[0][at]) heightReversals++;
  if (arrays[1][at + 1] > arrays[0][at + 1]) normalReversals++;
}
assert(ownershipEqual && markerEqual);
assert.equal(heightReversals, 0); assert.equal(normalReversals, 0);
const report = {
  schema: 'kaopu/lip-r09-support-analysis@1', generatedAt: new Date().toISOString(),
  scope: 'Frozen B data only; no new appearance candidate',
  qaSHA256: sha(fs.readFileSync(path.join(out, 'qa.json'))),
  anchorSHA256: sha(fs.readFileSync(anchorPath)), gpuContext: qa.gpuContext,
  measure: 'sum(indicator * ownership), resolved by MSAA and quantized to 8 bits, divided by sum(ownership).',
  measurements,
  consistency: { ownershipEqual, markerEqual, heightReversals, normalReversals },
  limitations: [
    'Not a geometric area fraction, a biological measurement, or a perceptual visibility threshold.',
    'Alpha marker alone cannot rule out mixed procedural/native MSAA samples at material boundaries.',
    '8-bit quantization limits precision. Full-ownership interior is a sensitivity check, not ground-truth anatomy.',
    'The fixed view cannot establish temporal stability, multi-view acceptance, or the unique cause of wax appearance.',
    'No amplitude, shape, material, or ownership parameter was varied by this readout.'
  ],
  visualAcceptance: false, productionReady: false, publicHttpsPassed: false
};
fs.writeFileSync(path.join(out, 'support-analysis.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ completed: true, path: path.join(out, 'support-analysis.json'), measurements }));
