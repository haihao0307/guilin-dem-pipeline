'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),base=root,S=require('./stack_candidate');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const files=['scene.js','dynamic.js','outside_valve_solver.js','gresley_solver.js','gresley-dynamic.js','app.js'];
const hashes=Object.fromEntries(files.map(f=>[f,hash(path.join(base,f))]));
const c={};c.window=c;vm.createContext(c);for(const f of ['scene.js','dynamic.js'])vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),c);
const outside=require('../outside_valve_solver').createOutsideValveSolver(c.DYNAMIC);
const g=require('../gresley-reconstruction/gresley_solver').createGresleySolver(c.SCENE,c.DYNAMIC,outside);
const profiles=S.inspect(c.SCENE,g.reference),uncut=S.derive(profiles,g.reference),eye=S.derive(profiles,g.reference,{}, {terminalEyes:true});
const write=(name,obj)=>fs.writeFileSync(path.join(__dirname,name),JSON.stringify(obj,null,2)+'\n');
write('SOURCE_PROFILES.json',{baseline:'../scene.js',sourceHashes:hashes,reference:g.reference,profiles,jointGraph:S.JOINTS});
write('UNCUT_STACK_CANDIDATE.json',uncut);write('TERMINAL_EYE_CANDIDATE.json',eye);
const before=JSON.stringify(c.SCENE),pose=g.pose(.4),baseline=S.parts(uncut,profiles,pose).filter(p=>p.kind==='rod').map(p=>({...p,y:[1.468,1.492]}));
const sourceOverlap=[];
for(const[k,names]of Object.entries(S.JOINTS))if(names.length===2){
 const w=pose.pins[k].slice();w[2]+=.02;
 const f=names.map(n=>S.scalar(baseline.find(p=>p.id==='plate/'+n),w));
 assert(Math.max(...f)<-.006);sourceOverlap.push({joint:k,theta:.4,parts:names,witness:w,scalarValues:f,commonInteriorBallRadius:.006});
}
const sweptTheta=.4+2*Math.PI*57/360,sp=g.pose(sweptTheta),bp=S.parts(uncut,profiles,sp).filter(p=>p.kind==='rod').map(p=>({...p,y:[1.468,1.492]})),w=[.02,1.48,5.55];
const vals=['two_to_one_lever','middle_short_link'].map(n=>S.scalar(bp.find(p=>p.id==='plate/'+n),w));assert(Math.max(...vals)<-.002);
sourceOverlap.push({joint:null,theta:sweptTheta,parts:['two_to_one_lever','middle_short_link'],witness:w,scalarValues:vals,commonInteriorBallRadius:.002,meaning:'A third conflicting edge closes main/equal/middle triangle. Under globally flat, unsplit full-thickness plate layering, two levels cannot suffice.'});
const uncutParts=S.parts(uncut,profiles,pose),terminalFailures=['R','L','M'].map(k=>{const a=uncutParts.find(p=>p.id==='pin/'+k),b=uncutParts.find(p=>p.id==='spindle/'+k),w=pose.pins[k];assert(S.scalar(a,w)<0&&S.scalar(b,w)<0);return {joint:k,witness:w,scalarValues:[S.scalar(a,w),S.scalar(b,w)],classification:'FAIL: solid spindle and pin overlap, no Y-axis hole; not a bearing/support',sharedCylinderAlsoSolid:!!profiles.sharedSpindleAliases[k]};});
write('RETAINED_FAILURES.json',{originalBaselineChanged:false,sourceOverlap,terminalFailures,wholeMechanicalAcceptance:false});
const refParts=S.parts(eye,profiles,pose),pairs=[],counts={};
for(let i=0;i<refParts.length;i++)for(let j=i+1;j<refParts.length;j++){
 const result=S.pairRelation(refParts[i],refParts[j]);counts[result.type]=(counts[result.type]||0)+1;
 pairs.push({indices:[i,j],ids:[refParts[i].id,refParts[j].id],...result,minLowerBound:result.lowerBound,minTheta:.4});
}
const dynamic=pairs.filter(p=>['separated_enclosures','UNRESOLVED_enclosure_overlap'].includes(p.type));
console.log('Parts',refParts.length,'pairs',pairs.length,'dynamic enclosure pairs',dynamic.length,'reference relations',counts);
const unresolved=[],N=14400,pinRange={},qRange={left:[Infinity,-Infinity],right:[Infinity,-Infinity],middle:[Infinity,-Infinity]};let maxLength=0,maxResidual=0,left,right,maxXZChange=0;
for(let k=0;k<=N;k++){
 const theta=.4+2*Math.PI*k/N;left=outside.pose(theta,'left',left);right=outside.pose(theta,'right',right);
 const pose=g.fromOutside(left,right),parts=S.parts(eye,profiles,pose);
 maxLength=Math.max(maxLength,pose.diagnostics.maxLengthError);maxResidual=Math.max(maxResidual,pose.outsideResidual);
 for(const[n,p]of Object.entries(pose.pins)){
  pinRange[n]??=[[Infinity,-Infinity],[Infinity,-Infinity]];
  for(let j=0;j<2;j++){const v=p[j*2];pinRange[n][j][0]=Math.min(pinRange[n][j][0],v);pinRange[n][j][1]=Math.max(pinRange[n][j][1],v);}
 }
 for(const n of Object.keys(qRange)){const v=pose['q'+n[0].toUpperCase()+n.slice(1)];qRange[n][0]=Math.min(qRange[n][0],v);qRange[n][1]=Math.max(qRange[n][1],v);}
 for(const pair of dynamic){const r=S.pairRelation(...pair.indices.map(i=>parts[i]));if(r.lowerBound<pair.minLowerBound){pair.minLowerBound=r.lowerBound;pair.minTheta=theta;}if(r.type==='UNRESOLVED_enclosure_overlap'&&unresolved.length<100)unresolved.push({theta,ids:pair.ids,...r});}
 for(const p of parts)if(p.kind==='ring'){maxXZChange=Math.max(maxXZChange,Math.abs(p.center[0]-pose.pins[p.joint][0]),Math.abs(p.center[2]-pose.pins[p.joint][2]));}
}
const unmodified=files.every(f=>hash(path.join(base,f))===hashes[f])&&JSON.stringify(c.SCENE)===before;
assert(unmodified);assert.strictEqual(maxXZChange,0);assert(maxLength<1e-12);assert.strictEqual(unresolved.length,0,JSON.stringify(unresolved.slice(0,10)));
const relevant=pairs.filter(p=>p.type==='separated_axially'||p.type==='separated_enclosures');
const geometryLower=Math.min(...relevant.map(p=>p.minLowerBound));
const timeChecks=[0,2.1,-17,1500].map(Time=>{const p=g.atTime(Time,{},{});return {Time,theta:p.theta,source:'DYNAMIC.state(Time), same outside pair and Gresley pose',XZSame:true};});
const report={nominalCentralGeometricScreenPass:unresolved.length===0,wholeMechanicalAcceptance:false,conditionalOnExplicitTerminalCuts:true,notRenderingAndNotWholeTrainAcceptance:true,sampleCount:N+1,phaseRange:[.4,.4+2*Math.PI],parts:refParts.length,pairs:pairs.length,dynamicEnclosurePairs:dynamic.length,analyticPairClassesAtReference:counts,unresolved,minimumNoncontactEnclosureLowerBoundM:geometryLower,maxRigidLengthErrorM:maxLength,maxOutsideSquaredEquationResidualM2:maxResidual,maxXZPinChangeM:maxXZChange,spindleYChangeM:0,allOriginalPlateDimensionsUnchanged:true,pinRangeXZ:pinRange,qRange,timeChecks,fullCycleSampledOnly:true,upstreamContinuousAllPhaseProof:false,sourceHashes:hashes,originalBaselineUnchanged:unmodified,
 limitations:['R/L/M uncropped source remains a failure; pass applies only to separately proposed through-bored terminal-eye geometry.','Two exact duplicate left/right shared-spindle cylinder fields must receive the same local terminal cuts; no changes were applied.','End-retainer envelopes fit nominally but threads, grooves, locks, assembly sequence, tolerances, lubrication, wear and strength are not proved.','Fixed O pivot has no verified frame mount or load path; middle spindle has no verified prismatic guide/chest.','Only central assembly plus its three spindle bodies are screened; other whole-locomotive solids and upstream interval phase proof are not covered.']};
write('STACK_QA.json',report);write('PAIR_RELATIONS.json',pairs);write('PARTS_REFERENCE.json',refParts);
write('EXPLICIT_MODIFICATION_MANIFEST.json',{applied:false,baselineFilesChanged:false,candidateOnly:true,changes:[
 {kind:'axial relocation',targets:Object.keys(S.RODS),preserved:'all original XZ profiles, thickness 24 mm, eye 33 mm, bore 13.5 mm',newY:eye.derived.layer},
 {kind:'new finite pin extents',targets:Object.keys(S.JOINTS),pinRadiusPreserved:.012,sourcePinLength:.070,newExtents:Object.fromEntries(Object.entries(eye.joints).map(([k,j])=>[k,j.shaftY]))},
 {kind:'explicit addition',targets:['R','L','M'],geometry:'union an eye cylinder centered on retained spindle front XZ and Y=1.48; outer radius retained eye radius 0.033, half-thickness retained spindle radius 0.016'},
 {kind:'explicit subtraction, NOT secretly applied',targets:['valve/right_valve_spindle','valve/left_valve_spindle','valve/middle_valve_spindle_inferred_horizontal','valve_chest/right_shared_valve_spindle','valve_chest/left_shared_valve_spindle'],geometry:'through-Y cylindrical bore of radius 0.0135 at each corresponding retained moving front XZ pin; difference applied to both source representations wherever duplicated',localExtentXZ:'within 13.5 mm of the original spindle front pin',doesNotChange:'spindle centerline/length, cylinder bore, chest bore, official axle stations, other train objects'},
 {kind:'new hardware',geometry:'15 explicitly sized bushings, 7 axial spacers, end washers and end-retainer envelopes; see candidate JSON',lockingAndStrength:'unverified'}],requiredBeforeImplementation:['Retain unchanged baseline and failing uncut candidate labels.','Apply the same terminal subtraction to every duplicate spindle field or the hole stays filled.','Do not claim the missing fixed-pivot frame mount or middle prismatic guide exists.']});
console.log(JSON.stringify(report,null,2));
