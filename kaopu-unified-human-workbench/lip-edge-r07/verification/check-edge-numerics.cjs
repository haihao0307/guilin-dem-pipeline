const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path');const source=fs.readFileSync(path.join(__dirname,'../src/EdgeContinuity.js'),'utf8');
const X=51,Y=17,count=X*Y,positions=new Float32Array(count*3),rest=new Float32Array(count*3),oral=new Float32Array(count),types=new Float32Array(count),samples=[];
for(let j=0;j<Y;j++)for(let i=0;i<X;i++){const id=j*X+i,x=(i-25)*.0008,z=-j*.0003,y=j<=7?-.008+j*.00038:-.008+7*.00038-(j-7)*.00055;positions.set([x,y,z],id*3);rest.set([x,-j*.001,0],id*3);oral[id]=j<6?0:j===6?.5:1;samples.push({u:(i-25)/25,v:j<=3||j>=12?.1:-.32,upper:true,inner:oral[id],type:0});}
const idx=[];for(let j=0;j<Y-1;j++)for(let i=0;i<X-1;i++){const a=j*X+i;idx.push(a,a+1,a+X,a+1,a+X+1,a+X);}
const attr=(array,itemSize)=>({array,itemSize,count:array.length/itemSize});let normalCalls=0,applyCalls=0,reportInside=0;
const geometry={attributes:{position:attr(positions,3),normal:attr(new Float32Array(count*3),3),fRest:attr(rest,3),csType:attr(types,1),l19Oral:attr(oral,1)},index:attr(new Uint32Array(idx),1),computeVertexNormals(){normalCalls++;return this;}};
const pairs=Array.from({length:49},(_,k)=>({u:(k/48*2-1)*.94,lower:k+1,upper:(Y-1)*X+k+1}));
const top={geometry,count,samples,pairs,lips:[],active:Array.from({length:count},(_,i)=>i)};
const solver={topology:top,reference:new Float32Array(count),referenceHorizontal:new Float32Array(count),lastKey:'fixture',base:positions.slice(),apply(){applyCalls++;this.base.set(positions);geometry.computeVertexNormals();geometry.computeVertexNormals();return {native:true};}};
const original=solver.apply,normal=geometry.computeVertexNormals;
const structure={mother:{surfaces:new Map([[geometry,solver]])},settings:{structure:1},anatomy:{settings:{microGeometry:1,tissueDepth:1}},performance:{jawOpen:.36,settings:{pucker:0}}};
const lm={48:[-.025,0,0],54:[.025,0,0],27:[0,0,.04],8:[0,0,-.04],62:[0,0,0],66:[0,0,0],30:[0,-.03,0]};
const model={positions:new Float32Array(3),state:{gnm:{identity:[1]},anny:{phenotypes:[],localChanges:[]}},faceSurface:{fields:{landmark(_,i){return lm[i];}}},lipStructure:structure};
const mat1={onBeforeCompile(){},customProgramCacheKey(){}},mat2={onBeforeCompile(){},customProgramCacheKey(){}},viewer={currentLip:{geometry},skin:{material:mat1}};
const motion={version:'native-return-motion-ownership@1'},corner={version:'native-corner-pucker-vector@3'};
const window={__LIP_CORNER_SOLVER__:corner,__LIP_MOTION_SOLVER__:motion,cornerLip:{version:'LIP-CORNER-R06',report(){if(structure.anatomy.settings.microGeometry!==1){reportInside++;throw Error('ancestor report called during transient evaluation');}return{comparison:'r06',solver:{version:corner.version,installed:true,valid:true,enabled:true,errors:[]},motionComparison:'r05',motionSolver:{valid:true,enabled:true,calibration:{ownershipFingerprint:'fixture'}},innerComparison:'r04'};}},lipRealism:{settings:()=>({enabled:true}),report:()=>({coarseReliefScale:.35})},headProceduralSkin:{settings:()=>({enabled:true}),material:()=>mat2},bodyProceduralSkin:{settings:()=>({enabled:true})}};
const sandbox={window,structuredClone,console};vm.createContext(sandbox);vm.runInContext(source,sandbox);const api=window.__LIP_EDGE_SOLVER__;
function execute(){structure.anatomy.settings.microGeometry=.35;try{return solver.apply(model,structure);}finally{structure.anatomy.settings.microGeometry=1;}}
const initial=positions.slice();let r=api.install(viewer,model);assert.ok(r.valid&&r.installed&&r.binding.freeCrestVertices>0);api.setEnabled(true);execute();r=api.report();assert.ok(r.last.completed&&r.last.allOriginalStagesExecuted&&r.last.hooksRestored&&r.last.committed);assert.equal(r.last.normalCalls,2);assert.ok(r.last.changedVertices>0);assert.ok(r.last.bodyDirectExact&&r.last.contactDirectExact&&r.last.protectedDirectExact);assert.ok(r.last.maximumProposedDeltaMM<=.6);assert.ok(r.last.triangleGuard.passed);assert.equal(geometry.computeVertexNormals,normal);const changed=r.last;const binding=r.binding;
for(const jaw of [0,.06]){positions.set(initial);structure.performance.jawOpen=jaw;const n=normalCalls;execute();r=api.report();assert.ok(r.last.bypass&&r.last.completed&&r.last.normalCalls===0&&r.last.changedVertices===0);assert.equal(normalCalls-n,2);assert.deepEqual(positions,initial);}
// Exercise actual mid-gate path, without cached posed corrections.
positions.set(initial);structure.performance.jawOpen=.18;execute();const half=api.report().last;assert.ok(half.jawGate>0&&half.jawGate<1&&half.completed);assert.ok(half.maximumProposedDeltaMM<changed.maximumProposedDeltaMM);
// Known identity change disables and still executes native, no normal hook.
positions.set(initial);model.state.gnm.identity=[2];const n=normalCalls;execute();r=api.report();assert.equal(r.valid,false);assert.equal(r.enabled,false);assert.equal(normalCalls-n,2);assert.deepEqual(positions,initial);api.uninstall();assert.equal(solver.apply,original);assert.equal(geometry.computeVertexNormals,normal);assert.equal(reportInside,0);
// A deliberately excessive crease proposal must fail before any position write.
positions.set(initial);positions[(7*X+25)*3+1]+=.01;structure.performance.jawOpen=.36;
const excessive=positions.slice();api.install(viewer,model);api.setEnabled(true);
assert.throws(()=>execute(),/displacement exceeds 0.6mm/);assert.deepEqual(positions,excessive);
const rejected=api.report().last;assert.equal(rejected.committed,false);assert.equal(rejected.allOriginalStagesExecuted,false);assert.ok(rejected.hooksRestored);assert.ok(rejected.maximumProposedDeltaMM>.6);
assert.equal(geometry.computeVertexNormals,normal);api.uninstall();assert.equal(solver.apply,original);
console.log(JSON.stringify({excessiveProposalRejectedBeforeWrite:{passed:true,maximumProposedDeltaMM:rejected.maximumProposedDeltaMM,hooksRestored:rejected.hooksRestored,committed:rejected.committed},scope:'Synthetic indexed strip/crease validates positive graph math, protection, transient-report isolation, gate, invalidation and descriptor lifecycle; not current person or visual quality',passed:true,sourceSHA256:require('crypto').createHash('sha256').update(source).digest('hex'),binding,full:changed,midGate:half,zeroGateExact:true,knownInvalidationNativeFallbackExact:true,uninstallDescriptorExact:true,ancestorReportCallsDuringTransient:reportInside,applyCalls,normalCalls},null,2));
