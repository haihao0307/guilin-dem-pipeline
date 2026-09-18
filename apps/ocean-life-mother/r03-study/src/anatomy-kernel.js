/* KAOPU Ocean Life R03.A anatomical articulation interface.
 * This kernel stores explicit part identity, measured/declared local frames,
 * hierarchy and bounded actuation. It does NOT infer anatomy from UV charts,
 * guess missing pivots, or claim a species binding without source evidence.
 */
const AnatomyKernel=(()=>{
'use strict';
const EPS=1e-12;
const finite3=(a)=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function norm(a){const l=Math.hypot(...a);if(!(l>EPS))throw Error('Zero-length anatomy axis');return a.map(x=>x/l)}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function rotate(v,axis,angle){const c=Math.cos(angle),s=Math.sin(angle),d=dot(axis,v),x=cross(axis,v);return v.map((q,i)=>q*c+x[i]*s+axis[i]*d*(1-c))}
function compile(spec){
 if(!spec||spec.schema!=='kaopu-fish-anatomy-articulation/0.1'||!Array.isArray(spec.parts))throw Error('Unsupported anatomy spec');
 if(typeof spec.coordinateFrame!=='string'||!spec.coordinateFrame.trim()||typeof spec.lengthUnit!=='string'||!spec.lengthUnit.trim()||spec.angleUnit!=='rad')throw Error('Anatomy frame and units must be explicit');
 const parts=new Map();
 for(const raw of spec.parts){
  if(!raw||typeof raw.id!=='string'||!raw.id||parts.has(raw.id))throw Error('Invalid or duplicate anatomy part id');
  if(raw.kind!=='rigid-hinge'&&raw.kind!=='rigid-fixed')throw Error('Unsupported anatomy part kind');
  if(raw.parent!==null&&raw.parent!==undefined&&typeof raw.parent!=='string')throw Error('Invalid anatomy parent');
  if(!finite3(raw.anchor))throw Error('Anatomy anchor must be explicit finite vec3');
  const part={...raw,anchor:raw.anchor.slice(),axis:null,limit:null};
  if(raw.kind==='rigid-hinge'){
   if(!finite3(raw.axis))throw Error('Hinge axis must be explicit finite vec3');
   if(!Array.isArray(raw.angleRange)||raw.angleRange.length!==2||!raw.angleRange.every(Number.isFinite)||raw.angleRange[0]>raw.angleRange[1])throw Error('Hinge angleRange must be explicit');
   part.axis=norm(raw.axis);part.limit=raw.angleRange.slice();
  }
  parts.set(part.id,part);
 }
 for(const part of parts.values())if(part.parent!=null&&!parts.has(part.parent))throw Error('Unknown anatomy parent: '+part.parent);
 // Reject hierarchy cycles; do not silently flatten them.
 for(const part of parts.values()){
  const seen=new Set([part.id]);let q=part;
  while(q.parent!=null){if(seen.has(q.parent))throw Error('Anatomy hierarchy cycle');seen.add(q.parent);q=parts.get(q.parent);}
 }
 function lineage(id){if(!parts.has(id))throw Error('Unknown anatomy part: '+id);const out=[];let q=parts.get(id);while(q){out.unshift(q);q=q.parent==null?null:parts.get(q.parent)}return out}
 function angleFor(part,states){
  if(part.kind!=='rigid-hinge')return 0;
  const raw=states&&Object.prototype.hasOwnProperty.call(states,part.id)?states[part.id]:0;
  if(!Number.isFinite(raw))throw Error('Nonfinite anatomy state: '+part.id);
  return clamp(raw,part.limit[0],part.limit[1]);
 }
 function applyOne(part,p,vector,states){
  const a=angleFor(part,states);if(part.kind==='rigid-fixed'||Math.abs(a)<EPS)return {point:p.slice(),vector:vector?vector.slice():null,angle:a};
  const rel=p.map((x,i)=>x-part.anchor[i]),rot=rotate(rel,part.axis,a),point=rot.map((x,i)=>x+part.anchor[i]);
  return{point,vector:vector?rotate(vector,part.axis,a):null,angle:a};
 }
 function apply(partId,point,vector=null,states={}){
  if(!finite3(point))throw Error('Anatomy point must be finite vec3');if(vector!==null&&!finite3(vector))throw Error('Anatomy vector must be finite vec3');
  let p=point.slice(),v=vector?vector.slice():null;const applied=[];
  for(const part of lineage(partId)){const q=applyOne(part,p,v,states);p=q.point;v=q.vector;applied.push({id:part.id,angle:q.angle});}
  return{point:p,vector:v,applied};
 }
 function applySample(partId,sample,states={}){
  if(!sample||!finite3(sample.position))throw Error('Sample position missing');
  const g=sample.geometricNormal?apply(partId,sample.position,sample.geometricNormal,states):apply(partId,sample.position,null,states);
  const s=sample.shadingNormal?apply(partId,sample.position,sample.shadingNormal,states):null;
  return{...sample,position:g.point,geometricNormal:g.vector,shadingNormal:s?s.vector:null,articulation:g.applied};
 }
 return{schema:spec.schema,coordinateFrame:spec.coordinateFrame,lengthUnit:spec.lengthUnit,angleUnit:spec.angleUnit,parts,lineage,apply,applySample,statesAreAnglesRadians:true,unknownBindingsRemainUnknown:true};
}
return{compile,rotate};
})();
if(typeof module!=='undefined')module.exports=AnatomyKernel;
