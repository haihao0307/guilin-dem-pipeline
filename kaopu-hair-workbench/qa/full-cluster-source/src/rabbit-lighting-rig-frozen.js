/* Bounded candidate lighting transfer, independent of either object's camera.
 * The RGB values below are artistic intensities, NOT Kelvin temperatures.
 * Source: haihao0307/guilin-dem-pipeline, f048def853b70e2347a8ad3308d714c9d0f1dd90,
 * kaopu-material-workbench/lab-r13/wet-material.frag, lines 378–392.
 * Source lamp radiance is unchanged. DISPLAY_GAIN is a material-transfer scale
 * for the existing SEDDI/KuKo display pipelines, not a change to the source rig.
 */
(function (root) {
  'use strict';
  const VERSION = 1, MODEL = 'r13-two-side-rgb-v1', DISPLAY_GAIN = 0.08;
  const SOURCE = 'https://github.com/haihao0307/guilin-dem-pipeline/blob/f048def853b70e2347a8ad3308d714c9d0f1dd90/kaopu-material-workbench/lab-r13/wet-material.frag#L378-L392';
  const DEFAULTS = Object.freeze({version: VERSION, model: MODEL, mode: 'side', warmPower: 1, coolPower: 1});
  const LEGACY = Object.freeze({...DEFAULTS, mode: 'legacy'});
  const ANEMONE_BOUNDS = Object.freeze({center: Object.freeze([0, .55, 0]), radius: 1.5});
  const normalize = v => { const length = Math.hypot(...v); return v.map(x => x / length); };
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const LAMPS = Object.freeze([
    Object.freeze({name: 'warm', position: Object.freeze(normalize([1, .6, .1]).map(x => x * 4)), color: Object.freeze([40, 30, 20])}),
    Object.freeze({name: 'cool', position: Object.freeze(normalize([-1, .3, -.3]).map(x => x * 4)), color: Object.freeze([5.6, 8.4, 12.6])})
  ]);
  function record(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(name + ' must be a plain object');
    // State may cross the host/iframe realm through the public runtime API.
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && (Object.getPrototypeOf(proto) !== null || proto.constructor?.name !== 'Object')) throw Error(name + ' must be a plain object');
  }
  // Strict complete extension validation is suitable for preflight before ANY
  // outer document mutation. The host retains ownership of its v1/v2/v3 schema.
  function validateState(value) {
    record(value, 'Lighting');
    const keys = Object.keys(DEFAULTS);
    for (const key of Object.keys(value)) if (!keys.includes(key)) throw Error('Unknown lighting field: ' + key);
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) throw Error('Missing lighting field: ' + key);
    if (value.version !== VERSION || value.model !== MODEL) throw Error('Unsupported lighting version or model');
    if (!['side', 'legacy'].includes(value.mode)) throw Error('Lighting mode must be side or legacy');
    for (const key of ['warmPower', 'coolPower']) if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 2) throw Error(key + ' must be within 0..2');
    return {...value};
  }
  function validatePatch(value, current = DEFAULTS) {
    record(value, 'Lighting patch');
    return validateState({...validateState(current), ...value});
  }
  function createController(initial = DEFAULTS) {
    let state = Object.freeze(validateState(initial));
    return Object.freeze({
      getState: () => ({...state}),
      setState(value) { const next = validateState(value); state = Object.freeze(next); return {...state}; },
      patch(value) { const next = validatePatch(value, state); state = Object.freeze(next); return {...state}; }
    });
  }
  function validateBounds(value) {
    if (!value || !Array.isArray(value.center) || value.center.length !== 3 || value.center.some(x => typeof x !== 'number' || !Number.isFinite(x)) || typeof value.radius !== 'number' || !Number.isFinite(value.radius) || value.radius <= 0) throw Error('Lighting bounds need a finite center and positive radius');
    return {center: value.center.slice(), radius: value.radius};
  }
  function boundsFromVertices(vertices) {
    if ((!Array.isArray(vertices) && !ArrayBuffer.isView(vertices)) || vertices.length < 3 || vertices.length % 3) throw Error('Invalid source model vertices');
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertices.length; i++) { const x = vertices[i], j = i % 3; if (typeof x !== 'number' || !Number.isFinite(x)) throw Error('Invalid source model coordinate'); low[j] = Math.min(low[j], x); high[j] = Math.max(high[j], x); }
    const center = low.map((x, i) => (x + high[i]) / 2); let radius = 0;
    for (let i = 0; i < vertices.length; i += 3) radius = Math.max(radius, Math.hypot(vertices[i] - center[0], vertices[i + 1] - center[1], vertices[i + 2] - center[2]));
    return validateBounds({center, radius});
  }
  function boundsFromModelJSON(model) {
    const data = typeof model === 'string' ? JSON.parse(model) : model;
    return boundsFromVertices(data?.meshes?.[0]?.vertices);
  }
  // CPU reference is deliberately the same equation as GLSL, for regression
  // tests and debugging. E is raw source irradiance, before DISPLAY_GAIN.
  function sampleLamp(p, index, state = DEFAULTS) {
    if (!Array.isArray(p) || p.length !== 3 || p.some(x => !Number.isFinite(x)) || !Number.isInteger(index) || index < 0 || index > 1) throw Error('Invalid R13 lamp sample');
    const valid = validateState(state), lamp = LAMPS[index];
    const d = lamp.position.map((x, i) => x - p[i]), distance2 = dot(d, d);
    const L = distance2 > 0 ? normalize(d) : [0, 0, 0];
    const cone = Math.pow(Math.max(dot(L, normalize(lamp.position)), 0), 12);
    const power = index === 0 ? valid.warmPower : valid.coolPower;
    return {L, E: lamp.color.map(x => x * cone * 5 / Math.max(distance2, 1e-5) * power), distance2, cone};
  }
  const glsl = `
// r13SideLighting: exact artistic RGB lamp equation from pinned rocks01/02 rig.
uniform int r13LightingMode;
uniform highp vec2 r13Powers;
const highp float r13DisplayGain = ${DISPLAY_GAIN.toFixed(8)};
void r13SideLamp(int lamp, highp vec3 p, out highp vec3 L, out highp vec3 E) {
  highp vec3 P = 4.0 * normalize(lamp == 0 ? vec3(1.0, 0.6, 0.1) : vec3(-1.0, 0.3, -0.3));
  highp vec3 C = lamp == 0 ? vec3(40.0, 30.0, 20.0) : vec3(5.6, 8.4, 12.6);
  highp vec3 d = P - p;
  L = normalize(d);
  E = C * pow(max(dot(L, normalize(P)), 0.0), 12.0) * 5.0 / max(dot(d, d), 1e-5);
  E *= lamp == 0 ? r13Powers.x : r13Powers.y;
}
`;
  function once(source, anchor, replacement, label) {
    if (typeof source !== 'string' || source.split(anchor).length !== 2) throw Error('Lighting adapter does not match pinned ' + label);
    return source.replace(anchor, replacement);
  }
  function afterPrecision(source, addition, label) {
    const matches = typeof source === 'string' ? source.match(/precision\s+(?:highp|mediump)\s+float\s*;/g) : null;
    if (!matches || matches.length !== 1) throw Error('Lighting adapter missing precision in ' + label);
    return once(source, matches[0], matches[0] + '\n' + addition, label);
  }
  // Deliberately transform only materialFragment. Original baseline fragment,
  // depth peeling, alpha, geometry, tissue colors and camera remain untouched.
  function transformAnemoneMaterialFragment(source) {
    if (typeof source !== 'string' || source.includes('r13SideLighting')) throw Error('Anemone lighting adapter already installed or source invalid');
    source = afterPrecision(source, glsl + `
uniform highp vec3 r13Center;uniform highp float r13Radius;
// A bounded, world-space bulk attenuation proxy for this fixed240-tube cluster.
// It is not exact per-tube shadowing or measured tissue thickness. Air gaps are
// represented by a fitted effective extinction; no camera/screen coordinate enters.
vec3 r13ClusterTransmission(vec3 p,vec3 L){
 vec3 q=(p-vec3(0.,.12,0.))/vec3(1.05,.68,1.05),d=L/vec3(1.05,.68,1.05);
 float a=dot(d,d),b=dot(q,d),c=dot(q,q)-1.,disc=b*b-a*c;
 if(disc<=0.)return vec3(1.);
 float root=sqrt(disc),entry=(-b-root)/a,exitDistance=(-b+root)/a;
 float pathLength=max(0.,exitDistance-max(0.,entry));
 return exp(-vec3(1.80,1.35,2.15)*pathLength);
}
`, 'anemone material');
    const setup = 'vec3 n=normalize(normal),v=normalize(eye-world),l=normalize(vec3(.6,.6,.5));';
    source = once(source, setup, setup + `
 vec3 r13P=(world-r13Center)/r13Radius,r13Diffuse=vec3(0.),r13Back=vec3(0.),r13Rim=vec3(0.),r13Thin=vec3(0.),r13Wet=vec3(0.);
 if(r13LightingMode==1){
  for(int lamp=0;lamp<2;lamp++){
   vec3 L,E;r13SideLamp(lamp,r13P,L,E);E*=r13DisplayGain*1.65*r13ClusterTransmission(r13P,L);
   r13Diffuse+=E*max(dot(n,L),0.);
   r13Back+=E*pow(max(dot(-n,L),0.),1.5);
   r13Rim+=E*smoothstep(-.2,.85,dot(n,L));
   r13Thin+=E*pow(clamp((.45-dot(n,L))/1.45,0.,1.),1.2);
   r13Wet+=E*pow(max(dot(n,normalize(L+v)),0.),12.)*max(dot(n,L),0.);
  }
 }
`, 'anemone normal setup');
    const body = 'lit=base*(.62+.34*diff)+mix(midColor,milk,.2)*rim*.035;';
    // Side mode redistributes the existing tissue response toward incident light.
    // The former fixed body/volume/rim/cap floors hid the weaker cool lamp. Keep
    // a small volume floor and the exact soft KuKo silhouette/coverage functions;
    // neither the shared lamp gain nor the original-light comparison is changed.
    source = once(source, body, 'if(r13LightingMode==1){lit=base*(vec3(.16)+.90*r13Diffuse)+mix(midColor,milk,.2)*rim*(vec3(.008)+.035*r13Rim);}else{' + body + '}', 'anemone body light');
    const diffuse = 'lit=base*(softAmbient+.52*diff*teacherCoverage*sharp);';
    source = once(source, diffuse, 'if(r13LightingMode==1){lit=base*(vec3(.085+.20*coc)+.85*r13Diffuse*teacherCoverage*sharp);}else{' + diffuse + '}', 'anemone diffuse');
    const rim = 'lit+=rimReturn*effectiveRim*.62*rimLight*sharp;';
    source = once(source, rim, 'if(r13LightingMode==1){lit+=rimReturn*effectiveRim*.62*(vec3(.055)+1.10*r13Rim+.45*r13Thin)*sharp;}else{' + rim + '}', 'anemone rim');
    const cap = 'lit+=base*pow(facing,1.5)*(.13+.18*tip);';
    source = once(source, cap, 'if(r13LightingMode==1){lit+=base*pow(facing,1.5)*(vec3(.035)+(.22+.24*tip)*r13Rim);}else{' + cap + '}', 'anemone cap light');
    const back = 'lit+=mix(base,milk,.25)*back*.06;';
    source = once(source, back, 'if(r13LightingMode==1){lit+=mix(coloredReturn,milk,.035)*r13Thin*.30*(.35+.65*(1.-facing)+.35*tip)*sharp;lit+=mix(vec3(1.),base,.12)*r13Wet*.065*sharp;}else{' + back + '}', 'anemone back light');
    source=once(source,'lit=max(lit,vec3(0.));',`if(r13LightingMode==1){float peak=max(max(lit.r,lit.g),lit.b);if(peak>.85){float shoulder=.85+.15*(1.-exp(-(peak-.85)/.15));lit*=shoulder/peak;}}
 lit=max(lit,vec3(0.));`, 'anemone hue-preserving highlight shoulder');
    return source;
  }
  const locations = new WeakMap();
  function bindUniforms(gl, program, value, bounds = ANEMONE_BOUNDS) {
    const state = validateState(value), frame = validateBounds(bounds);
    let u = locations.get(program);
    if (!u) { u = Object.fromEntries(['r13LightingMode', 'r13Powers', 'r13Center', 'r13Radius'].map(name => [name, gl.getUniformLocation(program, name)])); locations.set(program, u); }
    gl.uniform1i(u.r13LightingMode, state.mode === 'side' ? 1 : 0);
    gl.uniform2f(u.r13Powers, state.warmPower, state.coolPower);
    gl.uniform3fv(u.r13Center, frame.center);
    gl.uniform1f(u.r13Radius, frame.radius);
  }
  const api = Object.freeze({VERSION, MODEL, SOURCE, DISPLAY_GAIN, DEFAULTS, LEGACY, LAMPS, ANEMONE_BOUNDS, validateState, validatePatch, createController, validateBounds, boundsFromVertices, boundsFromModelJSON, sampleLamp, glsl, once, afterPrecision, transformAnemoneMaterialFragment, bindUniforms});
  root.StudioLighting = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
