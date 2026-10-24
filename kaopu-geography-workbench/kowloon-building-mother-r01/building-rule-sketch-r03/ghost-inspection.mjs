/** Display-only, two-scene-pass x-ray overlay for the independent R02 sketch.
 * The authoritative model/graph/physics never change. This is not refraction.
 */
import {packAssemblyDescriptors} from './kowloon-building-mother-r01/r07/assemblies.mjs';
import {primaryPackedBounds} from './kowloon-building-mother-r01/whole-building-floor-study-r01/primary-tile-index.mjs';
import {nativeDisplaySize} from './desktop-display.mjs';

const cache = new WeakMap();
const running = new WeakSet();
const COMPOSITE = `#version 300 es
precision highp float;precision highp int;
uniform sampler2D uFullScene,uInteriorScene;
uniform float uEnvelopeOpacity;
out vec4 outColor;
void main(){
 ivec2 p=ivec2(gl_FragCoord.xy);
 vec4 full=texelFetch(uFullScene,p,0),inside=texelFetch(uInteriorScene,p,0);
 // Both images contain exact analytic first hits and their existing edge cues.
 // Identical visible interior pixels stay opaque; obscured interiors become visible.
 outColor=vec4(mix(inside.rgb,full.rgb,uEnvelopeOpacity),1.);
}`;

function settings(options = {}) {
  const {ghostWalls = true, ghostRoof = true, ghostLiftShell = true,
    ghostNodeIds = [], opaqueNodeIds = []} = options;
  if ([ghostWalls, ghostRoof, ghostLiftShell].some(v => typeof v !== 'boolean') ||
      !Array.isArray(ghostNodeIds) || !Array.isArray(opaqueNodeIds) ||
      [...ghostNodeIds, ...opaqueNodeIds].some(id => typeof id !== 'string')) throw Error('Explicit inspection display settings required');
  return {ghostWalls, ghostRoof, ghostLiftShell, ghostNodeIds, opaqueNodeIds};
}

/** R02 teaching IDs/explicit display tags, not a guessed building classification. */
export function isGhostInspectionPrimitive(primitive, node, options = {}) {
  const o = settings(options), id = primitive.nodeId ?? node?.id ?? '';
  if (o.opaqueNodeIds.includes(id) || node?.inspectionDisplay === 'opaque' || primitive.inspectionDisplay === 'opaque') return false;
  if (o.ghostNodeIds.includes(id) || node?.inspectionDisplay === 'ghost' || primitive.inspectionDisplay === 'ghost') return true;
  if (o.ghostRoof && primitive.semanticClass === 'roof') return true;
  if (o.ghostWalls && primitive.semanticClass === 'wall' &&
      (node?.exterior === true || primitive.exterior === true || /:wall:(rear|right)$/.test(id))) return true;
  return o.ghostLiftShell && primitive.semanticClass === 'elevator' &&
    /:(shaft:(back|outer)|cabin:(back|side|ceiling))$/.test(id);
}

/** Pure display derivation. Primitive IDs, references, coordinates and bounds stay
 * unchanged. Empty display batches disappear; no replacement geometry is made.
 */
export function deriveGhostInspectionDisplay(model, options = {}) {
  if (!model || !Array.isArray(model.archetypes) || !Array.isArray(model.graph?.nodes)) throw Error('Sketch model required');
  const o = settings(options), nodes = new Map(model.graph.nodes.map(n => [n.id, n]));
  const archetypes = [], ghostIds = [], retainedIds = [];
  for (const archetype of model.archetypes) {
    const original = archetype.spec ?? archetype;
    const primitives = original.primitives.filter(p => {
      if (isGhostInspectionPrimitive(p, nodes.get(p.nodeId), o)) { ghostIds.push(p.nodeId); return false; }
      retainedIds.push(p.nodeId); return true;
    });
    if (!primitives.length) continue;
    archetypes.push({id: archetype.id, spec: {...original, primitives,
      counts: {...original.counts, primitives: primitives.length}}});
  }
  return {archetypes, ghostIds, retainedIds, options: o,
    displayOnly: true, sourceGeometryChanged: false, graphPreserved: true,
    physicsUsesOriginalModel: true, newGeometry: false};
}

function prepare(renderer, model, options) {
  const o = settings(options), key = JSON.stringify(o);
  let state = cache.get(renderer);
  if (state?.model === model && state.modelGeneration === renderer.modelGeneration && state.key === key) return state;
  if (state && state.modelGeneration === renderer.modelGeneration) releaseStateTextures(renderer, state);
  const display = deriveGhostInspectionDisplay(model, o);
  const textures = [];
  const archetypes = display.archetypes.map(({id, spec}) => {
    const packed = packAssemblyDescriptors(spec), texture = renderer.texture(packed);
    textures.push(texture);
    const core = spec.primitives.filter(p => !p.nodeId.includes('-partition'));
    const coreTexture = core.length && core.length !== spec.primitives.length ? renderer.texture(packAssemblyDescriptors({...spec, primitives: core})) : texture;
    if (coreTexture !== texture) textures.push(coreTexture);
    return {id, spec, texture, coreTexture, primaryBounds: primaryPackedBounds(packed, spec.primitives.length)};
  });
  state = {model, modelGeneration: renderer.modelGeneration, key, display, archetypes, textures, snapshot: null};
  cache.set(renderer, state);
  return state;
}

function releaseStateTextures(renderer, state) {
  const doomed = new Set([...state.textures, state.snapshot?.texture].filter(Boolean));
  for (const texture of doomed) renderer.gl.deleteTexture(texture);
  renderer.textures = renderer.textures.filter(texture => !doomed.has(texture));
}

function copyFullColor(renderer, state, width, height) {
  const g = renderer.gl;
  if (state.snapshot && (state.snapshot.width !== width || state.snapshot.height !== height)) {
    g.deleteTexture(state.snapshot.texture);
    renderer.textures = renderer.textures.filter(t => t !== state.snapshot.texture);
    state.snapshot = null;
  }
  if (!state.snapshot) {
    const texture = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, texture);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, width, height, 0, g.RGBA, g.HALF_FLOAT, null);
    for (const [key, value] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, key, value);
    renderer.textures.push(texture);
    state.snapshot = {texture, width, height};
  }
  g.bindFramebuffer(g.FRAMEBUFFER, renderer.colorTarget.fbo);
  g.readBuffer(g.COLOR_ATTACHMENT0);
  g.bindTexture(g.TEXTURE_2D, state.snapshot.texture);
  g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
  g.bindFramebuffer(g.FRAMEBUFFER, null);
}

function ensureModel(renderer, model, source) {
  if (renderer.model !== model || renderer.measured !== source) renderer.setModel(model, source);
}

/** Exactly two bounded whole-scene renders plus one fullscreen composite.
 * Final hit buffers/selection refer to the interior display, never a third trace.
 * Repaint selection by calling this function again (not repaintSelection()).
 */
export async function renderGhost(renderer, model, source, renderOptions = {}, options = {}) {
  const start = performance.now(), opacity = options.opacity ?? 0.25;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw Error('Ghost opacity must be between 0 and 1');
  if (running.has(renderer) || renderer.busy) throw Error('Ghost inspection frame already in progress');
  running.add(renderer);
  let completed = false;
  try {
    ensureModel(renderer, model, source);
    const width = renderOptions.width ?? 640, height = renderOptions.height ?? 544;
    const budget = nativeDisplaySize({cssWidth: width, cssHeight: height, dpr: 1,
      limits: {...renderer.displayLimits, bytesPerPixel: (renderer.displayLimits.bytesPerPixel ?? 112) + 8}});
    if (!budget.native) throw Error('Ghost inspection needs one extra RGBA16F image; native frame exceeds the explicit memory budget');
    const requestRevision = renderOptions.requestRevision ?? renderer.requestRevision;
    const frameOptions = {...renderOptions, requestRevision, displayArchetypes: null, skipPresent: true};
    const state = prepare(renderer, model, options);
    const full = await renderer.render(frameOptions);
    const cancelled = () => requestRevision !== renderer.requestRevision || renderer.model !== model || renderer.modelGeneration !== state.modelGeneration;
    if (full.cancelled || cancelled()) return {...full, cancelled: true, ghostInspection: true, wallMs: performance.now() - start};
    copyFullColor(renderer, state, width, height);
    // All original source shells are display-only occluders. The independent R02
    // source is empty; this also safely handles a source-bearing inspection call.
    const interior = await renderer.render({...frameOptions, source: false, displayArchetypes: state.archetypes});
    if (interior.cancelled || cancelled()) return {...interior, cancelled: true, ghostInspection: true, wallMs: performance.now() - start};
    const g = renderer.gl;
    renderer.busy = true;
    if (!renderer.ghostCompositeProgram) renderer.ghostCompositeProgram = renderer.compile('inspection-xray-two-scene-composite', COMPOSITE);
    g.disable(g.SCISSOR_TEST); g.disable(g.BLEND);
    g.bindVertexArray(renderer.vao);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, renderer.canvas.width, renderer.canvas.height);
    g.useProgram(renderer.ghostCompositeProgram);
    renderer.bindTexture(renderer.ghostCompositeProgram, 'uFullScene', 0, state.snapshot.texture);
    renderer.bindTexture(renderer.ghostCompositeProgram, 'uInteriorScene', 1, renderer.colorTarget.texture);
    g.uniform1f(renderer.uniform(renderer.ghostCompositeProgram, 'uEnvelopeOpacity'), opacity);
    g.drawArrays(g.TRIANGLES, 0, 3);
    const error = g.getError();
    if (error !== g.NO_ERROR) throw Error('Ghost inspection composite GL error ' + error);
    await renderer.complete(false);
    const wasCancelled = cancelled();
    if (wasCancelled) renderer.hitDataComplete = false;
    renderer.ghostInspectionActive = !wasCancelled;
    const stats = {...interior, cancelled: wasCancelled, ghostInspection: true,
      opacity, scenePasses: 2, compositePasses: 1, presentationPasses: 1,
      passes: full.passes + interior.passes + 1,
      wallMs: performance.now() - start,
      fullSceneWallMs: full.wallMs, interiorSceneWallMs: interior.wallMs,
      ghostPrimitiveCount: state.display.ghostIds.length, retainedPrimitiveCount: state.display.retainedIds.length,
      additionalFramebufferBytes: width * height * 8,
      picking: 'interior-first-hit', displayMode: 'two-pass-xray-overlay-not-physical-refraction',
      sourceGeometryChanged: false, graphPreserved: true, physicsUsesOriginalModel: true};
    renderer.stats.last = stats;
    completed = !wasCancelled;
    return stats;
  } finally {
    renderer.busy = false;
    if (!completed) renderer.ghostInspectionActive = false;
    running.delete(renderer);
  }
}

/** Async complete opaque frame. Uses the original descriptor collections and
 * original presentation shader, so unchanged inputs reproduce the opaque image.
 */
export async function restoreOpaque(renderer, model, source, renderOptions = {}) {
  if (running.has(renderer) || renderer.busy) throw Error('Wait for the current inspection frame before restoring');
  ensureModel(renderer, model, source);
  renderer.ghostInspectionActive = false;
  const stats = await renderer.render({...renderOptions, displayArchetypes: null, skipPresent: false});
  return {...stats, ghostInspection: false, scenePasses: 1, compositePasses: 0, picking: 'full-scene-first-hit'};
}
