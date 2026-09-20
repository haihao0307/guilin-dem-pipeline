import assert from "node:assert/strict";
import fs from "node:fs";
const root=new URL("../",import.meta.url);
const p=JSON.parse(fs.readFileSync(new URL("FISH_3A_QUALITY_GATE_R1.json",root)));
const q=JSON.parse(fs.readFileSync(new URL("QA_RECEIPT.json",root)));
let n=0;
const ok=(v,m)=>{assert(v,m);n++};
ok(p.policy==="all_required_gates_must_pass_no_weighted_average","policy");
ok(p.stages.length===8,"stages");
const t=p.stages.find(x=>x.id==="Q1_PRIMARY_SHAPE").thresholds;
for(const v of Object.values(q.fixedViews)){
  ok(v.iou<t.fixedViewIouMin||v.xorPctUnion>t.fixedViewXorPctMax||v.boundaryP95Px>t.boundaryP95PxMax,"current candidate must not falsely pass final Q1");
}
ok(q.gateDecision.overallShape==="HOLD","overall hold");
ok(q.gateDecision.materials==="CLOSED","materials closed");
ok(q.gateDecision.motion==="CLOSED","motion closed");
ok(q.visualSelfReview.accepted===false,"visual false");
ok(q.publication.attempted===false,"publication false");
console.log(`FISH 3A gate regression: ${n} assertions passed; current candidate correctly remains HOLD`);
