/* R07 DIAGNOSTIC ONLY: shade an already evaluated, fixed R06 surface.
 *
 * API is synchronous; SHA-256 jobs are asynchronous. Wait until
 * report().pendingHashes === 0 and check errors before persisting evidence.
 *
 * Sequence per pose: native R06 baseline frame/state/report -> install(v,m)
 * -> setMode('no-bump') -> native render/readPixels -> setMode('albedo')
 * -> native render/readPixels -> restore() -> native restored frame/state.
 *
 * During an attached diagnostic window DO NOT call cornerLip.report(),
 * __LIP_CORNER_SOLVER__.report(), viewer.update(), pose or parameter setters.
 * R06 correctly rejects a changed material compile owner during evaluation.
 * This helper never overrides that safeguard: it checks the evaluated bytes
 * directly, restores the exact hooks, then checks that R05/R06 stayed valid
 * and their actual evaluation counters did not change. The owning runner
 * must reject any state/pixel/actual-GPU-shader mismatch after restoration.
 *
 * No mesh/material clone, native setting write, pose update or render call.
 * Native teeth/gums/tongue material is outside this diagnostic's scope.
 */
(function publishR07EdgeSurfaceAttribution() {
  'use strict';
  const GLOBAL = '__R07_EDGE_SURFACE__', VERSION = 'R07-EDGE-SURFACE-ATTRIBUTION@1';
  const UNIFORM = 'r07EdgeSurfaceMode', MARKER = '// R07 edge surface diagnostic; not a product shader';
  const MODES = Object.freeze({ original: 0, 'no-bump': 1, albedo: 2 }), MAX_WINDOWS = 16;
  const own = (o, k) => Object.getOwnPropertyDescriptor(o, k);
  if (own(window, GLOBAL)) throw Error('R07 edge surface diagnostic already exists');
  let context = null, windows = 0;

  function sameDescriptor(a, b) {
    if (a === undefined || b === undefined) return a === b;
    return ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]);
  }
  function put(o, k, d, value) {
    Object.defineProperty(o, k, d ? { ...d, value } : { configurable: true, enumerable: false, writable: true, value });
  }
  function undo(o, k, d) {
    if (d) Object.defineProperty(o, k, d);
    else if (!Reflect.deleteProperty(o, k)) throw Error('Cannot restore inherited material member: ' + k);
  }
  function once(s, anchor, replacement) {
    if (s.split(anchor).length !== 2) throw Error('R07 shader anchor is not unique: ' + anchor);
    return s.replace(anchor, () => replacement);
  }
  function value(x) {
    if (x?.toArray) return x.toArray();
    if (ArrayBuffer.isView(x)) return Array.from(x);
    if (Array.isArray(x)) return x.map(value);
    if (x && typeof x === 'object') return x.isTexture ? { textureUUID: x.uuid } : x;
    return x;
  }
  function values(m) {
    const out = {};
    for (const k of ['color', 'roughness', 'metalness', 'ior', 'specularIntensity', 'specularColor', 'clearcoat',
      'clearcoatRoughness', 'transmission', 'thickness', 'opacity', 'side', 'transparent', 'wireframe', 'depthTest',
      'depthWrite', 'alphaTest', 'vertexColors', 'flatShading', 'normalScale', 'bumpScale', 'displacementScale',
      'displacementBias', 'emissive', 'emissiveIntensity', 'envMapIntensity', 'attenuationColor', 'attenuationDistance',
      'map', 'normalMap', 'bumpMap', 'displacementMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'envMap']) out[k] = value(m[k]);
    return JSON.stringify(out);
  }
  function bytes(a) { return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); }
  function equalBytes(a, b) {
    if (!a?.buffer || a.byteLength !== b.byteLength) return false;
    const x = bytes(a); for (let i = 0; i < x.length; i++) if (x[i] !== b[i]) return false;
    return true;
  }
  function settings(c) {
    // None of these readers invokes the R06 compatibility check.
    const inner = window.innerLip.report();
    return JSON.stringify({ model: c.model.state, pose: window.lipWorkbench.pose(), dna: window.lipWorkbench.dna(),
      nativeLip: window.lipWorkbench.settings(), ownerBeforeJaw: c.structure.performance.ownerBeforeJaw,
      head: window.headProceduralSkin.settings(), body: window.bodyProceduralSkin.settings(), base: window.lipRealism.settings(),
      inner: { comparison: inner.comparison, diagnostic: inner.diagnostic, baseComparison: inner.baseComparison } });
  }
  function cameraLighting(c) {
    const v = c.viewer, lights = [];
    v.scene.traverse(o => {
      if (!o.isLight) return;
      const r = { type: o.type, name: o.name, position: o.position.toArray(), quaternion: o.quaternion.toArray(),
        scale: o.scale.toArray(), matrix: o.matrixWorld.toArray(), color: o.color.toArray(), intensity: o.intensity, visible: o.visible };
      if (o.groundColor) r.ground = o.groundColor.toArray();
      if (o.target) r.target = { position: o.target.position.toArray(), quaternion: o.target.quaternion.toArray(),
        scale: o.target.scale.toArray(), matrix: o.target.matrixWorld.toArray() };
      lights.push(r);
    });
    return JSON.stringify({ camera: { position: v.camera.position.toArray(), quaternion: v.camera.quaternion.toArray(),
      target: v.orbit.target.toArray(), aspect: v.camera.aspect, fov: v.camera.fov, zoom: v.camera.zoom,
      near: v.camera.near, far: v.camera.far, projection: v.camera.projectionMatrix.toArray() },
      lights, center: v.cineRig.center.toArray(), exposure: v.renderer.toneMappingExposure,
      toneMapping: v.renderer.toneMapping, outputColorSpace: v.renderer.outputColorSpace });
  }
  function digest(c, record, key, input) {
    c.pendingHashes++;
    crypto.subtle.digest('SHA-256', typeof input === 'string' ? new TextEncoder().encode(input) : input)
      .then(b => { record[key] = Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join(''); })
      .catch(e => { record.hashError = String(e); c.errors.push('SHA-256: ' + String(e)); })
      .finally(() => { c.pendingHashes--; });
  }
  function captureBuffers(c) {
    const copies = new Map();
    function buffer(label, get, category) {
      const a = get();
      if (a != null && !ArrayBuffer.isView(a)) throw Error('Expected native typed buffer: ' + label);
      let saved = null;
      if (a) { if (!copies.has(a)) copies.set(a, bytes(a).slice()); saved = copies.get(a); }
      c.buffers.push({ label, get, original: a, saved, category });
    }
    function geometry(label, get) {
      const g = get();
      if (!g?.attributes?.position || !g.index) throw Error('Missing original indexed geometry: ' + label);
      const attrs = {}, names = ['position', 'normal', 'csRest', 'fRest', 'csType', 'csRegion', 'l19Oral', 'l19State', 'l19Detail', 'skinIndex', 'skinWeight'];
      for (const name of names) {
        attrs[name] = g.attributes[name];
        buffer(label + '.' + name, () => get()?.attributes?.[name]?.array,
          ['csType', 'csRegion', 'l19Oral', 'l19State', 'l19Detail'].includes(name) ? 'semantic' : 'geometry');
      }
      buffer(label + '.index', () => get()?.index?.array, 'geometry');
      c.geometries.push({ get, original: g, attrs, index: g.index, groups: JSON.stringify(g.groups) });
    }
    geometry('viewer.geometry', () => c.viewer.geometry);
    geometry('nativeLip.geometry', () => c.viewer.currentLip?.geometry);
    geometry('draw.geometry', () => c.viewer.mesh.geometry);
    buffer('canonical.positions', () => c.model.positions, 'geometry');
    buffer('canonical.faces', () => c.model.faces, 'geometry');
    buffer('native.beforeLocalBase', () => c.solver.base, 'beforeLocal');
    buffer('native.reference', () => c.solver.reference, 'geometry');
    buffer('native.referenceHorizontal', () => c.solver.referenceHorizontal, 'geometry');
    c.bufferInventory = c.buffers.map(b => ({ label: b.label, category: b.category, bytes: b.saved?.byteLength || 0 }));
  }
  function protectedInputs(c) {
    const bufferExact = { geometry: true, semantic: true, beforeLocal: true }, changedBuffers = [];
    for (const b of c.buffers) {
      const a = b.get(), exact = a === b.original && (b.saved === null ? a == null : equalBytes(a, b.saved));
      if (!exact) { bufferExact[b.category] = false; changedBuffers.push(b.label); }
    }
    const geometryObjectsExact = c.geometries.every(r => {
      const g = r.get(); return g === r.original && g.index === r.index && JSON.stringify(g.groups) === r.groups &&
        Object.entries(r.attrs).every(([k, a]) => g.attributes[k] === a);
    });
    const owners = [c.viewer.skin.material, window.headProceduralSkin.material()];
    const retained = owners.every((m, i) => m === c.materials[i].material);
    const originalNativeHook = owners[0].onBeforeCompile === c.materials[0].compile && owners[0].customProgramCacheKey === c.materials[0].cache;
    const expectedProceduralHook = c.material.onBeforeCompile === (c.attached ? c.compileDiagnostic : c.original.compile) &&
      c.material.customProgramCacheKey === (c.attached ? c.diagnosticCacheKey : c.original.cache);
    const uniformExact = c.nativeUniforms.every(r => {
      const n = c.viewer.renderer.properties.get(owners[0]).uniforms?.[r.name];
      const p = c.viewer.renderer.properties.get(owners[1]).uniforms?.[r.name];
      return n === r.object && p === r.object && JSON.stringify(value(r.object.value)) === r.value;
    }) && c.compiledUniforms.every(r => Object.entries(r.before).every(([name, o]) => r.shader.uniforms[name] === o));
    const f = c.functions;
    return { geometryAndCanonicalBytesExact: bufferExact.geometry && geometryObjectsExact,
      semanticBytesExact: bufferExact.semantic, beforeLocalBaseExact: bufferExact.beforeLocal,
      originalMaterialsRetained: retained, materialParametersExact: retained && c.materials.every(r => values(r.material) === r.values),
      nativeUniformObjectsAndValuesExact: uniformExact, nativeSettingsExact: settings(c) === c.original.settings,
      cameraLightingExact: cameraLighting(c) === c.original.cameraLighting,
      nativeFunctionsAndSolverHookExact: c.viewer.render === f.render && c.viewer.renderer.render === f.rendererRender &&
        c.viewer.update === f.update && c.structure.mother.update === f.motherUpdate && c.solver.apply === f.solverApply &&
        originalNativeHook && expectedProceduralHook,
      changedBuffers };
  }
  function allProtected(r) { return Object.entries(r).every(([k, v]) => k === 'changedBuffers' ? v.length === 0 : v === true); }
  function guard(c) {
    const r = protectedInputs(c);
    if (!allProtected(r)) throw Error('R07 fixed-surface inputs changed: ' + JSON.stringify(r));
    return r;
  }
  function attach(c) {
    if (c.attached) return;
    if (c.material.onBeforeCompile !== c.original.compile || c.material.customProgramCacheKey !== c.original.cache)
      throw Error('Another owner changed the original procedural material');
    try {
      put(c.material, 'onBeforeCompile', c.original.compileDescriptor, c.compileDiagnostic);
      put(c.material, 'customProgramCacheKey', c.original.cacheDescriptor, c.diagnosticCacheKey);
      c.attached = true; c.material.needsUpdate = true;
    } catch (e) {
      undo(c.material, 'onBeforeCompile', c.original.compileDescriptor);
      undo(c.material, 'customProgramCacheKey', c.original.cacheDescriptor);
      throw e;
    }
  }
  function detach(c) {
    if (!c.attached) return;
    if (c.material.onBeforeCompile !== c.compileDiagnostic || c.material.customProgramCacheKey !== c.diagnosticCacheKey)
      throw Error('R07 refuses to overwrite another material owner');
    undo(c.material, 'onBeforeCompile', c.original.compileDescriptor);
    undo(c.material, 'customProgramCacheKey', c.original.cacheDescriptor);
    c.attached = false; c.material.needsUpdate = true;
  }
  function install(viewer, model) {
    if (context && (!context.restored || context.pendingHashes)) throw Error('Restore and finish hashes before another R07 surface window');
    if (windows >= MAX_WINDOWS) throw Error('R07 surface window limit reached; close this diagnostic page');
    if (!crypto?.subtle || typeof TextEncoder !== 'function') throw Error('R07 requires HTTPS WebCrypto');
    const before = window.cornerLip?.report?.(), motion = window.motionLip?.report?.(), inner = window.innerLip?.report?.();
    if (before?.version !== 'LIP-CORNER-R06' || before.comparison !== 'r06' || before.solver?.version !== 'native-corner-pucker-vector@3' ||
        !before.solver.enabled || !before.solver.valid || !motion?.solver?.enabled || !motion.solver.valid ||
        inner?.comparison !== 'r04' || inner.diagnostic !== 0 || window.lipRealism?.settings?.().diagnostic !== 0)
      throw Error('R07 requires an evaluated, enabled R06 candidate-03 with inherited beauty channels');
    const material = window.headProceduralSkin?.material?.(), structure = model?.lipStructure;
    const solver = structure?.mother?.surfaces?.get(viewer?.currentLip?.geometry);
    if (!material?.isMeshPhysicalMaterial || !solver || solver.topology.geometry !== viewer.currentLip.geometry)
      throw Error('Original R06 native surface/material is unavailable');
    const names = window.__LIP_INNER_SHADER__?.nativeUniformNames;
    if (!Array.isArray(names) || names.length !== 15 || new Set(names).size !== names.length)
      throw Error('Original R04 live native uniform contract changed');
    const c = { viewer, model, structure, solver, material, window: ++windows, mode: 'original', control: { value: 0 }, attached: false,
      restored: false, pendingHashes: 0, errors: [], compileRecords: [], compiledUniforms: [], buffers: [], geometries: [], restoration: null,
      before: { r05Calls: motion.solver.calls, r06Calls: before.solver.calls, implementation: before.solver.version }, nativeUniforms: [] };
    c.original = { compile: material.onBeforeCompile, cache: material.customProgramCacheKey,
      compileDescriptor: own(material, 'onBeforeCompile'), cacheDescriptor: own(material, 'customProgramCacheKey'),
      settings: settings(c), cameraLighting: cameraLighting(c), innerDiagnostic: inner.diagnostic,
      baseDiagnostic: window.lipRealism.settings().diagnostic };
    if (typeof c.original.compile !== 'function' || typeof c.original.cache !== 'function') throw Error('Original material hooks unavailable');
    c.original.cacheValue = c.original.cache.call(material);
    for (const [k, d] of [['onBeforeCompile', c.original.compileDescriptor], ['customProgramCacheKey', c.original.cacheDescriptor]]) {
      if (d && (!('value' in d) || (!d.configurable && !d.writable))) throw Error('Cannot reversibly wrap ' + k);
      if (!d && !Object.isExtensible(material)) throw Error('Cannot add reversible member ' + k);
    }
    c.materials = [viewer.skin.material, material].map(m => ({ material: m, values: values(m), compile: m.onBeforeCompile, cache: m.customProgramCacheKey }));
    const np = viewer.renderer.properties.get(viewer.skin.material), sp = viewer.renderer.properties.get(material);
    for (const name of names) {
      const n = np.uniforms?.[name], p = sp.uniforms?.[name];
      if (!n || n !== p) throw Error('Render native baseline before install; original uniform owner missing: ' + name);
      c.nativeUniforms.push({ name, object: n, value: JSON.stringify(value(n.value)) });
    }
    c.functions = { render: viewer.render, rendererRender: viewer.renderer.render, update: viewer.update,
      motherUpdate: structure.mother.update, solverApply: solver.apply };
    captureBuffers(c);
    c.compileDiagnostic = function (shader, ...args) {
      try {
        const result = c.original.compile.call(this, shader, ...args);
        const fragment = shader.fragmentShader, uniforms = shader.uniforms, vertex = shader.vertexShader;
        if (typeof fragment !== 'string' || !fragment.includes('// LIP-INNER-R04 continuous native oral responsibility') ||
            !fragment.includes('fbGeomN=normal;') || !fragment.includes('dFdx(psH)') || !uniforms ||
            fragment.includes(MARKER) || new RegExp('\\b' + UNIFORM + '\\b').test(fragment) || own(uniforms, UNIFORM))
          throw Error('R07 expected the unchanged inherited R04 geometric/detail normal contract');
        const beforeUniforms = Object.fromEntries(Object.keys(uniforms).map(k => [k, uniforms[k]]));
        const nativeSame = c.nativeUniforms.every(r => uniforms[r.name] === r.object && JSON.stringify(value(r.object.value)) === r.value);
        if (!nativeSame || !uniforms.liEnabled || !uniforms.liDiagnostic) throw Error('R07 lost an original R04/native uniform object');
        const mains = fragment.match(/void\s+main\s*\(\s*\)\s*\{/g);
        if (mains?.length !== 1) throw Error('Expected one inherited fragment main');
        let modified = once(fragment, mains[0], MARKER + '\nuniform float ' + UNIFORM + ';\n' + mains[0]);
        modified = once(modified, '#include <clearcoat_normal_fragment_begin>',
          'if (' + UNIFORM + ' > .5 && ' + UNIFORM + ' < 1.5) normal = fbGeomN;\n#include <clearcoat_normal_fragment_begin>');
        modified = once(modified, '#include <opaque_fragment>',
          'if (' + UNIFORM + ' > 1.5 && ' + UNIFORM + ' < 2.5) outgoingLight = psBase;\n#include <opaque_fragment>');
        uniforms[UNIFORM] = c.control; shader.fragmentShader = modified;
        const record = { index: c.compileRecords.length, modeAtCompile: c.mode,
          originalFragment: fragment, modifiedFragment: modified, originalFragmentSHA256: null,
          modifiedFragmentSHA256: null, originalVertexSHA256: null,
          existingUniformObjectsPreserved: Object.entries(beforeUniforms).every(([k, o]) => uniforms[k] === o),
          requiredNativeUniformsSameOriginal: nativeSame, requiredNativeUniformCount: names.length,
          addedUniforms: Object.keys(uniforms).filter(k => !(k in beforeUniforms)),
          vertexShaderUntouchedByDiagnostic: shader.vertexShader === vertex };
        c.compileRecords.push(record); c.compiledUniforms.push({ shader, before: beforeUniforms });
        digest(c, record, 'originalFragmentSHA256', fragment); digest(c, record, 'modifiedFragmentSHA256', modified);
        digest(c, record, 'originalVertexSHA256', vertex);
        return result;
      } catch (e) { c.errors.push(String(e)); throw e; }
    };
    // Each install owns a new control object and compile evidence. A stable
    // key could reuse an earlier window's Three program/uniform list without
    // re-entering onBeforeCompile. Bound the total windows, and make this
    // diagnostic key unique while restoring the exact original key later.
    c.diagnosticCacheKey = function (...args) { return c.original.cache.call(this, ...args) + '/' + VERSION + '/window-' + c.window; };
    context = c; guard(c); return report();
  }
  function report() {
    const c = context;
    if (!c) return { version: VERSION, installed: false, restored: false, mode: 'original', wrapperAttached: false, pendingHashes: 0, errors: [] };
    return { schema: 'kaopu/lip-r07-edge-surface-attribution@1', version: VERSION, installed: !c.restored, restored: c.restored,
      mode: c.mode, window: c.window, maximumWindows: MAX_WINDOWS, wrapperAttached: c.attached, pendingHashes: c.pendingHashes,
      hashEvidenceComplete: c.compileRecords.length > 0 && c.pendingHashes === 0 && c.compileRecords.every(r =>
        r.originalFragmentSHA256 && r.modifiedFragmentSHA256 && r.originalVertexSHA256 && !r.hashError),
      invariants: protectedInputs(c), uniform: { name: UNIFORM, value: c.control.value },
      evaluatedBaseline: { ...c.before }, bufferInventory: c.bufferInventory,
      compileRecords: structuredClone(c.compileRecords), restoration: c.restoration ? structuredClone(c.restoration) : null,
      scope: 'Existing procedural skin only; retained native teeth/gums/tongue unchanged. Already evaluated R06 geometry is frozen.',
      noBumpMeaning: 'Only the inherited procedural psH normal perturbation is bypassed; fbGeomN is after original normal_fragment_maps. Mesh normals and native coarse microgeometry remain.',
      albedoMeaning: 'Output final psBase before lighting/depth visibility; normal output color transforms remain. Albedo is not a neutral physical material and cannot prove volume.',
      R06ReportDeferredWhileAttached: c.attached, nativeSettingsWritten: false, geometryWritten: false, renderOrUpdateRequested: false,
      actualPixelsOrGPUShaderVerifiedByHelper: false, errors: [...c.errors] };
  }
  function setMode(mode) {
    const c = context;
    if (!c || c.restored) throw Error('Install a new R07 fixed-surface window first');
    if (!Object.prototype.hasOwnProperty.call(MODES, mode)) throw Error('Unknown R07 edge mode: ' + String(mode));
    guard(c);
    if (mode === 'original') detach(c); else attach(c);
    c.mode = mode; c.control.value = MODES[mode]; return report();
  }
  function restore() {
    const c = context;
    if (!c) throw Error('R07 surface window was not installed');
    if (c.restored) return report();
    // Detach even if a protected input changed, so failed evidence does not
    // leave this helper's shader installed. Never overwrite another owner.
    detach(c); c.mode = 'original'; c.control.value = 0; c.restored = true;
    const inputs = protectedInputs(c), corner = window.cornerLip.report(), motion = window.motionLip.report();
    c.restoration = { compileFunctionExact: c.material.onBeforeCompile === c.original.compile,
      cacheFunctionExact: c.material.customProgramCacheKey === c.original.cache,
      compileOwnDescriptorExact: sameDescriptor(own(c.material, 'onBeforeCompile'), c.original.compileDescriptor),
      cacheOwnDescriptorExact: sameDescriptor(own(c.material, 'customProgramCacheKey'), c.original.cacheDescriptor),
      cacheValueExact: c.material.customProgramCacheKey.call(c.material) === c.original.cacheValue,
      diagnosticsExact: window.innerLip.report().diagnostic === c.original.innerDiagnostic &&
        window.lipRealism.settings().diagnostic === c.original.baseDiagnostic,
      allProtectedInputsExact: allProtected(inputs),
      r05AndR06StillEnabledValid: corner.comparison === 'r06' && corner.solver.enabled && corner.solver.valid &&
        motion.comparison === 'r05' && motion.solver.enabled && motion.solver.valid,
      r05CallsUnchanged: motion.solver.calls === c.before.r05Calls, r06CallsUnchanged: corner.solver.calls === c.before.r06Calls,
      actualRestoredFrameStillRequired: true };
    if (!Object.entries(c.restoration).every(([k, v]) => k === 'actualRestoredFrameStillRequired' || v === true)) {
      const message = 'R07 restoration/protected-input mismatch: ' + JSON.stringify(c.restoration);
      c.errors.push(message); throw Error(message);
    }
    return report();
  }
  Object.defineProperty(window, GLOBAL, { configurable: true, enumerable: false, writable: false,
    value: Object.freeze({ version: VERSION, install, setMode, report, restore }) });
})();
