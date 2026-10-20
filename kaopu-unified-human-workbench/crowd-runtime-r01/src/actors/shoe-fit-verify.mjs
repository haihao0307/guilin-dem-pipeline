/** Run with the artifact's test-loader. CPU geometry/coordinates only: the
 * retained MP05 native 104-bone fixture is not the current browser P01 person. */
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeMotion} from '../../vendor/f13/vendor/fiber/NativeMotion.mjs';
import {buildStyle, STYLES} from '../../vendor/shoe-workshop/r14/src/model.mjs';
import {createNativeShoeFactory, measureNativeFeet} from './NativeShoeBinding.mjs';
import {nativeFootSamples, shoeCoordinates, createCanvasInnerSurface, checkNativeShoeSections} from './NativeShoeFit.mjs';

globalThis.window = {};
const fixtureBytes = await readFile(new URL('../cloth/upstream/assets/native-person.json.gz', import.meta.url));
const fixture = JSON.parse(gunzipSync(fixtureBytes));
const model = {...fixture, positions: Float32Array.from(fixture.positions), faces: Uint32Array.from(fixture.faces),
  lastBodyDriver: {rig: fixture.rig, packet: {weights: fixture.rig.weights, restPositionsPerInfluence: fixture.rig.restPositionsPerInfluence}}};
const geometry = new THREE.BufferGeometry(), display = new Float32Array(model.positions.length);
for (let i = 0; i < display.length; i += 3) display.set([model.positions[i], model.positions[i + 2], -model.positions[i + 1]], i);
geometry.setAttribute('position', new THREE.BufferAttribute(display, 3)); geometry.setIndex(new THREE.BufferAttribute(model.faces, 1));
const material = new THREE.MeshStandardMaterial(), renderer = {getContext() {throw Error('No GPU is used in the shoe fit test');}};
const mesh = new THREE.Mesh(geometry, material), scene = new THREE.Scene(), worldRoot = new THREE.Group();
worldRoot.position.set(1.2, 0, -.7); worldRoot.rotation.y = .43; scene.add(worldRoot); worldRoot.add(mesh);
mesh.position.y = -Math.min(...Array.from(model.positions).filter((_, i) => i % 3 === 2));
worldRoot.updateWorldMatrix(true, true);
const viewer = {mesh, geometry, scene, renderer, skin: {material}, surfaces: new Map([['control', {geometry, levels: []}]]),
  currentOcular: {source: geometry, geometry, pairs: []}};
const motion = new NativeMotion(model, viewer); await motion.prepare();
const actor = {id: 'shoe-fit-control-fixture', model, mesh, motion, worldRoot, baseMeshMatrix: mesh.matrix.clone(), frameSequence: 0};
const measurements = measureNativeFeet(THREE, model, motion.native), style = STYLES.find(s => s.id === 'canvas');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bufferHash = geometries => sha(Buffer.concat(geometries.flatMap(g => [...Object.values(g.attributes), g.index])
  .map(a => Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength))));
const bodyBefore = bufferHash([geometry]);

// Reproduce the defective total-length/width rule, with the actual old recipe
// and actual inner triangles. No hypothetical mesh replaces either model.
const oldModel = buildStyle('canvas', {length: (measurements.L.lengthM * 1000 + 12) / style.length,
  width: (measurements.L.widthM * 1000 + 6) / style.width, instep: 0, thickness: 1.35, bend: 0});
const oldInner = createCanvasInnerSurface(oldModel);
const beforeFit = Object.fromEntries(['L', 'R'].map(side => {
  const foot = measurements[side], mirror = side === 'R' ? -1 : 1;
  const fit = {sx: 1, sy: 1, sz: 1, angleDegrees: 0, cx: mirror * (foot.bounds.xMin + foot.bounds.xMax) * 500,
    cz: (foot.bounds.zMin + foot.bounds.zMax) * 500 + 3, cy: -oldModel.last.soleTop(.5)};
  return [side, checkNativeShoeSections(oldModel.last, oldInner, nativeFootSamples(THREE, model, foot), fit)];
}));
assert.ok(beforeFit.L.forefoot.aboveInnerUpper + beforeFit.L.forefoot.missingClosedUpper > 0);
for (const part of oldModel.parts) part.geometry.dispose();

const factory = await createNativeShoeFactory({THREE, renderer, buildStyle, styles: STYLES,
  nativeMaterials: {get() {return material;}}});
const shoes = factory.bind(actor), geometries = shoes.items[0].shoe.children.map(m => m.geometry), shoeBefore = bufferHash(geometries);
const staticReport = shoes.report();
for (const foot of staticReport.feet) {
  assert.equal(foot.sampledRestSections.all.passed, true);
  assert.equal(foot.sampledRestSections.forefoot.passed, true);
  assert.equal(foot.sampledRestSections.toes.passed, true);
}
let maximumCoordinateErrorMm = 0;
const actions = [];
for (const mode of ['walk', 'run', 'jump']) {
  await motion.select(mode);
  const frames = [], aggregate = {maximumForefootUpperProtrusionMm: 0, maximumToeUpperProtrusionMm: 0,
    maximumForefootInsolePenetrationMm: 0, failedForefootFrames: 0, failedToeFrames: 0, maximumForefootRelativeDeformationMm: 0};
  for (let step = 0; step <= 24; step++) {
    const time = motion.clip.duration * step / 24; motion.apply(time); shoes.update(++actor.frameSequence);
    const feetReport = shoes.report().feet;
    for (const foot of feetReport) {
      const front = foot.sampledCurrentPoseSections.forefoot, toes = foot.sampledCurrentPoseSections.toes;
      aggregate.maximumForefootUpperProtrusionMm = Math.max(aggregate.maximumForefootUpperProtrusionMm, front.maxUpperProtrusionMm);
      aggregate.maximumToeUpperProtrusionMm = Math.max(aggregate.maximumToeUpperProtrusionMm, toes.maxUpperProtrusionMm);
      aggregate.maximumForefootInsolePenetrationMm = Math.max(aggregate.maximumForefootInsolePenetrationMm, front.maxInsolePenetrationMm);
      if (!front.passed) aggregate.failedForefootFrames++; if (!toes.passed) aggregate.failedToeFrames++;
      assert.equal(front.passed, true, mode + ' ' + foot.side + ' forefoot at ' + time);
      assert.equal(toes.passed, true, mode + ' ' + foot.side + ' toes at ' + time);
    }
    for (const item of shoes.items) {
      const source = nativeFootSamples(THREE, model, item.foot), posed = nativeFootSamples(THREE, model, item.foot, motion.native, motion.skinMatrix(item.foot.footName));
      const inverseShoeWorld = item.shoe.matrixWorld.clone().invert();
      for (let i = 0; i < posed.length; i++) {
        if (source[i].forefoot) aggregate.maximumForefootRelativeDeformationMm = Math.max(aggregate.maximumForefootRelativeDeformationMm,
          Math.hypot(posed[i].x - source[i].x, posed[i].y - source[i].y, posed[i].z - source[i].z));
        // The independent actual Object3D inverse must agree with the fitter,
        // including right-foot reflection, actor yaw, scale and ground lift.
        const nativePoint = motion.native.sampleVertex(posed[i].id);
        const actual = new THREE.Vector3(nativePoint[0], nativePoint[2], -nativePoint[1]).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseShoeWorld);
        const expected = shoeCoordinates(posed[i], item.fit);
        maximumCoordinateErrorMm = Math.max(maximumCoordinateErrorMm, actual.distanceTo(new THREE.Vector3(...expected)));
      }
    }
    frames.push({timeSeconds: time, feet: feetReport.map(f => ({side: f.side,
      forefoot: f.sampledCurrentPoseSections.forefoot, toes: f.sampledCurrentPoseSections.toes,
      allFoot: f.sampledCurrentPoseSections.all}))});
  }
  actions.push({mode, durationSeconds: motion.clip.duration, nativeSourceClip: motion.clip.metrics.sourceClip,
    sampledPhases: 25, footSamples: 50, ...aggregate, frames});
}
assert.ok(maximumCoordinateErrorMm < 1e-6, 'fit diagnostics must use the actual rendered placement');
assert.equal(bufferHash([geometry]), bodyBefore); assert.equal(bufferHash(geometries), shoeBefore);
const result = {schema: 'original-r14-canvas-wearer-section-check/1', measuredAtUTC: new Date().toISOString(),
  fixture: {compressedSHA256: sha(fixtureBytes), name: 'retained MP05 full-CSR 104-bone control person', currentBrowserP01: false},
  scope: 'CPU geometric point and original inner-triangle section checks; no GPU, no FPS, no complete surface/comfort certification',
  beforeFit, fittedRest: staticReport, actions, maximumCoordinateErrorMm,
  bodyGeometrySHA256Before: bodyBefore, bodyGeometrySHA256After: bufferHash([geometry]),
  nativeShoeGeometrySHA256Before: shoeBefore, nativeShoeGeometrySHA256After: bufferHash(geometries),
  preserved: {originalPartsPerShoe: geometries.length, fullCSR: true, footVisible: true, originalMotionUntouched: true,
    geometryBuffersUntouched: true, actionCacheAdded: false, completeShoeScaleExplicit: true},
  limitations: ['Current browser P01 recalculates its own fit; this fixture cannot certify that person.',
    'The original NativeMotion already owns its captured-clip preparation; this test only samples that original API.',
    'Toe and forefoot sections are checked at 25 phases per mode. Skin triangles between control samples and unsampled time are not certified.',
    'This is a rigid shoe. Rear ankle skin can move relative to the foot bone; all-foot boundary results are retained separately.']};
await writeFile(new URL('./shoe-fit-verification.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
factory.dispose(); motion.dispose();
console.log(JSON.stringify({passed: true, phaseSamples: 75, perFootSnapshots: 150, maximumCoordinateErrorMm,
  actions: actions.map(({frames, ...a}) => a), fitScale: staticReport.feet[0].fitScale, renderedShoeBoundsM: staticReport.feet[0].renderedShoeBoundsM}));
