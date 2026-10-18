'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const expected = 'd1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const source = process.env.SOURCE_SHA || process.env.GITHUB_SHA || 'local-unpublished';
const host = fs.readFileSync(path.resolve(__dirname, '../human-integrated-r07/preview.html'), 'utf8');
assert.equal(hash(host), expected, 'Frozen R07 changed; review a new host explicitly before integrating');
const moduleText = fs.readFileSync(path.join(__dirname, 'LipControlContract.js'), 'utf8');
new (require('node:vm').Script)(moduleText, { filename: 'LipControlContract.js' });
assert(!moduleText.includes('</script'), 'Unsafe inline script terminator');
const metadata = { version: 'LIP-CONTROL-CONTRACT-R01', sourceCommit: source,
  baseCommit: '5543f756ca3af1428323696324303fa70b8de850', hostSHA256: expected, moduleSHA256: hash(moduleText) };
const suffix = '\n<!-- LIP-CONTROL-CONTRACT-R01 -->\n<script>window.__LIP_CONTROL_CONTRACT_SOURCE__=' +
  JSON.stringify(metadata) + ';\n' + moduleText + '\n</script>\n';
const at = host.lastIndexOf('</body>'); assert(at >= 0, 'Frozen closing body not found');
const preview = host.slice(0, at) + suffix + host.slice(at);
assert.equal(preview.replace(suffix, ''), host, 'Original host must be byte-restorable');
const scripts = s => [...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => hash(m[1]));
assert.deepEqual(scripts(preview).slice(0, scripts(host).length), scripts(host), 'Original scripts changed');
fs.writeFileSync(path.join(__dirname, 'preview.html'), preview);
const manifest = { ...metadata, previewSHA256: hash(preview), previewBytes: Buffer.byteLength(preview),
  originalScriptHashes: scripts(host), originalHostRestorationExact: true,
  geometryChanged: false, shaderChanged: false, archiveSchemaChanged: false,
  inheritedStreamingAssets: true, standaloneOffline: false };
fs.writeFileSync(path.join(__dirname, 'BUILD_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
