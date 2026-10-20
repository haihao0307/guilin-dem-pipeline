const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file=require('node:path').resolve(__dirname,'../src/CornerContinuity.js');
const source=fs.readFileSync(file,'utf8');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const samples=[],rest=[],index=[],active=[],lips=[];
const nx=33,ny=16;
for(let side of [-1,1]){
 const offset=samples.length;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const x=side*(.012+i*.001),y=-.001+j*.001,u=x/.0252,v=y/(Math.abs(u)<=1?.004:.001),roi=Math.abs(u)<1.25;
  const red=roi?(1-smooth(.9,1,Math.abs(u)))*smooth(-.25,0,v)*(1-smooth(.78,1.04,v)):0;
  const s={u,v,front:1,depth:.002,type:0,inner:0,top:.004,bot:-.004,roi,skin:roi,weight:roi?(1-smooth(.98,1.33,Math.abs(u)))*Math.exp(-Math.pow(Math.max(0,v-.8)/1.1,2)):0,red,rim:roi&&Math.abs(u)<.98&&v>-.28&&v<.7,upper:true};
  const id=samples.length;samples.push(s);rest.push(x,y,.02);if(s.weight>.001)active.push(id);if(red>.025)lips.push(id);
 }
 for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const a=offset+j*nx+i;index.push(a,a+1,a+nx,a+1,a+nx+1,a+nx)}
}
const count=samples.length,canonical=new Float32Array(rest),base=new Float32Array(count*3);
for(let id=0;id<count;id++){base[id*3]=rest[id*3];base[id*3+1]=rest[id*3+2];base[id*3+2]=-rest[id*3+1]}
// Exterior rows with zero oral labels must still be rejected by rest depth.
const deep=33+17,oral=33+18;samples[deep].depth=.01;samples[oral].inner=.2;
const pairs=Array.from({length:49},(_,i)=>({u:-.94+i/48*1.88,upper:33+2+(i%8),lower:count/2+33+2+(i%8)}));
const geometry={attributes:{position:{array:base.slice(),count,itemSize:3},fRest:{array:canonical},csType:{array:new Float32Array(count)},l19Oral:{array:Float32Array.from(samples,s=>s.inner)}},index:{array:new Uint32Array(index)}};
const top={geometry,count,samples,active,lips,pairs};
const settings={enabled:true,borderSoftness:.48,furrows:.65,pigment:.68,wetness:.35,dryRoughness:.53,colorVariation:.65,upperShade:.45,dryness:.3,microRelief:.65,textureDensity:1,patternSeed:37,structure:1,upperVolume:1,lowerVolume:1,cupid:1,tubercle:1,corners:1};
const optics={upperMelanin:.26,lowerMelanin:.16,upperBlood:.48,lowerBlood:.54,oxygenation:.72,upperRoughness:.54,lowerRoughness:.49,upperWetness:.35,lowerWetness:.45,skinRefinement:.65,microGeometry:1,tissueDepth:1};
const baseSettings={enabled:true,redness:.4,pigment:.25,upperDifference:.18,variation:.65,edgeSoftness:.34,wetness:.35,roughness:.53,foldStrength:.55,seed:731,diagnostic:0};
const head={enabled:true,seed:731,tone:.72,warmth:.46,blood:.48,variation:.9,pores:.88,poreRadius:.09,poreSpacing:.58,microrelief:.72,roughness:.51,oil:.26,scatter:.62,freckles:.2,lipColor:.54,lipWetness:.24,eyeThinness:.34,diagnostic:0};
const body={enabled:true,regionalColor:.72,lidWarmth:.46,noseWarmth:.38,earBlood:.44,earTransmission:.58,bodyVariation:.64,bodyPores:.78,jointTone:.42,neckCreases:.34,beardShadow:.04,audit:0};
let nativeCalls=0,nativePerturb=false;
const gauss=(x,width)=>Math.exp(-(x*x)/(width*width));
// Independent controlled stage: original local expressions evaluated in an
// axis-aligned canonical frame converted to display x,+y(front),-z(up).
const solver={topology:top,apply(){
 nativeCalls++;const a=geometry.attributes.position.array,act=structure.performance.settings;this.base=a.slice();
 for(const id of active){
  const s=samples[id],O=this.base[id*3],N=-this.base[id*3+2],mix=smooth(-.16,.16,s.u),G=act.stretchLeft*(1-mix)+act.stretchRight*mix,j=act.cornerLeft*(1-mix)+act.cornerRight*mix;
  const Q=1-.23*act.pucker-.12*act.funnel+.18*G,oe=Math.min(1.18,1/Math.sqrt(Math.max(.65,Q))),pe=act.rollOut-act.rollIn,ce=gauss(s.v-.35,.85)*(1-s.inner*.8),ye=gauss(Math.abs(s.u)-.82,.33);
  const dx=O*(Q-1)*s.weight;
  let up=N*(oe-1)-N*.33*act.press+(s.upper?.0018*act.upperRaise:-.0024*act.lowerDepress)*gauss(s.u,.9)+.0028*j*ye;
  up+=(s.upper?1:-1)*.0017*act.funnel*gauss(s.u,.85)*gauss(s.v,.8)+(s.upper?-1:1)*.00125*pe*gauss(s.v-.2,.75);
  let front=(.0036*act.pucker+.0025*act.funnel)*gauss(s.u,.85)-.0008*G*ce;
  front+=(.00115*pe+.00065*act.press)*ce+(optics.tissueDepth-1)*.0011*ce;
  a[id*3]+=dx;a[id*3+1]+=front*s.weight;a[id*3+2]-=up*s.weight;
 }
 if(nativePerturb)a[(33*2+19)*3]+=.0002;
 pairs.map(x=>({...x}));return {fixture:true};
}};
const originalApply=solver.apply,originalDescriptor=Object.getOwnPropertyDescriptor(solver,'apply');
const actions={pucker:.82,funnel:0,press:0,rollIn:0,rollOut:0,stretchLeft:0,stretchRight:0,upperRaise:0,lowerDepress:0,cornerLeft:0,cornerRight:0,seal:.24,adhesion:0,release:0};
const structure={settings,anatomy:{settings:optics,scale:width=>1},performance:{settings:actions},mother:{surfaces:new Map([[geometry,solver]])}};
const lm={48:[-.0252,0,0],54:[.0252,0,0],62:[0,.001,0],66:[0,-.001,0],27:[0,.06,0],8:[0,-.06,0],30:[0,0,.03]};
const model={lipStructure:structure,positions:canonical.slice(),state:{gnm:{identity:{}},anny:{phenotypes:{},localChanges:{}}},identityLab:{settings:{shape:{}}},faceSurface:{fields:{landmark:(a,id)=>lm[id]}}};
const material={onBeforeCompile(){},customProgramCacheKey(){return 'fixture'}},skinMaterial={onBeforeCompile(){},customProgramCacheKey(){return 'fixture-skin'}};
const viewer={currentLip:{geometry},skin:{material}};
const motionReport=()=>({source:{sourceCommit:'a8bba75322c12df151ecbcebc416087b5248aa5f'},comparison:'r05',solver:{version:'native-return-motion-ownership@1',enabled:true,valid:true,calibration:{ownershipFingerprint:'fixture-ownership'}}});
const window={motionLip:{version:'LIP-MOTION-R05',report:motionReport},innerLip:{report:()=>({version:'LIP-INNER-R04',comparison:'r04',diagnostic:0,baseComparison:'r02'})},lipRealism:{report:()=>({version:'LIP-REALISM-R02',comparison:'r02',ablation:{},coarseReliefScale:.35}),settings:()=>baseSettings},headProceduralSkin:{settings:()=>head,material:()=>skinMaterial},bodyProceduralSkin:{settings:()=>body},__LIP_MOTION_SOLVER__:{report:()=>motionReport().solver}};
vm.runInNewContext(source,{window,structuredClone,Float32Array,Float64Array,Uint8Array,Uint32Array,Int32Array,Map,Set,Reflect,Object,Number,Math,Array,JSON,Error,Infinity,Symbol});
const api=window.__LIP_CORNER_SOLVER__,digest=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function run(){geometry.attributes.position.array.set(base);optics.microGeometry=.35;try{solver.apply(model,structure)}finally{optics.microGeometry=1}return geometry.attributes.position.array.slice()}
const results=[];
api.install(viewer,model);const binding=api.report().binding;assert.ok(binding.freeOriginallyActiveVertices>0);assert.ok(binding.freeOriginallyInactiveVertices>0);assert.equal(binding.contactPairSlots,49);assert.ok(binding.uniqueContactVertices<98);
const off=run();api.setEnabled(true);const on=run(),report=api.report();
assert.ok(report.last.linearSolve.converged);assert.ok(report.last.linearSolve.noOvershoot);assert.ok(report.last.changedOriginallyActiveVertices>0);assert.ok(report.last.coreDirectDeltaZero&&report.last.contactDirectDeltaZero&&report.last.centerDirectDeltaZero);
assert.ok(report.last.hooksRestored&&report.last.beforeLocalBaseMatchesEntry);assert.equal(report.last.pairMapCalls,1);assert.equal(Object.hasOwn(pairs,'map'),false);
for(let id=0;id<count;id++)if(samples[id].v<0||Math.abs(samples[id].u)<=.64||id===deep||id===oral)for(let k=0;k<3;k++)assert.equal(on[id*3+k],off[id*3+k]);
for(const name of ['x','up','front']){assert.ok(report.last.linearSolve.components[name].converged);assert.ok(report.last.maximumComponentCorrectionMM[name]>0)}
assert.ok(report.last.sourceAgreement.available&&report.last.sourceAgreement.passed);assert.equal(report.last.sourceAgreement.sampleCount,binding.freeOriginallyActiveVertices);assert.ok(report.last.sourceAgreement.nonzeroActualSamples>0&&report.last.sourceAgreement.nonzeroPredictedSamples>0);assert.ok(report.last.sourceAgreement.maxNormalizedErrorRatio<=1);
for(const p of pairs)for(const id of [p.upper,p.lower])for(let k=0;k<3;k++)assert.equal(on[id*3+k],off[id*3+k]);
const cutA=33*2+19,cutB=33*2+20;
const oldJump=Math.abs((off[cutA*3]-base[cutA*3])-(off[cutB*3]-base[cutB*3]))*1000,newJump=Math.abs((on[cutA*3]-base[cutA*3])-(on[cutB*3]-base[cutB*3]))*1000;
assert.ok(newJump<oldJump);
results.push({test:'complete native pucker vector redistribution with protected core/contact/center and actual controlled-stage source agreement',binding,last:report.last,fixtureCrossingEdge:{a:cutA,b:cutB,originalIncrementJumpMM:oldJump,redistributedIncrementJumpMM:newJump}});
// Reuse this same fixture with the immutable rejected candidate02. Compare
// the pre-downstream x result in this axis-aligned frame, and the full scalar
// x solver record. This is not a claim about final pixels or other components.
api.uninstall();delete window.__LIP_CORNER_SOLVER__;
const priorSource=fs.readFileSync(require('node:path').resolve(__dirname,'../evidence/candidate-02/source/CornerContinuity.js'),'utf8');
assert.equal(crypto.createHash('sha256').update(priorSource).digest('hex'),'ea34342e08938762cd8ed8f37d2333332a0b6cc600b2f6ad6314020c10ddbe00');
vm.runInNewContext(priorSource,{window,structuredClone,Float32Array,Float64Array,Uint8Array,Uint32Array,Int32Array,Map,Set,Reflect,Object,Number,Math,Array,JSON,Error,Infinity,Symbol});
const priorApi=window.__LIP_CORNER_SOLVER__;priorApi.install(viewer,model);priorApi.setEnabled(true);const priorOn=run(),priorReport=priorApi.report();
for(let id=0;id<count;id++)assert.equal(on[id*3],priorOn[id*3]);
assert.deepEqual(report.last.linearSolve.components.x,priorReport.last.linearSolve);
for(const key of ['nativeRestFingerprint','nativeIndexFingerprint','originalActiveFingerprint','protectedCoreFingerprint','freeVertexFingerprint'])assert.equal(binding[key],priorReport.binding[key]);
priorApi.uninstall();window.__LIP_CORNER_SOLVER__=api;api.install(viewer,model);api.setEnabled(true);run();
results.push({test:'immutable candidate02 and candidate03 retain the identical x solve and fixture x result',passed:true,priorModuleSHA256:'ea34342e08938762cd8ed8f37d2333332a0b6cc600b2f6ad6314020c10ddbe00',xScalarSolveRecordExact:true,fixtureXCoordinatesExact:true,restCoreAndFreeFingerprintsExact:true,scope:'Same controlled axis-aligned indexed fixture before downstream native stages; not actual rendered pixel equality.'});
api.setEnabled(false);structure.performance.settings.pucker=0;const zeroOff=run();api.setEnabled(true);const zeroOn=run();assert.equal(digest(zeroOff),digest(zeroOn));assert.equal(api.report().last.puckerZeroBypass,true);assert.equal(api.report().last.pairMapCalls,0);assert.equal(api.report().last.linearSolve,null);assert.equal(api.report().last.sourceAgreement,null);results.push({test:'pucker zero exact direct pass-through',passed:true});
const detached=api.uninstall();assert.ok(detached.originalApplyRestored);assert.equal(solver.apply,originalApply);assert.deepEqual(Object.getOwnPropertyDescriptor(solver,'apply'),originalDescriptor);
structure.performance.settings.pucker=.37;run();api.install(viewer,model);assert.deepEqual(api.report().binding,binding);api.setEnabled(true);run();results.push({test:'arbitrary pose install and exact descriptor restore',passed:true});
actions.funnel=.05;run();assert.equal(api.report().last.sourceAgreement.available,false);assert.equal(api.report().last.sourceAgreement.sampleCount,0);assert.equal(Object.hasOwn(api.report().last.sourceAgreement,'passed'),false);actions.funnel=0;results.push({test:'mixed actions explicitly make source agreement unavailable',passed:true,scope:'Availability policy only; not a full mixed-action validation.'});
nativePerturb=true;assert.throws(()=>run(),/Actual original local displacement disagrees/);assert.equal(Object.hasOwn(pairs,'map'),false);assert.equal(api.report().last.hooksRestored,true);assert.equal(api.report().last.sourceAgreement.passed,false);nativePerturb=false;api.uninstall();api.install(viewer,model);api.setEnabled(true);run();results.push({test:'actual source discrepancy is rejected before correction and descriptors restored',passed:true,perturbedNativeCoordinateMM:.2});
head.lipWetness=.31;assert.equal(api.report().valid,false);assert.equal(api.report().enabled,false);const fallback=run();api.uninstall();const native=run();assert.equal(digest(fallback),digest(native));assert.equal(head.lipWetness,.31);results.push({test:'custom authoring invalidates without changing setting and continues original evaluator',passed:true});
const summary={schema:'r06/candidate03-synthetic-check@1',moduleSHA256:crypto.createHash('sha256').update(source).digest('hex'),fixture:{vertices:count,triangles:index.length/3,pairs:49,uniqueContactVertices:binding.uniqueContactVertices,scope:'Synthetic indexed surface and a controlled native-stage stub, not the actual browser/Anny geometry, normals, closure or visual acceptance.'},passed:true,nativeCalls,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({passed:true,moduleSHA256:summary.moduleSHA256,vertices:count,free:binding.freeExteriorVertices,activeFree:binding.freeOriginallyActiveVertices,last:report.last}));
