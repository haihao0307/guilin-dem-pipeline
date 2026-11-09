/* LIP-INNER-R04 candidate: restore native oral-skin material responsibility.
 * Applies after the frozen R02 LipSurface.js hook, on the same shared material.
 * No geometry, groups, attributes, DNA values, textures or light rig are edited.
 *
 * Source: frozen human-integrated-r07/preview.html, SHA256
 * d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a.
 * Ow / F5 / U5 provide the native palette, upper/lower anatomy, roughness,
 * coat and mouth-depth visibility expressions. R07 C2 pcBoundary() already
 * computes Ow's skin base before lip colour, in linear light; reuse pcBase.
 *
 * This is the pure-mucosa endpoint of those source expressions, blended ONCE
 * with the inherited R02 result by the continuous native l19State.x semantic.
 * The old exterior atlas, dry patches, outer fade and decorative mottling are
 * deliberately not transplanted into the oral interior. The coefficients are
 * inherited appearance approximations, not measured tissue optics or volume
 * scattering. In particular l19Detail.w is normalized mouth-forward depth,
 * not a measured light path or anatomical thickness.
 */
(() => {
  'use strict';

  const VERSION = 'continuous-native-mucosa@1';
  const MARKER = '// LIP-INNER-R04 continuous native oral responsibility';
  const REQUIRED_NATIVE_UNIFORMS = Object.freeze([
    'csTone', 'csLipColor', 'csLipMix', 'csRoughness', 'csOil',
    'uLEnabled', 'uLPigment', 'uLUpperShade', 'uLWet', 'uLRough',
    'uL19Mel', 'uL19Blood', 'uL19Rough', 'uL19Wet', 'uL19Oxygen'
  ]);

  function once(source, anchor, replacement) {
    if (source.split(anchor).length !== 2) {
      throw Error('R04 mucosa integration anchor changed: ' + anchor);
    }
    return source.replace(anchor, () => replacement);
  }

  function declared(source, storage, type, name) {
    const pattern = new RegExp('\\b' + storage + '\\s+(?:(?:lowp|mediump|highp)\\s+)?' + type + '\\s+([^;]+);', 'g');
    for (const match of source.matchAll(pattern)) {
      if (match[1].split(',').some(field => field.trim() === name)) return true;
    }
    return false;
  }

  function apply(shader, uniforms) {
    if (!shader || typeof shader.fragmentShader !== 'string' || !shader.uniforms) {
      throw Error('R04 expects the compiled inherited shader contract');
    }
    const original = shader.fragmentShader;
    if (original.includes(MARKER)) throw Error('R04 mucosa hook applied twice');
    for (const key of ['liEnabled', 'liDiagnostic']) {
      if (!uniforms?.[key] || !Number.isFinite(uniforms[key].value)) {
        throw Error('R04 control uniform missing: ' + key);
      }
    }
    // These are the actual original live uniform objects copied by R07's
    // vertexContract. Never synthesize fallbacks or clone their current values.
    for (const key of REQUIRED_NATIVE_UNIFORMS) {
      if (!shader.uniforms[key] || !('value' in shader.uniforms[key])) {
        throw Error('R04 lost the original native uniform object: ' + key);
      }
    }
    for (const [storage, type, name] of [
      ['varying', 'vec3', 'vFRest'], ['varying', 'vec4', 'vCSRegion'],
      ['varying', 'vec4', 'vL19State'], ['varying', 'vec4', 'vL19Detail'],
      ['uniform', 'vec3', 'csTone'], ['uniform', 'float', 'csRoughness'],
      ['uniform', 'float', 'csOil']
    ]) {
      if (!declared(original, storage, type, name)) {
        throw Error('R04 inherited declaration missing: ' + name);
      }
    }
    for (const anchor of ['float lrInnerTop(', 'float lrInnerBottom(', 'vec3 pcBase=pcBoundary();']) {
      if (!original.includes(anchor)) throw Error('R04 requires frozen R02 native rails/base: ' + anchor);
    }
    if (!declared(shader.vertexShader || '', 'varying', 'float', 'vCSType')) {
      throw Error('R04 original vertex shader no longer supplies csType');
    }

    let declarations = MARKER + '\n';
    // C2 already declares csTone/csRoughness/csOil. Add only native fields that
    // R07 discarded from its fragment while retaining their live uniforms.
    for (const [storage, type, names] of [
      ['varying', 'float', ['vCSType']],
      ['uniform', 'vec3', ['csLipColor']],
      ['uniform', 'float', ['csLipMix', 'uLEnabled', 'uLPigment', 'uLUpperShade', 'uLWet', 'uLRough', 'uL19Oxygen']],
      ['uniform', 'vec2', ['uL19Mel', 'uL19Blood', 'uL19Rough', 'uL19Wet']],
      ['uniform', 'float', ['liEnabled', 'liDiagnostic']]
    ]) {
      const missing = names.filter(name => !declared(original, storage, type, name));
      if (missing.length) declarations += storage + ' ' + type + ' ' + missing.join(',') + ';\n';
    }
    declarations += 'float liOral=0.,liWeight=0.,liWetGain=0.;\n';
    const main = original.match(/void\s+main\s*\(\s*\)\s*\{/g);
    if (main?.length !== 1) throw Error('R04 expects one inherited fragment main');
    let fragment = once(original, main[0], declarations + '\n' + main[0]);

    fragment = once(fragment, 'roughnessFactor=psR;', `
 // Semantic ownership is independent of external lip silhouette and camera.
 // csType guards teeth/gums/tongue; the shared procedural slot is skin-only.
 liOral=clamp(vL19State.x,0.,1.)*clamp(vCSRegion.x,0.,1.)*(1.-step(.5,vCSType));
 liWeight=liEnabled>.5?liOral*clamp(uLEnabled,0.,1.):0.;
 if(liWeight>0.){
  // The original inner rails define upper/lower throughout the mouth.
  // vL19Detail.z is incomplete on deep oral vertices and is not used here.
  float liUpper=step((lrInnerTop(vFRest.x)+lrInnerBottom(vFRest.x))*.5,vFRest.y);
  float liMel=mix(uL19Mel.x,uL19Mel.y,liUpper);
  float liBlood=mix(uL19Blood.x,uL19Blood.y,liUpper);
  liWetGain=clamp(uLWet/.35*mix(uL19Wet.x,uL19Wet.y,liUpper),0.,1.);
  vec3 liColor=mix(pcBase,csLipColor,clamp(csLipMix*(.43+uLPigment*.30+liBlood*.25),0.,.94));
  liColor*=exp(-liMel*vec3(.20,.31,.42));
  liColor*=vec3(1.+liBlood*.10,1.-liBlood*.10,1.-liBlood*(.035+.06*uL19Oxygen));
  liColor*=1.-liUpper*uLUpperShade*.14+(1.-liUpper)*.022;
  // U5's full mucosa tint. Coverage belongs to liWeight, not the target colour.
  liColor=mix(liColor,liColor*vec3(.83,.67,.68),.72);
  liColor=mix(liColor,pcBase*1.04,clamp(vL19State.w*.25,0.,.3));
  psBase=mix(psBase,liColor,liWeight);
  diffuseColor.rgb=psBase;
  float liRough=clamp(mix(uL19Rough.x,uL19Rough.y,liUpper)+(uLRough-.53)*.65+(csRoughness-.62)*.30-liWetGain*.21,.28,.79);
  psR=mix(psR,liRough,liWeight);
  // R07's follicle/skin height has no oral ownership. Fade that shader field
  // out continuously; preserve mesh normals and all native geometric folds.
  // The inherited dFdx/dFdy normal evaluation still has its usual quad support.
  psH*=1.-liWeight;
 }
 roughnessFactor=psR;`);

    // This anchor follows the R02 coat block and material initialization.
    // Inserting at clearcoatNormal=normal would be overwritten by R02.
    fragment = once(fragment, '#include <lights_fragment_begin>', `
 #ifdef USE_CLEARCOAT
 if(liWeight>0.){
  material.clearcoat=mix(material.clearcoat,.010+csOil*.025+liWetGain*.32,liWeight);
  material.clearcoatRoughness=mix(material.clearcoatRoughness,.43-liWetGain*.24,liWeight);
 }
 #endif
 #include <lights_fragment_begin>`);

    fragment = once(fragment, 'if(psView>.5&&psView<1.5)outgoingLight=psBase;', `
 // Preserve U5's bounded visibility approximation only on the oral-skin domain.
 // Do this before every existing diagnostic override, not after those views.
 if(liWeight>0.){
  float liVisibility=.12+.88*exp(-max(0.,vL19Detail.w)*120.);
  outgoingLight*=mix(1.,liVisibility,liWeight);
 }
 if(psView>.5&&psView<1.5)outgoingLight=psBase;`);

    fragment = once(fragment, '#include <opaque_fragment>', `
 // Identity remains available in both R04 and R02 comparison modes.
 // Purple identifies continuous oral SKIN; unchanged native teeth are not it.
 // Fixed native debug colours keep this view independent of beauty settings.
 if(liDiagnostic>.5)outgoingLight=mix(vec3(.35,.40,.45),vec3(.22,.08,.46),liOral);
 #include <opaque_fragment>`);

    // Publish only after every anchor/contract check succeeded. Native uniform
    // identities and values remain untouched; only the two R04 handles are added.
    shader.uniforms.liEnabled = uniforms.liEnabled;
    shader.uniforms.liDiagnostic = uniforms.liDiagnostic;
    shader.fragmentShader = fragment;
    return fragment;
  }

  window.__LIP_INNER_SHADER__ = Object.freeze({
    version: VERSION,
    apply,
    nativeUniformNames: REQUIRED_NATIVE_UNIFORMS,
    requiredNativeUniforms: REQUIRED_NATIVE_UNIFORMS,
    measuredOptics: false,
    identityMeaning: 'purple = native continuous oral-skin semantic; native teeth/gums/tongue retain their own material'
  });
})();
