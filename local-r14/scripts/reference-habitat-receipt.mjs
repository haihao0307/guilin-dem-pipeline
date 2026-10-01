// Freeze receipt only; never mutates the production environment module.
import fs from 'node:fs';
import crypto from 'node:crypto';
const base = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, base));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const moduleBytes = read('src/environment.js');
const code = moduleBytes.toString('utf8');
const comparisonBytes = read('evidence/reference/HABITAT_COMPARISON.json');
const probeBytes = read('evidence/reference/HABITAT_PROBE_REPORT.json');
const comparison = JSON.parse(comparisonBytes), probe = JSON.parse(probeBytes);
const arrays = ['posHash', 'normalHash', 'indexHash', 'instanceMatrix'];
const geometryMatches = comparison.original.geometry.map((g, i) => ({
  object: i, originalName: g.name,
  allArrayHashesMatch: arrays.every(k => JSON.stringify(g[k]) === JSON.stringify(comparison.candidate.geometry[i][k]))
}));
const excluded = ['fish-school-settings-v1', 'function GU(', 'function aI(', 'function oI(', 'function lI(', 'function uI(', 'function vI('];
const receipt = {
  task: 'FISH_R14_DENSE_REFERENCE_HABITAT_UI_20261001',
  frozenAt: new Date().toISOString(),
  module: { path: 'local-r14/src/environment.js', bytes: moduleBytes.length, sha256: hash(moduleBytes) },
  reference: { url: 'https://threejs-fish.vercel.app/', repository: 'https://github.com/imokya/threejs-fish', commit: '971b500f467e8fddfb9ec54b9a143b2a8b09e7fc', bundleSha256: comparison.sourceBundleSha256, applicationLicense: 'UNKNOWN', applicationSourceShipped: false },
  productionComposition: { runtime: 'MIT Three.js 0.186.1', officialBloomNode: 'https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/BloomNode.js', fullMitNotice: code.startsWith('/* MIT License'), independentImplementation: 'local-r14/scripts/reference-habitat-owned-implementation.txt', originalApplicationMarkersAbsent: excluded.every(v => !code.includes(v)), excludedApplication: ['original fish', 'boids', 'panel', 'events', 'cinematic camera', 'application initialization'] },
  scene: { physicalScale: .1, floor: { width: 1000, depth: 1000, segments: [400,400], vertices: 160801, indices: 960000, referenceBaseY: -22 }, rocks: { seed: 7, count: 26, icoDetail: 4 }, kelp: { seed: 42, clusters: 14, count: 220, segments: [1,24] }, surface: { width: 1400, depth: 1400, referenceY: 26, waveGroups: 7 }, snow: { count: 7000, referenceBox: 60 }, bubbles: { seed: 99, sources: 8, batches: 6, batchParticles: 9, count: 432 }, backdrop: { radius: 900, segments: [48,24] }, reflection: { radius: 50, segments: [64,32], pmremBlur: .04, intensity: 1.25 } },
  optics: { density: 1, viewExtinction: [.048,.017,.012], sunExtinction: [.04,.014,.01], sunElevationDegrees: 55, sunBaseIntensity: 5, hemisphereIntensity: .35, shadow: { size: [2048,2048], near: 1, far: 160, bias: -.0004, normalBias: .03, intensity: .35 }, volume: { steps: 26, referenceMaxDistance: 120, hgG: .5, resolutionScale: .5 }, bloom: { mipCount: 5, kernels: [6,10,14,18,22], strength: .5, radius: .85, threshold: .95 }, exposure: .9, toneMapping: 'ACES', sourceRelationsReimplemented: true },
  validation: { comparisonAt: comparison.observedAt, comparisonSha256: hash(comparisonBytes), geometryObjects: geometryMatches.length, geometryMatches, allGeometryArraysMatch: geometryMatches.every(v => v.allArrayHashesMatch), bubbleOriginsMatch: JSON.stringify(comparison.original.bubbles) === JSON.stringify(comparison.candidate.bubbles), backendOriginal: comparison.original.backend, backendCandidate: comparison.candidate.backend, fixture: { sourceEye: [0,15,80], sourceTarget: [0,1.4,0], time: 4, fieldOfView: 62, referenceFishHiddenOnlyForQA: true }, probeSha256: hash(probeBytes), renderedFrames: probe.stats.renderedFrames, shaderCount: probe.shaderCount, glErrors: probe.glErrors, passes: probe.passes, errors: [...comparison.errors,...probe.errors], screenshots: ['reference-fixed-no-fish.png','candidate-fixed-no-fish.png','habitat-probe.png'], screenshotsInspected: true, visualPixelEqualityClaim: false },
  acceptance: { producerProbePassed: geometryMatches.every(v => v.allArrayHashesMatch) && probe.glErrors.every(v => v === 0) && !comparison.errors.length && !probe.errors.length, independentAssemblyApproval: false, visualAcceptance: false, motionAcceptance: false, productionReady: false }
};
fs.writeFileSync(new URL('evidence/reference/HABITAT_RECONSTRUCTION_RECEIPT.json', base), JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({module: receipt.module, geometry: receipt.validation.allGeometryArraysMatch, bubbles: receipt.validation.bubbleOriginsMatch, originalApplicationExcluded: receipt.productionComposition.originalApplicationMarkersAbsent, producerPassed: receipt.acceptance.producerProbePassed}));
