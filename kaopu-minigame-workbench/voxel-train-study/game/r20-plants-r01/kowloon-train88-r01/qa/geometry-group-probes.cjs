// Usage: node qa/geometry-group-probes.cjs [--group=0] [--backend=webgpu]
//        node qa/geometry-group-probes.cjs --self-test
// Each (group, backend) gets a fresh browser/GPU process. No old QA or host is loaded.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const names = ['a', 'b', 'c', 'e'];
const tolerance = {a: [.0002, 0, .0002, 0], b: [.0002, .0002, .0002, 0], c: [.0002, .0002, .0002, 0], e: [0, 0, 0, 0]};

function compareCases(left, right, description = {}) {
  const comparison = {...description, age: left?.age, failures: 0, maxError: 0, maxErrorByAttachment: {}, firstMismatches: []};
  if (!left || !right || left.age !== right.age) return {...comparison, failures: 1, error: 'Missing case or age mismatch'};
  for (const name of names) {
    const a = left.attachments?.[name], b = right.attachments?.[name];
    if (!a || !b || a.length !== b.length) {comparison.failures++; comparison.error = `Missing/mismatched ${name} attachment`; continue;}
    let maximum = 0;
    for (let i = 0; i < a.length; i++) {
      const difference = Math.abs(a[i] - b[i]), allowed = tolerance[name][i % 4];
      if (Number.isFinite(difference)) maximum = Math.max(maximum, difference);
      if (!Number.isFinite(difference) || difference > allowed) {
        comparison.failures++;
        if (comparison.firstMismatches.length < 16) comparison.firstMismatches.push({attachment: name, pixel: Math.floor(i / 4), channel: i % 4, webgl: a[i], webgpu: b[i], tolerance: allowed});
      }
    }
    comparison.maxErrorByAttachment[name] = maximum; comparison.maxError = Math.max(comparison.maxError, maximum);
  }
  return comparison;
}

function mergeCases(cases, points, capacity = 96) {
  if (!cases.length || !Array.isArray(points) || points.some(point => !Array.isArray(point) || point.length !== 3 || point.some(value => !Number.isFinite(value)))) throw Error('Merge requires ordered cases and verified probe.points');
  const pixels = points.length, age = cases[0].age;
  for (const item of cases) {
    if (item.age !== age) throw Error('Cannot merge different age snapshots');
    for (const name of names) if (item.attachments?.[name]?.length !== pixels * 4) throw Error(`Incomplete ${name} group attachment`);
  }
  const attachments = Object.fromEntries(names.map(name => [name, new Array(pixels * 4).fill(0)]));
  const selectedGroups = new Array(pixels).fill(-1);
  let overflows = 0;
  for (let pixel = 0; pixel < pixels; pixel++) {
    const i = pixel * 4;
    let best = 10000, selected = -1, rawCount = 0, overflow = false;
    for (let group = 0; group < cases.length; group++) {
      const value = cases[group].attachments;
      const raw = value.c[i + 3], flag = value.e[i], distance = value.a[i];
      if (!Number.isFinite(distance) || !Number.isInteger(raw) || raw < 0 || raw > capacity || ![0, 1].includes(flag)) throw Error(`Invalid group metadata at group ${group}, sample ${pixel}`);
      rawCount += raw; overflow ||= flag !== 0;
      // Strict < and original manifest order preserve the first equal-distance winner.
      if (distance < best) {best = distance; selected = group;}
    }
    overflow ||= rawCount > capacity;
    if (overflow || selected === -1) {
      attachments.a.splice(i, 4, overflow ? 0 : 10000, overflow ? 999 : 0, overflow ? 0 : 10000, 0);
      attachments.b.splice(i, 4, ...points[pixel].map(Math.fround), 0);
      attachments.c.splice(i, 4, 1, 1, 1, rawCount);
      attachments.e[i] = overflow ? 1 : 0;
      if (overflow) overflows++;
    } else {
      for (const name of ['a', 'b', 'c']) attachments[name].splice(i, 4, ...cases[selected].attachments[name].slice(i, i + 4));
      attachments.c[i + 3] = rawCount;
    }
    selectedGroups[pixel] = overflow ? -2 : selected;
  }
  const materialIds = {};
  for (let i = 1; i < attachments.a.length; i += 4) materialIds[attachments.a[i]] = (materialIds[attachments.a[i]] || 0) + 1;
  return {age, attachments, selectedGroups, overflows, materialIds};
}

function selfTest() {
  const item = (d, id, raw = 1, overflow = 0, age = .05) => ({age, attachments: {a: [d, id, d, id + 100], b: [3, 4, 5, id + 200], c: [1, 2, 3, raw], e: [overflow, 0, 0, 0]}});
  const point = [[7, 8, 9]];
  assert.equal(mergeCases([item(1, 3), item(1, 4)], point).attachments.a[1], 3, 'strict first tie');
  assert.equal(mergeCases([item(1, 3), item(-1, 4)], point).attachments.a[1], 4, 'negative physical winner');
  assert.equal(mergeCases([item(1, 3, 48), item(2, 4, 48)], point).attachments.a[1], 3, 'exact capacity allowed');
  const overflow = mergeCases([item(1, 3, 48), item(2, 4, 49)], point);
  assert.deepEqual(overflow.attachments.a, [0, 999, 0, 0]); assert.deepEqual(overflow.attachments.b, [7, 8, 9, 0]);
  assert.deepEqual(overflow.attachments.c, [1, 1, 1, 97]); assert.equal(overflow.attachments.e[0], 1);
  assert.equal(mergeCases([item(2, 4, 96, 1)], point).attachments.a[1], 999, 'saturated local overflow preserved');
  assert.equal(mergeCases([item(10000, 0, 0)], point).attachments.a[1], 0, 'vacant group stays vacant');
  assert.throws(() => mergeCases([item(1, 3), item(2, 4, 1, 0, .58)], point), /snapshots/);
  assert.equal(compareCases(item(1, 3), item(1.0001, 3)).failures, 0);
  assert.equal(compareCases(item(1, 3), item(1.0003, 3)).failures, 2);
  assert.equal(compareCases(item(1, 3), item(1, 4)).failures, 3, 'IDs, seeds and source ownership are exact');
  const nonfinite = item(1, 3); nonfinite.attachments.b[1] = NaN;
  assert.equal(compareCases(item(1, 3), nonfinite).failures, 1);
  console.log('geometry-group probe self-tests passed');
}

function options(argv) {
  const output = {};
  for (const argument of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argument);
    if (!match) throw Error(`Unknown argument ${argument}`);
    output[match[1]] = match[2] ?? true;
  }
  return output;
}
async function run(argv = process.argv.slice(2)) {
  const args = options(argv);
  if (args['self-test']) {selfTest(); return;}
  const stationRoot = path.resolve(args.root || path.join(__dirname, '..'));
  const manifestPath = path.join(stationRoot, 'generated/geometry-group-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.groups?.length || !manifest.probe?.points || manifest.probe.points.length !== manifest.probe.width * manifest.probe.height) throw Error('Manifest requires groups, dimensions, ages, and exact probe.points');
  if (manifest.groups.some((group, i) => group.index !== i || group.outputs !== 4)) throw Error('Manifest must retain original contiguous group order and four outputs');
  const selected = args.group === undefined ? manifest.groups : manifest.groups.filter(group => group.index === Number(args.group));
  const backends = args.backend ? [args.backend] : ['webgl', 'webgpu'];
  if (!selected.length || backends.some(backend => !['webgl', 'webgpu'].includes(backend))) throw Error('Invalid --group or --backend');
  const timeoutMs = Number(args['timeout-ms'] || 120000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw Error('Invalid --timeout-ms');
  const out = path.resolve(args.out || process.env.GEOMETRY_GROUP_PROBE_OUTPUT || 'train88-kowloon-bridge-results');
  fs.mkdirSync(out, {recursive: true});
  const reportPath = path.join(out, 'geometry-group-probes.json');
  const report = {commit: process.env.GITHUB_SHA || null, scope: 'Small-sample real-browser shader compilation and numerical execution; not full-station visual acceptance.', startedAt: new Date().toISOString(), status: 'running', manifest: {path: manifestPath, groups: manifest.groups, probe: manifest.probe}, selectedGroups: selected.map(group => group.index), selectedBackends: backends, tolerance, backends: [], comparisons: [], merged: []};
  const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  save();
  const {chromium} = require('playwright');
  const browserArgs = ['--no-sandbox', '--disable-gpu-watchdog', '--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--enable-features=Vulkan', '--disable-vulkan-surface'];
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const filename = path.resolve(stationRoot, '.' + pathname);
      if (!filename.startsWith(stationRoot + path.sep)) {response.writeHead(403).end(); return;}
      const mime = filename.endsWith('.html') ? 'text/html' : filename.endsWith('.json') ? 'application/json' : 'text/javascript';
      response.setHeader('content-type', mime); response.setHeader('cache-control', 'no-store'); response.end(fs.readFileSync(filename));
    } catch {response.writeHead(404).end();}
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(Number(args.port || 0), '127.0.0.1', resolve);});
  const origin = `http://127.0.0.1:${server.address().port}`;

  async function one(group, backend) {
    let browserServer, browser, page, timer, settled = false;
    const start = Date.now();
    let latest = {group: group.index, name: group.name, backend, status: 'running', stage: 'launch', cases: [], errors: [], events: []};
    let resolveTerminal;
    const terminal = new Promise(resolve => {resolveTerminal = resolve;});
    const finish = value => {if (settled) return; settled = true; clearTimeout(timer); latest = value; resolveTerminal(value);};
    const failure = (message, stage = latest.stage) => finish({...latest, status: 'failed', stage, failure: message, elapsedMs: Date.now() - start});
    const arm = () => {clearTimeout(timer); timer = setTimeout(() => failure(`Stage timeout after ${timeoutMs}ms (not evidence of context loss)`), timeoutMs);};
    const receipt = value => {
      if (settled) return;
      if (value.stage !== latest.stage) arm();
      latest = value; report.live = value; save();
      if (value.status !== 'running') finish(value);
    };
    console.log(`STATION_GEOMETRY_GROUP_LAUNCH ${backend} group=${group.index} ${group.name}`);
    try {
      arm();
      browserServer = await chromium.launchServer({headless: !args.headed, args: browserArgs, ...(args['executable-path'] ? {executablePath: args['executable-path']} : {}), timeout: Math.min(timeoutMs, 30000)});
      browser = await chromium.connect(browserServer.wsEndpoint());
      browser.on('disconnected', () => {if (!settled) failure('Browser disconnected');});
      page = await browser.newPage();
      await page.exposeFunction('__reportGeometryGroup', receipt);
      page.on('crash', () => failure('Renderer process crashed'));
      page.on('pageerror', error => failure(error.stack || String(error)));
      page.on('console', message => {
        const text = message.text();
        if (text.startsWith('STATION_GEOMETRY_GROUP_')) console.log(text);
        // A renderer/GPU failure can arrive while page JavaScript is blocked in the driver.
        if (/CONTEXT_LOST_WEBGL|GPU process (?:has )?(?:crashed|exited)|WebGL context (?:was )?lost/i.test(text)) failure(`GPU loss console receipt: ${text}`);
      });
      const url = `${origin}/qa/geometry-group-probe.html?backend=${backend}&group=${group.index}`;
      await Promise.race([page.goto(url, {waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 30000)}).catch(error => failure(error.stack || String(error), 'navigation')), terminal]);
      return await terminal;
    } catch (error) {
      failure(error.stack || String(error)); return await terminal;
    } finally {
      clearTimeout(timer);
      if (browserServer) {
        // Kill only the browser created for this case; a poisoned GPU must not leak into the next group.
        await Promise.race([browserServer.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
        const process = browserServer.process();
        if (process && process.exitCode === null && process.signalCode === null) await browserServer.kill().catch(() => {});
      }
    }
  }

  try {
    for (const group of selected) for (const backend of backends) {
      const value = await one(group, backend); report.backends.push(value); delete report.live; save();
      console.log(`STATION_GEOMETRY_GROUP_RECEIPT ${backend} group=${group.index} ${value.status} stage=${value.stage} elapsed=${Math.round(value.elapsedMs || 0)}ms`);
    }
    if (backends.length === 2) for (const group of selected) {
      const gl = report.backends.find(value => value.group === group.index && value.backend === 'webgl');
      const gpu = report.backends.find(value => value.group === group.index && value.backend === 'webgpu');
      if (gl?.status !== 'sampled' || gpu?.status !== 'sampled') {report.comparisons.push({kind: 'group', group: group.index, failures: 1, error: 'One or both real GPU programs did not complete'}); continue;}
      for (const age of manifest.probe.ages) report.comparisons.push(compareCases(gl.cases.find(value => value.age === age), gpu.cases.find(value => value.age === age), {kind: 'group', group: group.index, name: group.name}));
    }
    const completeSelection = selected.length === manifest.groups.length;
    if (completeSelection) for (const backend of backends) {
      const ordered = manifest.groups.map(group => report.backends.find(value => value.group === group.index && value.backend === backend));
      if (ordered.some(value => value?.status !== 'sampled')) {report.merged.push({backend, status: 'blocked', reason: 'A constituent group did not complete'}); continue;}
      const cases = manifest.probe.ages.map(age => mergeCases(ordered.map(value => value.cases.find(item => item.age === age)), manifest.probe.points));
      report.merged.push({backend, status: 'merged', cases});
    }
    if (!completeSelection) report.mergeNotRun = 'Partial --group selection; global station merge is deliberately not claimed.';
    if (completeSelection && backends.length === 2) {
      const gl = report.merged.find(value => value.backend === 'webgl'), gpu = report.merged.find(value => value.backend === 'webgpu');
      if (gl?.status === 'merged' && gpu?.status === 'merged') for (const age of manifest.probe.ages) report.comparisons.push(compareCases(gl.cases.find(value => value.age === age), gpu.cases.find(value => value.age === age), {kind: 'merged'}));
      else report.comparisons.push({kind: 'merged', failures: 1, error: 'Global merge blocked by an incomplete backend/group'});
    }
    const failed = report.backends.some(value => value.status !== 'sampled') || report.comparisons.some(value => value.failures > 0);
    report.status = failed ? 'failed' : (backends.length === 2 ? (completeSelection ? 'numeric-equivalence-passed' : 'selected-groups-numeric-equivalence-passed') : 'selected-backend-sampled');
    report.finishedAt = new Date().toISOString(); save();
    if (failed) process.exitCode = 1;
    console.log(`STATION_GEOMETRY_GROUP_REPORT ${report.status} ${reportPath}`);
  } catch (error) {
    report.status = 'failed'; report.failure = error.stack || String(error); save(); process.exitCode = 1; throw error;
  } finally {await new Promise(resolve => server.close(resolve));}
}
module.exports = {compareCases, mergeCases, selfTest, run};
if (require.main === module) run().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
