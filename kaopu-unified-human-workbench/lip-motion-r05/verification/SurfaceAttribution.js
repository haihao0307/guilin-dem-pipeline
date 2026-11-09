/* R05 diagnostic only. Install after the frozen R04 is ready.
 *
 * __R05_SURFACE_DIAG__.setMode('baseline' | 'no-bump' | 'albedo')
 * __R05_SURFACE_DIAG__.report()
 * __R05_SURFACE_DIAG__.restore()
 *
 * These methods DO NOT render, change a pose, or call a native parameter setter.
 * The owning harness must submit and read back each real frame. Wait until
 * report().pendingHashes === 0 before saving the shader evidence. After restore,
 * submit a real frame and compare it with the original frozen R04 frame.
 *
 * Scope: the existing procedural skin material only. Native teeth/gums/tongue
 * and any other retained material are untouched. Map the contributing material
 * before attributing a displayed defect to this experiment.
 *
 * 'baseline' adds two inactive uniform branches; it does not claim pixel identity
 * until the owning harness checks the actual frame. 'no-bump' preserves the
 * original geometric normal and every optical coefficient. 'albedo' bypasses
 * lighting in the output only; it is not a production material improvement.
 */
(function installR05SurfaceAttribution() {
  'use strict';

  const VERSION = 'R05-SURFACE-ATTRIBUTION@1';
  const GLOBAL = '__R05_SURFACE_DIAG__';
  const UNIFORM = 'r05SurfaceMode';
  const MODE = Object.freeze({ baseline: 0, 'no-bump': 1, albedo: 2 });
  const MARKER = '// R05 surface attribution; diagnostic only';
  const own = (object, key) => Object.getOwnPropertyDescriptor(object, key);

  if (Object.prototype.hasOwnProperty.call(window, GLOBAL)) {
    throw Error('R05 surface diagnostic is already installed; do not stack hooks');
  }
  const skin = window.headProceduralSkin;
  const base = window.lipRealism;
  const inner = window.innerLip;
  const nativeNames = window.__LIP_INNER_SHADER__?.nativeUniformNames;
  if (!skin?.material || base?.version !== 'LIP-REALISM-R02' ||
      inner?.version !== 'LIP-INNER-R04' || !base.ready || !inner.ready) {
    throw Error('R05 surface diagnostic requires the ready, frozen R04 workbench');
  }
  if (!Array.isArray(nativeNames) || !nativeNames.length ||
      new Set(nativeNames).size !== nativeNames.length) {
    throw Error('R05 surface diagnostic requires the original native uniform contract');
  }
  if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') {
    throw Error('R05 surface diagnostic requires HTTPS SHA-256 support');
  }
  const material = skin.material();
  if (!material?.isMeshPhysicalMaterial) {
    throw Error('R05 surface diagnostic requires the original procedural skin material');
  }

  const original = {
    compile: material.onBeforeCompile,
    cacheKey: material.customProgramCacheKey,
    compileDescriptor: own(material, 'onBeforeCompile'),
    cacheDescriptor: own(material, 'customProgramCacheKey'),
    baseSettings: structuredClone(base.settings()),
    innerDiagnostic: inner.report().diagnostic,
    innerComparison: inner.report().comparison
  };
  if (typeof original.compile !== 'function' || typeof original.cacheKey !== 'function') {
    throw Error('R05 surface diagnostic cannot find the original material hooks');
  }
  original.cacheValue = original.cacheKey.call(material);
  if (typeof original.cacheValue !== 'string') {
    throw Error('R05 surface diagnostic requires a string material cache key');
  }
  for (const [key, descriptor] of [
    ['onBeforeCompile', original.compileDescriptor],
    ['customProgramCacheKey', original.cacheDescriptor]
  ]) {
    if (descriptor && (!('value' in descriptor) ||
        (!descriptor.configurable && !descriptor.writable))) {
      throw Error('R05 cannot reversibly wrap material member: ' + key);
    }
    if (!descriptor && !Object.isExtensible(material)) {
      throw Error('R05 cannot reversibly add material member: ' + key);
    }
  }
  if (!Object.isExtensible(window)) {
    throw Error('R05 cannot publish its diagnostic handle');
  }

  const control = { value: MODE.baseline };
  const compileRecords = [];
  const nativeReferences = [];
  const errors = [];
  let mode = 'baseline';
  let restored = false;
  let pendingHashes = 0;
  let restoration = null;

  function sameDescriptor(a, b) {
    if (a === undefined || b === undefined) return a === b;
    return ['value', 'get', 'set', 'writable', 'enumerable', 'configurable']
      .every(key => a[key] === b[key]);
  }
  function restoreMember(key, descriptor) {
    if (descriptor) Object.defineProperty(material, key, descriptor);
    else if (!Reflect.deleteProperty(material, key)) {
      throw Error('R05 could not restore inherited material member: ' + key);
    }
  }
  function wrapMember(key, descriptor, value) {
    Object.defineProperty(material, key, descriptor
      ? { ...descriptor, value }
      : { configurable: true, enumerable: false, writable: true, value });
  }
  function once(source, anchor, replacement) {
    if (source.split(anchor).length !== 2) {
      throw Error('R05 diagnostic anchor is not unique: ' + anchor);
    }
    return source.replace(anchor, () => replacement);
  }
  function hashText(record, key, source) {
    pendingHashes++;
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
      .then(buffer => {
        record[key] = Array.from(new Uint8Array(buffer), byte =>
          byte.toString(16).padStart(2, '0')).join('');
      })
      .catch(error => {
        record.hashError = String(error);
        errors.push('SHA-256: ' + String(error));
      })
      .finally(() => { pendingHashes--; });
  }
  function diagnosticState() {
    const settings = base.settings();
    const innerState = inner.report();
    return {
      baseDiagnostic: settings.diagnostic,
      innerDiagnostic: innerState.diagnostic,
      innerComparison: innerState.comparison,
      diagnosticsExact: settings.diagnostic === original.baseSettings.diagnostic &&
        innerState.diagnostic === original.innerDiagnostic,
      baseSettingsExact: JSON.stringify(settings) === JSON.stringify(original.baseSettings)
    };
  }
  function requireBeautyChannels() {
    const state = diagnosticState();
    if (state.baseDiagnostic !== 0 || state.innerDiagnostic !== 0) {
      throw Error('R05 surface experiments require inherited beauty channels (both diagnostics = 0); native settings were not changed');
    }
  }

  function compileDiagnostic(shader, ...args) {
    try {
      const result = original.compile.call(this, shader, ...args);
      const fragment = shader?.fragmentShader;
      const uniformObject = shader?.uniforms;
      if (typeof fragment !== 'string' || !uniformObject ||
          !fragment.includes('// LIP-INNER-R04 continuous native oral responsibility') ||
          !fragment.includes('fbGeomN=normal;') || !fragment.includes('dFdx(psH)')) {
        throw Error('R05 did not receive the original R04 shader with geometric and detail normals');
      }
      if (fragment.includes(MARKER) ||
          new RegExp('\\b' + UNIFORM + '\\b').test(fragment) ||
          Object.prototype.hasOwnProperty.call(uniformObject, UNIFORM)) {
        throw Error('R05 diagnostic uniform/hook already exists');
      }
      const before = Object.fromEntries(Object.keys(uniformObject)
        .map(name => [name, uniformObject[name]]));
      const required = [...nativeNames, 'liEnabled', 'liDiagnostic'];
      for (const name of required) {
        if (!before[name] || !('value' in before[name])) {
          throw Error('R05 original live uniform is missing: ' + name);
        }
      }
      const mains = fragment.match(/void\s+main\s*\(\s*\)\s*\{/g);
      if (mains?.length !== 1) throw Error('R05 expects one original fragment main');
      let modified = once(fragment, mains[0],
        MARKER + '\nuniform float ' + UNIFORM + ';\n' + mains[0]);
      modified = once(modified, '#include <clearcoat_normal_fragment_begin>',
        'if (' + UNIFORM + ' > .5 && ' + UNIFORM + ' < 1.5) normal = fbGeomN;\n' +
        '#include <clearcoat_normal_fragment_begin>');
      modified = once(modified, '#include <opaque_fragment>',
        'if (' + UNIFORM + ' > 1.5 && ' + UNIFORM + ' < 2.5) outgoingLight = psBase;\n' +
        '#include <opaque_fragment>');

      // Publish only after every source and native contract check succeeded.
      // Native objects, values, vertex shader and existing settings stay live.
      uniformObject[UNIFORM] = control;
      shader.fragmentShader = modified;
      const preserved = Object.keys(before).every(name =>
        before[name] === shader.uniforms[name]);
      if (shader.uniforms !== uniformObject || !preserved) {
        throw Error('R05 changed an existing shader uniform object');
      }
      const record = {
        index: compileRecords.length,
        modeAtCompile: mode,
        originalTemplateSHA256: null,
        modifiedTemplateSHA256: null,
        originalTemplate: fragment,
        modifiedTemplate: modified,
        nativeUniformIdentity: required.map(name => ({
          name, present: true, sameObject: before[name] === shader.uniforms[name]
        })),
        originalUniformCount: Object.keys(before).length,
        modifiedUniformCount: Object.keys(shader.uniforms).length,
        addedUniforms: Object.keys(shader.uniforms).filter(name => !(name in before)),
        originalUniformObjectsPreserved: preserved,
        vertexShaderUntouchedByDiagnostic: true
      };
      compileRecords.push(record);
      nativeReferences.push({ shader, before });
      hashText(record, 'originalTemplateSHA256', fragment);
      hashText(record, 'modifiedTemplateSHA256', modified);
      return result;
    } catch (error) {
      errors.push(String(error));
      throw error;
    }
  }
  function diagnosticCacheKey(...args) {
    return original.cacheKey.call(this, ...args) + '/' + VERSION;
  }

  function report() {
    const state = diagnosticState();
    return {
      schema: 'kaopu/lip-r05-surface-attribution@1',
      version: VERSION,
      installed: !restored,
      restored,
      mode,
      uniform: { name: UNIFORM, value: control.value },
      shaderCompiles: compileRecords.length,
      pendingHashes,
      hashEvidenceComplete: compileRecords.length > 0 && pendingHashes === 0 &&
        compileRecords.every(record => record.originalTemplateSHA256 && record.modifiedTemplateSHA256),
      originalMaterialRetained: skin.material() === material,
      hooks: {
        expectedCompileActive: material.onBeforeCompile === (restored ? original.compile : compileDiagnostic),
        expectedCacheKeyActive: material.customProgramCacheKey === (restored ? original.cacheKey : diagnosticCacheKey),
        originalCacheValue: original.cacheValue,
        currentCacheValue: material.customProgramCacheKey.call(material)
      },
      originalDiagnostics: {
        base: original.baseSettings.diagnostic,
        inner: original.innerDiagnostic,
        innerComparison: original.innerComparison
      },
      currentDiagnostics: state,
      originalBaseSettings: structuredClone(original.baseSettings),
      allCapturedNativeUniformObjectsStillIdentical: nativeReferences.every(({ shader, before }) =>
        Object.keys(before).every(name => shader.uniforms[name] === before[name])),
      nativeSettingsWritten: false,
      renderRequestedByDiagnostic: false,
      geometryChangedByDiagnostic: false,
      nativeOtherMaterialsChanged: false,
      scope: 'existing procedural skin material only; retained native teeth/gums/tongue material unchanged',
      normalMeaning: 'fbGeomN captured after original normal_fragment_maps and before psH detail; no-bump leaves mesh geometry unchanged',
      actualFrameIdentityVerifiedHere: false,
      actualShaderLinkVerifiedHere: false,
      requiresOwningHarnessFrameVerification: true,
      restoration: restoration ? structuredClone(restoration) : null,
      compileRecords: structuredClone(compileRecords),
      errors: [...errors]
    };
  }
  function setMode(next) {
    if (restored) throw Error('R05 surface diagnostic has already been restored');
    if (typeof next !== 'string' || !Object.prototype.hasOwnProperty.call(MODE, next)) {
      throw Error('Unknown R05 surface diagnostic mode: ' + String(next));
    }
    if (skin.material() !== material || material.onBeforeCompile !== compileDiagnostic ||
        material.customProgramCacheKey !== diagnosticCacheKey) {
      throw Error('R05 material ownership changed while the diagnostic was installed');
    }
    if (next !== 'baseline') requireBeautyChannels();
    mode = next;
    control.value = MODE[next];
    return report();
  }
  function restore() {
    if (restored) return report();
    if (material.onBeforeCompile !== compileDiagnostic ||
        material.customProgramCacheKey !== diagnosticCacheKey) {
      throw Error('R05 refuses to overwrite a material hook installed by another owner');
    }
    control.value = MODE.baseline;
    mode = 'baseline';
    restoreMember('onBeforeCompile', original.compileDescriptor);
    restoreMember('customProgramCacheKey', original.cacheDescriptor);
    restored = true;
    material.needsUpdate = true;
    const state = diagnosticState();
    restoration = {
      compileFunctionExact: material.onBeforeCompile === original.compile,
      cacheFunctionExact: material.customProgramCacheKey === original.cacheKey,
      compileOwnDescriptorExact: sameDescriptor(own(material, 'onBeforeCompile'), original.compileDescriptor),
      cacheOwnDescriptorExact: sameDescriptor(own(material, 'customProgramCacheKey'), original.cacheDescriptor),
      cacheValueExact: material.customProgramCacheKey.call(material) === original.cacheValue,
      diagnosticsExact: state.diagnosticsExact,
      baseSettingsExact: state.baseSettingsExact,
      diagnosticsWereNeverWritten: true,
      materialInvalidatedForOriginalProgram: true,
      actualRestoredFrameStillRequired: true
    };
    if (Object.entries(restoration).some(([key, value]) => key.endsWith('Exact') && !value)) {
      errors.push('R05 restore: original hook, settings or diagnostic identity mismatch; no external settings were overwritten');
      throw Error(errors[errors.length - 1]);
    }
    return report();
  }

  try {
    wrapMember('onBeforeCompile', original.compileDescriptor, compileDiagnostic);
    wrapMember('customProgramCacheKey', original.cacheDescriptor, diagnosticCacheKey);
    Object.defineProperty(window, GLOBAL, {
      configurable: true, enumerable: false, writable: false,
      value: Object.freeze({ version: VERSION, setMode, report, restore })
    });
    material.needsUpdate = true;
  } catch (error) {
    restoreMember('onBeforeCompile', original.compileDescriptor);
    restoreMember('customProgramCacheKey', original.cacheDescriptor);
    if (Object.prototype.hasOwnProperty.call(window, GLOBAL)) Reflect.deleteProperty(window, GLOBAL);
    throw error;
  }
})();
