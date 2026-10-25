/* Candidate-only adapter data and scalar GLSL source generator.
 * Pure, no SCENE/DYNAMIC mutations, rendering, object meshes or publishing.
 */
'use strict';
const S=require('./stack_candidate');
const PIN_IDS={O:'fixed_pivot_pin',R:'right_input_pin',L:'left_input_pin',A:'long_end_pin',C:'equal_centre_pin',B:'equal_left_end_pin',E:'equal_middle_end_pin',M:'middle_valve_crosshead_pin'};
const SPINDLE_IDS={R:'valve/right_valve_spindle',L:'valve/left_valve_spindle',M:'valve/middle_valve_spindle_inferred_horizontal'};
const ALIASES={R:'valve_chest/right_shared_valve_spindle',L:'valve_chest/left_shared_valve_spindle'};
function mapping(part){
 if(part.id.startsWith('plate/'))return {sourcePartId:'valve/gresley_'+part.id.slice(6),operation:'candidate-only full-thickness profile relocation and common-pose XZ motion',newField:false};
 if(part.id.startsWith('pin/'))return {sourcePartId:'valve/gresley_'+PIN_IDS[part.joint],operation:'candidate-only pin extent replacement, radius unchanged, common-pose XZ translation',newField:false};
 if(part.id.startsWith('spindle/'))return {sourcePartId:SPINDLE_IDS[part.joint],operation:'candidate-only explicit local through-Y subtraction; retained source capsule and centerline',newField:false};
 return {sourcePartId:null,operation:'new candidate-only '+part.role,newField:true};
}
const helper=`float stackRingY(vec3 p, vec2 c, float lo, float hi, float ri, float ro) { float rr=length(p.xz-c); float radial=rr-ro; if(ri>0.0)radial=max(radial,ri-rr); return max(radial,max(lo-p.y,p.y-hi)); }\n`;
const f=x=>{if(!Number.isFinite(x))throw Error('Nonfinite GLSL coefficient');let s=x.toPrecision(17);return /[.eE]/.test(s)?s:s+'.0';};
const v=a=>'vec3('+a.map(f).join(',')+')';
function glsl(part,name){
 let expr;
 if(part.kind==='ring')expr=`stackRingY(p,vec2(${f(part.center[0])},${f(part.center[2])}),${f(part.y[0])},${f(part.y[1])},${f(part.inner)},${f(part.outer)})`;
 else if(part.kind==='rod'){
  const Y=part.centerY??(part.y[0]+part.y[1])/2,ps=part.points.map(p=>[p[0],Y,p[2]]);
  expr=`mFlatRod(p,${v(ps[0])},${v(ps[1])},1,${v(ps[2]||ps[0])},${ps.length===3?'true':'false'},${f(part.width)},${f(part.eye)},${f(part.bore)},${f(part.halfThickness??(part.y[1]-part.y[0])/2)})`;
 }else{
  expr=`mCapsule(p,${v(part.points[0])},${v(part.points[1])},${f(part.radius)})`;
  if(part.terminalBore)expr=`max(${expr},${f(part.terminalBore)}-length(p.xz-vec2(${f(part.points[1][0])},${f(part.points[1][2])})))`;
 }
 return `float ${name}(vec3 p) { return ${expr}; }`;
}
function describe(parts){return parts.map((part,i)=>({id:part.id,...mapping(part),fieldFunction:'candidate_stack_'+i,referenceRigidFrameSourcePartId:part.joint?'valve/gresley_'+PIN_IDS[part.joint]:'valve/gresley_'+part.id.slice(6),referenceFrameNote:'Compile the reference geometry once, use Gresley inverseXZ of this exact frame source at common theta; Y stays at candidate value. OR evaluate world-pose fields directly, never both.',poseDependency:part.joint==='O'?'fixed original O XZ':part.joint?'common Gresley pose.pins.'+part.joint:part.joints.map(k=>'common Gresley pose.pins.'+k),AABB:S.bounds(part),supportAABBInflationRecommended:1e-6,lipschitzAnalyticUpperBound:1,lipschitzGpuInflated:1.000002,glsl:glsl(part,'candidate_stack_'+i)}));}
function pack(design,profiles,pose){if(!design.options.terminalEyes)throw Error('Uncut terminal stack is a retained FAILURE, not the connected integration candidate');for(const k of Object.keys(ALIASES))if(!profiles.sharedSpindleAliases[k]?.solidCylinderContainedInCapsule)throw Error('Alias suppression condition no longer verified for '+k);const parts=S.parts(design,profiles,pose);return {parts,fields:describe(parts),helperGLSL:helper,aliasPolicy:Object.entries(ALIASES).map(([k,id])=>({sourcePartId:id,physicalAliasOf:SPINDLE_IDS[k],candidateAction:'suppress duplicate independent solid ONLY while canonical candidate capsule represents this same shaft and receives the explicit terminal cut',condition:'same absolute outside/Gresley pose; source cylinder radius/endpoints verified contained in canonical capsule; do not suppress other mPV parts',alternative:'retain alias field only if the identical moving terminal Y-bore is subtracted; still count it as one physical spindle, not another cleared body',baselineAction:'retain original unchanged'})),coordinateContract:'All descriptors/scalars are in current world coordinates at ONE common theta. Do NOT also apply dynValve/dynGresley to them. A source-local implementation must perform exactly one inverse rigid transform instead.',warnings:['Input terminal cut and added eye are explicit candidate geometry changes, not existing holes.','End retainer is an envelope, not a verified thread/groove/lock.','O remains unsupported by any verified frame mount.','Middle spindle straight path remains a kinematic constraint without a verified guide/chest.','No whole-train interference or structural acceptance claim.']};}
module.exports={PIN_IDS,SPINDLE_IDS,ALIASES,mapping,glsl,helper,describe,pack};
