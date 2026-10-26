#!/usr/bin/env node

const fixtures = [
  {
    id: "shell_only_with_labels",
    expected: "REJECT_SHELL_ONLY",
    producer: "p1", verifier: "v1",
    systems: [
      {id:"envelope", requirement:"REQUIRED", status:"VERIFIED", nodes:["shell"], edges:[], evidence:["e-shell"]},
      {id:"columns", requirement:"REQUIRED", status:"CLAIMED", nodes:[], edges:[], evidence:["label-columns"]},
      {id:"beams", requirement:"REQUIRED", status:"CLAIMED", nodes:[], edges:[], evidence:["label-beams"]}
    ]
  },
  {
    id: "detailed_facade_no_system_graph",
    expected: "REJECT_REQUIRED_SYSTEM_MISSING",
    producer: "p1", verifier: "v1",
    systems: [
      {id:"envelope", requirement:"REQUIRED", status:"VERIFIED", nodes:["facade-detail"], edges:[], evidence:["e-facade"]},
      {id:"columns", requirement:"REQUIRED", status:"MISSING", nodes:[], edges:[], evidence:[]},
      {id:"beams", requirement:"REQUIRED", status:"MISSING", nodes:[], edges:[], evidence:[]}
    ]
  },
  {
    id: "parts_without_relations",
    expected: "REJECT_RELATION_MISSING",
    producer: "p1", verifier: "v1",
    systems: [
      {id:"columns", requirement:"REQUIRED", status:"VERIFIED", nodes:["c1"], edges:[], evidence:["e-c"]},
      {id:"beams", requirement:"REQUIRED", status:"VERIFIED", nodes:["b1"], edges:[], evidence:["e-b"]}
    ],
    requiredRelations:[{id:"columns-support-beams", status:"MISSING", edges:[], evidence:[]}]
  },
  {
    id: "door_mesh_without_host_relation",
    expected: "REJECT_RELATION_MISSING",
    producer: "p1", verifier: "v1",
    systems: [
      {id:"walls", requirement:"REQUIRED", status:"VERIFIED", nodes:["w1"], edges:[], evidence:["e-w"]},
      {id:"doors", requirement:"REQUIRED", status:"VERIFIED", nodes:["d1"], edges:[], evidence:["e-d"]}
    ],
    requiredRelations:[{id:"door-hosted-by-opening", status:"MISSING", edges:[], evidence:[]}]
  },
  {
    id: "basement_requirement_unknown",
    expected: "HOLD_REQUIREMENT_UNKNOWN",
    producer: "p1", verifier: "v1",
    systems: [
      {id:"envelope", requirement:"REQUIRED", status:"VERIFIED", nodes:["shell"], edges:[], evidence:["e-shell"]},
      {id:"basement", requirement:"UNKNOWN", status:"UNKNOWN", nodes:[], edges:[], evidence:["source-insufficient"]}
    ]
  },
  {
    id: "basement_not_applicable_with_source",
    expected: "CANDIDATE_READY",
    producer: "p1", verifier: "v1",
    systems: [
      {id:"envelope", requirement:"REQUIRED", status:"VERIFIED", nodes:["shell"], edges:[], evidence:["e-shell"]},
      {id:"columns", requirement:"REQUIRED", status:"VERIFIED", nodes:["c1"], edges:[], evidence:["e-c"]},
      {id:"beams", requirement:"REQUIRED", status:"VERIFIED", nodes:["b1"], edges:[], evidence:["e-b"]},
      {id:"doors", requirement:"REQUIRED", status:"VERIFIED", nodes:["d1"], edges:[], evidence:["e-d"]},
      {id:"basement", requirement:"NOT_APPLICABLE", status:"NOT_APPLICABLE", nodes:[], edges:[], evidence:["reference-no-basement"]}
    ],
    requiredRelations:[
      {id:"columns-support-beams", status:"VERIFIED", edges:["c1->b1"], evidence:["e-cb"]},
      {id:"door-hosted-by-opening", status:"VERIFIED", edges:["d1->opening1"], evidence:["e-do"]}
    ]
  },
  {
    id: "full_graph_self_verified",
    expected: "REJECT_PRODUCER_SELF_APPROVAL",
    producer: "p1", verifier: "p1",
    systems: [
      {id:"columns", requirement:"REQUIRED", status:"VERIFIED", nodes:["c1"], edges:[], evidence:["e-c"]},
      {id:"beams", requirement:"REQUIRED", status:"VERIFIED", nodes:["b1"], edges:[], evidence:["e-b"]}
    ],
    requiredRelations:[{id:"columns-support-beams", status:"VERIFIED", edges:["c1->b1"], evidence:["e-cb"]}]
  },
  {
    id: "full_graph_independent_verifier",
    expected: "CANDIDATE_READY",
    producer: "p1", verifier: "v1",
    systems: [
      {id:"envelope", requirement:"REQUIRED", status:"VERIFIED", nodes:["shell"], edges:[], evidence:["e-shell"]},
      {id:"columns", requirement:"REQUIRED", status:"VERIFIED", nodes:["c1"], edges:[], evidence:["e-c"]},
      {id:"beams", requirement:"REQUIRED", status:"VERIFIED", nodes:["b1"], edges:[], evidence:["e-b"]},
      {id:"doors", requirement:"REQUIRED", status:"VERIFIED", nodes:["d1"], edges:[], evidence:["e-d"]},
      {id:"basement", requirement:"REQUIRED", status:"VERIFIED", nodes:["bs1"], edges:[], evidence:["e-bs"]}
    ],
    requiredRelations:[
      {id:"columns-support-beams", status:"VERIFIED", edges:["c1->b1"], evidence:["e-cb"]},
      {id:"door-hosted-by-opening", status:"VERIFIED", edges:["d1->opening1"], evidence:["e-do"]},
      {id:"basement-below-ground-floor", status:"VERIFIED", edges:["bs1->ground1"], evidence:["e-bg"]}
    ]
  }
];

function judge(f) {
  if (f.producer === f.verifier) return "REJECT_PRODUCER_SELF_APPROVAL";
  if ((f.systems || []).some(s => s.requirement === "UNKNOWN")) return "HOLD_REQUIREMENT_UNKNOWN";
  const required = (f.systems || []).filter(s => s.requirement === "REQUIRED");
  const missing = required.filter(s => s.status !== "VERIFIED" || !s.nodes?.length || !s.evidence?.length);
  if (missing.length) {
    const shellPresent = required.some(s => s.id === "envelope" && s.status === "VERIFIED" && s.nodes?.length);
    const onlyClaims = missing.every(s => ["CLAIMED", "MISSING"].includes(s.status));
    if (shellPresent && onlyClaims && missing.some(s => s.status === "CLAIMED")) return "REJECT_SHELL_ONLY";
    return "REJECT_REQUIRED_SYSTEM_MISSING";
  }
  const invalidNA = (f.systems || []).filter(s => s.requirement === "NOT_APPLICABLE" && !s.evidence?.length);
  if (invalidNA.length) return "HOLD_REQUIREMENT_UNKNOWN";
  const badRelation = (f.requiredRelations || []).some(r => r.status !== "VERIFIED" || !r.edges?.length || !r.evidence?.length);
  if (badRelation) return "REJECT_RELATION_MISSING";
  return "CANDIDATE_READY";
}

const cases = fixtures.map(f => ({id:f.id, expected:f.expected, actual:judge(f), matched:f.expected===judge(f)}));
const result = {
  probe:"BUILDING-LEARNED-SYSTEMS-NOT-INSTANTIATED-001",
  scope:"representation completeness only; not structural safety certification",
  passed:cases.every(c=>c.matched),
  matched:`${cases.filter(c=>c.matched).length}/${cases.length}`,
  cases
};
process.stdout.write(JSON.stringify(result, null, 2)+"\n");
if (!result.passed) process.exitCode=1;
