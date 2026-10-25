'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert'),base=require('./model_path').modelPath();const ctx={};ctx.window=ctx;vm.createContext(ctx);for(const f of ['scene.js','dynamic.js','outside_valve_solver.js'])vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),ctx);
const Params=require(path.join(base,'topology-parameters'));
const old=require(path.join(base,'gresley_solver')),S=require(path.join(base,'stack-reconstruction/stack_candidate')),I=require(path.join(base,'stack-reconstruction/integration_spec'));
const {createSideOffsetGresleySolver:make}=require('./side_offset_solver'),C=require('./installation_constraints'),outside=ctx.createOutsideValveSolver(ctx.DYNAMIC),original=old.createGresleySolver(ctx.SCENE,ctx.DYNAMIC,outside),neutral=make(ctx.SCENE,ctx.DYNAMIC,outside,{middleX:0});
let baselineError=0,frameError=0;const outsideRanges={left:[Infinity,-Infinity],right:[Infinity,-Infinity]};for(let i=0;i<=1440;i++)for(const side of ['left','right']){const z=outside.pose(.4+i*2*Math.PI/1440,side).spindleZ;outsideRanges[side][0]=Math.min(outsideRanges[side][0],z);outsideRanges[side][1]=Math.max(outsideRanges[side][1],z);assert(z>=4.02&&z<=4.18);} for(let i=0;i<=360;i++){const theta=.4+i*Math.PI/180,a=original.pose(theta),b=neutral.pose(theta);for(const k of Object.keys(a.pins))for(let j=0;j<3;j++)baselineError=Math.max(baselineError,Math.abs(a.pins[k][j]-b.pins[k][j]));}assert(baselineError<1e-12);
const report={outsideRanges,sampledOutsideInputsInsideConditionalBox:true,outsideAllPhaseContainmentProved:false,baselineReplayMaxErrorM:baselineError,candidates:[],deliberateFailures:[],wholeAcceptance:false};
const profiles=S.inspect(ctx.SCENE,original.reference);
for(const middleX of [Math.abs(Params.middleX),-Math.abs(Params.middleX)]){
 const G=make(ctx.SCENE,ctx.DYNAMIC,outside,{middleX,planeY:Params.planeY,pivotZ:Params.pivotZ,middleLinkLength:Params.middleLinkLength,middleSpindleLength:Params.middleSpindleLength}),d=S.derive(profiles,G.reference,{}, {terminalEyes:true});
 // Existing profiles retain spindle length1.15; consumers must update middle-only profile before building fields.
 const prof=JSON.parse(JSON.stringify(profiles));prof.spindles.M.length=G.reference.lengths.middleSpindle;
 const pack=I.pack(d,prof,G.pose(.4));
 for(let i=0;i<=360;i++){
  const theta=.4+i*Math.PI/180,p=G.pose(theta);assert(p.diagnostics.maxLengthError<2e-12);
  assert(Math.abs(p.pins.R[0]-.98)<1e-15&&Math.abs(p.pins.L[0]+.98)<1e-15);assert(p.pins.M[0]===middleX);
  for(const field of pack.fields){const f=G.transformFor(field.referenceRigidFrameSourcePartId,p),q=[.12,1.49,5.42],t=G.transformPoint(q,f),b=G.transformPoint(t,f,true);frameError=Math.max(frameError,...b.map((v,j)=>Math.abs(v-q[j])));}
 }
 const gates=C.cycleGates(G,{guideEnd:Params.chest.guideEnd,rearGlandStart:Params.chest.rear-Params.chest.coverThickness,frontGlandEnd:Params.chest.front+Params.chest.coverThickness,linerRear:Params.chest.rear,linerFront:Params.chest.front,headCentres:Params.chest.headCentres,headHalfLength:Params.chest.headHalfLength}),lat=C.lateralMargins(middleX,{chestOuterRadius:Params.chest.outerRadius,valveBoreRadius:Params.chest.boreRadius});assert(gates.margins.terminalEyeToGuideAfterAllowance>0);assert(gates.margins.rearSpindleBeyondGlandAfterReserve>0);assert(lat.margins.chestToPowerBore>=.005-1e-12&&lat.margins.powerShellToValveBore>=.005-1e-12&&lat.margins.chestToFrame>=.005-1e-12);
 report.candidates.push({middleX,reference:G.reference,profileCount:pack.parts.length,cycle:gates,lateral:lat});
}
for(const options of [{middleAxisTilt:.126},{planeY:1.52},{middleX:-.98},{inputFrontDatumZ:5.3}]){assert.throws(()=>make(ctx.SCENE,ctx.DYNAMIC,outside,options));report.deliberateFailures.push(options);}
const short=make(ctx.SCENE,ctx.DYNAMIC,outside,{middleX:.38,middleLinkLength:.25,middleSpindleLength:1.15});const shortG=C.cycleGates(short,{samples:361});assert(shortG.margins.rearSpindleBeyondGlandAfterReserve<0);report.retainedShortSpindleFailure={...shortG,caseNote:'Retained earlier rear gland station4.228; moving terminal forward while retaining shaft1.15 fails that configuration.'};
// The existing outside-chest shell radius cannot fit this disjoint current-frame corridor.
assert(!C.lateralFamily({chestOuterRadius:.1693}).sharedCastingWithSeparateUncutBores.nonempty);
// Literal bores cannot be occupied by the explicitly added web; no original solid is subtracted.
let boreQueries=0,minWebInBore=Infinity;for(const sign of [-1,1])for(let z=4.4;z<=5.0;z+=.01)for(let k=0;k<48;k++){
 const angle=k*2*Math.PI/48,cp=C.powerAxisAtWorldZ(z,.126),r=.23495*.99,x=r*Math.cos(angle),y=cp[1]+r*Math.sin(angle)/Math.cos(.126);
 // Correct by exact normal coordinate: y above gives transverse radius r exactly.
 const a=C.connectionWeb([x,y,z],{middleX:sign*.38}),rv=.1143*.99,b=C.connectionWeb([sign*.38+rv*Math.cos(angle),1.48+rv*Math.sin(angle),z],{middleX:sign*.38});assert(a>0&&b>0);minWebInBore=Math.min(minWebInBore,a,b);boreQueries+=2;
}
report.forwardInverseMaxErrorM=frameError;assert(frameError<3e-14);report.webBoreQueries=boreQueries;report.minimumPositiveWebFieldInsideBores=minWebInBore;
fs.writeFileSync(path.join(__dirname,'SOLVER_QA.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'CANDIDATE_REFERENCES.json'),JSON.stringify(report.candidates.map(c=>c.reference),null,2)+'\n');console.log(JSON.stringify({baselineError,frameError,candidates:report.candidates.map(c=>({middleX:c.middleX,cycle:c.cycle,interval:c.lateral.sharedCastingWithSeparateUncutBores.absoluteMiddleXInterval})),boreQueries,wholeAcceptance:false},null,2));
