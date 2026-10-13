'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FLAGS, parseOptions, snapshotRuntime, createSnapshotServer, stageTimings, pngDimensions, validateFrame, bounded } = require('../qa/local-review.cjs');

test('review defaults to a bounded 16x16 tile in uncut overall perspective', () => {
  const o = parseOptions([]);
  assert.equal(o.mode, 'smoke');
  assert.equal(o.view, 'overall');
  assert.equal(o.candidate, null);
  assert.deepEqual(o.nativePixels, [320, 400]);
  assert.deepEqual(o.rect, [144, 192, 16, 16]);
  assert.equal(o.maxSubmissions, 20000);
});
test('full frame is explicit, native size, with no crop', () => {
  const o = parseOptions(['--mode', 'full']);
  assert.deepEqual(o.rect, [0, 0, 320, 400]);
  assert.equal(o.maxSubmissions, 2000000);
  assert.equal(o.renderTimeoutMs, 7200000);
});
test('invalid/expensive crop options and malformed arguments are rejected', () => {
  for (const args of [ ['--rect', '0,0,17,16'], ['--rect', '319,0,16,16'], ['--rect', '0,0,1.5,16'], ['--mode', 'full', '--rect', '0,0,1,1'], ['--viewport', '0x2'], ['--mode', 'bad'], ['--view', 'bad'], ['--growth', 'maybe'], ['--mode'], ['--typo', 'full'], ['--mode', 'init', '--mode', 'full'] ]) assert.throws(() => parseOptions(args));
});
test('initialization mode never requests a frame', () => {
  assert.equal(parseOptions(['--mode', 'init']).rect, null);
});
test('runtime is frozen into an exact-byte source map and all nine source mothers match', () => {
  const s = snapshotRuntime();
  assert.equal(s.motherParity.length, 9);
  assert.ok(s.motherParity.every(x => x.matches));
  assert.ok(s.bytes.has('/runtime/index.html'));
  assert.ok(s.bytes.has('/runtime/app.mjs'));
  assert.ok([...s.bytes.keys()].every(k => k.startsWith('/runtime/')));
});
test('allowlisted candidate snapshot includes original shared runtime and isolated candidate', () => {
  const o = parseOptions(['--candidate', 'whole-frontage-r04', '--view', 'facade-detail']);
  assert.equal(o.candidate, 'whole-frontage-r04');
  assert.equal(o.view, 'facade-detail');
  const s = snapshotRuntime(undefined, o.candidate);
  assert.ok(s.bytes.has('/whole-frontage-r04/runtime/index.html'));
  assert.ok(s.bytes.has('/whole-frontage-r04/runtime/app.mjs'));
  assert.ok(s.bytes.has('/runtime/scheduler.mjs'));
  assert.ok(s.bytes.has('/runtime/mothers/brick-core.mjs'));
  assert.ok([...s.bytes.keys()].every(k => k.startsWith('/runtime/') || k.startsWith('/whole-frontage-r04/runtime/')));
  assert.equal(s.motherParity.length, 9);
  assert.ok(s.motherParity.every(x => x.matches));
});
test('candidate selection rejects traversal, absolute paths, encodings, and unknown siblings', () => {
  for (const candidate of ['../runtime', '/tmp', 'whole-frontage-r04/../../', 'whole-frontage-r04/runtime', '%2e%2e', 'unknown-candidate', 'whole-frontage-r04\\runtime']) {
    assert.throws(() => parseOptions(['--candidate', candidate]), /Unknown review candidate/);
    assert.throws(() => snapshotRuntime(undefined, candidate), /Unknown review candidate/);
  }
});
test('every local static module import resolves within the captured candidate/shared runtime', () => {
  const s = snapshotRuntime(undefined, 'whole-frontage-r04');
  for (const [name, bytes] of s.bytes) {
    if (!name.endsWith('.mjs')) continue;
    for (const match of bytes.toString().matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const resolved = new URL(match[1], 'http://127.0.0.1' + name).pathname;
      assert.ok(s.bytes.has(resolved), `${name} requires missing ${resolved}`);
    }
  }
});
test('snapshot HTTP handler serves only captured runtime bytes and rejects path traversal', () => {
  const s = snapshotRuntime(undefined, 'whole-frontage-r04');
  const server = createSnapshotServer(s);
  function request(url, method = 'GET') {
    const result = {};
    const response = { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.body = body; } };
    server.emit('request', { url, method }, response);
    return result;
  }
  const actual = request('/whole-frontage-r04/runtime/index.html?manual=1');
  assert.equal(actual.status, 200);
  assert.deepEqual(actual.body, s.bytes.get('/whole-frontage-r04/runtime/index.html'));
  assert.equal(request('/runtime/mothers/brick-core.mjs').status, 200);
  assert.equal(request('/whole-frontage-r04/src/frontage-programme.mjs').status, 404);
  assert.equal(request('/qa/local-review.cjs').status, 404);
  for (const url of ['/runtime/../qa/local-review.cjs', '/runtime/%2e%2e/qa/local-review.cjs', '/whole-frontage-r04/runtime/../../runtime/app.mjs', '/runtime/..%5Cqa/local-review.cjs', '/runtime/app.mjs%00', '/%zz']) assert.equal(request(url).status, 400, url);
  assert.equal(request('/runtime/app.mjs', 'POST').status, 405);
});
test('runner uses original QA SwiftShader/Vulkan switches', () => {
  for (const flag of ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--enable-features=Vulkan', '--disable-vulkan-surface']) assert.ok(FLAGS.includes(flag));
});
test('timings come from pipeline start/end events', () => {
  assert.deepEqual(stageTimings([{stage:'pipeline-geo0-start',ms:10},{stage:'pipeline-geo0-end',ms:40},{stage:'pipeline-shade-start',ms:50},{stage:'pipeline-shade-end',ms:130}]), {geo0:30, shade:80});
});
test('native PNG header has exact dimensions and rejects non-PNG substitutes', () => {
  const b = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(b); b.writeUInt32BE(320,16); b.writeUInt32BE(400,20);
  assert.deepEqual(pngDimensions(b), [320,400]);
  assert.throws(() => pngDimensions(Buffer.from('not a PNG')));
});
test('frame contract rejects debug, cutting, incompleteness, and mislabeled smoke', () => {
  const o=parseOptions([]), f={view:'overall',pixels:o.nativePixels,rect:o.rect,inspectionCrop:true,snapshot:{debug:0,cut:[0,0,1,1000000],tanFov:.42},rayStatus:{hit:256,trueMiss:0,exhausted:0,visibilityUnresolved:0,candidateOverflows:0,activeQueries:0}};
  assert.doesNotThrow(()=>validateFrame(f,o));
  for(const mutate of [x=>x.snapshot.debug=1,x=>x.snapshot.cut=[0,0,-1,1],x=>x.inspectionCrop=false,x=>x.rayStatus.hit=255,x=>x.rayStatus.visibilityUnresolved=1,x=>x.rayStatus.activeQueries=1]) {const q=structuredClone(f);mutate(q);assert.throws(()=>validateFrame(q,o));}
});
test('bounded waits terminate stalled operations', async () => {
  assert.equal(await bounded(Promise.resolve(12),100,'test'),12);
  await assert.rejects(bounded(new Promise(()=>{}),5,'test'), /exceeded 5 ms/);
});
