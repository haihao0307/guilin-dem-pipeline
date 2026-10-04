'use strict';
// No build/output mutation. --webgl additionally compiles/links the actual
// source adapters in an isolated existing Playwright Chromium context.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..'), S = require('../src/studio-lighting.js'), R = require('../src/rabbit-lighting-adapter.js');
const tests = [], check = (name, fn) => { fn(); tests.push(name); };
const near = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
function pinnedShader(kind, BaseShader = class {}) {
  let Shader;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'teacher-original/js/app', kind + '.js'), 'utf8'), {define(deps, factory) { Shader = factory(BaseShader); }});
  return Shader;
}
function sourceOf(kind) { const shader = {}; pinnedShader(kind).prototype.fillCode.call(shader); return shader; }
function constantSource(file, name) {
  const source = fs.readFileSync(path.join(root, file), 'utf8'), match = source.match(new RegExp('const ' + name + '=`([\\s\\S]*?)`;'));
  assert.ok(match, 'missing ' + name); return match[1];
}
const pairs = [];
check('R13 origin irradiance and asymmetric artistic RGB are exact', () => {
  S.sampleLamp([0, 0, 0], 0).E.forEach((v, i) => near(v, [12.5, 9.375, 6.25][i]));
  S.sampleLamp([0, 0, 0], 1).E.forEach((v, i) => near(v, [1.75, 2.625, 3.9375][i]));
  for (let i = 0; i < 2; i++) near(Math.hypot(...S.LAMPS[i].position), 4);
  assert.deepEqual(S.sampleLamp([0, 0, 0], 0, {...S.DEFAULTS, warmPower: 0}).E, [0, 0, 0]);
  S.sampleLamp([0, 0, 0], 1, {...S.DEFAULTS, coolPower: 2}).E.forEach((v, i) => near(v, [3.5, 5.25, 7.875][i]));
});
check('Per-fragment cone and inverse-square are the pinned formula', () => {
  for (const p of [[.35, -.2, .8], [-.85, .4, -.6], [0, 0, 0]]) for (let i = 0; i < 2; i++) {
    const lamp = S.LAMPS[i], d = lamp.position.map((v, j) => v - p[j]), d2 = d.reduce((a, v) => a + v * v, 0), L = d.map(v => v / Math.sqrt(d2));
    const c = Math.pow(Math.max(L.reduce((sum, v, j) => sum + v * lamp.position[j] / 4, 0), 0), 12) * 5 / Math.max(d2, 1e-5);
    S.sampleLamp(p, i).E.forEach((v, j) => near(v, lamp.color[j] * c));
  }
  for (let i = 0; i < 2; i++) assert.deepEqual(S.sampleLamp(S.LAMPS[i].position.map(x => x * 2), i).E, [0, 0, 0]);
});
check('Engine/R13 axis permutation round-trips and warm/cool are lateral', () => {
  const engine = [.8, -.5, .25], rig = [engine[1], engine[2], engine[0]], restored = [rig[2], rig[0], rig[1]];
  assert.deepEqual(restored, engine);
  assert.ok(S.LAMPS[0].position[0] > 0 && S.LAMPS[1].position[0] < 0);
});
check('Bounded full state and UI patches validate atomically', () => {
  const c = S.createController();
  c.patch({mode: 'legacy', warmPower: 0, coolPower: 2});
  const before = c.getState();
  for (const invalid of [{warmPower: -1}, {coolPower: 2.1}, {warmPower: NaN}, {coolPower: Infinity}, {warmPower: '1'}, {warmPower: true}, {mode: 'kelvin'}, {version: 2}, {model: 'unknown'}, {extra: 1}]) {
    assert.throws(() => c.patch(invalid)); assert.deepEqual(c.getState(), before);
  }
  for (const invalid of [null, [], true, {}, {version: 1}, {...S.DEFAULTS, coolPower: undefined}]) { assert.throws(() => c.setState(invalid)); assert.deepEqual(c.getState(), before); }
  const copy = c.getState(); copy.warmPower = 2; assert.deepEqual(c.getState(), before);
  const crossRealm = vm.runInNewContext('(' + JSON.stringify(S.DEFAULTS) + ')'); assert.deepEqual(S.validateState(crossRealm), S.DEFAULTS);
  assert.throws(() => S.validateState(new Date()));
  assert.deepEqual(S.DEFAULTS, {version: 1, model: S.MODEL, mode: 'side', warmPower: 1, coolPower: 1});
});
check('Teacher role resolves and patches nothing', () => {
  let calls = 0; const fail = () => { calls++; throw Error('teacher must never resolve'); };
  const t = R.installRabbitLightingAdapter({role: 'teacher', getModule: fail, getGL: fail, getMesh: fail});
  assert.deepEqual(t.getState(), S.LEGACY); assert.deepEqual(t.patch({mode: 'side'}), S.LEGACY); assert.equal(calls, 0);
});
const appearanceContext = {}; vm.runInNewContext(fs.readFileSync(path.join(root, 'full-cluster/src/rabbit-fur-shader-adapter.js'), 'utf8'), appearanceContext);
for (const kind of ['ShellShader', 'FinShader', 'DiffuseColoredShader']) check(kind + ' exact original legacy, AO, alpha and position paths survive', () => {
  const original = sourceOf(kind), adapted = R.transformRabbitLightingSources(original.vertexShaderCode, original.fragmentShaderCode, kind);
  const name = kind === 'DiffuseColoredShader' ? 'computePointLight' : 'computeHairLighting';
  const expectedLegacy = original.fragmentShaderCode.slice(original.fragmentShaderCode.indexOf('vec4 ' + name + '() {'));
  assert.ok(adapted.fragmentShaderCode.includes(expectedLegacy.replace('vec4 ' + name + '() {', 'vec4 rabbitLegacyLighting() {')));
  assert.ok(adapted.fragmentShaderCode.includes('if (r13LightingMode == 0) return rabbitLegacyLighting();'));
  assert.ok(adapted.vertexShaderCode.includes(original.vertexShaderCode.match(/gl_Position[^;]+;/)[0]));
  assert.ok(adapted.vertexShaderCode.includes('(rabbitWorld - rabbitCenterWorld).yzx'));
  assert.ok(adapted.fragmentShaderCode.includes('mat3(view_matrix) * rigL.zxy'));
  const wrapper = adapted.fragmentShaderCode.slice(adapted.fragmentShaderCode.lastIndexOf('vec4 ' + name + '() {'));
  assert.ok(wrapper.indexOf('vec3 color = ') < wrapper.indexOf('for (int lamp'));
  assert.ok(wrapper.includes('* E * r13DisplayGain'));
  assert.throws(() => R.transformRabbitLightingSources(adapted.vertexShaderCode, adapted.fragmentShaderCode, kind));
  if (kind !== 'DiffuseColoredShader') {
    const alpha = kind === 'ShellShader' ? 'fragColor.a *= alphaColor;' : 'fragColor.a = outAlpha*k_alpha;';
    assert.ok(adapted.fragmentShaderCode.includes(alpha));
    const appeared = appearanceContext.transformRabbitFurFragmentSource(original.fragmentShaderCode, kind);
    const combined = R.transformRabbitLightingSources(original.vertexShaderCode, appeared, kind);
    assert.ok(combined.fragmentShaderCode.includes('rabbitRemapFurMask')); pairs.push({name: kind + '+appearance', ...combined});
    assert.ok(appearanceContext.transformRabbitFurFragmentSource(adapted.fragmentShaderCode, kind).includes('r13SideLighting'));
  }
  pairs.push({name: kind, ...adapted});
});
check('Source model bounds are positive, camera-independent and immutable', () => {
  for (const [file, radius] of [['bunnyUV', 25.412848048575743], ['cloth', 51.74982327733134]]) {
    const json = fs.readFileSync(path.join(root, 'teacher-original/data/models', file + '.json'), 'utf8'), before = crypto.createHash('sha256').update(json).digest('hex');
    const bounds = S.boundsFromModelJSON(json); assert.deepEqual(bounds.center, [0, 0, 0]); near(bounds.radius, radius);
    assert.equal(crypto.createHash('sha256').update(json).digest('hex'), before);
  }
  for (const vertices of [[], [0, 0, 0], [1, 2], [1, 2, NaN]]) assert.throws(() => S.boundsFromVertices(vertices));
});
check('Anemone changes only bounded material lighting, with legacy branches', () => {
  const f = constantSource('full-cluster/src/anemone-renderer.js', 'materialFragment'), adapted = S.transformAnemoneMaterialFragment(f);
  for (const anchor of ['lit=base*(.62+.34*diff)+mix(midColor,milk,.2)*rim*.035;', 'lit=base*(softAmbient+.52*diff*teacherCoverage*sharp);', 'lit+=rimReturn*effectiveRim*.62*rimLight*sharp;', 'lit+=mix(base,milk,.25)*back*.06;', 'alpha=clamp(1.-translucency*transmission+tip*.035*translucency,.12,1.);']) assert.ok(adapted.includes(anchor));
  assert.equal(adapted.slice(adapted.indexOf('lit=max(lit,vec3(0.));')), f.slice(f.indexOf('lit=max(lit,vec3(0.));')));
  assert.throws(() => S.transformAnemoneMaterialFragment(adapted)); assert.throws(() => S.transformAnemoneMaterialFragment(f.replace('lit+=mix(base,milk,.25)*back*.06;', 'changed;')));
  for (const name of ['vertex', 'bodyVertex']) pairs.push({name: 'anemone-' + name, vertexShaderCode: constantSource('full-cluster/src/anemone-renderer.js', name), fragmentShaderCode: adapted});
});
check('Optical varyings preserve exact prior vertex geometry and separate surface visibility from absorption', () => {
  const strip=s=>s.replace('\nout vec3 tissueShape;out vec3 tubeAxis;','').replace('tissueShape=vec3(radius*profile,radius*(1.-.1*s)*(1.+.07*exp(-pow((s-.9)/.06,2.))),cap);tubeAxis=t;','').replace('tissueShape=vec3(0.);tubeAxis=vec3(0.,1.,0.);','');
  const expected=['4659305efb5e081e788a706e52b05096c06965f8df60007ff9719f66557bd7cc','355fce73deb14be871c8f7d503812724dcf5ae4a747dc30bef62c090ef700f76'];
  ['vertex','bodyVertex'].forEach((name,i)=>assert.equal(crypto.createHash('sha256').update(strip(constantSource('full-cluster/src/anemone-renderer.js',name))).digest('hex'),expected[i]));
  const shader=S.transformAnemoneMaterialFragment(constantSource('full-cluster/src/anemone-renderer.js','materialFragment'));
  assert.ok(shader.includes('return exp(-1.65*pathLength);'));
  assert.ok(shader.includes('vec3 sigma=-log(Tfit)/.06'));
  assert.ok(shader.includes('if(shape.y<=0.||amount<=0.)return vec3(0.);'));
  assert.ok(shader.includes('r13Wet+=E*r13WetBRDF(n,v,L);'));
  assert.ok(shader.includes('lit+=r13Wet*.85*sharp;'));
  assert.ok(!shader.includes('exp(-vec3(1.80,1.35,2.15)*pathLength)'));
});
check('Prototype adapter uploads live state and bounds without teacher edits', () => {
  const calls = [], gl = {getUniformLocation: (_, name) => name, uniform1i: (...a) => calls.push(a), uniform1f: (...a) => calls.push(a), uniform2f: (...a) => calls.push(a), uniform3fv: (...a) => calls.push(a)};
  class Base { getUniform(name) {return name;} getAttrib() {return 0;} use() {} }
  const shaders = Object.fromEntries(['ShellShader', 'FinShader', 'DiffuseColoredShader'].map(name => [name, pinnedShader(name, Base)]));
  const modelAssets = {'data/models/bunnyUV.json': fs.readFileSync(path.join(root, 'teacher-original/data/models/bunnyUV.json'), 'utf8')};
  const c = R.installRabbitLightingAdapter({role: 'candidate', getModule: name => shaders[name], getGL: () => gl, getMesh: () => 'rabbit', modelAssets});
  for (const Shader of Object.values(shaders)) { const instance = new Shader(); instance.program = {}; instance.fillCode(); instance.fillUniformsAttributes(); c.patch({mode: 'legacy', warmPower: .4, coolPower: 1.7}); instance.use(); assert.ok(instance.fragmentShaderCode.includes('r13SideLighting')); }
  assert.ok(calls.some(a => a[0] === 'r13LightingMode' && a[1] === 0)); assert.ok(calls.some(a => a[0] === 'r13Powers' && a[1] === .4 && a[2] === 1.7));
  assert.throws(() => R.installRabbitLightingAdapter({role: 'candidate', getModule: name => shaders[name], getGL: () => gl, getMesh: () => 'rabbit', modelAssets}));
});
async function webgl() {
  const {chromium} = require('playwright'); let browser;
  try {
    const executablePath = process.env.HAIR_CHROMIUM_EXECUTABLE || undefined;
    browser = await chromium.launch({executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
    const page = await browser.newPage();
    const result = await page.evaluate(pairs => {
      const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2'); if (!gl) throw Error('WebGL2 unavailable');
      return pairs.map(pair => {
        const program = gl.createProgram();
        for (const [type, source] of [[gl.VERTEX_SHADER, pair.vertexShaderCode], [gl.FRAGMENT_SHADER, pair.fragmentShaderCode]]) {
          const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(pair.name + ': ' + gl.getShaderInfoLog(shader)); gl.attachShader(program, shader);
        }
        gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(pair.name + ': ' + gl.getProgramInfoLog(program));
        const uniforms = ['r13LightingMode', 'r13Powers', 'r13Center', 'r13Radius'].map(name => ({name, active: gl.getUniformLocation(program, name) !== null}));
        return {name: pair.name, uniforms, glError: gl.getError()};
      });
    }, pairs);
    for (const item of result) { assert.equal(item.glError, 0); assert.ok(item.uniforms.every(u => u.active), JSON.stringify(item)); }
    tests.push('Real WebGL2 compiled and linked all seven source-adapter combinations with active bounded uniforms');
    return result;
  } finally { if (browser) await browser.close(); }
}
(async () => {
  const gpu = process.argv.includes('--webgl') ? await webgl() : null;
  console.log(JSON.stringify({passed: true, count: tests.length, tests, gpu, visualAcceptance: false, productionReady: false}, null, 2));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
