'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const modelArg=process.argv.indexOf('--model');const base=path.resolve(modelArg>=0?process.argv[modelArg+1]:(process.env.A4_MODEL_DIR||path.join(__dirname,'..')));
const c={};c.window=c;vm.createContext(c);
for(const f of ['scene.js','dynamic.js'])vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),c);
const {createOutsideValveSolver}=require(path.join(base,'outside_valve_solver.js'));
const {createGresleySolver}=require('./gresley_solver');
const D=c.DYNAMIC,S=c.SCENE,outside=createOutsideValveSolver(D),g=createGresleySolver(S,D,outside);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex');
const before=JSON.stringify({S,D:{...D}}),hashes=Object.fromEntries(['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','app.js'].map(f=>[f,hash(f)]));
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const reference=g.pose(.4),referenceErrors=Object.fromEntries(Object.entries(g.reference.pins).map(([k,p])=>[k,dist(p,reference.pins[k])]));
assert(Math.max(...Object.values(referenceErrors))<1e-13);
assert(dist(g.reference.spindle.rear,reference.spindle.rear)<1e-13);
assert(Math.abs(reference.finiteMinusIdeal)>1e-6,'Ideal law must not replace finite closure');
const N=14400,mins={rightHeight:Infinity,leftHeight:Infinity,middleHeight:Infinity,rightTriangle:Infinity,leftTriangle:Infinity};
let left,right,maxLength=0,maxOutside=0,maxNeighbor=0,maxCorrection=-Infinity,minCorrection=Infinity,minM=Infinity,maxM=-Infinity,minL=Infinity,maxL=-Infinity,minR=Infinity,maxR=-Infinity,prev,first,last;
const rows=[];
for(let k=0;k<=N;k++){
 const theta=.4+2*Math.PI*k/N;
 left=outside.pose(theta,'left',left);right=outside.pose(theta,'right',right);
 const s=g.fromOutside(left,right),d=s.diagnostics;
 if(!first)first=s;last=s;
 maxLength=Math.max(maxLength,d.maxLengthError);maxOutside=Math.max(maxOutside,s.outsideResidual);
 mins.rightHeight=Math.min(mins.rightHeight,d.rightCircle.heightSquared);mins.leftHeight=Math.min(mins.leftHeight,d.leftCircle.heightSquared);mins.middleHeight=Math.min(mins.middleHeight,d.middleHeightSquared);
 mins.rightTriangle=Math.min(mins.rightTriangle,d.rightCircle.lowerTriangleMargin,d.rightCircle.upperTriangleMargin);mins.leftTriangle=Math.min(mins.leftTriangle,d.leftCircle.lowerTriangleMargin,d.leftCircle.upperTriangleMargin);
 minM=Math.min(minM,s.qMiddle);maxM=Math.max(maxM,s.qMiddle);minL=Math.min(minL,s.qLeft);maxL=Math.max(maxL,s.qLeft);minR=Math.min(minR,s.qRight);maxR=Math.max(maxR,s.qRight);
 minCorrection=Math.min(minCorrection,s.finiteMinusIdeal);maxCorrection=Math.max(maxCorrection,s.finiteMinusIdeal);
 if(prev)maxNeighbor=Math.max(maxNeighbor,...Object.keys(s.pins).map(k=>dist(prev.pins[k],s.pins[k])));prev=s;
 if(k%20===0)rows.push({theta,qLeft:s.qLeft,qRight:s.qRight,qMiddle:s.qMiddle,finiteMinusIdeal:s.finiteMinusIdeal,pins:s.pins});
}
const seam=Math.max(...Object.keys(first.pins).map(k=>dist(first.pins[k],last.pins[k])));
let maxRandom=0,maxPeriodic=0,maxReverse=0;
for(let k=0;k<=100;k++){
 const theta=.4+2*Math.PI*k/100,s=g.pose(theta),rev=g.fromOutside(outside.pose(theta,'left',left),outside.pose(theta,'right',right));
 const periodic=g.pose(theta+2*Math.PI*13);
 for(const key of Object.keys(s.pins)){maxRandom=Math.max(maxRandom,dist(s.pins[key],rev.pins[key]));maxPeriodic=Math.max(maxPeriodic,dist(s.pins[key],periodic.pins[key]));}
}
left=outside.pose(.4+2*Math.PI,'left');right=outside.pose(.4+2*Math.PI,'right');
for(let k=720;k>=0;k--){
 const theta=.4+2*Math.PI*k/720;left=outside.pose(theta,'left',left);right=outside.pose(theta,'right',right);
 const a=g.fromOutside(left,right),b=rows[k];
 for(const key of Object.keys(a.pins))maxReverse=Math.max(maxReverse,dist(a.pins[key],b.pins[key]));
}
const timeCases=[{Time:0,state:{}},{Time:2.1,state:{}},{Time:-17,state:{initialTheta:1.2,angularSpeed:-.8}},{Time:1500,state:{initialTheta:.4,angularSpeed:2.6}}];
const timeChecks=timeCases.map(({Time,state})=>{const s=g.atTime(Time,{},state),theta=(state.initialTheta??.4)+(state.angularSpeed??1)*Time;assert.strictEqual(s.theta,theta);return {Time,theta,sharedTheta:true};});
assert.throws(()=>g.fromOutside(outside.pose(.4,'left'),outside.pose(.5,'right')),/same absolute theta/);
assert.throws(()=>g.solveInputs(4.1,50),/infeasible/);
const unchanged=before===JSON.stringify({S,D:{...D}})&&Object.entries(hashes).every(([f,h])=>hash(f)===h);
assert(unchanged);assert(maxLength<1e-12);assert(maxOutside<1e-10);assert(seam<1e-10);assert(maxRandom<1e-10);assert(maxPeriodic<1e-10);assert(maxReverse<1e-10);
const out={pass:true,scope:'independent numerical finite Gresley closure from retained inferred geometry',wholeMechanicalAcceptance:false,middleInstallationValidated:false,middleChestCreated:false,rendererChanged:false,allPhaseProof:false,sampleCount:N+1,sourceHashes:hashes,referenceTheta:.4,referencePins:g.reference.pins,lengths:g.reference.lengths,planeY:g.reference.planeY,rightBranch:g.reference.rightBranch,leftBranch:g.reference.leftBranch,middleBranch:g.reference.middleBranch,outsideInputOffsets:g.outsideInputOffsets,referenceErrors,referenceSpindleRearError:dist(g.reference.spindle.rear,reference.spindle.rear),referenceQ:{left:reference.qLeft,right:reference.qRight,middle:reference.qMiddle,ideal:reference.idealComparisonOnly,finiteMinusIdeal:reference.finiteMinusIdeal},qRanges:{left:[minL,maxL],right:[minR,maxR],middle:[minM,maxM]},finiteMinusIdealRangeM:[minCorrection,maxCorrection],minimumMargins:mins,maxLengthErrorM:maxLength,maxOutsideSquaredEquationResidualM2:maxOutside,maxNeighborPointMotionM:maxNeighbor,seamErrorM:seam,maxRandomAccessVsContinuationErrorM:maxRandom,maxReverseErrorM:maxReverse,maxPeriodicityErrorM:maxPeriodic,timeChecks,sourceAndRuntimeUntouched:unchanged};
fs.writeFileSync(path.join(__dirname,'NUMERICAL_QA.json'),JSON.stringify(out,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'REFERENCE_CONSTRUCTORS.json'),JSON.stringify(g.reference,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'cycle-samples.json'),JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
