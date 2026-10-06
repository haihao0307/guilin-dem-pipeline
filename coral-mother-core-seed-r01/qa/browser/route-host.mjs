import assert from 'node:assert/strict';
import { access, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifest, materialSource, previewSVG, sha256, spikySource } from './fixtures.mjs';

export const ORIGIN = 'http://localhost:4173';
export const BASE = '/coral-mother-core-seed-r01/';
export const URL_ROOT = ORIGIN + BASE;
export const requiredFiles = [
  'index.html', 'runtime.js', 'original-replay.js', 'original-replay.css',
  'frame-host.js', 'webgl-lifecycle.js', 'studio.js', 'studio.css',
  'spiky-teacher-r01/index.html', 'spiky-teacher-r01/app.js', 'spiky-teacher-r01/style.css',
];
const here = path.dirname(fileURLToPath(import.meta.url));
const exists = async file => { try { await access(file); return true; } catch { return false; } };

export async function loadProductionFiles() {
  let root = process.env.CORAL_APP_ROOT ? path.resolve(process.env.CORAL_APP_ROOT) : path.resolve(here, '../..');
  if (!process.env.CORAL_APP_ROOT && !await exists(path.join(root, 'runtime.js'))) root = path.join(root, 'publish');
  const fallback = process.env.CORAL_BASELINE_ROOT ? path.resolve(process.env.CORAL_BASELINE_ROOT)
    : path.basename(root) === 'publish' ? path.resolve(root, '../baseline') : null;
  const files = new Map(), provenance = [];
  for (const name of requiredFiles) {
    const candidates = [path.join(root, name), ...(fallback ? [path.join(fallback, name)] : [])];
    const found = await Promise.all(candidates.map(exists));
    const selected = candidates[found.indexOf(true)];
    assert.ok(selected, `Required public host file absent: ${name}. Set CORAL_APP_ROOT to the complete public Coral directory.`);
    // Only this hardcoded HTML/JS/CSS allowlist is ever opened. No traversal or asset scan.
    const canonical = await realpath(selected);
    assert.ok(!canonical.split(path.sep).includes('private'), 'Private paths are forbidden');
    const body = await readFile(canonical, 'utf8');
    files.set(name, body);
    provenance.push({ name, sourceSHA256: sha256(body), sourceBytes: Buffer.byteLength(body), layer: selected.startsWith(root + path.sep) ? 'app' : 'baseline' });
  }
  return { files, provenance };
}

function replaceExactlyOnce(text, before, after, label) {
  assert.equal(text.split(before).length - 1, 1, `${label}: expected exactly one production anchor`);
  return text.replace(before, after);
}

export function patchLoaderIdentities(production) {
  const served = new Map(production), substitutions = [];
  let replay = production.get('original-replay.js');
  const originalHashes = {};
  for (const id of ['color', 'transparent', 'rosette']) {
    const expression = new RegExp(`\\b${id}:\\{sha256:'([a-f0-9]{64})',bytes:(\\d+)`);
    const match = replay.match(expression);
    assert.ok(match, `Missing production manifest entry: ${id}`);
    originalHashes[id] = match[1];
    const replacement = `${id}:{sha256:'${manifest[id].sha256}',bytes:${manifest[id].bytes}`;
    replay = replaceExactlyOnce(replay, match[0], replacement, `${id} manifest`);
    substitutions.push({ file: 'original-replay.js', before: match[0], after: replacement });
  }
  served.set('original-replay.js', replay);
  const runtime = replaceExactlyOnce(production.get('runtime.js'), originalHashes.rosette, manifest.rosette.sha256, 'legacy Flower hash');
  served.set('runtime.js', runtime);
  substitutions.push({ file: 'runtime.js', before: originalHashes.rosette, after: manifest.rosette.sha256 });
  let spiky = production.get('spiky-teacher-r01/app.js');
  const hash = spiky.match(/SOURCE_SHA='[a-f0-9]{64}'/);
  const count = spiky.match(/bytes\.byteLength!==\d+/);
  assert.ok(hash && count, 'Missing Spiky hash/byte anchors');
  for (const [before, after] of [[hash[0], `SOURCE_SHA='${sha256(spikySource)}'`], [count[0], `bytes.byteLength!==${Buffer.byteLength(spikySource)}`]]) {
    spiky = replaceExactlyOnce(spiky, before, after, 'Spiky identity');
    substitutions.push({ file: 'spiky-teacher-r01/app.js', before, after });
  }
  served.set('spiky-teacher-r01/app.js', spiky);
  for (const [name, text] of served) {
    let reversed = text;
    for (const item of substitutions.filter(item => item.file === name).reverse()) reversed = replaceExactlyOnce(reversed, item.after, item.before, `reverse ${name}`);
    assert.equal(reversed, production.get(name), `Non-identity production edit detected: ${name}`);
  }
  return { served, substitutions: substitutions.map(({ file, before, after }) => ({ file, kind: before.includes('bytes') || before.includes('byteLength') ? 'hash-and/or-byte-identity' : 'hash-identity', beforeSHA256: sha256(before), afterSHA256: sha256(after) })) };
}

export async function installRoutes(context, served, audit) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    // No route.continue(), network fallback, public shader fetch, or filesystem wildcard.
    audit.requests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    if (url.origin !== ORIGIN || request.method() !== 'GET') {
      audit.blocked.push({ reason: 'outside synthetic origin or GET scope', origin: url.origin, path: url.pathname });
      return route.abort('blockedbyclient');
    }
    if (request.resourceType() === 'image' || url.pathname === '/favicon.ico') {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: previewSVG });
    }
    if (!url.pathname.startsWith(BASE)) {
      audit.blocked.push({ reason: 'outside Coral test prefix', path: url.pathname });
      return route.abort('blockedbyclient');
    }
    let name = decodeURIComponent(url.pathname.slice(BASE.length));
    if (!name || name.endsWith('/')) name += 'index.html';
    if (name === 'spiky-teacher-r01/original-shader.frag') return route.fulfill({ status: 200, contentType: 'text/plain', body: spikySource });
    if (name === 'spiky-teacher-r01/material.glsl') return route.fulfill({ status: 200, contentType: 'text/plain', body: materialSource });
    if (!served.has(name)) {
      audit.blocked.push({ reason: 'not in hardcoded host allowlist', path: url.pathname });
      return route.abort('blockedbyclient');
    }
    const type = name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript';
    return route.fulfill({ status: 200, contentType: `${type}; charset=utf-8`, body: served.get(name) });
  });
}
