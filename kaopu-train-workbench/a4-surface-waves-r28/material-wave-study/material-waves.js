/* Original analytic shading-only wave study. No images, meshes, or field edits. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ANALYTIC_MATERIAL_WAVES = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const norm = a => Math.hypot(...a);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const unit = a => { const n = norm(a); if (!(n > 0)) throw Error('Nonzero geometric normal required'); return a.map(x => x / n); };
  const wave = (amplitude, k, phase, modulation, l, modulationPhase) => ({amplitude, k, phase, modulation, l, modulationPhase});
  // k and l are radians/metre. Amplitudes are virtual shading heights in metres,
  // not physical displacement, measured finish, a wear simulation, or an A4 claim.
  const presets = {
    neutral: {albedo: [0.56, 0.62, 0.65], roughness: 0.62, metallic: 0, maxSlope: 0.008, albedoVariation: 0.025, roughnessVariation: 0.014, waves: [
      wave(0.000012, [1.7, 0.6, 0.8], 0.7, 0.15, [0.3, 0.7, 0.2], 1.1),
      wave(0.000005, [17, 7, 11], 1.6, 0.12, [2, 1, 3], 0.4),
      wave(0.000002, [101, 23, 41], 2.2, 0.08, [3, 7, 2], 0.9)]},
    steel: {albedo: [0.48, 0.51, 0.54], roughness: 0.42, metallic: 0.95, maxSlope: 0.012, albedoVariation: 0.018, roughnessVariation: 0.012, waves: [
      wave(0.000004, [430, 27, 13], 0.3, 0.18, [3, 17, 5], 0.7),
      wave(0.000002, [31, 97, 23], 1.1, 0.12, [5, 2, 13], 0.2),
      wave(0.000001, [11, 37, 251], 2.2, 0.08, [7, 3, 2], 1.0)]},
    copper: {albedo: [0.66, 0.32, 0.19], roughness: 0.38, metallic: 0.95, maxSlope: 0.012, albedoVariation: 0.020, roughnessVariation: 0.012, waves: [
      wave(0.000005, [41, 281, 19], 0.2, 0.20, [11, 2, 7], 1.0),
      wave(0.000003, [127, 13, 31], 1.7, 0.16, [3, 7, 13], 0.4),
      wave(0.000001, [17, 23, 367], 0.8, 0.08, [5, 11, 2], 1.5)]},
    brass: {albedo: [0.67, 0.52, 0.23], roughness: 0.34, metallic: 0.95, maxSlope: 0.010, albedoVariation: 0.018, roughnessVariation: 0.010, waves: [
      wave(0.000004, [317, 11, 23], 0.6, 0.16, [3, 13, 7], 0.8),
      wave(0.000002, [19, 73, 149], 1.9, 0.10, [11, 5, 2], 0.3),
      wave(0.000001, [61, 229, 7], 2.4, 0.08, [2, 7, 11], 0.9)]},
    wood: {albedo: [0.25, 0.13, 0.065], roughness: 0.76, metallic: 0, maxSlope: 0.025, albedoVariation: 0.035, roughnessVariation: 0.018, waves: [
      wave(0.000025, [210, 7, 5], 0.4, 0.38, [3, 2, 11], 0.9),
      wave(0.000010, [401, 3, 11], 1.3, 0.24, [7, 2, 5], 0.4),
      wave(0.000004, [17, 67, 13], 2.1, 0.15, [2, 3, 7], 1.7)]},
    // Dormant until a separately evidenced exposed fluid surface exists.
    water: {albedo: [0.08, 0.16, 0.19], roughness: 0.12, metallic: 0, maxSlope: 0.020, albedoVariation: 0.010, roughnessVariation: 0.008, waves: [
      wave(0.000080, [19, 0, 11], 0.5, 0.15, [2, 0, 3], 0.4),
      wave(0.000040, [7, 0, 37], 1.2, 0.12, [3, 0, 2], 1.1),
      wave(0.000020, [47, 0, 17], 2.0, 0.08, [1, 0, 5], 0.3)]},
    // No transparency/refraction is supplied by this small shading module.
    glass: {albedo: [0.32, 0.39, 0.41], roughness: 0.10, metallic: 0, maxSlope: 0.005, albedoVariation: 0.004, roughnessVariation: 0.004, waves: [
      wave(0.0000005, [37, 23, 17], 0.1, 0.08, [2, 3, 5], 0.7),
      wave(0.0000003, [13, 71, 31], 1.6, 0.06, [5, 2, 3], 1.2),
      wave(0.0000002, [59, 11, 43], 2.3, 0.04, [3, 5, 2], 0.2)]}
  };
  // Low-frequency finish component remains resolvable in the WHOLE train view.
  // It is not a geometric wrinkle, livery inference, or measured roughness.
  // Neutral surfaces carry a declared unclassified signal, not zero detail.
  for (const name of ['steel', 'copper', 'wood']) {
    presets[name].waves.push(wave(0.000018, [1.4, 0.5, 1.1], 0.85, 0.16, [0.4, 0.3, 0.6], 0.5));
  }
  const waveCount = 4;
  function freezeDeep(x) { Object.values(x).forEach(v => { if (v && typeof v === 'object') freezeDeep(v); }); return Object.freeze(x); }
  freezeDeep(presets);
  const names = Object.freeze(Object.keys(presets));
  function material(nameOrVariables) {
    const m = typeof nameOrVariables === 'string' ? presets[nameOrVariables] : nameOrVariables;
    if (!m) throw Error('Unknown material preset');
    return m;
  }
  function bounds(nameOrVariables) {
    const m = material(nameOrVariables);
    return {
      height: m.waves.reduce((s, w) => s + Math.abs(w.amplitude), 0),
      gradient: m.waves.reduce((s, w) => s + Math.abs(w.amplitude) * (norm(w.k) + Math.abs(w.modulation) * norm(w.l)), 0),
      normalAngleRadians: Math.atan(m.maxSlope),
      relativeAlbedoVariation: m.albedoVariation,
      absoluteRoughnessVariation: m.roughnessVariation
    };
  }
  function waveValueGradient(q, nameOrVariables, detailWeight = 1) {
    const m = material(nameOrVariables);
    if (!q || q.length !== 3 || !q.every(Number.isFinite)) throw Error('Finite three-component material-local point required');
    if (!Number.isFinite(detailWeight) || detailWeight < 0 || detailWeight > 1) throw Error('detailWeight must be in [0,1]');
    let height = 0; const gradient = [0, 0, 0];
    for (const w of m.waves) {
      const v = dot(w.l, q) + w.modulationPhase;
      const s = dot(w.k, q) + w.phase + w.modulation * Math.sin(v);
      height += w.amplitude * Math.sin(s);
      for (let j = 0; j < 3; j++) gradient[j] += w.amplitude * Math.cos(s) * (w.k[j] + w.modulation * Math.cos(v) * w.l[j]);
    }
    return {height: height * detailWeight, gradient: gradient.map(v => v * detailWeight)};
  }
  function perturbNormal(normalWorld, gradientWorld, maxSlope) {
    const n = unit(normalWorld), d = dot(n, gradientWorld);
    const tangent = gradientWorld.map((v, j) => v - n[j] * d);
    const scale = norm(tangent) > maxSlope ? maxSlope / norm(tangent) : 1;
    return unit(n.map((v, j) => v - scale * tangent[j]));
  }
  function shadingSample(q, normalWorld, inverseRows, nameOrVariables, detailWeight = 1) {
    const m = material(nameOrVariables), w = waveValueGradient(q, m, detailWeight), b = bounds(m);
    // q = J * pWorld + offset. A scalar gradient is a covector: J^T * grad(q).
    const g = [0, 1, 2].map(j => inverseRows.reduce((s, row, k) => s + row[j] * w.gradient[k], 0));
    const signal = b.height > 0 ? w.height / b.height : 0;
    return {
      virtualHeight: w.height,
      normal: perturbNormal(normalWorld, g, m.maxSlope),
      albedo: m.albedo.map(v => clamp(v * (1 + m.albedoVariation * signal), 0, 1)),
      roughness: clamp(m.roughness + m.roughnessVariation * signal, 0.04, 1),
      metallic: m.metallic,
      geometryDisplacement: 0
    };
  }
  function assignMaterial(part) {
    const id = part.id;
    const result = (preset, basis, note) => ({preset, materialIndex: names.indexOf(preset), basis, note});
    if (/(?:^|_)copper(?:_|$)/.test(id.split('/').pop())) return result('copper', 'explicit-part-label', 'Copper named in field ID; appearance remains a study preset.');
    if (/(?:^|_)wood(?:_|$)/.test(id.split('/').pop())) return result('wood', 'explicit-part-label', 'Wood named in field ID; no species, grain direction or real finish claimed.');
    if (/(?:^|_)steel(?:_|$)/.test(id.split('/').pop())) return result('steel', 'explicit-part-label', 'Steel named in field ID; no alloy or real finish claimed.');
    // Brass, glass and water are deliberately NOT guessed from valves, pipes,
    // oil cups, boiler internals or empty space. Bronze is not called brass.
    if (/rubber|bronze|packing|seal|bushing|oil_cup|hose/.test(id)) return result('neutral', 'unclassified-default', 'Mixed or unresolved material; source diagnostic color with an unclassified analytic finish, not a steel assertion.');
    if (part.source === 'stack') return result('steel', 'declared-stack-role-assumption', 'Generic inferred mechanism study; stack frame and declared role do not establish alloy, finish or historical material.');
    if (['frame', 'wheel', 'drive', 'actuation', 'valve', 'wheel_attachment'].includes(part.group)) return result('steel', 'declared-role-assumption', 'Generic structural/mechanism steel study, not verified component material or historic livery.');
    return result('neutral', 'unclassified-default', 'No field-specific material evidence; do not infer material from source diagnostic color.');
  }
  const glslNumber = n => Number.isInteger(n) ? n.toFixed(1) : String(n);
  const glslVec = a => `vec3(${a.map(glslNumber).join(',')})`;
  function generateGLSL() {
    const cases = names.map((name, id) => {
      const m = presets[name];
      const entries = Array.from({length: waveCount}, (_, i) => m.waves[i] || wave(0, [0, 0, 0], 0, 0, [0, 0, 0], 0));
      return `  if (id == ${id}) {\n    m.albedo = ${glslVec(m.albedo)}; m.roughness = ${glslNumber(m.roughness)}; m.metallic = ${glslNumber(m.metallic)};\n    m.maxSlope = ${glslNumber(m.maxSlope)}; m.albedoVariation = ${glslNumber(m.albedoVariation)}; m.roughnessVariation = ${glslNumber(m.roughnessVariation)};\n${entries.map((w, i) => `    m.waves[${i}] = MWWave(${glslNumber(w.amplitude)}, ${glslVec(w.k)}, ${glslNumber(w.phase)}, ${glslNumber(w.modulation)}, ${glslVec(w.l)}, ${glslNumber(w.modulationPhase)});`).join('\n')}\n    return m;\n  }`;
    }).join('\n');
    return `// ORIGINAL SHADING-ONLY WAVES. Generated from material-waves.js.\n// Include after precision highp float; precision highp int; in GLSL ES 3.00.\n// No time, texture, geometry displacement, field, depth, opacity or collision edits.\nstruct MWWave { float amplitude; vec3 k; float phase; float modulation; vec3 l; float modulationPhase; };\nstruct MWMaterial { vec3 albedo; float roughness; float metallic; float maxSlope; float albedoVariation; float roughnessVariation; MWWave waves[4]; };\nstruct MWValue { float height; vec3 gradient; float heightBound; };\nstruct MWShading { vec3 normal; vec3 albedo; float roughness; float metallic; };\nMWMaterial mwPreset(int id) {\n  MWMaterial m;\n${cases}\n  // Unknown ID falls back to a deterministic neutral, not uninitialized data.\n  m.albedo=vec3(.56,.62,.65); m.roughness=.62; m.metallic=0.; m.maxSlope=0.; m.albedoVariation=0.; m.roughnessVariation=0.;\n  for(int i=0;i<4;i++)m.waves[i]=MWWave(0.,vec3(0.),0.,0.,vec3(0.),0.);\n  return m;\n}\nMWValue mwHeightGradient(vec3 q, MWMaterial m, float detailWeight) {\n  MWValue w; w.height=0.; w.gradient=vec3(0.); w.heightBound=0.;\n  for(int i=0;i<4;i++) {\n    MWWave a=m.waves[i]; float v=dot(a.l,q)+a.modulationPhase;\n    float phase=dot(a.k,q)+a.phase+a.modulation*sin(v);\n    w.height+=a.amplitude*sin(phase);\n    w.gradient+=a.amplitude*cos(phase)*(a.k+a.modulation*cos(v)*a.l);\n    w.heightBound+=abs(a.amplitude);\n  }\n  w.height*=clamp(detailWeight,0.,1.); w.gradient*=clamp(detailWeight,0.,1.);\n  return w;\n}\nvec3 mwNormal(vec3 normalWorld, vec3 gradientWorld, float maxSlope) {\n  vec3 n=normalize(normalWorld); vec3 t=gradientWorld-n*dot(n,gradientWorld);\n  float slope=length(t); if(slope>maxSlope)t*=maxSlope/max(slope,1e-20);\n  return normalize(n-t);\n}\nMWShading mwShade(vec3 q, vec3 normalWorld, mat3 worldToMaterialLinear, MWMaterial m, float detailWeight) {\n  MWValue w=mwHeightGradient(q,m,detailWeight);\n  float signal=w.heightBound>0.?w.height/w.heightBound:0.;\n  MWShading s; s.normal=mwNormal(normalWorld,transpose(worldToMaterialLinear)*w.gradient,m.maxSlope);\n  s.albedo=clamp(m.albedo*(1.+m.albedoVariation*signal),0.,1.);\n  s.roughness=clamp(m.roughness+m.roughnessVariation*signal,.04,1.); s.metallic=m.metallic; return s;\n}\n// Rows uploaded by rigid-coordinates.js, from the SAME mechanical snapshot.\n// q_i=dot(inverseRow_i.xyz,pWorld)+inverseRow_i.w.\nvec3 mwLocalPoint(vec3 pWorld,vec4 row0,vec4 row1,vec4 row2) {\n  vec4 p=vec4(pWorld,1.); return vec3(dot(row0,p),dot(row1,p),dot(row2,p));\n}\nmat3 mwInverseLinear(vec4 row0,vec4 row1,vec4 row2) {\n  return transpose(mat3(row0.xyz,row1.xyz,row2.xyz));\n}\n// View-only detail weight. Exact gradient above is with this weight held fixed.\n// Bound phase excursion across each pixel; no time-dependent material phase.\nfloat mwDetailWeight(MWMaterial m,vec3 dqdx,vec3 dqdy) {\n  float excursion=0.;\n  for(int i=0;i<4;i++){MWWave a=m.waves[i];if(a.amplitude==0.)continue;\n    float x=abs(dot(a.k,dqdx))+abs(a.modulation)*abs(dot(a.l,dqdx));\n    float y=abs(dot(a.k,dqdy))+abs(a.modulation)*abs(dot(a.l,dqdy));\n    excursion=max(excursion,x+y);}\n  return 1.-smoothstep(.78539816339,1.57079632679,excursion);\n}\n`;
  }
  return Object.freeze({presets, names, waveCount, bounds, waveValueGradient, perturbNormal, shadingSample, assignMaterial, generateGLSL});
});
