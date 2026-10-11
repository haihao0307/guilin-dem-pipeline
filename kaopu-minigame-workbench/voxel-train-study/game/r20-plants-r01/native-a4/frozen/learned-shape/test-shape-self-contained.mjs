import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {generate} from './derived/train-shape-only.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const recipe=JSON.parse(fs.readFileSync(path.join(root,'recovered-recipe.json'),'utf8'));
globalThis.fetch=()=>{throw Error('NO_NETWORK_PERMITTED_IN_SHAPE_TEST');};
const model=generate(recipe);
assert.equal(recipe.generator,'steam_train');
assert.equal(model.parts.filter(p=>p.name==='动轮轴总成').length,3);
assert.equal(model.parts.filter(p=>p.name==='承载轮轴总成').length,7); // 2 front + 1 rear + 4 tender.
assert.equal(model.parts.filter(p=>p.name==='函数流线罩壳').length,1);
assert.equal(model.parts.filter(p=>p.name==='曲柄、联杆、主连杆和十字头').length,2);
assert.ok(!model.parts.some(p=>/楼体|电车|机械猫|站台|店面/.test(p.name)));
let meshes=0,vertices=0,triangles=0,textureMaps=0,nonfinite=0;
const geometries=new Set();
model.root.traverse(n=>{
 if(n.isMesh){meshes++;geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])if(m[k])textureMaps++;}
});
for(const g of geometries){const a=g.getAttribute('position');vertices+=a.count;triangles+=(g.index?.count??a.count)/3;for(const v of a.array)if(!Number.isFinite(v))nonfinite++;}
assert.equal(textureMaps,0);assert.equal(nonfinite,0);
let closure=0,anchors=0;
for(let i=0;i<=360;i++){
 const t=i/360*2*Math.PI/1.3;model.update(t);
 for(const f of model.checks)closure=Math.max(closure,f(t));
 for(const e of model.anchorErrors())anchors=Math.max(anchors,e);
}
assert.ok(closure<1e-12);assert.ok(anchors<1e-12);
// This documents a known old-schema limitation; it is not silently fixed here.
const zero=structuredClone(recipe);zero.parameters.tenders=0;
const stillTender=generate(zero).parts.filter(p=>p.name==='煤水车 / 水箱 / 悬挂').length;
assert.equal(stillTender,1);
const result={scope:'CPU evaluation of preserved learned shape functions, not WebGL rendering or physical validation',teacherPayloadsRead:0,networkUsed:false,imagesUsed:textureMaps,parts:model.parts.length,meshObjects:meshes,uniqueGeometries:geometries.size,verticesAcrossUniqueGeometries:vertices,trianglesAcrossUniqueGeometries:triangles,nonFinitePositionValues:nonfinite,drivingAxleGroups:3,carryingAxleGroupsIncludingTender:7,externalSliderCrankGroups:2,cycleSamples:361,maxDeclaredRodClosureGameUnits:closure,maxDeclaredAnchorErrorGameUnits:anchors,knownLimitations:{units:'game units; no metre calibration',gauge:'wheel centres hardcoded ±0.94, not a rail-contact gauge contract',cylinderPhases:'two outside groups at 0 and pi/2; no three-cylinder mechanism',tendersZeroCreatesOne:stillTender===1,structuralOrThermalRating:false},allAssertionsPassed:true};
fs.writeFileSync(path.join(root,'SHAPE_TEST_RESULTS.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
