import assert from 'node:assert/strict';
import fs from 'node:fs';
import{materialForRecord}from'./facade-materials.mjs';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),app=fs.readFileSync(new URL('./semantic-app.mjs',import.meta.url),'utf8');
assert.match(html,/<button id="semanticMode" hidden/);assert.match(html,/<button id="materialMode" hidden/);
assert(app.includes('integratedHostAll:new URLSearchParams(location.search).get("hostWall")!=="single"'));
for(let i=1;i<=20;i++){const m=materialForRecord({caseId:'kcc',geometryKind:'unsigned-shell-surface',classKey:'wall',sourcePatchId:'p'+String(i).padStart(3,'0'),color:'#aaa'});assert.equal(m.type,2);assert.equal(m.color,'#deded4');}
assert.equal(materialForRecord({caseId:'warehouse',geometryKind:'unsigned-shell-surface',classKey:'wall',sourcePatchId:'p012'}).type,3);
assert.equal(materialForRecord({caseId:'lowrise',geometryKind:'unsigned-shell-surface',classKey:'wall',sourcePatchId:'p001'}).type,1);
console.log(JSON.stringify({passed:true,defaultSixHosts:true,semanticAndLegacyColorButtonsHidden:true,kccFacadeMaterials:20,scope:'static wiring; browser whole-scene verification pending'}));

for(const cls of ['roof','floor','stair','column','beam','elevator','handrail','UNKNOWN']){const m=materialForRecord({caseId:'kcc',classKey:cls,color:'#ff00ff'});assert.notEqual(m.color,'#ff00ff');assert.equal(m.type,1);}
