/** Mindfront MakeHuman Eyebrows01 (CC0) source-centreline adapter.
 * Original source data and exact hashes: BROW_PROVENANCE.json.
 * New code: real GNM surface supports; no MakeHuman head or mesh overlay.
 */
import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {TeacherSkinBVH} from './SkinBVH.mjs';
import {BROW_LIBRARY} from './BrowData.mjs';
import{smoothBrowValue}from'./binding-math.mjs';
import{BROW_PROFILE,mapBrowField,browDensity}from'./BrowProfile.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const unit=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const point=(a,i)=>Array.from(a.subarray(i*3,i*3+3));
const rootAt=(model,positions,t,b)=>{const p=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)p[k]+=positions[model.triangles[t*3+j]*3+k]*b[j];return p};
const rank=i=>{let x=(i+1)^0x9e3779b9;x=Math.imul(x^(x>>>16),0x21f0aaad);return ((x^(x>>>15))>>>0)/4294967296};
function distance2(p,line){let d=Infinity;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);d=Math.min(d,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy))}return d}
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const referenceY=u=>7.4+.00473699+.04515122*u+.30553433*u*u-.45473728*u*u*u;
const referenceZ=x=>1.5266593-.5647476*x+1.408603*x*x-2.3594694*x*x*x;
const CACHE=new Map();
function source(id){if(CACHE.has(id))return CACHE.get(id);const data=BROW_LIBRARY.find(p=>p.id===id);if(!data)throw Error('Unknown Mindfront eyebrow style');const raw=decode(data.points),pts=new Float32Array(raw.buffer),counts=decode(data.counts),curves=[];let offset=0;for(let i=0;i<counts.length;i++){const arr=[];for(let j=0;j<counts[i];j++){arr.push(Array.from(pts.subarray(offset,offset+3)));offset+=3}const arc=[0];for(let j=1;j<arr.length;j++)arc.push(arc[j-1]+Math.hypot(...arr[j].map((v,k)=>v-arr[j-1][k])));curves.push({points:arr,arc,total:arc.at(-1)})}const value={data,curves};CACHE.set(id,value);return value}
function sample(curve,s){const d=clamp(s,0,1)*curve.total;let j=1;while(j<curve.arc.length-1&&curve.arc[j]<d)j++;const t=(d-curve.arc[j-1])/(curve.arc[j]-curve.arc[j-1]||1);return curve.points[j-1].map((v,k)=>mix(v,curve.points[j][k],t))}
export class MakeHumanBrows{
 constructor(model,positions,normals,context){
  this.model=model;this.capacity=Math.max(...BROW_LIBRARY.map(p=>p.count));this.segments=10;this.per=this.segments+1;this.count=0;this.options={browsModel:3,browsDensity:92,browsLength:100,browsDirection:0,browsLift:6,...context.options};
  this.lines=[context.landmarks.slice(17,22),context.landmarks.slice(22,27)];this.eyes=[context.landmarks.slice(36,42),context.landmarks.slice(42,48)];this.eyes.forEach(e=>e.push(e[0]));
  if(!context.allowed.size)throw Error('No valid current-head brow surface');this.bvh=new TeacherSkinBVH(model,positions,context.allowed);
  this.front=Math.max(...this.bvh.faces.map(f=>f.max[2]))+.025;this.back=Math.min(...this.bvh.faces.map(f=>f.min[2]))-.025;
  const n=this.capacity*this.per*2;this.geometry=new THREE.BufferGeometry();for(const name of ['position','tangent','scalpNormal'])this.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage));
  for(const name of ['strandSide','along','strandRandom','strandRadius'])this.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(n),1).setUsage(THREE.DynamicDrawUsage));this.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(this.capacity*this.segments*6),1).setUsage(THREE.DynamicDrawUsage));
  this.supportT=new Int32Array(this.capacity*this.per);this.supportB=new Float32Array(this.capacity*this.per*3);this.lifts=new Float32Array(this.capacity*this.per);this.rootTriangles=new Int32Array(this.capacity);this.rootBarycentrics=new Float32Array(this.capacity*3);this.templateRoots=new Float32Array(this.capacity*3);this.positions=new Float32Array(this.capacity*this.per*3);this.sourceIds=new Uint16Array(this.capacity);this.selected=new Uint8Array(this.capacity);
  this.mesh=new THREE.Mesh(this.geometry,new THREE.MeshBasicMaterial());this.mesh.name='Mindfront CC0 surface-bound eyebrows';this.mesh.frustumCulled=false;this.mesh.renderOrder=2;this.bind();this.update(positions,normals);
 }
 project(p){const ray=this.bvh.segmentHit([p[0],p[1],this.front],[p[0],p[1],this.back]),hit=this.bvh.nearest(ray?.point||p);return hit&&Math.hypot(hit.p[0]-p[0],hit.p[1]-p[1])<.006&&Math.abs(hit.p[2]-p[2])<.02?hit:null}
 mapPoint(p,root){const sign=root[0]<0?-1:1,line=this.lines.find(l=>Math.sign(l[2][0])===sign),[a,b]=BROW_PROFILE.sourceAbsX,[c,d]=BROW_PROFILE.targetLocalAbsX,t=(Math.abs(p[0])-a)/(b-a),x=c+(d-c)*t,depth=smoothBrowValue(x,line)[2];return mapBrowField(p,root,depth)}

 bind(){
  const started=performance.now(),o=this.options,src=source(o.browsModel);this.sourceData=src.data;this.count=0;this.rejectedRoots=0;this.minEyeGap=Infinity;let maxLift=0;
  for(let si=0;si<src.curves.length;si++){
   const curve=src.curves[si],root=curve.points[0],mappedRoot=this.mapPoint(root,root),hit=this.project(mappedRoot);if(!hit){this.rejectedRoots++;continue}const eyeGap=Math.min(...this.eyes.map(e=>distance2(hit.p,e)));
   if(Math.abs(hit.p[0])<.004||eyeGap<.0035){this.rejectedRoots++;continue}
   this.minEyeGap=Math.min(this.minEyeGap,eyeGap);const i=this.count++;this.sourceIds[i]=si;this.rootTriangles[i]=hit.t;this.rootBarycentrics.set(hit.b,i*3);this.templateRoots.set(hit.p,i*3);
   let previous=hit;for(let j=0;j<this.per;j++){
    const s=j/this.segments,p=sample(curve,s*o.browsLength/100),mapped=this.mapPoint(p,root),angle=o.browsDirection*Math.PI/180,dx=mapped[0]-mappedRoot[0],dy=mapped[1]-mappedRoot[1];mapped[0]=mappedRoot[0]+Math.cos(angle)*dx-Math.sin(angle)*dy;mapped[1]=mappedRoot[1]+Math.sin(angle)*dx+Math.cos(angle)*dy;
    let h=j===0?hit:this.project(mapped);if(!h||Math.min(...this.eyes.map(e=>distance2(h.p,e)))<.0025)h=previous;previous=h;
    const q=i*this.per+j;this.supportT[q]=h.t;this.supportB.set(h.b,q*3);const nativeDepth=p[2]-root[2]-(referenceZ(Math.abs(p[0]))-referenceZ(Math.abs(root[0]))),lift=j===0?.00002:.000045+clamp(nativeDepth*.085,0,.0018)*o.browsLift/10;this.lifts[q]=lift;maxLift=Math.max(maxLift,lift);
    for(let side=0;side<2;side++){const v=q*2+side;this.geometry.attributes.strandSide.array[v]=side?1:-1;this.geometry.attributes.along.array[v]=s;this.geometry.attributes.strandRandom.array[v]=rank(si);this.geometry.attributes.strandRadius.array[v]=.000043*(.78+.44*rank(si))*(1-.89*s*s*s)}
   }
  }
  if(this.count<100)throw Error('Eyebrow retarget left too few safe roots');this.maxLift=maxLift;this.bindMs=performance.now()-started;this.select();for(const name of ['strandSide','along','strandRandom','strandRadius'])this.geometry.attributes[name].needsUpdate=true;
 }
 select(){this.selected.fill(0);const a=this.geometry.index.array;let at=0;this.activeCount=0;for(let i=0;i<this.count;i++){if(rank(this.sourceIds[i])>=this.options.browsDensity/100*browDensity(source(this.options.browsModel).curves[this.sourceIds[i]].points[0][0]))continue;this.activeCount++;this.selected[i]=1;for(let j=0;j<this.segments;j++){const q=(i*this.per+j)*2;a.set([q,q+1,q+2,q+1,q+3,q+2],at);at+=6}}this.geometry.setDrawRange(0,at);this.geometry.index.needsUpdate=true}
 update(positions,normals){
  this.surfacePositions=positions;this.surfaceNormals=normals;const p=this.geometry.attributes.position.array,n=this.geometry.attributes.scalpNormal.array,t=this.geometry.attributes.tangent.array;
  for(let i=0;i<this.count;i++)for(let j=0;j<this.per;j++){const q=i*this.per+j,triangle=this.supportT[q],b=this.supportB.subarray(q*3,q*3+3),surface=rootAt(this.model,positions,triangle,b),normal=unit(rootAt(this.model,normals,triangle,b));for(let k=0;k<3;k++){const v=surface[k]+normal[k]*this.lifts[q];this.positions[q*3+k]=v;p[q*6+k]=p[q*6+3+k]=v;n[q*6+k]=n[q*6+3+k]=normal[k]}}
  for(let i=0;i<this.count;i++)for(let j=0;j<this.per;j++){const q=i*this.per+j,a=(i*this.per+Math.max(0,j-1))*3,b=(i*this.per+Math.min(this.segments,j+1))*3;const d=unit([0,1,2].map(k=>this.positions[b+k]-this.positions[a+k]));for(let k=0;k<3;k++)t[q*6+k]=t[q*6+3+k]=d[k]}
  for(const name of ['position','scalpNormal','tangent'])this.geometry.attributes[name].needsUpdate=true;
 }
 apply(patch){let rebind=false,selection=false;for(const k of Object.keys(this.options)){if(patch[k]===undefined||patch[k]===this.options[k])continue;if(!Number.isFinite(patch[k]))throw Error('Invalid eyebrow '+k);this.options[k]=patch[k];if(k==='browsDensity')selection=true;else rebind=true}if(this.options.browsModel<1)this.options.browsModel=1;if(rebind){this.bind();this.update(this.surfacePositions,this.surfaceNormals)}else if(selection)this.select()}
 diagnostics(){let rootHash=2166136261,maxRootOffset=0;for(let i=0;i<this.count;i++){const root=rootAt(this.model,this.surfacePositions,this.rootTriangles[i],this.rootBarycentrics.subarray(i*3,i*3+3)),p=this.positions.subarray(i*this.per*3,i*this.per*3+3);maxRootOffset=Math.max(maxRootOffset,Math.hypot(...root.map((v,k)=>v-p[k])));const bits=new Uint32Array(this.templateRoots.buffer,i*3*4,3);for(const b of bits)rootHash=Math.imul(rootHash^b,16777619)}let curveHash=2166136261;const cb=new Uint32Array(this.positions.buffer,0,this.count*this.per*3);for(const v of cb)curveHash=Math.imul(curveHash^v,16777619);return{curveHash:curveHash>>>0,source:'Mindfront MakeHuman Eyebrows01 CC0',style:this.options.browsModel,profile:BROW_PROFILE.schema,sourceCount:this.sourceData.count,count:this.count,activeCount:this.activeCount,rejectedRoots:this.rejectedRoots,rootHash:rootHash>>>0,maxRootOffset,minNeutralEyeGap:this.minEyeGap,sourceSha256:this.sourceData.sourceSha256,finite:this.positions.subarray(0,this.count*this.per*3).every(Number.isFinite),triangleAttached:true,meshOverlay:false,bindMs:this.bindMs}}
 dispose(){this.geometry.dispose();this.mesh.material.dispose()}
}
