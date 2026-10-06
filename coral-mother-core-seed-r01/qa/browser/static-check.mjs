import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { LABEL, legacyBundle, legacyHash, manifest, originalsBundle, originalsHash, records, sha256, sources, spikySource } from './fixtures.mjs';
import { loadProductionFiles, patchLoaderIdentities } from './route-host.mjs';

export async function staticCheck() {
  const { files, provenance } = await loadProductionFiles();
  const { served, substitutions } = patchLoaderIdentities(files);
  for (const [name, source] of served) if (name.endsWith('.js')) new Script(source, { filename: name });
  for (const [compressed, expected] of [[originalsHash, originalsBundle], [legacyHash, legacyBundle]]) {
    assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(compressed, 'base64url')).toString()), expected);
  }
  assert.equal(records.length, 3);
  assert.equal(new Set(records.map(x => x.id)).size, 3);
  for (const record of records) {
    assert.equal(record.sha256, sha256(record.source));
    assert.equal(Buffer.byteLength(record.source), manifest[record.id].bytes);
    assert.ok(record.source.includes('Self-authored synthetic'));
  }
  for (const id of ['color', 'transparent']) assert.equal([...sources[id].matchAll(/(^[ \t]*mat3\s+ca\s*=)/gm)].length, 1);
  assert.ok(sources.rosette.includes('void main(){ mainImage(fragColorOut, gl_FragCoord.xy); }'));
  for (const anchor of ['vec2 uv = (2.0 * I - iResolution.xy) / iResolution.y;', 'vec3 rd = normalize(vec3(uv, -1.0));', 'color = mix(proColor, texColor, 0.3315);']) assert.equal(spikySource.split(anchor).length - 1, 1);
  assert.ok(originalsHash.length < 60000 && legacyHash.length < 100000);
  return { label: LABEL, staticStatus: 'PASS', browserStatus: 'NOT RUN BY STATIC CHECK', productionFiles: provenance, identitySubstitutions: substitutions, syntheticManifest: manifest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await staticCheck(), null, 2));
}
