'use strict';
const assert=require('node:assert/strict');
/** Integration-only bridge. All retained donor/host sources remain unchanged.
 * Match the complete known upstream expressions; unexpected drift must fail. */
const earBridges=[
 ["patch(shader.fragmentShader,'*csCover*uIEnabled*iInside*(1.-lpMask);','*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);')","patch(shader.fragmentShader,'*csCover*uIEnabled*iInside;','*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);')",1],
 ["patch(shader.fragmentShader,'vec4(fDiffuse,fMask*(1.-lpMask*.65))','vec4(fDiffuse,fMask*(1.-lpMask*.65)*(1.-eaM*.86))')","patch(shader.fragmentShader,'vec4(fDiffuse,fMask)','vec4(fDiffuse,fMask*(1.-lpMask*.65)*(1.-eaM*.86))')",1],
 ["patch(shader.fragmentShader,'vec4(diffuseColor.rgb,fMask*(1.-lpMask*.65))','vec4(diffuseColor.rgb,fMask*(1.-lpMask*.65)*(1.-eaM*.86))')","patch(shader.fragmentShader,'vec4(diffuseColor.rgb,fMask)','vec4(diffuseColor.rgb,fMask*(1.-lpMask*.65)*(1.-eaM*.86))')",1]
];
const idleBridges=[
 ['csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65)','csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65)*(1.-eaM)',2],
 ['h*=fMask*fHostDetail*(1.-lpMask)','h*=fMask*fHostDetail*(1.-lpMask)*(1.-eaM)',2],
 ['lpMoist*uLWet*.20','lpMoist*lpWetGain*.24',1],
 ['float idleDrySkin=fMask*(1.-lpMask)','float idleDrySkin=fMask*(1.-lpMask)*(1.-eaM)',1]
];
const makeupBridges=[['clamp(vFA.x,0.,1.)*csCover*(1.-clamp(vFA.y*4.,0.,1.))','clamp(vFA.x,0.,1.)*csCover*(1.-clamp(vFA.y*4.,0.,1.))*(1.-lpMask)*(1.-eaM)',1]];
exports.adapt=function adapt(source,relativePath,records){
 if(relativePath.endsWith('/skin-dna-r02-1/Anatomy.mjs')){const a='model.regionalFace=api;';assert.equal(source.split(a).length,2);source="import {installAttributeBudget} from './AttributeBudget.mjs';\n"+source.replace(a,a+'installAttributeBudget(model);');records.push({path:relativePath,adapter:'lossless-vertex-slot-packing',exactInputAnchor:a});}
 const bridges=relativePath.endsWith('/ear-root-r04/EarMaterial.mjs')?earBridges:relativePath.endsWith('/idle-r01/IdleSkin.mjs')?idleBridges:relativePath.endsWith('/skin-folds-r02/FoldSkin.mjs')?makeupBridges:[];
 for(const [before,after,count]of bridges){assert.equal(source.split(before).length,count+1,'Pinned composition anchor changed: '+relativePath+' '+before);source=source.split(before).join(after);records.push({path:relativePath,adapter:'unified-specialist-ownership',exactInputAnchor:before,result:after,occurrences:count});}
 return source;
};
if(require.main===module){
 const fs=require('node:fs');let checks=0;
 for(const [p,rel,bridges]of [
  [__dirname+'/specialists/ear-root-r04/EarMaterial.mjs','ear-root-r04/EarMaterial.mjs',earBridges],
  [__dirname+'/../idle-r01/IdleSkin.mjs','idle-r01/IdleSkin.mjs',idleBridges],
  [__dirname+'/../skin-folds-r02/FoldSkin.mjs','skin-folds-r02/FoldSkin.mjs',makeupBridges]
 ]){const input=fs.readFileSync(p,'utf8'),records=[],output=exports.adapt(input,'kaopu-unified-human-workbench/'+rel,records);for(const [,after]of bridges)assert(output.includes(after));assert.equal(records.length,bridges.length);assert.equal(fs.readFileSync(p,'utf8'),input);assert.equal(exports.adapt(input,'unrelated.mjs',[]),input);assert.throws(()=>exports.adapt(input.replace(bridges[0][0],'broken-anchor'),'kaopu-unified-human-workbench/'+rel,[]));checks+=bridges.length;}
 const input=fs.readFileSync(__dirname+'/Anatomy.mjs','utf8'),output=exports.adapt(input,'kaopu-unified-human-workbench/skin-dna-r02-1/Anatomy.mjs',[]);assert(output.includes('installAttributeBudget(model)'));
 console.log('PASS '+checks+' exact compatibility expressions and attribute-packing activation; donor immutability and drift rejection');
}
