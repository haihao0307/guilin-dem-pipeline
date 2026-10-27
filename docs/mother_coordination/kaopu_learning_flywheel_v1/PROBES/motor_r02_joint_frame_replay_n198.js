#!/usr/bin/env node

const subject = {
  commit: "3ccae4bde0c91973adbb81f99ec4d54bc9357ce0",
  fileBlob: "dc3534286d854d403d5da97b03ba2e2f51eba4be",
  sourceContract: {
    door: "T(-.28,.40,z) * RY(s*door) * S(.70,.53,.05)",
    window: "T(-.28,.40,z) * RY(s*door) * T(windowLocal) * S(.68,.23,.03)",
    assembly: "flat assemblyObjects[] + stage scalar; draw = T(stageOffset) * objectMatrix",
    explicitFields: {
      jointFrame: false,
      localPos0: false,
      localPos1: false,
      parentAssembly: false,
      parentId: false,
      hingeLocal: false
    }
  }
};

const radians = d => d * Math.PI / 180;
const rotateY = ([x,y,z], a) => [
  Math.cos(a)*x + Math.sin(a)*z,
  y,
  -Math.sin(a)*x + Math.cos(a)*z
];
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const norm = v => Math.hypot(...v);
const hingeLocal = [0.70,0,0];
const windowLocal = [-0.04,0.72,-0.18];
const angles = [0,15,35,65];

const samples = angles.map(deg => {
  const a = radians(deg);
  const hingeWorld = rotateY(hingeLocal,a);
  const windowWorld = rotateY(windowLocal,a);
  const recoveredWindowRelative = rotateY(windowWorld,-a);
  return {
    deg,
    hingeEdgeWorldDrift: Number(norm(sub(hingeWorld,hingeLocal)).toFixed(9)),
    windowDoorRelativeError: Number(norm(sub(recoveredWindowRelative,windowLocal)).toFixed(12))
  };
});

const hingeFixed = samples.every(s=>s.hingeEdgeWorldDrift<=1e-9);
const childRelativeInvariant = samples.every(s=>s.windowDoorRelativeError<=1e-9);
const explicitDualFrames = subject.sourceContract.explicitFields.localPos0 && subject.sourceContract.explicitFields.localPos1;
const explicitParentAssembly = subject.sourceContract.explicitFields.parentAssembly || subject.sourceContract.explicitFields.parentId;

const assertions = [
  {id:"hinge-fixed-point", expected:false, actual:hingeFixed},
  {id:"window-child-relative-invariant", expected:true, actual:childRelativeInvariant},
  {id:"explicit-dual-local-joint-frames", expected:false, actual:explicitDualFrames},
  {id:"explicit-parent-assembly-graph", expected:false, actual:explicitParentAssembly},
  {id:"center-pivot-negative-control-rejected", expected:true, actual:!hingeFixed}
].map(x=>({...x,matched:x.expected===x.actual}));

const result = {
  probe:"MOTOR-R02-JOINT-FRAME-REPLAY-N198",
  applicableRegression:"MOTOR-ARTICULATED-CHILD-TRANSFORM-001",
  teacherMethodCandidate:"OpenUSD dual local joint-frame semantics from N196",
  evidenceLayer:"SOURCE_PLUS_SYNTHETIC_NUMERIC_REPLAY",
  subject,
  epsilon:1e-9,
  samples,
  verdicts:{
    hingeFixedPoint:hingeFixed?"PASS":"FAIL",
    windowChildAttachment:childRelativeInvariant?"PASS":"FAIL",
    explicitDualJointFrames:explicitDualFrames?"PASS":"FAIL",
    explicitParentAssemblyGraph:explicitParentAssembly?"PASS":"FAIL",
    stagedAssemblyMeaning:"VISUAL_TIMELINE_ONLY",
    overall:"HOLD_GATE_FAIL_ROOT_CAUSE_PERSISTS"
  },
  assertions,
  replayMatched:`${assertions.filter(x=>x.matched).length}/${assertions.length}`,
  ci:{workflowRuns:0,commitStatuses:0},
  limitations:[
    "No browser, GPU, visual-fidelity, or user-acceptance claim is made.",
    "The numeric replay evaluates the exact source transform contract, not rendered pixels."
  ]
};

process.stdout.write(JSON.stringify(result,null,2)+"\n");
if (!assertions.every(x=>x.matched)) process.exitCode=1;
