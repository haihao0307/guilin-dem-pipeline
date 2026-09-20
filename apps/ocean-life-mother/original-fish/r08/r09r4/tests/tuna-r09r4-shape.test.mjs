import assert from "node:assert/strict";
import fs from "node:fs";
const root=new URL("../",import.meta.url);
const s=JSON.parse(fs.readFileSync(new URL("TUNA_R09R4_PRIMARY_SHAPE.json",root)));
const g=JSON.parse(fs.readFileSync(new URL("SHAPE_GATE_R09R4.json",root)));
const q=JSON.parse(fs.readFileSync(new URL("QA_RECEIPT.json",root)));
let n=0;
const ok=(v,m)=>{assert(v,m);n++};
ok(s.sourceSha256==="f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0","source");
ok(s.representation.sourceRuntimeDependency===false,"runtime");
ok(s.counts.nativeVertices>48000&&s.counts.nativeFaces>93000,"dimension");
ok(s.distanceQA.candidateToSourceRmsPctL<0.30,"c2s");
ok(s.distanceQA.sourceToCandidateRmsPctL<0.35,"s2c");
for(const v of ["side_left","three_quarter","front","top"]){
  ok(g.views[v].iou>0.974,`${v} iou`);
  ok(g.views[v].boundaryP95Px<2.75,`${v} p95`);
}
ok(g.landmarks.snout.errorPctL<0.01,"snout");
ok(g.landmarks.dorsalExtreme.errorPctL<0.001,"dorsal");
ok(q.gateDecision.primarySilhouette==="PROVISIONAL_PASS","provisional");
ok(q.gateDecision.overallShape==="HOLD","hold");
ok(q.gateDecision.materials==="CLOSED"&&q.gateDecision.motion==="CLOSED","closed");
for(const r of q.browserRuns){
  ok(r.webglError===0,`${r.name} webgl`);
  ok(r.horizontalOverflow===0,`${r.name} overflow`);
  ok(r.pageErrors.length===0&&r.consoleErrors.length===0,`${r.name} errors`);
}
console.log(`Original Fish Tuna R09R4: ${n} assertions passed`);
