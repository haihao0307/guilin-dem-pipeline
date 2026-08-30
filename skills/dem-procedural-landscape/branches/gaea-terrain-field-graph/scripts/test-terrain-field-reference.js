'use strict';

const assert = require('node:assert/strict');
const terrain = require('./terrain-field-reference.js');

const checks = [];
const record = (name, fn) => {
  fn();
  checks.push(name);
};

record('seed-bank-deterministic', () => {
  assert.deepEqual(terrain.deriveSeeds(20260830), terrain.deriveSeeds(20260830));
});

const seeds = terrain.deriveSeeds(20260830);
const worldX = 482345.25;
const worldY = 2765432.75;

record('field-evaluation-deterministic', () => {
  assert.deepEqual(
    terrain.evaluateVisualFields(worldX, worldY, seeds),
    terrain.evaluateVisualFields(worldX, worldY, seeds)
  );
});

record('world-coordinate-tile-continuity', () => {
  const tileOriginX = 480000;
  const tileOriginY = 2760000;
  const localX = worldX - tileOriginX;
  const localY = worldY - tileOriginY;
  assert.deepEqual(
    terrain.evaluateVisualFields(worldX, worldY, seeds),
    terrain.evaluateVisualFields(tileOriginX + localX, tileOriginY + localY, seeds)
  );
});

record('visual-seed-isolation', () => {
  const changedColorSeed = { ...seeds, color: seeds.color + 1 };
  assert.deepEqual(
    terrain.evaluateVisualFields(worldX, worldY, seeds),
    terrain.evaluateVisualFields(worldX, worldY, changedColorSeed)
  );
});

record('field-ranges', () => {
  const fields = terrain.evaluateVisualFields(worldX, worldY, seeds);
  for (const [name, value] of Object.entries(fields)) {
    assert.ok(Number.isFinite(value), `${name} must be finite`);
    assert.ok(value >= 0 && value <= 1, `${name} must stay in [0, 1]`);
  }
});

record('bounded-height-and-protected-mask', () => {
  assert.equal(terrain.boundedRenderHeight(100, 50, 1, 1, 5, 10), 100);
  assert.equal(terrain.boundedRenderHeight(100, 50, 1, 0, 5, 10), 110);
  assert.equal(terrain.boundedRenderHeight(100, -50, 1, 0, 5, 10), 95);
});

record('normalized-splat', () => {
  const weights = terrain.normalizedSplat([0.2, 0.4, 0.8, 0.1]);
  const sum = weights.reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  assert.ok(weights.every((value) => value >= 0 && value <= 1));
});

record('structural-color-range', () => {
  const fields = terrain.evaluateVisualFields(worldX, worldY, seeds);
  const color = terrain.shadeTerrainColor(fields, {
    rock: [0.42, 0.44, 0.40],
    wet: [0.16, 0.24, 0.22],
    soil: [0.38, 0.31, 0.20],
    exposed: [0.68, 0.62, 0.48],
    sharpness: 2.5
  });
  assert.equal(color.length, 3);
  assert.ok(color.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
});

process.stdout.write(`${JSON.stringify({ status: 'passed', checks }, null, 2)}\n`);
