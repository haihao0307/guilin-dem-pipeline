// Isolated r01: import path relocated only; shading implementation unchanged.
/**
 * R8 bounded, continuous hair-shadow experiment, for the vendored Three r170.
 *
 * Derived from the two-pass, first-depth-shaped layering in Yuksel & Keyser,
 * Deep Opacity Maps (2008), https://www.cemyuksel.com/research/deepopacity/
 * This is our adaptation: four cumulative optical-depth channels, analytical
 * ribbon coverage and tau = -log(max(1-alpha, 1e-6)); not the paper's literal
 * implementation. Four layers still approximate the depth distribution and
 * cannot represent arbitrary separated clumps exactly. There is no temporal
 * accumulation, stochastic threshold, extra blur, or multiple scattering.
 *
 * Geometry, vertex expansion and radii are shared with FiberMaterial. Native
 * directional maps retain opaque casters; each receiver multiplies its native
 * per-light visibility by that light's exp(-tau). Main BRDFs are untouched.
 *
 * Call update() immediately BEFORE the main renderer.render(), after app-side
 * material/caster setters. Geometry edits must mark attributes needsUpdate (or
 * call markDirty()). Camera position, light power/color and exposure are not
 * map dependencies. Light transforms, frusta, geometry and radius/opacity are.
 */
import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {FIBER_DEPTH_VERTEX} from './FiberMaterial.js';

export const HAIR_OPACITY_VERSION = 'r8-four-layer-tau-1';
export const HAIR_OPACITY_LAYER_FRACTIONS = Object.freeze([0.1, 0.3, 0.6, 1.0]);
const TAU_EPSILON = 1e-6;
const now = () => globalThis.performance?.now?.() ?? Date.now();
const visibleInTree = object => {
  for (let p = object; p; p = p.parent) if (!p.visible) return false;
  return true;
};

// Identical analytical interval coverage to the existing fibre depth shader.
const COVERAGE = /* glsl */`
uniform float fiberOpacity;
uniform float coverageAA;
varying float vFiberAcross;
varying float vFiberRadius;
varying float vFiberRandom;
varying float vFiberAlong;
varying vec2 vFiberDepthZW;
float hairOpacityCoverage() {
  if (vFiberRadius <= 0.0) return 0.0;
  if (coverageAA < 0.5) return 1.0;
  float footprint = max(fwidth(vFiberAcross), 1e-9);
  float low = max(vFiberAcross - 0.5 * footprint, -vFiberRadius);
  float high = min(vFiberAcross + 0.5 * footprint, vFiberRadius);
  return clamp((high - low) / footprint, 0.0, 1.0);
}
`;

export const HAIR_NEAREST_FRAGMENT = /* glsl */`
#include <packing>
${COVERAGE}
void main() {
  float alpha = clamp(fiberOpacity * hairOpacityCoverage(), 0.0, 1.0);
  if (alpha <= 0.0) discard;
  float depth = 0.5 * vFiberDepthZW.x / vFiberDepthZW.y + 0.5;
  gl_FragColor = packDepthToRGBA(depth);
}
`;

export const HAIR_ACCUMULATION_FRAGMENT = /* glsl */`
#include <packing>
${COVERAGE}
uniform sampler2D hairNearestDepth;
uniform float hairMapSize;
uniform float hairFarDepth;
uniform vec4 hairLayerFractions;
void main() {
  float alpha = clamp(fiberOpacity * hairOpacityCoverage(), 0.0, 1.0);
  if (alpha <= 0.0) discard;
  float depth = 0.5 * vFiberDepthZW.x / vFiberDepthZW.y + 0.5;
  float first = unpackRGBAToDepth(texture2D(hairNearestDepth, gl_FragCoord.xy / hairMapSize));
  float span = max(hairFarDepth - first, 1e-7);
  vec4 ends = first + hairLayerFractions * span;
  float tau = -log(max(1.0 - alpha, ${TAU_EPSILON.toFixed(6)}));
  // Every channel is cumulative from first depth through its layer endpoint.
  // Explicit ONE/ONE blending is essential, including the alpha channel.
  gl_FragColor = tau * step(vec4(depth), ends);
}
`;

export const HAIR_RECEIVER_GLSL = /* glsl */`
uniform float hairOpacityActive;
uniform float hairScatterStrength;
uniform float hairOpacityMapSize;
uniform sampler2D hairOpacityNearest0;
uniform sampler2D hairOpacityNearest1;
uniform sampler2D hairOpacityTau0;
uniform sampler2D hairOpacityTau1;
uniform float hairOpacityFar0;
uniform float hairOpacityFar1;
uniform vec4 hairOpacityFractions;
float hairOpacityTauAtDepth(float depth, float first, float last, vec4 cumulative) {
  if (depth <= first || first >= 1.0) return 0.0;
  // Enforce monotonicity against small half-float accumulation roundoff.
  // The finite half-float maximum also makes a rare overflow evaluate opaque
  // rather than propagating Infinity*0 through mix() as NaN.
  cumulative = clamp(cumulative, vec4(0.0), vec4(65504.0));
  cumulative.y = max(cumulative.y, cumulative.x);
  cumulative.z = max(cumulative.z, cumulative.y);
  cumulative.w = max(cumulative.w, cumulative.z);
  float relative = clamp((depth - first) / max(last - first, 1e-7), 0.0, 1.0);
  if (relative < hairOpacityFractions.x)
    return cumulative.x * relative / hairOpacityFractions.x;
  if (relative < hairOpacityFractions.y)
    return mix(cumulative.x, cumulative.y, (relative - hairOpacityFractions.x) /
      (hairOpacityFractions.y - hairOpacityFractions.x));
  if (relative < hairOpacityFractions.z)
    return mix(cumulative.y, cumulative.z, (relative - hairOpacityFractions.y) /
      (hairOpacityFractions.z - hairOpacityFractions.y));
  return mix(cumulative.z, cumulative.w, (relative - hairOpacityFractions.z) /
    (hairOpacityFractions.w - hairOpacityFractions.z));
}
float hairOpacityTap(sampler2D nearestMap, sampler2D tauMap, vec2 uv, float depth, float last) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;
  float first = unpackRGBAToDepth(texture2D(nearestMap, uv));
  vec4 cumulative = texture2D(tauMap, uv);
  float tau = hairOpacityTauAtDepth(depth, first, last, cumulative);
  return exp(-min(tau, 80.0));
}
float hairOpacityLookup(sampler2D nearestMap, sampler2D tauMap, vec4 coordinate,
    float bias, float last) {
  vec3 p = coordinate.xyz / coordinate.w;
  p.z += bias; // same normalized orthographic depth units and native depth bias
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)
    return 1.0;
  // Reconstruct transmittance at four texel centers, each with its OWN first
  // depth/layers. Interpolating packed depth or mixing layers first is invalid.
  vec2 pixel = p.xy * hairOpacityMapSize - 0.5;
  vec2 weight = fract(pixel);
  vec2 base = (floor(pixel) + 0.5) / hairOpacityMapSize;
  vec2 dx = vec2(1.0 / hairOpacityMapSize, 0.0);
  vec2 dy = vec2(0.0, 1.0 / hairOpacityMapSize);
  return mix(mix(hairOpacityTap(nearestMap, tauMap, base, p.z, last),
                 hairOpacityTap(nearestMap, tauMap, base + dx, p.z, last), weight.x),
             mix(hairOpacityTap(nearestMap, tauMap, base + dy, p.z, last),
                 hairOpacityTap(nearestMap, tauMap, base + dx + dy, p.z, last), weight.x), weight.y);
}
float hairOpacityVisibility(int lightIndex, vec4 coordinate, float bias) {
  if (hairOpacityActive < 0.5) return 1.0;
  if (lightIndex == 0) return hairOpacityLookup(hairOpacityNearest0, hairOpacityTau0,
    coordinate, bias, hairOpacityFar0);
  if (lightIndex == 1) return hairOpacityLookup(hairOpacityNearest1, hairOpacityTau1,
    coordinate, bias, hairOpacityFar1);
  return 1.0;
}
`;

const FULLSCREEN_VERTEX = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
function additiveSettings() {
  return {transparent: true, forceSinglePass: true, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor, depthTest: false, depthWrite: false,
    premultipliedAlpha: false, toneMapped: false};
}
function target(size, type, depthBuffer = false) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter, generateMipmaps: false,
    depthBuffer, stencilBuffer: false, samples: 0,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  rt.texture.name = type === THREE.HalfFloatType ? 'hair cumulative tau RGBA16F' : 'hair nearest depth RGBA8';
  return rt;
}
function rendererSnapshot(renderer) {
  const gl = renderer.getContext();
  return {
    target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(),
    mip: renderer.getActiveMipmapLevel(), viewport: renderer.getViewport(new THREE.Vector4()),
    scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest(),
    actualViewport: new THREE.Vector4().fromArray(gl.getParameter(gl.VIEWPORT)),
    actualScissor: new THREE.Vector4().fromArray(gl.getParameter(gl.SCISSOR_BOX)),
    actualScissorTest: gl.isEnabled(gl.SCISSOR_TEST),
    actualClearColor: Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE)),
    clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
    clearDepth: gl.getParameter(gl.DEPTH_CLEAR_VALUE), clearStencil: gl.getParameter(gl.STENCIL_CLEAR_VALUE),
    autoClear: renderer.autoClear, autoClearColor: renderer.autoClearColor,
    autoClearDepth: renderer.autoClearDepth, autoClearStencil: renderer.autoClearStencil,
    toneMapping: renderer.toneMapping, toneMappingExposure: renderer.toneMappingExposure,
    outputColorSpace: renderer.outputColorSpace, shadowEnabled: renderer.shadowMap.enabled,
    shadowAutoUpdate: renderer.shadowMap.autoUpdate, shadowNeedsUpdate: renderer.shadowMap.needsUpdate,
    infoAutoReset: renderer.info.autoReset,
  };
}
function restoreRenderer(renderer, s) {
  renderer.autoClear = s.autoClear;
  renderer.autoClearColor = s.autoClearColor;
  renderer.autoClearDepth = s.autoClearDepth;
  renderer.autoClearStencil = s.autoClearStencil;
  renderer.toneMapping = s.toneMapping;
  renderer.toneMappingExposure = s.toneMappingExposure;
  renderer.outputColorSpace = s.outputColorSpace;
  renderer.shadowMap.enabled = s.shadowEnabled;
  renderer.shadowMap.autoUpdate = s.shadowAutoUpdate;
  renderer.shadowMap.needsUpdate = s.shadowNeedsUpdate;
  renderer.info.autoReset = s.infoAutoReset;
  renderer.state.buffers.depth.setClear(s.clearDepth);
  renderer.state.buffers.stencil.setClear(s.clearStencil);
  // Restore logical default-framebuffer state before selecting the saved RT.
  renderer.setViewport(s.viewport);
  renderer.setScissor(s.scissor);
  renderer.setScissorTest(s.scissorTest);
  renderer.setRenderTarget(s.target, s.face, s.mip);
  // Clear-color encoding depends on the selected target's color space.
  renderer.setClearColor(s.clearColor, s.clearAlpha);
  renderer.state.buffers.color.setClear(...s.actualClearColor, false);
  // ShadowMap and callers can set a physical viewport directly; preserve that
  // too, through Three's state cache rather than leaving raw GL changes stale.
  renderer.state.viewport(s.actualViewport);
  renderer.state.scissor(s.actualScissor);
  renderer.state.setScissorTest(s.actualScissorTest);
}
function configurePassRenderer(renderer) {
  renderer.autoClear = false;
  renderer.shadowMap.enabled = false;
  renderer.info.autoReset = false;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.state.buffers.depth.setClear(1);
  renderer.state.buffers.stencil.setClear(0);
}
function completeFramebuffer(renderer, rt) {
  renderer.setRenderTarget(rt);
  const gl = renderer.getContext();
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  const samples = gl.getParameter(gl.SAMPLES);
  return {complete: status === gl.FRAMEBUFFER_COMPLETE, status, statusHex: `0x${status.toString(16)}`, samples};
}

/** A real GPU test, not an extension-string-only capability declaration. */
export function probeHairOpacityCapabilities(renderer) {
  const gl = renderer.getContext();
  const result = {tested: true, supported: false, webgl2: typeof gl.texStorage2D === 'function',
    extension: null, format: 'RGBA16F / HalfFloatType', floatBlendExtensionRequired: false,
    framebuffer: null, blendExpected: [64, 128, 32, 191], blendActual: null,
    blendToleranceBytes: 2, probeRenderCalls: 0, reason: null};
  if (!result.webgl2) { result.reason = 'WebGL2 is required'; return result; }
  if (gl.getExtension('EXT_color_buffer_float')) result.extension = 'EXT_color_buffer_float';
  else if (gl.getExtension('EXT_color_buffer_half_float')) result.extension = 'EXT_color_buffer_half_float';
  if (!result.extension) { result.reason = 'No renderable half-float color-buffer extension'; return result; }
  const s = rendererSnapshot(renderer);
  const half = target(1, THREE.HalfFloatType);
  const bytes = target(1, THREE.UnsignedByteType);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const add = new THREE.ShaderMaterial({vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: 'void main() { gl_FragColor = vec4(0.125, 0.25, 0.0625, 0.375); }',
    ...additiveSettings()});
  const copy = new THREE.ShaderMaterial({vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: 'uniform sampler2D source; varying vec2 vUv; void main() { gl_FragColor = texture2D(source, vUv); }',
    uniforms: {source: {value: half.texture}}, depthTest: false, depthWrite: false,
    blending: THREE.NoBlending, toneMapped: false});
  const testScene = new THREE.Scene(), camera = new THREE.Camera(), quad = new THREE.Mesh(geometry, add);
  quad.frustumCulled = false;
  testScene.add(quad);
  try {
    configurePassRenderer(renderer);
    result.framebuffer = completeFramebuffer(renderer, half);
    if (!result.framebuffer.complete || result.framebuffer.samples !== 0)
      throw new Error('RGBA16F framebuffer is incomplete or unexpectedly multisampled');
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.render(testScene, camera); result.probeRenderCalls++;
    renderer.render(testScene, camera); result.probeRenderCalls++;
    const readbackFbo = completeFramebuffer(renderer, bytes);
    if (!readbackFbo.complete) throw new Error('RGBA8 verification framebuffer is incomplete');
    quad.material = copy;
    renderer.render(testScene, camera); result.probeRenderCalls++;
    const pixel = new Uint8Array(4);
    renderer.readRenderTargetPixels(bytes, 0, 0, 1, 1, pixel);
    result.blendActual = Array.from(pixel);
    result.supported = result.blendExpected.every((v, i) => Math.abs(v - pixel[i]) <= result.blendToleranceBytes);
    if (!result.supported) result.reason = 'Actual RGBA16F ONE/ONE blend→RGBA8 readback did not match';
  } catch (error) { result.reason = String(error.message || error); }
  finally {
    half.dispose(); bytes.dispose(); geometry.dispose(); add.dispose(); copy.dispose();
    restoreRenderer(renderer, s);
  }
  return result;
}

/** CPU counterpart for meaningful layer monotonicity/numerical checks. */
export function evaluateHairOpacityTau(depth, first, last, cumulative) {
  if (depth <= first || first >= 1) return 0;
  const values = [0];
  for (const value of cumulative) values.push(Math.min(65504, Math.max(values.at(-1), value, 0)));
  const knots = [0, ...HAIR_OPACITY_LAYER_FRACTIONS];
  const x = Math.max(0, Math.min(1, (depth - first) / Math.max(last - first, 1e-7)));
  for (let i = 1; i < knots.length; i++) if (x <= knots[i])
    return values[i - 1] + (values[i] - values[i - 1]) * (x - knots[i - 1]) / (knots[i] - knots[i - 1]);
  return values[4];
}

export function createHairOpacityShadows(options) { return new HairOpacityShadows(options); }

export class HairOpacityShadows {
  constructor({renderer, scene, lights, mapSize = 512, onPass = null} = {}) {
    if (!renderer || !scene || !Array.isArray(lights) || lights.length !== 2 ||
        lights.some(light => !light.isDirectionalLight || !light.shadow.camera.isOrthographicCamera))
      throw new Error('HairOpacityShadows requires a renderer, scene and exactly two orthographic directional lights');
    if (THREE.REVISION !== '170') throw new Error('HairOpacityShadows shader hooks are audited only for Three r170');
    if (mapSize !== 512) throw new Error('This bounded experiment uses fixed 512×512 maps');
    this.renderer = renderer; this.scene = scene; this.lights = [...lights];
    this.mapSize = mapSize; this.onPass = onPass;
    this.enabled = false; this.hairCasts = true; this.disposed = false;
    this.capability = {tested: false, supported: false, reason: 'init() has not run'};
    this.fibers = new Map(); this.receivers = new Map(); this.maps = [];
    this.passScene = new THREE.Scene(); this.dirty = true; this.dirtyReason = 'initial';
    this.signature = ''; this.lightSignature = ''; this.lastError = null; this.rebuilds = 0; this.updateCalls = 0;
    this.skippedUpdates = 0; this.passCounts = {nearest: 0, accumulation: 0, drawCalls: 0};
    this.lastUpdate = null;
    this.lastPasses = []; this.passHistory = []; this.pendingQueries = [];
    this.timerExtension = renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');
    this.uniforms = {
      hairScatterStrength: {value:.22}, hairOpacityActive: {value: 0}, hairOpacityMapSize: {value: mapSize},
      hairOpacityFractions: {value: new THREE.Vector4(...HAIR_OPACITY_LAYER_FRACTIONS)},
      hairOpacityNearest0: {value: null}, hairOpacityNearest1: {value: null},
      hairOpacityTau0: {value: null}, hairOpacityTau1: {value: null},
      hairOpacityFar0: {value: 1}, hairOpacityFar1: {value: 1},
    };
  }

  init() {
    if (this.disposed) throw new Error('HairOpacityShadows is disposed');
    if (this.capability.tested) return {...this.capability};
    this.capability = probeHairOpacityCapabilities(this.renderer);
    if (!this.capability.supported) return {...this.capability};
    const s = rendererSnapshot(this.renderer);
    try {
      for (let i = 0; i < this.lights.length; i++) {
        const light = this.lights[i];
        const nearest = target(this.mapSize, THREE.UnsignedByteType, true);
        const tau = target(this.mapSize, THREE.HalfFloatType);
        const record = {light, nearest, tau, bounds: null, framebuffer: null};
        // Push before checking, so a failed allocation is still disposed.
        this.maps.push(record);
        this.uniforms[`hairOpacityNearest${i}`].value = nearest.texture;
        this.uniforms[`hairOpacityTau${i}`].value = tau.texture;
        record.framebuffer = {nearest: completeFramebuffer(this.renderer, nearest),
          tau: completeFramebuffer(this.renderer, tau)};
        if (!Object.values(record.framebuffer).every(x => x.complete && x.samples === 0)) {
          throw new Error(`Light ${light.id} full-size map FBO is incomplete or multisampled`);
        }
      }
      this.capability.fullSizeFramebuffers = this.maps.map(m => m.framebuffer);
    } catch (error) {
      this.capability.supported = false;
      this.capability.reason = String(error.message || error);
      for (const map of this.maps) { map.nearest.dispose(); map.tau.dispose(); }
      this.maps = [];
    } finally { restoreRenderer(this.renderer, s); }
    return {...this.capability};
  }

  attachFiber(mesh) {
    if (this.fibers.has(mesh)) return this;
    const u = mesh.material?.uniforms;
    if (!u?.radiusScale || !u?.fiberOpacity || !u?.fiberShadows ||
        !mesh.geometry.getAttribute('strandRadius') || !mesh.geometry.getAttribute('scalpNormal'))
      throw new Error('Attach an existing configured FiberMaterial mesh');
    const uniforms = {viewportHeight: {value: this.mapSize}, radiusScale: u.radiusScale,
      fiberOpacity: u.fiberOpacity, coverageAA: {value: 1}};
    const nearestMaterial = new THREE.ShaderMaterial({name: 'deterministic nearest analytical hair depth',
      vertexShader: FIBER_DEPTH_VERTEX, fragmentShader: HAIR_NEAREST_FRAGMENT, uniforms,
      side: THREE.DoubleSide, blending: THREE.NoBlending, depthTest: true,
      depthWrite: true, forceSinglePass: true, toneMapped: false});
    const tauMaterial = new THREE.ShaderMaterial({name: 'four cumulative hair optical-depth layers',
      vertexShader: FIBER_DEPTH_VERTEX, fragmentShader: HAIR_ACCUMULATION_FRAGMENT,
      uniforms: {...uniforms, hairNearestDepth: {value: null}, hairMapSize: {value: this.mapSize},
        hairFarDepth: {value: 1}, hairLayerFractions: this.uniforms.hairOpacityFractions},
      side: THREE.DoubleSide, ...additiveSettings()});
    const proxy = new THREE.Mesh(mesh.geometry, nearestMaterial);
    proxy.matrixAutoUpdate = false; proxy.frustumCulled = false; proxy.name = `${mesh.name} optical-depth proxy`;
    this.passScene.add(proxy);
    this.fibers.set(mesh, {mesh, proxy, nearestMaterial, tauMaterial,
      baselineCast: mesh.castShadow, material: mesh.material});
    this._attachReceiver(mesh.material, 'fiber');
    if (this.enabled) mesh.castShadow = false;
    this.markDirty('attached fiber');
    return this;
  }

  attachHead(head) {
    if (!head?.material?.isMeshStandardMaterial) throw new Error('Head receiver must use MeshStandardMaterial');
    this._attachReceiver(head.material, 'head');
    return this;
  }

  _attachReceiver(material, kind) {
    if (this.receivers.has(material)) return;
    const oldCompile = material.onBeforeCompile, oldKey = material.customProgramCacheKey;
    const baselineKey = oldKey.call(material);
    const record = {material, kind, oldCompile, oldKey, baselineKey, patchedCompiles: 0};
    const owner = this;
    material.onBeforeCompile = function(shader, renderer) {
      oldCompile.call(this, shader, renderer);
      if (!owner.enabled) return;
      Object.assign(shader.uniforms, owner.uniforms);
      const packingMarker = '#include <packing>';
      if (!shader.fragmentShader.includes(packingMarker)) throw new Error('Receiver packing shader hook is missing');
      shader.fragmentShader = shader.fragmentShader.replace(packingMarker, `${packingMarker}\n${HAIR_RECEIVER_GLSL}`);
      if (kind === 'fiber') {
        const marker = '// Each light gets ONLY its own shadow visibility, including warm/cool.';
        if (!shader.fragmentShader.includes(marker)) throw new Error('Fibre per-light visibility hook is missing');
        shader.fragmentShader = shader.fragmentShader.replace(marker, /* glsl */`
          #if defined(USE_SHADOWMAP) && (UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS)
            if (receiveShadow && fiberShadows > 0.5) {
              float hairTransmission = hairOpacityVisibility(UNROLLED_LOOP_INDEX, vDirectionalShadowCoord[i], lampShadow.shadowBias);
              // Bounded secondary-transport surrogate, not full dual scattering.
              // Keeps the opaque-head shadow and the matching lamp colour.
              float shorterPath = max(0.0,sqrt(hairTransmission)-hairTransmission);
              float crossFiber = sqrt(max(0.0,1.0-pow(dot(T,normalize(directionalLights[i].direction)),2.0)));
              color += directionalLights[i].color * visibility * hairScatterStrength * shorterPath * sqrt(pigment) * (.35+.65*crossFiber);
              visibility *= hairTransmission;
            }
          #endif
          ${marker}`);
      } else {
        const marker = 'getDirectionalLightInfo( directionalLight, directLight );';
        const nativeChunk = THREE.ShaderChunk.lights_fragment_begin;
        if (!nativeChunk.includes(marker) || !shader.fragmentShader.includes('#include <lights_fragment_begin>'))
          throw new Error('StandardMaterial per-directional-light hook is missing');
        const replacement = nativeChunk.replace(marker, `${marker}\n
          #if defined(USE_SHADOWMAP) && (UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS)
            if (directLight.visible && receiveShadow)
              directLight.color *= hairOpacityVisibility(UNROLLED_LOOP_INDEX,
                vDirectionalShadowCoord[i], directionalLightShadows[i].shadowBias);
          #endif`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', replacement);
      }
      record.patchedCompiles++;
    };
    material.customProgramCacheKey = () => this.enabled ? `${baselineKey}:${HAIR_OPACITY_VERSION}:${kind}` : baselineKey;
    this.receivers.set(material, record);
    if (this.enabled) material.needsUpdate = true;
  }

  setEnabled(value) {
    if (this.disposed) return false;
    const next = !!value && this.capability.supported;
    if (next === this.enabled) return next;
    this.enabled = next;
    this.uniforms.hairOpacityActive.value = 0; // becomes live only after a successful build
    for (const record of this.receivers.values()) record.material.needsUpdate = true;
    for (const record of this.fibers.values()) {
      if (next) { record.baselineCast = record.mesh.castShadow; record.mesh.castShadow = false; }
      else record.mesh.castShadow = record.baselineCast;
    }
    this.renderer.shadowMap.needsUpdate = true;
    if (next) this.markDirty('enabled');
    return next;
  }

  /** Head caster/receiver flags stay owned by the app. */
  setCasterSelection({hair} = {}) {
    if (hair !== undefined) this.hairCasts = !!hair;
    this.uniforms.hairOpacityActive.value = this.enabled && this.hairCasts && this.rebuilds > 0 ? 1 : 0;
    return this;
  }

  markDirty(reason = 'explicit') { this.dirty = true; this.dirtyReason = reason; return this; }

  _prepare() {
    this.scene.updateMatrixWorld(true);
    const ordered = [];
    this.scene.traverseVisible(object => { if (object.isDirectionalLight) ordered.push(object); });
    ordered.sort((a, b) => Number(b.castShadow) - Number(a.castShadow));
    if (ordered.length !== 2 || this.lights.some((light, i) => ordered[i] !== light || !light.castShadow))
      throw new Error('Scene directional-light order/castShadow changed; this two-light receiver mapping is invalid');
    for (const light of this.lights) {
      light.target.updateMatrixWorld(true);
      light.shadow.camera.updateProjectionMatrix();
      light.shadow.updateMatrices(light);
    }
    const signature = [];
    for (const light of this.lights) signature.push(light.id, ...light.shadow.matrix.elements);
    const lightSignature = signature.join('|');
    if (lightSignature !== this.lightSignature) {
      // A light move/frustum edit also invalidates its opaque native map when
      // the application uses shadowMap.autoUpdate=false.
      this.renderer.shadowMap.needsUpdate = true;
      this.lightSignature = lightSignature;
    }
    for (const record of this.fibers.values()) {
      const mesh = record.mesh, g = mesh.geometry;
      const visible = visibleInTree(mesh) && mesh.material.visible;
      record.proxy.visible = visible;
      record.proxy.geometry = g;
      record.proxy.matrix.copy(mesh.matrixWorld);
      record.proxy.matrixWorldNeedsUpdate = true;
      signature.push(mesh.id, g.id, visible, ...mesh.matrixWorld.elements,
        record.material.uniforms.radiusScale.value, record.material.uniforms.fiberOpacity.value,
        g.drawRange.start, g.drawRange.count, g.index?.version ?? -1);
      for (const [name, attribute] of Object.entries(g.attributes)) signature.push(name, attribute.version, attribute.count);
      for (const group of g.groups) signature.push(group.start, group.count, group.materialIndex);
      // syncMaterials/setFiberModes may have just re-enabled native hair casts.
      mesh.castShadow = false;
    }
    return signature.join('|');
  }

  _bounds(map) {
    const camera = map.light.shadow.camera, range = camera.far - camera.near;
    const transform = new THREE.Matrix4(), p = new THREE.Vector3();
    let minDepth = Infinity, maxDepth = -Infinity, minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity, points = 0;
    let maxRadius = 0;
    const extent = [];
    // Radius is explicitly WORLD-space in FiberMaterial, including scaled meshes.
    for (const record of this.fibers.values()) {
      if (!record.proxy.visible || record.material.uniforms.fiberOpacity.value <= 0) continue;
      const mesh = record.mesh, g = mesh.geometry, position = g.getAttribute('position');
      const radius = g.getAttribute('strandRadius'), scale = record.material.uniforms.radiusScale.value;
      transform.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
      let localMin = Infinity, localMax = -Infinity;
      // All vertices are conservatively included, even if a draw range omits some.
      // Side pairs share centers, but do not assume that for externally supplied meshes.
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i).applyMatrix4(transform);
        const r = Math.max(0, radius.getX(i) * scale);
        const depth = -p.z;
        minDepth = Math.min(minDepth, depth - r); maxDepth = Math.max(maxDepth, depth + r);
        minX = Math.min(minX, p.x - r); maxX = Math.max(maxX, p.x + r);
        minY = Math.min(minY, p.y - r); maxY = Math.max(maxY, p.y + r);
        localMin = Math.min(localMin, depth - r); localMax = Math.max(localMax, depth + r);
        maxRadius = Math.max(maxRadius, r); points++;
      }
      extent.push({mesh: mesh.name || String(mesh.id), nearWorld: localMin, farWorld: localMax});
    }
    const supportWorld = (camera.top - camera.bottom) / camera.zoom / this.mapSize * 0.75;
    // Small numeric pad also covers packed depth/float interpolation roundoff.
    const paddingWorld = Math.max(range * 2e-6, 1e-7);
    if (!points) { minDepth = camera.near; maxDepth = camera.near; minX = maxX = minY = maxY = 0; }
    const nearestPossible = (minDepth - paddingWorld - camera.near) / range;
    const far = (maxDepth + paddingWorld - camera.near) / range;
    const halfX = (camera.right - camera.left) / (2 * camera.zoom);
    const halfY = (camera.top - camera.bottom) / (2 * camera.zoom);
    const centerX = (camera.right + camera.left) / 2, centerY = (camera.top + camera.bottom) / 2;
    const fitsDepth = !points || (nearestPossible >= 0 && far < 1);
    const fitsXY = !points || (minX - supportWorld >= centerX - halfX && maxX + supportWorld <= centerX + halfX &&
      minY - supportWorld >= centerY - halfY && maxY + supportWorld <= centerY + halfY);
    const bounds = {points, depthUnits: 'normalized orthographic light-camera depth [0,1]',
      nearWorld: minDepth, farWorld: maxDepth, paddingWorld, maximumPhysicalRadiusWorld: maxRadius,
      antialiasSupportWorld: supportWorld, nearestPossible, lastLayerDepth: far,
      layerFractions: [...HAIR_OPACITY_LAYER_FRACTIONS],
      lastLayerCoversAllGeometry: fitsDepth, fitsNativeFrustumXY: fitsXY,
      lightMatrix: map.light.shadow.matrix.toArray(), near: camera.near, far: camera.far,
      extentsByMesh: extent,
      limitation: 'Four cumulative knots interpolate extinction through gaps; exact separated-clump transmittance is not represented'};
    if (!fitsDepth || !fitsXY) {
      map.bounds = bounds;
      throw new Error(`Hair geometry exceeds unchanged light ${map.light.id} frustum; refusing clipped opacity maps`);
    }
    map.bounds = bounds;
    return bounds;
  }

  _renderPass(map, kind) {
    const renderer = this.renderer, gl = renderer.getContext(), ext = this.timerExtension;
    const rt = kind === 'nearest' ? map.nearest : map.tau;
    for (const record of this.fibers.values()) {
      record.proxy.material = kind === 'nearest' ? record.nearestMaterial : record.tauMaterial;
      if (kind === 'accumulation') {
        record.tauMaterial.uniforms.hairNearestDepth.value = map.nearest.texture;
        record.tauMaterial.uniforms.hairFarDepth.value = map.bounds.lastLayerDepth;
      }
    }
    renderer.setRenderTarget(rt);
    renderer.setClearColor(kind === 'nearest' ? 0xffffff : 0x000000, kind === 'nearest' ? 1 : 0);
    renderer.clear(true, kind === 'nearest', false);
    const callsBefore = renderer.info.render.calls;
    let query = null;
    if (ext && !gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
      query = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    }
    const started = now();
    const oldShaderError = renderer.debug.onShaderError;
    const oldCheckShaderErrors = renderer.debug.checkShaderErrors;
    let shaderError = null, renderError = null;
    renderer.debug.checkShaderErrors = true;
    renderer.debug.onShaderError = (context, program, vertex, fragment) => {
      shaderError = [context.getProgramInfoLog(program), context.getShaderInfoLog(vertex),
        context.getShaderInfoLog(fragment)].filter(Boolean).join('\n');
      if (oldShaderError) oldShaderError(context, program, vertex, fragment);
    };
    try { renderer.render(this.passScene, map.light.shadow.camera); }
    catch (error) { renderError = error; }
    finally {
      if (query) gl.endQuery(ext.TIME_ELAPSED_EXT);
      renderer.debug.onShaderError = oldShaderError;
      renderer.debug.checkShaderErrors = oldCheckShaderErrors;
    }
    if (shaderError !== null || renderError) {
      if (query) gl.deleteQuery(query);
      if (renderError) throw renderError;
      throw new Error(`${kind} shader failed: ${shaderError || 'unspecified compiler error'}`);
    }
    const record = {sequence: this.passCounts.nearest + this.passCounts.accumulation + 1,
      lightId: map.light.id, kind, cpuSubmissionMs: now() - started, gpuMs: null,
      gpuStatus: query ? 'pending' : 'unavailable', drawCalls: renderer.info.render.calls - callsBefore,
      samples: gl.getParameter(gl.SAMPLES), resolution: [this.mapSize, this.mapSize]};
    this.passCounts[kind]++; this.passCounts.drawCalls += record.drawCalls;
    this.lastPasses.push(record); this.passHistory.push(record);
    if (this.passHistory.length > 128) this.passHistory.shift();
    if (query) this.pendingQueries.push({query, record});
    if (this.onPass) this.onPass({...record});
  }

  _pollTimers() {
    if (!this.timerExtension || !this.pendingQueries.length) return;
    const gl = this.renderer.getContext(), ext = this.timerExtension;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    this.pendingQueries = this.pendingQueries.filter(({query, record}) => {
      if (!disjoint && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return true;
      record.gpuStatus = disjoint ? 'disjoint-discarded' : 'measured';
      if (!disjoint) record.gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(query);
      if (this.onPass) this.onPass({...record, timingOnly: true});
      return false;
    });
  }

  update({force = false} = {}) {
    this.updateCalls++;
    this._pollTimers();
    if (!this.enabled || this.disposed) return this.lastUpdate = {rendered: false, enabled: this.enabled, reason: 'disabled'};
    const started = now();
    let snapshot;
    try {
      const signature = this._prepare();
      if (!this.hairCasts) { this.skippedUpdates++; return this.lastUpdate = {rendered: false, reason: 'hair casters disabled', enabled: true}; }
      if (!force && !this.dirty && signature === this.signature) {
        this.skippedUpdates++; return this.lastUpdate = {rendered: false, reason: 'maps unchanged', enabled: true};
      }
      this.lastPasses = [];
      // Validate all bounds BEFORE publishing any new map to the main receiver.
      this.maps.forEach(map => this._bounds(map));
      snapshot = rendererSnapshot(this.renderer);
      configurePassRenderer(this.renderer);
      for (let i = 0; i < this.maps.length; i++) {
        const map = this.maps[i];
        this._renderPass(map, 'nearest');
        this._renderPass(map, 'accumulation');
        this.uniforms[`hairOpacityFar${i}`].value = map.bounds.lastLayerDepth;
      }
      this.signature = signature; this.dirty = false; this.rebuilds++;
      this.lastBuildCpuMs = now() - started;
      this.uniforms.hairOpacityActive.value = 1;
      this.lastError = null;
      return this.lastUpdate = {rendered: true, enabled: true, rebuilds: this.rebuilds,
        renderPasses: this.lastPasses.length, drawCalls: this.lastPasses.reduce((sum, p) => sum + p.drawCalls, 0),
        cpuSubmissionMs: this.lastBuildCpuMs};
    } catch (error) {
      this.lastError = String(error.message || error);
      this.setEnabled(false);
      // Must survive snapshot restoration so native baseline maps rebuild.
      if (snapshot) snapshot.shadowNeedsUpdate = true;
      return this.lastUpdate = {rendered: false, enabled: false, error: this.lastError};
    } finally { if (snapshot) restoreRenderer(this.renderer, snapshot); }
  }

  diagnostics() {
    this._pollTimers();
    return {secondaryTransport:{strength:this.uniforms.hairScatterStrength.value,model:"bounded per-light shorter-path surrogate, not validated multiple scattering"},version: HAIR_OPACITY_VERSION, enabled: this.enabled, hairCasts: this.hairCasts,
      capability: {...this.capability}, mapSize: this.mapSize, depthLayers: 4,
      storage: 'per light: RGBA8 packed nearest + RGBA16F cumulative tau, samples=0',
      colorTextureEstimateBytes: 2 * this.mapSize * this.mapSize * (4 + 8),
      memoryEstimateExcludes: 'depth attachments, driver allocations, native opaque shadow maps and transient probe',
      tauMapping: '-log(max(1-alpha,1e-6)), alpha=existing analytical ribbon coverage × existing fiber opacity',
      blend: {rgb: 'ONE + ONE', alpha: 'ONE + ONE', equation: 'ADD', explicitCustomBlending: true},
      receiverFilter: 'four neighboring transmittance taps, 1-texel bilinear reconstruction; no enlarged blur',
      depthBias: 'each native light shadow bias and normal-biased native shadow coordinate, unchanged',
      lights: this.maps.map(m => ({lightId: m.light.id, bounds: m.bounds, framebuffer: m.framebuffer})),
      receivers: [...this.receivers.values()].map(r => ({kind: r.kind, material: r.material.name,
        patchedCompiles: r.patchedCompiles})),
      nativeFiberCasters: [...this.fibers.values()].map(r => ({name: r.mesh.name, castShadow: r.mesh.castShadow})),
      updateCalls: this.updateCalls, skippedUpdates: this.skippedUpdates, rebuilds: this.rebuilds,
      lastUpdate: this.lastUpdate ? {...this.lastUpdate} : null,
      lastBuildCpuMs: this.lastBuildCpuMs ?? null, passCounts: {...this.passCounts},
      lastPasses: this.lastPasses.map(p => ({...p})), timerQuerySupported: !!this.timerExtension,
      pendingTimerQueries: this.pendingQueries.length, dirty: this.dirty, dirtyReason: this.dirtyReason,
      lastError: this.lastError, limitations: [
        'Bounded four-layer extinction approximation; depth interpolation can attenuate empty gaps between separated clumps',
        'Finite 512² spatial resolution; deterministic analytical coverage does not imply alias-free shadows',
        'Scalar transmittance only; no colored extinction or multiple scattering',
        'RGBA16F accumulation has finite precision; extremely dense overlap can saturate or overflow',
        'GPU timings require available non-disjoint timer queries; CPU times are submission times, not GPU durations',
        'No iPhone validation implied; capability is checked on the actual running WebGL context',
      ]};
  }

  dispose() {
    if (this.disposed) return;
    this.setEnabled(false);
    for (const record of this.receivers.values()) {
      record.material.onBeforeCompile = record.oldCompile;
      record.material.customProgramCacheKey = record.oldKey;
      record.material.needsUpdate = true;
    }
    for (const record of this.fibers.values()) {
      record.nearestMaterial.dispose(); record.tauMaterial.dispose();
      this.passScene.remove(record.proxy); // original geometries stay owned by app
    }
    for (const map of this.maps) { map.nearest.dispose(); map.tau.dispose(); }
    const gl = this.renderer.getContext();
    for (const {query} of this.pendingQueries) gl.deleteQuery(query);
    this.pendingQueries = []; this.fibers.clear(); this.receivers.clear(); this.maps = [];
    this.disposed = true;
  }
}
