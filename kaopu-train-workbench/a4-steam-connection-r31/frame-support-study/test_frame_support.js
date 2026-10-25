'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),F=require('./frame_support');
const {modelPath,topologyPath}=require('./model_path'),base=modelPath(),topology=topologyPath(base),ctx={};ctx.window=ctx;vm.createContext(ctx);for(const f of ['scene.js','dynamic.js'])vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),ctx);
const O=require(path.join(base,'outside_valve_solver')).createOutsideValveSolver(ctx.DYNAMIC),oldRef=require(path.join(base,'gresley_solver')).extractReference(ctx.SCENE),S=require(path.join(base,'stack-reconstruction/stack_candidate')),N=require(path.join(topology,'side_offset_solver'));
if(process.argv.includes('--resolve-only')){console.log(JSON.stringify({model:base,topology,modulesLoaded:true}));process.exit(0);}
const hosts=F.inspectFrameHosts(ctx.SCENE);assert.deepEqual(hosts.map(h=>h.x),[-.54,.54]);assert(hosts.every(h=>Math.abs(h.halfThickness-.015)<1e-15));
// Exact vertical slice through a horizontal plate body; eye is nowhere near it.
const rod={id:'plate/proof',kind:'rod',points:[[-2,1,0],[2,1,0]],y:[.9,1.1],width:.024,eye:.033,bore:.0135};
assert.deepEqual(F.sectionBounds(rod,[.525,.555]).z,[-.024,.024]);
const angle=.43,c=Math.cos(angle),s=Math.sin(angle),rot={...rod,points:[[-2*c,1,-2*s],[2*c,1,2*s]]},q=F.sectionBounds(rot,[.525,.555]);
const exact=[.525*Math.tan(angle)-.024/c,.555*Math.tan(angle)+.024/c];assert(Math.max(...q.z.map((v,i)=>Math.abs(v-exact[i])))<1e-14);
assert.equal(F.diskProjection([2,0],.01,[-1,1]),null);assert.deepEqual(F.diskProjection([0,2],.1,[-1,1]),[1.9,2.1]);
// Exhaustive sampled surface checks supplement, not replace the analytic proof.
let seed=95817,surfaceChecks=0,maxSectionExcess=0;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<400;i++){
 const a=[random()*2-1,random()*2-1],b=[random()*2-1,random()*2-1],r=.01+random()*.15,lo=random()*2-1,slab=[lo,lo+.03],out=F.capsuleProjection(a,b,r,slab);
 for(let j=0;j<=100;j++)for(let k=0;k<24;k++){
  const t=j/100,ang=2*Math.PI*k/24,p=[a[0]+t*(b[0]-a[0])+r*Math.cos(ang),a[1]+t*(b[1]-a[1])+r*Math.sin(ang)];
  if(p[0]>=slab[0]&&p[0]<=slab[1]){assert(out);const excess=Math.max(out[0]-p[1],p[1]-out[1]);maxSectionExcess=Math.max(maxSectionExcess,excess);assert(excess<1e-12);surfaceChecks++;}
 }
}
const profiles=S.inspect(ctx.SCENE,oldRef),results=[];
for(const middleX of [-.38,.37,.38,.39]){
 const g=N.createSideOffsetGresleySolver(ctx.SCENE,ctx.DYNAMIC,O,{middleX}),design=S.derive(profiles,g.reference,{},{terminalEyes:true}),partsAt=t=>S.parts(design,profiles,g.pose(t)),phases=Array.from({length:1441},(_,i)=>.4+2*Math.PI*i/1440);
 const apertures=F.deriveApertures({hosts,partsAt,phases});
 assert(apertures.every(a=>a.required&&a.insideRetainedFrontRectangle&&!a.continuousCoverage));
 for(const a of apertures)assert(a.crossingPartIds.every(id=>id==='plate/two_to_one_lever'||id==='plate/equal_lever'));
 // Dense post-derivation phase checks, exact full-thickness section containment.
 let minMargin=Infinity;for(let k=0;k<1600;k++)for(const a of apertures){const h=hosts.find(h=>h.id===a.hostId),q=F.sectionAtPose(partsAt(.4+2*Math.PI*(k+.314)/1600),h);if(!q.y)continue;const m=Math.min(q.y[0]-a.opening.y[0],a.opening.y[1]-q.y[1],q.z[0]-a.opening.z[0],a.opening.z[1]-q.z[1]);minMargin=Math.min(minMargin,m);assert(m>0);}
 const support=F.proposedPivotSupport({hosts,pose:g.pose(.4),parts:partsAt(.4),design,apertures});
 assert(support.checks.every(c=>c.insideFrame&&c.slotToBridgeGap>0));assert(support.clearanceAboveAllExistingMovingHardware>0);assert(!support.structuralAcceptance&&!support.historicalDimensions);
 assert.deepEqual(support.pivotLoadPath.at(-1),'retained left/right main frame plates');
 const fixed=g.pose(1.9).pins.O;assert.deepEqual(support.fixedPivot,fixed);
 results.push({middleX,reference:g.reference.config,apertures,support,denseIndependentCheckMinimumOpeningMarginM:minMargin});
}
const report={pass:true,analyticPrimitiveTests:true,surfaceChecks,maxSectionExcessM:maxSectionExcess,sourceStage:path.basename(base)+' retained-source read-only',actualSceneOrGeometryChanged:false,conditionalContinuousProof:false,historicalOrStructuralClaim:false,results};
fs.writeFileSync(path.join(__dirname,'FRAME_SUPPORT_QA.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'FRAME_HOSTS.json'),JSON.stringify(hosts,null,2)+'\n');
console.log(JSON.stringify({pass:true,surfaceChecks,maxSectionExcessM:maxSectionExcess,candidates:results.map(r=>({middleX:r.middleX,slots:r.apertures.map(a=>({host:a.hostId,parts:a.crossingPartIds,opening:a.opening,ligaments:a.ligaments})),bridge:r.support.bridge,bridgeChecks:r.support.checks,minSampleOpeningMargin:r.denseIndependentCheckMinimumOpeningMarginM})),wholeAcceptance:false},null,2));
