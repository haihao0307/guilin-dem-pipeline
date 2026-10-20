import {ClothSolver} from './upstream/material-physics.mjs';
import {MeshContact,outwardPacket} from './upstream/mesh-contact.mjs';
import {LayerContact} from './layer-contact.mjs';
import {initializeLayers} from './layer-initialization.mjs';

const DEFAULTS={friction:.3,wind:0,contactEnabled:true,substeps:2,iterations:16,cleanupIterations:12};
function checkedSettings(base,patch) {
 const result={...base};
 for(const [key,value]of Object.entries(patch)) {
  if(!(key in DEFAULTS))throw Error('未知布料设置：'+key);
  if(key==='contactEnabled'){if(typeof value!=='boolean')throw Error('接触开关必须是布尔值');}
  else if(!Number.isFinite(value))throw Error('布料参数必须是有限数');
  if(key==='friction'&&(value<0||value>1))throw Error('摩擦近似系数超出 0–1');
  if(key==='wind'&&Math.abs(value)>30)throw Error('风扰动力超出本轮范围');
  if(key==='substeps'&&(!Number.isInteger(value)||value<1||value>8))throw Error('子步数须为 1–8 的整数');
  if(key==='iterations'&&(!Number.isInteger(value)||value<1||value>32))throw Error('迭代数须为 1–32 的整数');
  if(key==='cleanupIterations'&&(!Number.isInteger(value)||value<0||value>48))throw Error('尾约束迭代数须为 0–48 的整数');
  result[key]=value;
 }
 return result;
}
function checkedThickness(value) {if(!Number.isFinite(value)||value<.0005||value>.03)throw Error('衣层厚度超出研究范围');return value;}
const bodyClearanceMM=thickness=>Math.max(2,thickness*500+.5);

/** Independent garments, one simulation clock. SI units throughout.
 * Reuses the existing flat-paper XPBD and dihedral kernel. This prototype
 * adds mass-weighted inter-garment contacts and a swept vertex/face crossing
 * guard. No complete CCD or
 * complete self-collision certificate is claimed.
 */
export class LayerWorld {
 static async create(body,rows,kernelBytes,options={}) {
  const {instance}=await WebAssembly.instantiate(kernelBytes,{env:{atan2:Math.atan2}});
  return new LayerWorld(body,rows,instance,options);
 }
 constructor(body,rows,instance,options={}) {
  this.e=instance.exports;this.memory=this.e.memory;this.rows=[];this.time=0;this.steps=0;
  this.options=checkedSettings(DEFAULTS,options);this.freeBlocks=[];this.poolBytes=0;this.reusedBytes=0;this.allocationOwner=null;
  this.contacts=new LayerContact({cellSize:.025,searchMargin:.003,contactMargin:.0005,maxCorrection:.004,sampleLimit:40});
  this.body=new MeshContact(body.positions,body.faces);this.bodyMesh=this.makeMesh(this.body);
  this.lastContact=null;this.solveMS=0;this.totalCorrections=0;this.drag=null;this.lastDT=null;this.timings=null;this._timing=null;this.initializationReport=null;
  this._collectingRows=true;for(const row of rows)this.add(row);this._collectingRows=false;this.initialize();
 }
 alloc(T,data) {
  const a=typeof data==='number'?new T(data):T.from(data),capacity=Math.ceil(a.byteLength/8)*8;
  const reusable=this.freeBlocks.findIndex(block=>block.capacity>=capacity);
  let ptr;
  if(reusable>=0){const block=this.freeBlocks.splice(reusable,1)[0];ptr=block.ptr;this.reusedBytes+=capacity;if(block.capacity>capacity)this.freeBlocks.push({ptr:ptr+capacity,capacity:block.capacity-capacity});}
  else{ptr=this.e.alloc(capacity);this.poolBytes+=capacity;}
  if(ptr+a.byteLength>this.memory.buffer.byteLength)throw Error('布料工作内存不足');
  const view=new T(this.memory.buffer,ptr,a.length);view.set(a);const block={ptr,view,capacity};this.allocationOwner?.push(block);return block;
 }
 release(blocks) {for(const block of blocks||[])if(block.capacity)this.freeBlocks.push({ptr:block.ptr,capacity:block.capacity});this.freeBlocks.sort((a,b)=>a.ptr-b.ptr);const merged=[];for(const b of this.freeBlocks){const last=merged[merged.length-1];if(last&&last.ptr+last.capacity===b.ptr)last.capacity+=b.capacity;else merged.push({...b});}this.freeBlocks=merged;}
 makeMesh(mesh) {
  const p=this.alloc(Float64Array,mesh.p),normal=this.alloc(Float64Array,mesh.p.length),faces=this.alloc(Int32Array,mesh.faces),order=this.alloc(Int32Array,mesh.tri),nodes=this.alloc(Float64Array,mesh.nodes.flatMap(n=>[n.lo,n.hi,n.left,n.right,...n.box]));
  this.e.refit(p.ptr,faces.ptr,mesh.faces.length/3,normal.ptr,nodes.ptr,mesh.nodes.length,order.ptr,mesh.p.length/3);
  return {p,normal,faces,order,nodes};
 }
 add(row) {
  if(!row||row.id===undefined||!row.packet||!row.positions)throw Error('衣物缺少身份、纸样或中面位置');
  if(this.rows.some(r=>r.id===row.id))throw Error('衣物身份重复');
  const thickness=checkedThickness(row.thickness??.002);
  const oriented=outwardPacket(row.packet,row.positions,this.body);
  const s=new ClothSolver(oriented.packet,row.positions,{sdf:this.body,family:row.family||'knit',role:row.role||'top',doubleLayer:false,deferContactInitialization:true,clearanceMM:bodyClearanceMM(thickness),bend:1,softness:1,damping:7,gravity:1});
  s.old.set(s.p);
  const a={id:row.id,s,thickness,enabled:true,source:row,orientation:oriented.signs,allocations:[],physicalMassKG:s.mass.reduce((n,v)=>n+v,0)};
  this.allocationOwner=a.allocations;
  try {
  for(const key of ['p','v','old','w']){a[key]=this.alloc(Float64Array,s[key]);s[key]=a[key].view;}
  a.faces=this.alloc(Int32Array,s.faces);a.edges=this.alloc(Float64Array,s.edges.flatMap(e=>[e.a,e.b,e.rest,0]));a.bends=this.alloc(Float64Array,s.bends.flatMap(b=>[b.a,b.b,b.c,b.d,0,b.rest]));
  a.cache=this.alloc(Int32Array,new Int32Array(s.count+s.edges.length+s.faces.length/3).fill(-1));
  a.saved=s.p.slice();a.backup={p:s.p.slice(),v:s.v.slice(),old:s.old.slice()};a.outputIndices=Uint32Array.from(oriented.packet.spec.panels.flatMap((p,idx,all)=>{const offset=all.slice(0,idx).reduce((n,q)=>n+q.uvMm.length,0);return p.triangles.flatMap(t=>t.map(i=>i+offset));}));
  this.rows.push(a);this.contacts.reset();if(!this._collectingRows)this.initialize();return a;
  }catch(error){this.rows=this.rows.filter(existing=>existing!==a);this.release(a.allocations);throw error;}finally{this.allocationOwner=null;}
 }
 initialize() {
  const original=this.rows.map(a=>a.s.p.slice());
  try {
   const report=initializeLayers(this);
   for(const a of this.rows){a.saved.set(a.s.p);a.s.initial.set(a.s.p);a.s.old.set(a.s.p);a.s.v.fill(0);a.s.time=0;a.s.steps=0;a.cache.view.fill(-1);a.s.expand();}
   this.contacts.reset();this.lastContact=null;this.time=0;this.steps=0;this.lastDT=null;this.timings=null;this.solveMS=0;this.totalCorrections=0;this.drag=null;this.initializationReport=report;
   return report;
  }catch(error){this.rows.forEach((a,i)=>{a.s.p.set(original[i]);a.s.expand();a.cache.view.fill(-1);});this.contacts.reset();throw Error('初始叠穿放置失败：'+error.message);}
 }
 remove(id) {const removed=this.rows.filter(r=>r.id===id);this.rows=this.rows.filter(r=>r.id!==id);for(const a of removed)this.release(a.allocations);if(this.drag?.id===id)this.drag=null;this.contacts.reset();this.lastContact=null;}
 surfaces() {return this.rows.filter(r=>r.enabled).map(r=>({id:r.id,positions:r.s.p,previous:r.s.old,triangles:r.s.faces,inverseMass:r.s.w,thickness:r.thickness,enabled:true}));}
 projectBody(a,dense=false,refresh=false) {
  const m=this.bodyMesh,s=a.s,started=performance.now();
  // In the retained kernel refresh=0 blindly reuses the old winning triangle.
  // Coupled cloth corrections can invalidate it. refresh=1 still reuses the
  // kernel's certified nearest-query cache, but checks every competitor bound.
  const count=this.e.body_project(a.p.ptr,a.w.ptr,s.count,a.faces.ptr,s.faces.length/3,a.edges.ptr,s.edges.length,1,0,0,m.p.ptr,m.normal.ptr,m.faces.ptr,m.nodes.ptr,m.order.ptr,a.cache.ptr,s.settings.clearanceMM*.001,1,dense?1:0);
  if(this._timing)this._timing.bodyProjectionMS+=performance.now()-started;return count;
 }
 set(options={}) {this.options=checkedSettings(this.options,options);if(options.contactEnabled!==undefined){this.contacts.reset();this.lastContact=null;}}
 setThickness(id,value) {checkedThickness(value);const a=this.rows.find(r=>r.id===id);if(!a)throw Error('衣物不存在');a.thickness=value;a.s.settings.clearanceMM=bodyClearanceMM(value);a.cache.view.fill(-1);this.contacts.reset();this.lastContact=null;}
 reset() {for(const a of this.rows){a.s.p.set(a.saved);a.s.v.fill(0);a.s.old.set(a.saved);a.s.time=0;a.s.steps=0;a.cache.view.fill(-1);a.s.expand();}this.time=0;this.steps=0;this.contacts.reset();this.lastContact=null;this.totalCorrections=0;this.drag=null;this.lastDT=null;this.timings=null;this.solveMS=0;}
 perturb(id,kind='tug') {
  const a=this.rows.find(r=>r.id===id);if(!a)return;const s=a.s;
  let ymin=Infinity,zmax=-Infinity;for(let k=0;k<s.p.length;k+=3){ymin=Math.min(ymin,s.p[k+1]);zmax=Math.max(zmax,s.p[k+2]);}
  for(let i=0;i<s.count;i++){const k=i*3;if(!s.w[i])continue;
   if(kind==='tug'&&s.p[k+1]<ymin+.14){const u=Math.max(0,1-(s.p[k+1]-ymin)/.14);s.v[k+1]+=.16*u;s.v[k+2]+=.40*u;}
   if(kind==='push'&&s.p[k+2]>zmax-.08&&Math.abs(s.p[k])<.15){s.v[k+2]-=.45;}
  }
 }
 setDrag(value) {if(value!==null&&value!==undefined&&(!Number.isInteger(value.vertex)||value.vertex<0||!Array.isArray(value.target)||value.target.length!==3||!value.target.every(Number.isFinite)))throw Error('无效拖拽目标');this.drag=value||null;}
 applyDrag(h) {
  if(!this.drag)return;const a=this.rows.find(r=>r.id===this.drag.id);if(!a)return;
  const s=a.s,g=s.map[this.drag.vertex];if(g===undefined||!s.w[g])return;const k=g*3;
  const target=this.drag.target;for(let d=0;d<3;d++)s.p[k+d]+=Math.max(-.003,Math.min(.003,(target[d]-s.p[k+d])*.35));
 }
 step(dt=1/120) {
  if(!(dt>0&&dt<=1/30))throw Error('非法时间步');
  const started=performance.now(),active=this.rows.filter(r=>r.enabled),sub=this.options.substeps,h=dt/sub,e=this.e;
  for(const a of active){for(const key of ['p','v','old'])a.backup[key].set(a.s[key]);a.backup.time=a.s.time;a.backup.steps=a.s.steps;}
  const previous={time:this.time,steps:this.steps,lastContact:this.lastContact,lastDT:this.lastDT,solveMS:this.solveMS,timings:this.timings,totalCorrections:this.totalCorrections};let corrections=0;
  const timing={membraneMS:0,bodyProjectionMS:0,layerContactMS:0,layerBroadphaseMS:0,layerAuditMS:0};this._timing=timing;
  const solveContacts=passes=>{const t=performance.now();this.lastContact=this.contacts.solve(this.surfaces(),{friction:this.options.friction,passes,measureResidual:false});timing.layerContactMS+=performance.now()-t;timing.layerBroadphaseMS+=this.lastContact.timings?.broadphaseBuildMS||0;corrections+=this.lastContact.correctionCount;};
  try {
   for(let ss=0;ss<sub;ss++) {
    for(const a of active){const s=a.s;e.predict(a.p.ptr,a.v.ptr,a.old.ptr,a.w.ptr,s.count,h,Math.exp(-s.settings.damping*h),9.81*s.settings.gravity);
     if(this.options.wind)for(let i=0;i<s.count;i++)if(s.w[i])s.p[i*3+2]+=this.options.wind*h*h*(1+.2*Math.sin(this.time*3+s.p[i*3]*9));
     e.reset_lambda(a.edges.ptr,s.edges.length,4,3);e.reset_lambda(a.bends.ptr,s.bends.length,6,4);
    }
    for(let it=0;it<this.options.iterations;it++) {
     this.applyDrag(h);
     for(const a of active){const t=performance.now(),s=a.s,alpha=(s.family==='knit'?.00035:s.family==='leather'?.00003:.00006)*s.settings.softness/(h*h);e.distance_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,alpha);if(it%2===0)e.bend_batch(a.p.ptr,a.w.ptr,a.bends.ptr,s.bends.length,(s.family==='leather'?2800:s.family==='denim'?6000:12000)/(Math.max(.05,s.settings.bend)*h*h));e.strain_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12);timing.membraneMS+=performance.now()-t;if(it%2===1)this.projectBody(a,false,it===1&&ss===0);}
     if(this.options.contactEnabled&&it%4===3)solveContacts(1);
    }
    for(const a of active)this.projectBody(a,ss===sub-1,true);
    // Retain the upstream paper/body strain cleanup, while also alternating
    // reciprocal cloth contacts. Neither the final body projection nor cloth
    // response may be treated as preserving the other constraints by itself.
    for(let it=0;it<this.options.cleanupIterations;it++) {
     for(const a of active){const t=performance.now(),s=a.s;e.strain_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12);timing.membraneMS+=performance.now()-t;this.projectBody(a,false,false);}
     if(this.options.contactEnabled&&it%2===1)solveContacts(1);
    }
    if(this.options.contactEnabled){solveContacts(1);for(const a of active)this.projectBody(a,false,false);}else this.lastContact=null;
    for(const a of active){if(!e.finish(a.p.ptr,a.v.ptr,a.old.ptr,a.w.ptr,a.s.count,h,1))throw Error('出现非有限数值');for(let i=0;i<a.s.p.length;i++)if(Math.abs(a.s.p[i]-a.saved[i])>.40)throw Error('超出本轮受限位移');}
    this.time+=h;
   }
   if(this.options.contactEnabled){const t=performance.now(),measurement=this.contacts.measure(this.surfaces());timing.layerAuditMS=performance.now()-t;Object.assign(this.lastContact,{residualMaxPenetration:measurement.residualMaxPenetration,residualCount:measurement.residualCount,residualCandidateCount:measurement.residualCandidateCount,residualScope:measurement.residualScope,sampleContactPoints:measurement.sampleContactPoints,measuredAfterBodyProjection:true});}
   for(const a of active){a.s.time=this.time;a.s.steps+=sub;a.s.expand();}
   this.steps++;this.totalCorrections+=corrections;this.lastDT=dt;this.timings=timing;this.solveMS=performance.now()-started;
  } catch(error) {for(const a of active){for(const key of ['p','v','old'])a.s[key].set(a.backup[key]);a.s.time=a.backup.time;a.s.steps=a.backup.steps;a.s.expand();a.cache.view.fill(-1);}Object.assign(this,previous);this.contacts.reset();throw Error(error.message+'；已恢复本步之前的衣形');}
  finally{this._timing=null;}
  // The worker prepares exactly one transferable snapshot after this method.
  return this;
 }
 snapshot(options={}) {
  return {rows:this.rows.map(a=>({id:a.id,positions:Float32Array.from(a.s.output),normals:Float32Array.from(a.s.normals),indices:a.outputIndices,thickness:a.thickness,particles:a.s.count,triangles:a.s.faces.length/3,seamPairs:a.s.seamPairs.length,physicalMassKG:a.physicalMassKG})),audit:this.audit(options)};
 }
 audit({bodySamples=false}={}) {
  let minBody=Infinity,bodyVertices=0,bodyInsideVertices=0,bodyThicknessOverlappingVertices=0,bodyThicknessOverlap=0,maxStretch=0,seamGap=0;const bodyPerGarment=[];const q=new Float64Array(4);for(const a of this.rows){const s=a.s;
   for(const ed of s.edges){const i=ed.a*3,j=ed.b*3;maxStretch=Math.max(maxStretch,Math.hypot(s.p[i]-s.p[j],s.p[i+1]-s.p[j+1],s.p[i+2]-s.p[j+2])/ed.rest);}
   for(const [i,j]of s.seamPairs){seamGap=Math.max(seamGap,Math.hypot(s.output[i*3]-s.output[j*3],s.output[i*3+1]-s.output[j*3+1],s.output[i*3+2]-s.output[j*3+2]));}
   if(bodySamples){let minimum=Infinity,overlapping=0,clearanceDeficit=0;for(let i=0;i<s.count;i++){const j=i*3,d=this.body.sample(s.p[j],s.p[j+1],s.p[j+2],q)[0];minBody=Math.min(minBody,d);minimum=Math.min(minimum,d);bodyVertices++;if(d<0)bodyInsideVertices++;if(d<a.thickness*.5){bodyThicknessOverlappingVertices++;overlapping++;bodyThicknessOverlap=Math.max(bodyThicknessOverlap,a.thickness*.5-d);}clearanceDeficit=Math.max(clearanceDeficit,s.settings.clearanceMM*.001-d);}bodyPerGarment.push({id:a.id,minimumMiddleSurfaceDistanceMM:minimum*1000,minimumHalfThicknessClearanceMM:(minimum-a.thickness*.5)*1000,thicknessOverlappingVertices:overlapping,configuredClearanceDeficitMM:clearanceDeficit*1000});}
  }
  return {simulationSeconds:this.time,completedSteps:this.steps,solverMS:this.solveMS,stageTimingsMS:this.timings,garmentCount:this.rows.length,contactEnabled:!!this.options.contactEnabled,contact:this.lastContact,initialization:this.initializationReport,totalCorrections:this.totalCorrections,maxEdgeStretch:maxStretch,seamGapMM:seamGap*1000,bodyMinimumMM:bodySamples&&bodyVertices?minBody*1000:null,bodySampledVertices:bodySamples?bodyVertices:null,bodyInsideVertices:bodySamples?bodyInsideVertices:null,bodyThicknessOverlappingVertices:bodySamples?bodyThicknessOverlappingVertices:null,bodyThicknessOverlapMM:bodySamples?bodyThicknessOverlap*1000:null,bodyPerGarment:bodySamples?bodyPerGarment:null,bodyMetric:bodySamples?'all cloth vertices against actual static native-body triangles; no edge or whole-surface certificate':'not sampled in this snapshot; collision solver uses actual static native-body triangles',bodyClearancePerGarmentMM:this.rows.map(a=>({id:a.id,value:a.s.settings.clearanceMM})),substepsPerStep:this.options.substeps,solverIterations:this.options.iterations,cleanupIterations:this.options.cleanupIterations,simulationHz:this.lastDT?1/this.lastDT:null,nominalStepSeconds:this.lastDT,continuousCollision:false,sweptVertexFace:true,edgeEdgeCollision:false,completeSelfCollision:false,materialCalibrated:false,arbitraryLayeringCertified:false,fullFreeClothMembrane:false,constraintModel:'flat-paper edge-distance XPBD, dihedral bend and engineering strain bounds',kinematicShapeAttraction:false,staticNativeBody:true,temporaryBodyMotion:false,wasmReservedBytes:this.poolBytes,wasmReusedBytes:this.reusedBytes,wasmFreeBlockBytes:this.freeBlocks.reduce((sum,b)=>sum+b.capacity,0)};
 }
}
