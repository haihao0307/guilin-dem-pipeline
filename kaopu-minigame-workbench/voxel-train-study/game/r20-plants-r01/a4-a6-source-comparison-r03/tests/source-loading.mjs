import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {loadImage} from '@napi-rs/canvas';
import {fetchSourceBytes, withDeadline} from '../src/source-transport.mjs';
import {restoreOriginal, clearVerifiedSourceCache} from '../src/original-chassis-recovery.mjs';

const report = {status: 'RUNNING', execution: 'Node CPU; real retained image decode; no browser or WebGL', tests: []};
const realFetch = globalThis.fetch;
const qa = new URL('../qa/', import.meta.url);
const never = () => new Promise(() => {});
const url = 'https://fixture.invalid/source.bin'; // Mocked transport only. No request is sent here.
async function test(name, run) {
  const start = performance.now();
  try {
    const evidence = await run();
    report.tests.push({name, status: 'PASS', durationMs: Math.round(performance.now() - start), ...evidence});
  } catch (error) {
    report.tests.push({name, status: 'FAIL', error: error.stack});
    throw error;
  }
}

try {
  await test('HTTP failure is explicit', async () => {
    await assert.rejects(fetchSourceBytes(url, {
      retries: 0, timeoutMs: 200,
      fetchImpl: async () => new Response('unavailable', {status: 503})
    }), /SOURCE_HTTP_503/);
  });
  await test('network rejection is propagated', async () => {
    await assert.rejects(fetchSourceBytes(url, {
      retries: 0, timeoutMs: 200,
      fetchImpl: async () => { throw new TypeError('MOCK_NETWORK_DISCONNECTED'); }
    }), /MOCK_NETWORK_DISCONNECTED/);
  });
  await test('bounded retry succeeds and bypasses cached failed response', async () => {
    const calls = [], progress = [];
    const bytes = await fetchSourceBytes(url, {
      retries: 1, timeoutMs: 200, onProgress: event => progress.push(event),
      fetchImpl: async (_url, options) => {
        calls.push(options.cache);
        return calls.length === 1 ? new Response('retry', {status: 503}) : new Response(new Uint8Array([7, 8, 9]));
      }
    });
    assert.deepEqual([...new Uint8Array(bytes)], [7, 8, 9]);
    assert.deepEqual(calls, ['default', 'reload']);
    assert.equal(progress.filter(event => event.phase === 'retry').length, 1);
    return {attempts: calls.length, cacheModes: calls};
  });
  await test('exhausted retries stop at the configured bound', async () => {
    let calls = 0;
    await assert.rejects(fetchSourceBytes(url, {
      retries: 1, timeoutMs: 200,
      fetchImpl: async () => { calls++; throw Error('MOCK_OFFLINE'); }
    }), /MOCK_OFFLINE/);
    assert.equal(calls, 2);
    return {attempts: calls};
  });
  await test('never-resolving fetch times out and aborts', async () => {
    let signal;
    await assert.rejects(withDeadline(fetchSourceBytes(url, {
      retries: 0, timeoutMs: 20,
      fetchImpl: (_url, options) => { signal = options.signal; return never(); }
    }), 'test safety deadline', 1000), /SOURCE_TIMEOUT /);
    assert.equal(signal.aborted, true);
    return {abortObserved: signal.aborted};
  });
  await test('stalled streamed body is covered by total deadline', async () => {
    let signal;
    await assert.rejects(withDeadline(fetchSourceBytes(url, {
      retries: 0, timeoutMs: 20,
      fetchImpl: async (_url, options) => {
        signal = options.signal;
        return new Response(new ReadableStream({start(controller) { controller.enqueue(new Uint8Array([1, 2])); }}));
      }
    }), 'test safety deadline', 1000), /SOURCE_TIMEOUT /);
    assert.equal(signal.aborted, true);
    return {abortObserved: signal.aborted};
  });
  await test('stalled arrayBuffer fallback is covered by total deadline', async () => {
    await assert.rejects(withDeadline(fetchSourceBytes(url, {
      retries: 0, timeoutMs: 20,
      fetchImpl: async () => ({ok: true, headers: new Headers(), body: null, arrayBuffer: never})
    }), 'test safety deadline', 1000), /SOURCE_TIMEOUT /);
  });
  await test('streamed bytes and progress are exact', async () => {
    const progress = [];
    const bytes = await fetchSourceBytes(url, {
      retries: 0, timeoutMs: 200, onProgress: event => progress.push(event),
      fetchImpl: async () => new Response(new ReadableStream({start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5]));
        controller.close();
      }}), {headers: {'content-length': '5'}})
    });
    assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3, 4, 5]);
    assert.equal(progress.at(-1).loaded, 5);
    assert.equal(progress.at(-1).total, 5);
    assert.ok(progress.some(event => event.loaded === 3));
    return {receivedBytes: bytes.byteLength, progress};
  });
  await test('stream read failure is explicit', async () => {
    await assert.rejects(fetchSourceBytes(url, {
      retries: 0, timeoutMs: 200,
      fetchImpl: async () => new Response(new ReadableStream({start(controller) { controller.error(Error('MOCK_BODY_RESET')); }}))
    }), /MOCK_BODY_RESET/);
  });
  await test('non-network stages are bounded', async () => {
    await assert.rejects(withDeadline(never(), 'GLTF test', 20), /SOURCE_STAGE_TIMEOUT GLTF test/);
    assert.equal(await withDeadline(Promise.resolve('done'), 'immediate', 20), 'done');
  });

  // Match the original CPU runner, without rerunning its entire suite as a side effect.
  globalThis.self = globalThis;
  globalThis.ProgressEvent = class { constructor(type, props) { this.type = type; Object.assign(this, props); } };
  let decodedImages = 0;
  globalThis.createImageBitmap = async blob => {
    decodedImages++;
    return loadImage(Buffer.from(await blob.arrayBuffer()));
  };
  const calls = new Map();
  const localFetch = async (input, options) => {
    const address = input instanceof Request ? input.url : String(input);
    if (address.startsWith('file:')) {
      calls.set(address, (calls.get(address) || 0) + 1);
      return new Response(await fs.readFile(fileURLToPath(address)));
    }
    return realFetch(input, options);
  };
  globalThis.fetch = localFetch;
  await test('concurrent and repeated restores download each source asset once with independent scenes', async () => {
    clearVerifiedSourceCache();
    calls.clear();
    const results = [];
    for (const key of ['a4', 'mark3']) {
      const progressA = [], progressB = [];
      const [first, second] = await Promise.all([
        restoreOriginal(key, {onProgress: event => progressA.push(event)}),
        restoreOriginal(key, {onProgress: event => progressB.push(event)})
      ]);
      const third = await restoreOriginal(key);
      const expectedURLs = ['object.json', 'fields.bin.gz', ...first.object.content.images.map(image => image.payload)]
        .map(file => new URL(`../source-assets/${key}/${file}`, import.meta.url).href);
      for (const address of expectedURLs) assert.equal(calls.get(address), 1, address);
      assert.equal([...calls.keys()].filter(address => address.includes(`/source-assets/${key}/`)).length, expectedURLs.length);
      assert.notStrictEqual(first.root, second.root);
      assert.notStrictEqual(first.root, third.root);
      assert.notStrictEqual(first.mixer, second.mixer);
      assert.strictEqual(first.binary, second.binary, 'verified immutable byte buffer should be shared');
      first.nodes.forEach((node, index) => assert.notStrictEqual(node, second.nodes[index]));
      const firstMesh = first.primitives[0].object, secondMesh = second.primitives[0].object;
      assert.notStrictEqual(firstMesh.material, secondMesh.material);
      const originalX = second.nodes[0].position.x;
      first.nodes[0].position.x += 123;
      assert.equal(second.nodes[0].position.x, originalX);
      first.showClosures([first.inventory.candidateRoots[0]]);
      assert.ok(second.primitives.every(primitive => primitive.object.visible));
      assert.ok(progressA.some(event => event.phase === 'verified'));
      assert.ok(progressB.some(event => event.phase === 'verified'));
      assert.equal(progressA.at(-1).phase, 'scene-ready');
      assert.equal(progressB.at(-1).phase, 'scene-ready');
      results.push({key, independentScenes: 3, nodes: first.nodes.length,
        downloads: expectedURLs.map(address => ({url: address, count: calls.get(address)}))});
    }
    assert.ok(decodedImages > 0, 'retained images must be decoded, not replaced by placeholders');
    return {sources: results, actualImageDecodes: decodedImages};
  });
  await test('failed verification is evicted and a later retry restores the actual source', async () => {
    clearVerifiedSourceCache();
    let injected = false;
    globalThis.fetch = async (input, options) => {
      const response = await localFetch(input, options);
      const address = input instanceof Request ? input.url : String(input);
      if (!injected && address.endsWith('/mark3/object.json')) {
        injected = true;
        const bytes = new Uint8Array(await response.arrayBuffer());
        bytes[0] ^= 1;
        return new Response(bytes);
      }
      return response;
    };
    await assert.rejects(restoreOriginal('mark3'), /SOURCE_OBJECT_HASH_MISMATCH/);
    globalThis.fetch = localFetch;
    const source = await restoreOriginal('mark3');
    assert.equal(source.nodes.length, 145);
    return {injectedFailure: injected, recoveredNodes: source.nodes.length};
  });
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  globalThis.fetch = realFetch;
  clearVerifiedSourceCache();
  await fs.mkdir(qa, {recursive: true});
  await fs.writeFile(new URL('SOURCE_LOADING.json', qa), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
