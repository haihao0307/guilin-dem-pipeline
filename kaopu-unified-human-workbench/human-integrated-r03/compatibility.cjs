'use strict';
const assert = require('node:assert/strict');
/** Integration-only bridge. R04's standalone builder injected lip exclusion
 * before applying the ear layer; ET19 retains the original host masks. Match
 * those actual inputs then apply both bounded exclusions. Donors stay intact. */
const bridges = [
 ["patch(shader.fragmentShader,'*csCover*uIEnabled*iInside*(1.-lpMask);','*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);')", "patch(shader.fragmentShader,'*csCover*uIEnabled*iInside;','*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);')"],
 ["patch(shader.fragmentShader,'vec4(fDiffuse,fMask*(1.-lpMask*.65))','vec4(fDiffuse,fMask*(1.-lpMask*.65)*(1.-eaM*.86))')", "patch(shader.fragmentShader,'vec4(fDiffuse,fMask)','vec4(fDiffuse,fMask*(1.-lpMask*.65)*(1.-eaM*.86))')"],
 ["patch(shader.fragmentShader,'vec4(diffuseColor.rgb,fMask*(1.-lpMask*.65))','vec4(diffuseColor.rgb,fMask*(1.-lpMask*.65)*(1.-eaM*.86))')", "patch(shader.fragmentShader,'vec4(diffuseColor.rgb,fMask)','vec4(diffuseColor.rgb,fMask*(1.-lpMask*.65)*(1.-eaM*.86))')"]
];
exports.adapt = function adapt(source, relativePath, records) {
 if (!relativePath.endsWith('/ear-root-r04/EarMaterial.mjs')) return source;
 for (const [before, after] of bridges) {
  assert.equal(source.split(before).length, 2, 'Pinned R04 identity/diffusion bridge changed: '+before);
  records.push({path:relativePath,adapter:'original-host-to-ear-et19-mask',exactInputAnchor:before,result:after});
  source=source.replace(before,()=>after);
 }
 return source;
};
if (require.main === module) {
 const fs=require('node:fs'),p=__dirname+'/specialists/ear-root-r04/EarMaterial.mjs',input=fs.readFileSync(p,'utf8'),records=[];
 const output=exports.adapt(input,'kaopu-unified-human-workbench/ear-root-r04/EarMaterial.mjs',records);
 for(const [,after] of bridges)assert(output.includes(after));
 assert.equal(records.length,3);assert.equal(fs.readFileSync(p,'utf8'),input);
 assert.throws(()=>exports.adapt(output,'kaopu-unified-human-workbench/ear-root-r04/EarMaterial.mjs',[]));
 assert.equal(exports.adapt(input,'unrelated.mjs',[]),input);
 console.log('PASS integration bridge: three exact host anchors, combined lip/ear exclusions, immutable donor, fail on drift');
}
