'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const HERE=__dirname;
const modelArg=process.argv.indexOf('--model');
if(modelArg>=0&&!process.argv[modelArg+1])throw Error('--model requires a path');
const MODEL=path.resolve(modelArg>=0?process.argv[modelArg+1]:(process.env.A4_MODEL_DIR||path.join(HERE,'../r24')));
global.window=global;
vm.runInThisContext(fs.readFileSync(path.join(MODEL,'dynamic.js'),'utf8'));
const {createOutsideValveSolver}=require('./outside_valve_solver');
const S=createOutsideValveSolver(DYNAMIC),dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
assert.deepStrictEqual(S.reference,JSON.parse(fs.readFileSync(path.join(HERE,'reference-endpoints.json'),'utf8')),'Embedded JS reference must match extracted source endpoints');
const scene=JSON.parse(fs.readFileSync(path.join(MODEL,'scene.js'),'utf8').replace(/^window.SCENE=/,'').replace(/;\s*$/,''));
const outsideParts=scene.parts.filter(p=>p.group==='valve'&&/^valve\/(left|right)_/.test(p.id));
assert.equal(outsideParts.length,46);
const jointMembership={return_crank:['B','E'],eccentric_rod:['E','J'],radius_rod:['A','U','D'],union_link:['C','L'],lifting_link:['A','H'],lifting_arm:['K','H'],combination_lever:['L','U'],crosshead_rigid_drop_arm:['C'],main_crank_lateral_mount:['B'],valve_spindle:['V'],expansion_link_slotted_cheeks:['T','J'],die_block:['D'],eccentric_pin_pin:['E'],expansion_tail_pin:['J'],combination_upper_pin:['U'],combination_lower_pin:['L'],valve_crosshead_pin:['V'],crosshead_drop_pin:['C'],radius_lift_pickup_pin:['A'],lift_top_pin:['H'],trunnion_inner_journal:['T'],trunnion_outer_journal:['T']};
const report={scope:'independent JS finite closure; pure study module; no shader/whole-train acceptance',outsideFieldCount:46,wholeAcceptance:false,sides:{}};
let totalCalls=0;
for(const side of ['left','right']){
 const ref=S.reference[side],python=JSON.parse(fs.readFileSync(path.join(HERE,side+'-cycle.json'),'utf8'));
 let p=null,maxEq=0,maxVsPython=0,maxSeam=0,maxTransformJointError=0,maxInverseError=0,maxRandomAccessError=0,maxRigidLengthError=0,maxSameCrossheadError=0;
 for(let k=0;k<python.length;k++){
  const row=python[k];p=S.pose(row.theta,side,p);totalCalls++;
  maxEq=Math.max(maxEq,p.maxEquationResidual);
  maxVsPython=Math.max(maxVsPython,dist(p.state,[row.sigma,row.combinationAngle,row.spindleZ]));
  const c=DYNAMIC.pose(row.theta,side==='left'?0:2,0).s;
  maxSameCrossheadError=Math.max(maxSameCrossheadError,dist(p.yz.C,[.9,c[1]]));
  const lens=[['E','J',1.8],['T','J',.5],['D','U',2.3],['A','D',.276],['A','H',.65],['L','U',.66],['L','V',.58],['U','V',.08],['C','L',.62]];
  maxRigidLengthError=Math.max(maxRigidLengthError,...lens.map(([a,b,l])=>Math.abs(dist(p.yz[a],p.yz[b])-l)));
  if(k%24===0){
   let direct=S.pose(row.theta,side);maxRandomAccessError=Math.max(maxRandomAccessError,dist(p.state,direct.state));
   for(const part of outsideParts.filter(x=>x.id.startsWith('valve/'+side+'_'))){
    const name=part.id.replace('valve/'+side+'_','');
    for(const joint of jointMembership[name]||[]){
     const src=[p.lateral,...ref[joint]],expected=[p.lateral,...p.yz[joint]],trans=S.fieldTransform(part.id,src,p);
     maxTransformJointError=Math.max(maxTransformJointError,dist(trans,expected));
    }
    // All eight AABB corners and a nontrivial interior point test rigid inverse.
    for(let b=0;b<9;b++){
     const src=b===8?part.aabb_min.map((v,i)=>.37*v+.63*part.aabb_max[i]):[0,1,2].map(j=>(b&(1<<j))?part.aabb_max[j]:part.aabb_min[j]);
     const trans=S.fieldTransform(part.id,src,p),back=S.fieldTransform(part.id,trans,p,true);
     maxInverseError=Math.max(maxInverseError,dist(back,src));
    }
   }
  }
 }
 const first=S.pose(.4,side);maxSeam=dist(first.state,p.state);
 assert(maxEq<1e-10);assert(maxVsPython<1e-10);assert(maxTransformJointError<1e-10);assert(maxInverseError<1e-10);assert(maxRandomAccessError<1e-10);assert(maxSeam<1e-10);assert(maxSameCrossheadError<1e-12);
 report.sides[side]={samples:python.length,maxSquaredLengthEquationResidualM2:maxEq,maxRigidLengthErrorM:maxRigidLengthError,maxStateDifferenceVsIndependentPython:maxVsPython,maxSourceJointTransformErrorM:maxTransformJointError,maxTransformInverseErrorM:maxInverseError,maxRandomAccessVsSequentialStateDifference:maxRandomAccessError,periodicSeamStateDifference:maxSeam,maxSameDynamicCrossheadErrorM:maxSameCrossheadError};
}
// Shared-time signature: right(theta) equals left(theta+4.3) for retained identical gear.
let phaseShiftError=0,periodicityError=0;
for(let k=0;k<600;k++){
 const t=-9+19*k/599,l=S.pose(t+4.3,'left'),r=S.pose(t,'right'),rr=S.pose(t+2*Math.PI,'right');
 phaseShiftError=Math.max(phaseShiftError,dist(l.state,r.state));periodicityError=Math.max(periodicityError,dist(r.state,rr.state));
}
report.leftRightRetainedPhaseShiftMaxStateError=phaseShiftError;report.arbitraryTimePeriodicityMaxStateError=periodicityError;report.sequentialPoseCalls=totalCalls;
assert(phaseShiftError<1e-10);assert(periodicityError<1e-10);
fs.writeFileSync(path.join(HERE,'JS_CLOSURE_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
const mappingReport={moving:[],fixed:[],unsupported:[],maximumChestSourceSpindleEndpointErrorM:0,maximumChestMotionOffsetErrorM:0,sourceChestFunctionCount:0};
for(const part of scene.parts.filter(p=>['valve','valve_chest'].includes(p.group))){
 const cls=S.classify(part.id);mappingReport[cls.status].push(part.id);const tr=S.transformFor(part.id,1.9);
 assert.equal(tr===null,cls.status!=='moving');
 if(part.group==='valve_chest'){
  const source=scene.sources.motion,fn=part.glsl_function;
  const body=source.match(new RegExp('float '+fn+'\\(vec3 p\\) \\{ (.*?) \\}'))[1];
  const pv=body.match(/mPV\(p-vec3\(([^)]+)\),([^,]+),([^,]+),([^,]+),(\d+)\)/);assert(pv);
  const origin=pv[1].split(',').map(Number),q=+pv[2],rear=+pv[3],front=+pv[4],index=+pv[5],ref=S.reference[cls.side];
  assert.equal(cls.status==='moving',index>=6&&index<=10);mappingReport.sourceChestFunctionCount++;
  mappingReport.maximumChestSourceSpindleEndpointErrorM=Math.max(mappingReport.maximumChestSourceSpindleEndpointErrorM,Math.abs(ref.V[1]-(origin[2]+rear)),Math.abs(ref.V[1]+1.15-(origin[2]+front)),Math.abs(q-(ref.V[1]-4.1)));
  if(tr){const pose=S.pose(1.9,cls.side),expectedDelta=pose.spindleZ-ref.V[1];mappingReport.maximumChestMotionOffsetErrorM=Math.max(mappingReport.maximumChestMotionOffsetErrorM,Math.abs(tr.forwardYZ[5]-expectedDelta),Math.abs(tr.inverseYZ[5]+expectedDelta));}
 }
}
assert.equal(mappingReport.moving.length,46);assert.equal(mappingReport.fixed.length,32);assert.equal(mappingReport.unsupported.length,14);assert.equal(mappingReport.sourceChestFunctionCount,32);assert(mappingReport.maximumChestSourceSpindleEndpointErrorM<1e-12);assert(mappingReport.maximumChestMotionOffsetErrorM<1e-12);
fs.writeFileSync(path.join(HERE,'FIELD_MAPPING_QA.json'),JSON.stringify(mappingReport,null,2)+'\n');
console.log('Mapping:',mappingReport.moving.length,'moving,',mappingReport.fixed.length,'fixed,',mappingReport.unsupported.length,'unsupported central/conjugated; chest source endpoints max error',mappingReport.maximumChestSourceSpindleEndpointErrorM);
