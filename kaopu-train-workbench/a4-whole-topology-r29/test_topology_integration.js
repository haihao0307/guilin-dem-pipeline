const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const C={};C.window=C;vm.createContext(C);
for(const f of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','topology-parameters.js','side_offset_solver.js','gresley-dynamic.js','stack-fields.js','stack-dynamic.js','middle-chest-fields.js','middle-chest-dynamic.js','frame-support-fields.js','frame-support-dynamic.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),C,{filename:f});
const D=C.DYNAMIC,G=D.gresleySolver,P=C.TOPOLOGY_PARAMETERS,H=P.chest;
assert.strictEqual(require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'scene.js'))).digest('hex'),'8053c0c615d7ff045f267d217ae2576d3a8d1d4a4ec958e06540a0133473b8da','Original R28 scene bytes must remain unchanged');
let minEyeGuide=Infinity,minRearCoverage=Infinity,minHeadEnd=Infinity,maxResidual=0,maxRigidError=0;
for(let k=0;k<=1440;k++){
 const theta=2*Math.PI*k/1440,g=G.pose(theta);maxResidual=Math.max(maxResidual,g.diagnostics.maxLengthError);
 minEyeGuide=Math.min(minEyeGuide,g.pins.M[2]-.033-H.guideEnd);
 minRearCoverage=Math.min(minRearCoverage,H.rear-H.coverThickness-g.spindle.rear[2]);
 for(const z0 of H.headCentres){const z=z0+g.qMiddle;minHeadEnd=Math.min(minHeadEnd,z-H.headHalfLength-H.rear,H.front-z-H.headHalfLength);}
 for(const p of C.MIDDLE_CHEST.movingParts){const frame=D.gresleyFrame(p,theta,{mode:'candidate',beta:.126}),q=[P.middleX,P.planeY,(p.aabb_min[2]+p.aabb_max[2])/2],actual=G.transformPoint(q,frame);maxRigidError=Math.max(maxRigidError,Math.abs(actual[2]-q[2]-(g.qMiddle-G.pose(.4).qMiddle)));assert(actual[0]===P.middleX&&actual[1]===P.planeY);}
}
assert(maxResidual<1e-12);assert(minEyeGuide>.005);assert(minRearCoverage>.005);assert(minHeadEnd>.005);assert(maxRigidError<1e-12);
const baseline=C.SCENE.parts.filter(p=>D.visible(p,{mode:'baseline',beta:.11}));assert(baseline.length===519);assert(!baseline.some(p=>p.source==='stack'||p.source==='installation'));
const out={revision:'R29 topology integration',status:'PASS scoped numerical gates only',baselineFields:baseline.length,candidateFields:C.SCENE.parts.filter(p=>D.visible(p,{mode:'candidate',beta:.126})).length,phaseSamples:1441,maxClosureResidual:maxResidual,minEyeGuideClearance:minEyeGuide,minRearGlandCoverage:minRearCoverage,minHeadEndMargin:minHeadEnd,maxHeadRigidTransformError:maxRigidError,originalSceneBytesUnchanged:true,wholeMechanicalAcceptance:false,unverified:['whole-neighbor solids','frame aperture/support integration','historical dimensions','steam ports and cycle','structural strength']};
fs.writeFileSync(path.join(__dirname,'R29_TOPOLOGY_INTEGRATION_QA.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out));
