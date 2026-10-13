'use strict';
const assert = require('node:assert/strict');
/** Integration-only source bridge. The donor copies are immutable.
 * R04's standalone builder used to inject lip exclusion into IdentitySkin.
 * This integrated builder uses the retained original IdentitySkin instead.
 * Match that actual upstream anchor, then apply BOTH lip and ear exclusion.
 * Do not hide missing anchors, disable ear material, or roll back ET19 optics.
 */
exports.adapt = function adapt(source, relativePath, records) {
  if (!relativePath.endsWith('/ear-root-r04/EarMaterial.mjs')) return source;
  const before = "patch(shader.fragmentShader,'*csCover*uIEnabled*iInside*(1.-lpMask);','*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);')";
  const after = "patch(shader.fragmentShader,'*csCover*uIEnabled*iInside;','*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);')";
  assert.equal(source.split(before).length, 2, 'Pinned R04 identity bridge changed');
  records.push({path: relativePath, adapter: 'original-identity-to-ear-et19-mask', exactInputAnchor: '*csCover*uIEnabled*iInside;', result: '*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);'});
  return source.replace(before, () => after);
};
if (require.main === module) {
  const fs = require('node:fs');
  const p = __dirname + '/specialists/ear-root-r04/EarMaterial.mjs';
  const input = fs.readFileSync(p, 'utf8'), records = [];
  const output = exports.adapt(input, 'kaopu-unified-human-workbench/ear-root-r04/EarMaterial.mjs', records);
  assert(output.includes("patch(shader.fragmentShader,'*csCover*uIEnabled*iInside;','*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);')"));
  assert.equal(records.length, 1);
  assert.equal(fs.readFileSync(p, 'utf8'), input);
  assert.throws(() => exports.adapt(output, 'kaopu-unified-human-workbench/ear-root-r04/EarMaterial.mjs', []));
  assert.equal(exports.adapt(input, 'unrelated.mjs', []), input);
  console.log('PASS integration bridge: exact anchor, both exclusions, immutable donor, fail on drift');
}
