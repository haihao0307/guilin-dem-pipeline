/* R08: one reviewed local organization change on the original R06 lip material.
 * Retains native geometry, palette, coverage, roughness, wetness, light rig,
 * original authoring uniforms and the inherited screen-derivative normal path.
 * The organized finite-groove field is adapted from the separate historical
 * R03 experiment; R06 itself inherited R01 fine detail through R02, not R03.
 * Main/attached-branch amplitude is the reviewed engineering gain of 4.
 * Independent transverse strokes and micro coefficients are not multiplied.
 * This is a limited local readability change. Overall realism remains unresolved;
 * no calibrated tissue depths, measured optics or new anatomy are claimed.
 * No photograph, external mesh, image texture or lighting substitute is used.
 */
(function () {
  'use strict';
  const VERSION = 'native-lip-surface@2';
  const MODES = Object.freeze(['r08', 'r06']);
  const PATCH_IDS = Object.freeze(['organized-finite-grooves-main4']);
  // Only the known inherited function family may be replaced. Its native
  // half-width is read from each actual source, never fixed to a screenshot.
  const INHERITED_FOLDS = `float lrFolds(vec2 mm,float depth,float upper,float footprint){
 float spacing=1.05,cell=floor(mm.x/spacing),height=0.;
 for(int j=-1;j<=1;j++){
  float id=cell+float(j);vec2 k=vec2(id,upper*97.+23.);
  float a=lrHash(k),b=lrHash(k+17.7),c=lrHash(k+54.1),d=lrHash(k+91.3);
  float root=(id+.13+.74*a)*spacing;
  float start=.035+.18*b,end=.60+.36*c;
  float tangent=(a-.5)*.34+(root/__HALF_MM__)*.20;
  float center=root+tangent*(depth-.40)+(b-.5)*.18*depth*(1.-depth)*4.;
  float width=.035+.030*d,filterWidth=sqrt(width*width+footprint*footprint*.30);
  float along=smoothstep(start,start+.13,depth)*(1.-smoothstep(end-.17,end,depth));
  float delta=(mm.x-center)/filterWidth;
  float primary=-exp(-delta*delta)*along;
  float branchStart=.24+.20*c,branchEnd=min(.96,branchStart+.17+.18*a);
  float t=clamp((depth-branchStart)/max(.04,branchEnd-branchStart),0.,1.);
  float branchCenter=center+mix(-1.,1.,step(.5,d))*(.14+.26*b)*t*t*(3.-2.*t);
  float branchDelta=(mm.x-branchCenter)/(filterWidth*.72);
  float branch=-exp(-branchDelta*branchDelta)*smoothstep(0.,.2,t)*(1.-smoothstep(.72,1.,t));
  height+=(primary+.32*branch)*(.000005+.000006*c)*(width/filterWidth);
 }
 float crossField=lrNoise(mm*vec2(.47,3.0)+upper*41.);
 float crossFold=-pow(clamp((crossField-.48)*2.,0.,1.),3.)*.0000024;
 float micro=(lrNoise(mm*vec2(5.1,6.3)+upper*71.)-.5)*.0000016;
 float visibility=1.-smoothstep(.055,.34,footprint);
 return (height+crossFold+micro)*visibility*smoothstep(-.08,.12,depth)*(1.-smoothstep(.86,1.08,depth));
}`;
  // The two coordinate slots below come from the same source's lrEvaluate.
  // All other bytes match the reviewed r03-organization-main-4x experiment.
  const ORGANIZED_FOLDS = `float lrGrooveR03(float delta){return -exp(-delta*delta)*(1.-smoothstep(2.5,3.5,abs(delta)));}
float lrFolds(vec2 mm,float depth,float upper,float footprint){
 if(footprint>=.34)return 0.;
 float spanMM=max(1.,mix(lrInnerBottom(vFRest.x)-lrBottom(vFRest.x),lrTop(vFRest.x)-lrInnerTop(vFRest.x),upper)*1000.);
 float spacing=1.10,cell=floor(mm.x/spacing),height=0.;
 // At the largest visible footprint each root has <1.32 mm horizontal
 // support. Five cells cover that support on both sides of every cell edge.
 for(int j=-2;j<=2;j++){
  float id=cell+float(j);vec2 k=vec2(id,upper*113.+211.);
  float a=lrHash(k),b=lrHash(k+17.7),c=lrHash(k+54.1),d=lrHash(k+91.3);
  float root=(id+.12+.76*a)*spacing;
  if(lrHash(k+121.6)>=.18){
   float extent=mix(.12+.18*c,.30+.42*c,step(.42,lrHash(k+141.3)));
   float start=.035+(.92-extent)*b;
   float t=clamp((depth-start)/extent,0.,1.);
   float drift=(lrHash(k+159.7)-.5)*.72,bend=(lrHash(k+177.9)-.5)*.28;
   float center=root+drift*(t-.5)+bend*4.*t*(1.-t);
   float width=.045+.035*d,filterWidth=sqrt(width*width+footprint*footprint*.30);
   float endSoft=min(.48,max(.16,footprint/max(.05,extent*spanMM)));
   float along=smoothstep(0.,endSoft,t)*(1.-smoothstep(1.-endSoft,1.,t));
   float amplitude=(.000006+.000004*lrHash(k+193.4))*4.;
   height+=lrGrooveR03((mm.x-center)/filterWidth)*along*amplitude*(width/filterWidth);
   // A branch is optional and remains shallower and shorter than its parent.
   if(lrHash(k+219.8)<.35){
    float branchStart=.24+.26*lrHash(k+237.1),branchExtent=.22+.24*lrHash(k+253.6);
    float bt=clamp((t-branchStart)/branchExtent,0.,1.);
    float offset=mix(-1.,1.,step(.5,lrHash(k+277.2)))*(.10+.18*lrHash(k+293.5));
    float branchCenter=center+offset*bt*bt*(3.-2.*bt);
    float branchWidth=width*.70,branchFilter=sqrt(branchWidth*branchWidth+footprint*footprint*.30);
    float branchSoft=min(.48,max(.16,footprint/max(.05,extent*branchExtent*spanMM)));
    float branchAlong=smoothstep(0.,branchSoft,bt)*(1.-smoothstep(1.-branchSoft,1.,bt));
    height+=lrGrooveR03((mm.x-branchCenter)/branchFilter)*branchAlong*amplitude*.25*(branchWidth/branchFilter);
   }
  }
  // Independent short transverse/oblique segments use actual rest mm, not
  // normalized depth as a distance. Sample the rails at this segment's root.
  if(lrHash(k+313.9)<.45){
   float crossRoot=(id+.12+.76*lrHash(k+331.7))*spacing;
   float restX=__CENTRE_X__+crossRoot*.001;
   float inner=mix(lrInnerBottom(restX),lrInnerTop(restX),upper);
   float outer=mix(lrBottom(restX),lrTop(restX),upper);
   float crossY=(mix(inner,outer,.10+.78*lrHash(k+349.2))-__CENTRE_Y_SUBTRACT__)*1000.;
   float angle=(lrHash(k+367.4)-.5)*1.36;
   vec2 direction=vec2(cos(angle),sin(angle)),q=mm-vec2(crossRoot,crossY);
   float extent=.35+.50*lrHash(k+383.6),halfExtent=extent*.5;
   float endSoft=min(halfExtent,max(extent*.20,footprint*.55));
   float along=1.-smoothstep(halfExtent-endSoft,halfExtent,abs(dot(q,direction)));
   float width=.018+.018*lrHash(k+401.3),filterWidth=sqrt(width*width+footprint*footprint*.30);
   float delta=dot(q,vec2(-direction.y,direction.x))/filterWidth;
   height+=lrGrooveR03(delta)*along*(.000002+.0000015*lrHash(k+419.8))*(width/filterWidth);
  }
 }
 float micro=(lrNoise(mm*vec2(5.1,6.3)+upper*71.)-.5)*.0000016;
 float visibility=1.-smoothstep(.055,.34,footprint);
 return (height+micro)*visibility*smoothstep(-.08,.12,depth)*(1.-smoothstep(.86,1.08,depth));
}`;
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
  function oneMatch(text, pattern, name) {
    const hits = [...text.matchAll(pattern)];
    if (hits.length !== 1) throw Error('R08 requires exactly one inherited source contract: ' + name);
    return hits[0];
  }
  function readFunction(fragment, signature) {
    const start = fragment.indexOf(signature);
    if (start < 0 || fragment.indexOf(signature, start + signature.length) >= 0)
      throw Error('R08 requires exactly one inherited function: ' + signature);
    let depth = 1;
    for (let i = start + signature.length; i < fragment.length; i++) {
      if (fragment[i] === '{') depth++;
      else if (fragment[i] === '}' && --depth === 0) return fragment.slice(start, i + 1);
    }
    throw Error('R08 inherited function is incomplete: ' + signature);
  }
  function sourceContract(fragment) {
    if (typeof fragment !== 'string') throw Error('R08 requires the actual original fragment source');
    if (fragment.includes('float lrGrooveR03(')) throw Error('R08 organized appearance is already present');
    const from = readFunction(fragment, 'float lrFolds(vec2 mm,float depth,float upper,float footprint){');
    const evaluate = readFunction(fragment, 'void lrEvaluate(float oldMask){');
    const number = '[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?';
    const tangent = oneMatch(from, new RegExp('float tangent=\\(a-\\.5\\)\\*\\.34\\+\\(root/(' + number + ')\\)\\*\\.20;', 'g'), 'native half-width');
    if (from !== INHERITED_FOLDS.replace('__HALF_MM__', tangent[1]))
      throw Error('R08 inherited fine-detail function differs from the reviewed R01/R02 family');
    const mm = oneMatch(evaluate, new RegExp('vec2 mm=\\(vFRest\\.xy-vec2\\((' + number + '),(' + number + ')\\)\\)\\*1000\\.;', 'g'), 'rest-mm origin');
    const u = oneMatch(evaluate, new RegExp('float u=\\(vFRest\\.x-(' + number + ')\\)/(' + number + ');', 'g'), 'native horizontal coordinate');
    const centreX = Number(mm[1]), centreY = Number(mm[2]), halfWidthMM = Number(tangent[1]), halfWidthM = Number(u[2]);
    if (![centreX, centreY, halfWidthMM, halfWidthM, Number(u[1])].every(Number.isFinite) ||
        halfWidthMM <= 0 || halfWidthM <= 0 || Math.abs(centreX - Number(u[1])) > 1e-9 ||
        Math.abs(halfWidthMM - halfWidthM * 1000) > 1e-5)
      throw Error('R08 native coordinates or units do not agree');
    // Parenthesize only a negative subtraction operand. Positive default-role
    // coordinates retain the exact previously rendered experiment bytes.
    const cySubtract = mm[2][0] === '-' ? '(' + mm[2] + ')' : mm[2];
    const to = ORGANIZED_FOLDS.replace('__CENTRE_X__', mm[1]).replace('__CENTRE_Y_SUBTRACT__', cySubtract);
    return { patch: { id: PATCH_IDS[0], from, to }, binding: {
      source: 'Actual inherited lrEvaluate rest-mm origin and lrFolds native half-width',
      centreM: [centreX, centreY], halfWidthMM,
      coordinateLiterals: { centreX: mm[1], centreY: mm[2], halfWidthMM: tangent[1] },
      scaleConvention: 'Existing rest-space metres converted to millimetres',
      hardCodedScreenshotCoordinates: false
    } };
  }
  function patches(mode, originalFragment) {
    validMode(mode);
    if (mode === 'r06') return [];
    const source = originalFragment === undefined ? context?.inheritedFragment : originalFragment;
    if (typeof source !== 'string') throw Error('R08 patches require an actual original fragment before compilation');
    return [{ ...sourceContract(source).patch }];
  }
  function applyPatches(fragment, replacements) {
    let result = fragment;
    for (const p of replacements) {
      if (result.split(p.from).length !== 2) throw Error('R08 requires exactly one inherited anchor: ' + p.id);
      if (result.includes(p.to)) throw Error('R08 appearance was already installed: ' + p.id);
      result = result.replace(p.from, () => p.to);
    }
    return result;
  }
  function transform(fragment, mode) {
    if (typeof fragment !== 'string') throw Error('R08 expects an actual inherited fragment shader');
    return applyPatches(fragment, patches(mode, fragment));
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
      records: [], evidence: {}, inheritedFragment: null, errors: [], compiling: false };
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
        const contract = c.mode === 'r08' ? sourceContract(originalFragment) : null;
        const replacements = contract ? [{ ...contract.patch }] : [];
        const finalFragment = applyPatches(originalFragment, replacements);
        shader.fragmentShader = finalFragment;
        if (shader.vertexShader !== originalVertex || Object.keys(shader.uniforms).length !== uniformEntries.length ||
            uniformEntries.some(([name, value]) => shader.uniforms[name] !== value)) {
          throw Error('R08 modified inherited shader inputs outside the declared fragment patch');
        }
        c.inheritedFragment = originalFragment;
        c.evidence[c.mode] = { mode: c.mode, originalVertex, finalVertex: shader.vertexShader,
          originalFragment, finalFragment, replacements, coordinateBinding: contract?.binding || null };
        c.records.push({ sequence: c.records.length + 1, mode: c.mode, replacements: replacements.map(p => p.id),
          coordinateBinding: contract?.binding || null,
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
      { installed: true, mode: c.mode, compiledForCurrentMode: false,
        replacements: c.mode === 'r06' || !c.inheritedFragment ? [] : patches(c.mode, c.inheritedFragment),
        sourceRequired: c.mode === 'r08' && !c.inheritedFragment };
  }
  function report() {
    const c = context, same = !!c && window.headProceduralSkin?.material?.() === c.material, stable = !!c && hooksStable(c);
    return { version: VERSION, implementation: VERSION, installed: !!c?.installed, mode: c?.mode || 'r06',
      valid: !!c?.installed && same && stable && !c.errors.length, materialSameObject: same, hooksStable: stable,
      errors: c ? [...c.errors] : [], compileRecords: c ? structuredClone(c.records) : [],
      compiledForCurrentMode: !!c?.evidence[c.mode], lastRemoval: lastRemoval && { ...lastRemoval },
      newUniforms: 0, geometryChanged: false, originalAuthoringValuesChanged: false,
      newMeshes: 0, newImageMaps: 0, measuredOptics: false, physiologicalCalibration: false,
      boundaryMeaning: 'Exact inherited R06 exterior coverage, pigment transition and tissue colour',
      detailMeaning: 'Organized finite grooves; reviewed main/attached-branch gain 4; unchanged transverse/micro amplitudes and native screen derivatives',
      patchIds: [...PATCH_IDS], modes: [...MODES],
      coordinateBinding: c?.evidence.r08?.coordinateBinding ? structuredClone(c.evidence.r08.coordinateBinding) : null,
      coordinatePolicy: 'Derive from the actual inherited shader; fail closed if the reviewed function/coordinate contract differs',
      originalNormalDerivativePreserved: true, overallRealismResolved: false,
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
    modes: MODES, patchIds: PATCH_IDS, nativeUniformNames: NATIVE_UNIFORMS });
})();
