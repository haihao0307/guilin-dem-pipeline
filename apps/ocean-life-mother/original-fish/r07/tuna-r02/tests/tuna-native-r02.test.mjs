import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('./',import.meta.url);
const profile=JSON.parse(fs.readFileSync(new URL('TUNA_NATIVE_PROFILE_R02.json',root),'utf8'));
const qa=JSON.parse(fs.readFileSync(new URL('QA_RECEIPT.json',root),'utf8'));
const html=fs.readFileSync(new URL('index.html',root),'utf8');
let checks=0;const ok=(v,m)=>{assert(v,m);checks++};
ok(profile.schema==='kaopu.original-fish.tuna-native-profile/0.2','schema');
ok(profile.source.referenceId==='FISH-REF-002','reference');
ok(profile.source.geometryRigMotion.sha256==='f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0','low hash');
ok(profile.source.appearance.sha256==='5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe','high hash');
ok(profile.source.sourceRuntimeDependency===false,'no source runtime');
ok(profile.bodySections.length===33,'33 body sections');
let last=-1;
for(const [i,s] of profile.bodySections.entries()){
  ok(s.length===5,`section ${i} shape`);ok(s.every(Number.isFinite),`section ${i} finite`);
  ok(s[0]>last,`section ${i} monotonic`);last=s[0];ok(s[1]>0,`section ${i} width`);ok(s[2]>s[3],`section ${i} height`);
}
ok(profile.bodySections[0][1]<0.02,'tail peduncle slender');ok(profile.bodySections.at(-1)[1]<0.03,'snout slender');
for(const k of ['dorsal_main','dorsal_rear','anal','caudal_upper','caudal_lower']){
 const p=profile.sideFinPolygons[k];ok(Array.isArray(p)&&p.length>=7,`${k} polygon`);ok(p.flat().every(Number.isFinite),`${k} finite`);
}
for(const pair of [['pectoral_left','pectoral_right'],['pelvic_left','pelvic_right']]){
 const a=profile.lateralFinPolygons3D[pair[0]],b=profile.lateralFinPolygons3D[pair[1]];ok(a.length===b.length,`${pair[0]} symmetry count`);
 for(let i=0;i<a.length;i++){const target=[-a[i][0],a[i][1],a[i][2]];const d=Math.min(...b.map(q=>Math.hypot(q[0]-target[0],q[1]-target[1],q[2]-target[2])));ok(d<0.04,`${pair[0]} lateral mirror ${i}`)}
}
ok(profile.eyes.opaque.length===2,'two eyes');ok(profile.eyes.cornea.length===2,'two corneas');
ok(profile.semanticRig.nativeControls===24,'24 native controls');ok(profile.semanticRig.sourceJoints===98,'98 source joints recorded');
ok(profile.semanticRig.sourceClipPeriodSeconds>2&&profile.semanticRig.sourceClipPeriodSeconds<2.3,'source period');
ok(profile.evidenceBoundary.notNatureDerived===true,'not nature derived');ok(profile.evidenceBoundary.productionReady===false,'not production ready');
ok(!html.includes('tuna_fish.glb')&&!html.includes('tuna_fish (1)(1).glb'),'no raw source file dependency in html');
ok(html.includes('source dependency=false'),'runtime boundary visible');
ok(qa.runs.length===2,'two browser runs');
for(const run of qa.runs){ok(run.pageErrors.length===0,`${run.name} no page errors`);ok(run.consoleErrors.length===0,`${run.name} no console errors`);ok(run.horizontalOverflow===0,`${run.name} no overflow`);for(const v of run.views)ok(v.webglError===0,`${run.name} ${v.view} webgl`)}
const h=crypto.createHash('sha256').update(html).digest('hex');ok(h===qa.candidate.htmlSha256,'html hash');ok(qa.candidate.sourceRuntimeDependency===false,'qa no source dependency');ok(qa.candidate.visualAcceptance===false,'visual acceptance false');
console.log(`Original Fish Tuna R02: ${checks} assertions passed`);
