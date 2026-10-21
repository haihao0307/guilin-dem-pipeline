/* R08: two independently inspectable native outer-lip appearance changes.
 * The immutable R06 shader is delegated to first, on its original material.
 * Geometry, original uniforms, saliva-film controls/formula and all authoring
 * values are kept. Edge mode changes the film's shared exterior coverage.
 * Edge mode changes the SHARED exterior material coverage (colour, fine height,
 * roughness and wet-film coverage), not a colour-only mask. Colour mode only
 * changes the tissue albedo field. Neither is a measured physiological model.
 * No photograph, external mesh, image texture or lighting substitute is used.
 */
(function () {
  'use strict';
  const VERSION = 'native-lip-surface@1';
  const MODES = Object.freeze(['r08', 'r06', 'edge', 'colour']);
  const EDGE = Object.freeze([
    Object.freeze({
      id: 'edge-width',
      from: 'float edgeWidth=mix(.00032,.00105,lrEdgeSoftness)*(.75+.5*lrNoise(vec2(u*6.+13.,lrUpper*9.)));',
      to: '// R08 edge: narrower, spatially varying shared exterior coverage; engineering metres.\n float edgeWidth=mix(.00011,.00046,lrEdgeSoftness)*(.55+.90*lrNoise(vec2(u*6.+13.,lrUpper*9.)));'
    }),
    Object.freeze({
      id: 'edge-pigment-transition',
      from: 'float outer=smoothstep(.62,1.02,lrDepth)*(.28+.24*lrNoise(mm*.30+13.));',
      to: '// R08 edge: keep the skin transition close to the inherited exterior rail.\n float outer=smoothstep(.78,1.04,lrDepth)*(.28+.24*lrNoise(mm*.30+13.));'
    })
  ]);
  const COLOUR = Object.freeze([
    Object.freeze({
      id: 'tissue-colour',
      from: 'color+=vec3(.057,-.034,-.024)*(tissue*.78+smallTissue*.22)*lrVariation;\n color*=1.+tissue*.060*lrVariation;',
      to: `// R08 colour: separate signed chroma and absorption-like appearance fields.
 // Existing palette, upper/lower controls and rest seed remain the owners.
 // The fields have zero-centred construction, NOT an asserted exact image mean.
 // Their coefficients are artistic engineering choices, not measured blood or melanin.
 float lsSmall=(smallTissue*2.);
 float lsBroad=(tissue*2.);
 // Fade only this new fine field when its rest-space pixel footprint grows.
 float lsFine=(lrNoise(mm*vec2(1.15,1.65)+vec2(47.,lrUpper*19.+8.))-.5)*2.*(1.-smoothstep(.16,.42,footprint));
 float lsBlood=.28*lsBroad+.54*lsSmall+.18*lsFine;
 float lsPigment=(pigmentField-.825)/.175;
 float lsExterior=(1.-clamp(vL19State.x,0.,1.))*smoothstep(-.05,.15,lrDepth);
 float lsGain=lrVariation*lsExterior;
 color+=vec3(.115,-.060,-.035)*lsBlood*lsGain;
 color*=exp(-vec3(.115,.180,.235)*lsPigment*lsGain);
 color*=1.+lsFine*.035*lsGain;`
    })
  ]);
  const NATIVE_UNIFORMS = Object.freeze([
    'csTone', 'csLipColor', 'csLipMix', 'csRoughness', 'csOil',
    'uLEnabled', 'uLPigment', 'uLUpperShade', 'uLWet', 'uLRough',
    'uL19Mel', 'uL19Blood', 'uL19Rough', 'uL19Wet', 'uL19Oxygen'
  ]);
  const own = (o, k) => Object.getOwnPropertyDescriptor(o, k);
  let context = null, lastRemoval = null;

  function validMode(mode) {
    if (!MODES.includes(mode)) throw Error('Unknown R08 surface mode: ' + mode);
    return mode;
  }
  function patches(mode) {
    validMode(mode);
    return (mode === 'r08' ? [...EDGE, ...COLOUR] : mode === 'edge' ? EDGE : mode === 'colour' ? COLOUR : [])
      .map(p => ({ ...p }));
  }
  function transform(fragment, mode) {
    if (typeof fragment !== 'string') throw Error('R08 expects an actual inherited fragment shader');
    let result = fragment;
    for (const p of patches(mode)) {
      if (result.split(p.from).length !== 2) throw Error('R08 requires exactly one inherited anchor: ' + p.id);
      if (result.includes(p.to)) throw Error('R08 appearance was already installed: ' + p.id);
      result = result.replace(p.from, () => p.to);
    }
    return result;
  }
  function install(viewer, model) {
    const material = window.headProceduralSkin?.material?.();
    if (context) {
      if (context.viewer === viewer && context.model === model && context.material === material && hooksStable(context)) return report();
      throw Error('R08 material is already bound to another owner; remove it explicitly first');
    }
    if (!viewer?.renderer || !model?.lipStructure || !material?.isMeshPhysicalMaterial ||
        typeof material.onBeforeCompile !== 'function' || typeof material.customProgramCacheKey !== 'function' ||
        window.innerLip?.version !== 'LIP-INNER-R04' || window.lipRealism?.version !== 'LIP-REALISM-R02') {
      throw Error('R08 requires the fixed native R06/R04 material chain');
    }
    const c = { viewer, model, material, mode: 'r06', installed: true,
      compile: material.onBeforeCompile, key: material.customProgramCacheKey,
      compileDescriptor: own(material, 'onBeforeCompile'), keyDescriptor: own(material, 'customProgramCacheKey'),
      records: [], evidence: {}, errors: [], compiling: false };
    for (const [name, descriptor] of [['onBeforeCompile', c.compileDescriptor], ['customProgramCacheKey', c.keyDescriptor]]) {
      if (descriptor?.configurable === false) throw Error('R08 material owner cannot be wrapped: ' + name);
    }
    c.compileWrapper = function (shader, ...args) {
      if (this !== c.material || c.compiling) throw Error('Unexpected recursive R08 shader compilation');
      c.compiling = true;
      try {
        Reflect.apply(c.compile, this, [shader, ...args]);
        const originalFragment = shader.fragmentShader, originalVertex = shader.vertexShader;
        if (!originalFragment.includes('// LIP-INNER-R04 continuous native oral responsibility')) {
          throw Error('R08 original R04 shader was not produced');
        }
        const uniformEntries = Object.entries(shader.uniforms);
        for (const name of NATIVE_UNIFORMS) if (!shader.uniforms[name]) throw Error('R08 native uniform is absent: ' + name);
        const finalFragment = transform(originalFragment, c.mode);
        shader.fragmentShader = finalFragment;
        if (shader.vertexShader !== originalVertex || Object.keys(shader.uniforms).length !== uniformEntries.length ||
            uniformEntries.some(([name, value]) => shader.uniforms[name] !== value)) {
          throw Error('R08 modified inherited shader inputs outside the declared fragment patch');
        }
        c.evidence[c.mode] = { mode: c.mode, originalVertex, finalVertex: shader.vertexShader,
          originalFragment, finalFragment, replacements: patches(c.mode) };
        c.records.push({ sequence: c.records.length + 1, mode: c.mode, replacements: patches(c.mode).map(p => p.id),
          inheritedUniformCount: uniformEntries.length, allInheritedUniformObjectsPreserved: true,
          nativeUniforms: NATIVE_UNIFORMS.map(name => ({ name, present: true, sameObject: true })),
          originalVertexPreserved: true });
      } catch (error) {
        c.errors.push(String(error)); throw error;
      } finally { c.compiling = false; }
    };
    c.keyWrapper = function () {
      const original = Reflect.apply(c.key, c.material, []);
      return c.mode === 'r06' ? original : original + '/' + VERSION + '/' + c.mode;
    };
    context = c;
    Object.defineProperty(material, 'onBeforeCompile', { configurable: true, writable: true, enumerable: c.compileDescriptor?.enumerable || false, value: c.compileWrapper });
    Object.defineProperty(material, 'customProgramCacheKey', { configurable: true, writable: true, enumerable: c.keyDescriptor?.enumerable || false, value: c.keyWrapper });
    material.needsUpdate = true;
    return report();
  }
  function hooksStable(c) {
    return c.material.onBeforeCompile === c.compileWrapper && c.material.customProgramCacheKey === c.keyWrapper;
  }
  function setMode(mode) {
    validMode(mode);
    const c = context;
    if (!c?.installed) throw Error('R08 material is not installed');
    if (c.compiling) throw Error('Cannot change R08 mode during shader compilation');
    // Disabling remains possible if a later owner has wrapped this wrapper.
    // Enabling requires the exact material and both owned hook identities.
    if (mode !== 'r06' && (window.headProceduralSkin?.material?.() !== c.material || !hooksStable(c) || c.errors.length)) {
      throw Error('R08 material ownership changed; appearance remains unavailable');
    }
    if (c.mode !== mode) { c.mode = mode; c.material.needsUpdate = true; }
    return report();
  }
  function shaderEvidence() {
    const c = context;
    if (!c) return { installed: false, mode: null, compiledForCurrentMode: false };
    const e = c.evidence[c.mode];
    return e ? { installed: true, compiledForCurrentMode: true, ...structuredClone(e) } :
      { installed: true, mode: c.mode, compiledForCurrentMode: false, replacements: patches(c.mode) };
  }
  function report() {
    const c = context, same = !!c && window.headProceduralSkin?.material?.() === c.material, stable = !!c && hooksStable(c);
    return { version: VERSION, implementation: VERSION, installed: !!c?.installed, mode: c?.mode || 'r06',
      valid: !!c?.installed && same && stable && !c.errors.length, materialSameObject: same, hooksStable: stable,
      errors: c ? [...c.errors] : [], compileRecords: c ? structuredClone(c.records) : [],
      compiledForCurrentMode: !!c?.evidence[c.mode], lastRemoval: lastRemoval && { ...lastRemoval },
      newUniforms: 0, geometryChanged: false, originalAuthoringValuesChanged: false,
      newMeshes: 0, newImageMaps: 0, measuredOptics: false, physiologicalCalibration: false,
      boundaryMeaning: 'Shared exterior coverage includes colour, shader fine height, roughness and wet-film coverage; native geometry is unchanged',
      colourMeaning: 'Signed, rest-attached chroma and absorption-like appearance fields; unchanged palette and identity controls; not measured haemoglobin or melanin',
      visualAcceptance: false };
  }
  function uninstall() {
    const c = context;
    if (!c) return { installed: false, originalHooksRestored: true, mode: 'r06' };
    if (c.compiling) throw Error('Cannot remove R08 during shader compilation');
    c.mode = 'r06'; c.material.needsUpdate = true;
    const restored = {};
    for (const [name, wrapper, descriptor] of [['onBeforeCompile', c.compileWrapper, c.compileDescriptor], ['customProgramCacheKey', c.keyWrapper, c.keyDescriptor]]) {
      restored[name] = c.material[name] === wrapper;
      if (restored[name]) {
        if (descriptor) Object.defineProperty(c.material, name, descriptor);
        else if (!Reflect.deleteProperty(c.material, name)) throw Error('Cannot restore R08 material descriptor: ' + name);
      }
    }
    c.installed = false;
    lastRemoval = { installed: false, mode: 'r06', originalHooksRestored: restored.onBeforeCompile && restored.customProgramCacheKey,
      otherOwnersPreserved: true, restored };
    context = null;
    return structuredClone(lastRemoval);
  }
  window.__LIP_SURFACE_MATERIAL__ = Object.freeze({ version: VERSION, install, setMode, report, shaderEvidence, uninstall, transform, patches,
    modes: MODES, nativeUniformNames: NATIVE_UNIFORMS });
})();
