/** KAOPU independent road grammar. No teacher code, mesh or assets. Metres. */
export const VERSION='0.1.0';
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function validateSpec(spec){
  const errors=[];
  if(!spec?.source?.url||!spec.source.dataset) errors.push('Missing traceable source');
  if(!Array.isArray(spec?.roads)||!spec.roads.length) errors.push('No roads');
  const ids=new Set();
  for(const r of spec?.roads||[]){
    if(ids.has(r.id)) errors.push(`Duplicate road ID ${r.id}`); ids.add(r.id);
    if(!r.points||r.points.length<2||r.points.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v)))) errors.push(`${r.id}: invalid local metre centreline`);
    if(!Number.isFinite(r.halfWidth)||r.halfWidth<=0) errors.push(`${r.id}: invalid halfWidth`);
    if(!Number.isFinite(r.height)) errors.push(`${r.id}: height must be metres, not a layer code`);
    if(!['observed','inferred','design'].includes(r.widthEvidence)) errors.push(`${r.id}: missing width evidence`);
    if(r.heightEvidence!=='observed'&&r.heightEvidence!=='inferred') errors.push(`${r.id}: missing height evidence`);
    for(const lane of r.lanes||[]){
      if(!lane.id||![-1,1].includes(lane.direction)||!(lane.tMax>lane.tMin)||lane.tMax>r.halfWidth||lane.tMin < -r.halfWidth) errors.push(`${r.id}: invalid lane bounds/direction`);
    }
  }
  const laneIds=new Set((spec?.roads||[]).flatMap(r=>(r.lanes||[]).map(l=>l.id)));
  for(const m of spec?.movements||[])if(!laneIds.has(m.from)||!laneIds.has(m.to)||!m.evidence) errors.push('Invalid/untraced movement');
  return errors;
}
export function segmentFrame(p,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(len<1e-8) return null;
  const u=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(len*len),0,1);
  const q=[a[0]+u*dx,a[1]+u*dz],dist=Math.hypot(p[0]-q[0],p[1]-q[1]);
  return {u,len,q,dist,t:((p[0]-q[0])*-dz+(p[1]-q[1])*dx)/len,tangent:[dx/len,dz/len]};
}
export function roadFrame(p,road){
  let best=null,offset=0;
  for(let i=1;i<road.points.length;i++){
    const f=segmentFrame(p,road.points[i-1],road.points[i]);
    if(!f) continue;
    if(!best||f.dist<best.dist) best={...f,s:offset+f.u*f.len,segment:i-1};
    offset+=f.len;
  }
  return best;
}
// Exact extrusion SDF for a 2D distance field and a vertical interval.
export function extrude(d,y,lo,hi){
  const v=Math.abs(y-(lo+hi)/2)-(hi-lo)/2;
  return Math.hypot(Math.max(d,0),Math.max(v,0))+Math.min(Math.max(d,v),0);
}
export function sampleRoad(p,spec){
  let value=Infinity,id=null;
  for(const r of spec.roads){
    const f=roadFrame([p[0],p[2]],r);if(!f)continue;
    // Capsule sweep: exact straight-segment field; min union at polyline joints.
    const d=extrude(f.dist-r.halfWidth,p[1],r.height-0.18,r.height);
    if(d<value){value=d;id=r.id;}
  }
  return {field:value,roadId:id};
}
export function pointAt(road,s){
  let rest=Math.max(0,s);
  for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-8)continue;
    if(rest<=len||i===road.points.length-1){const u=clamp(rest/len,0,1);return {point:[a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])],normal:[-(b[1]-a[1])/len,(b[0]-a[0])/len]};}rest-=len;
  }return null;
}
export function lengthOf(road){return road.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-road.points[i][0],p[1]-road.points[i][1]),0);}
export function anchors(spec,{spacing=24,clearance=1.1}={}){
  if(!(spacing>0))throw Error('Positive spacing required');
  const out=[];
  for(const r of spec.roads)for(let s=spacing/2;s<lengthOf(r);s+=spacing){
    const f=pointAt(r,s);if(!f)continue;
    for(const side of [-1,1]){
      const t=(r.halfWidth+clearance)*side,x=f.point[0]+f.normal[0]*t,z=f.point[1]+f.normal[1]*t;
      // Suppress furniture where another road cuts the pavement.
      if(spec.roads.some(o=>o.id!==r.id&&roadFrame([x,z],o)?.dist<o.halfWidth+1))continue;
      out.push({id:`${r.id}:lamp:${side}:${s}`,roadId:r.id,s,t,position:[x,r.height,z],height:6.5,evidence:'design'});
    }
  }return out;
}
export function materialAt(p,spec,{seed=17,wear=0.35}={}){
  const hit=sampleRoad(p,spec);const r=spec.roads.find(r=>r.id===hit.roadId);if(!r)return null;
  const f=roadFrame([p[0],p[2]],r);
  const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7+seed*17.13)*43758.5453;return n-Math.floor(n);};
  // Deterministic design noise, not measured Hong Kong surface scans.
  return {roadId:r.id,s:f.s,t:f.t,roughness:0.82,grit:hash(Math.floor(p[0]*80),Math.floor(p[2]*80)),wear:wear*hash(Math.floor(p[0]*0.3),Math.floor(p[2]*0.3)),evidence:'design-not-measured'};
}
export function signalState(time,{green=18,amber=3,allRed=2}={}){
  if(!(green>0&&amber>0&&allRed>0))throw Error('Positive signal phase durations required');
  const half=green+amber+allRed,t=((time%(half*2))+half*2)%(half*2),a=t<half,local=t%half;
  const active=local<green?'green':local<green+amber?'amber':'red';
  return {A:a?active:'red',B:a?'red':active,evidence:'design-not-live'};
}
export function laneAt(p,spec){
  let best=null;
  for(const road of spec.roads){const f=roadFrame([p[0],p[2]],road);if(!f||f.dist>road.halfWidth)continue;
    for(const lane of road.lanes||[])if(f.t>=lane.tMin&&f.t<lane.tMax){
      const candidate={roadId:road.id,laneId:lane.id,s:f.s,t:f.t,direction:lane.direction,kind:lane.kind,evidence:lane.evidence||'inferred',distance:f.dist};
      if(!best||candidate.distance<best.distance)best=candidate;
    }
  }return best;
}
export function laneGraph(spec){
  // Two crossing polylines do NOT create a topological connection by themselves.
  return {lanes:spec.roads.flatMap(r=>(r.lanes||[]).map(l=>({...l,roadId:r.id}))),movements:(spec.movements||[]).map(m=>({...m}))};
}
export function traceRoad(origin,direction,spec,{maxDistance=1000,maxSteps=256,epsilon=0.001}={}){
  const norm=Math.hypot(...direction);if(!(norm>0))throw Error('Ray needs a direction');
  const d=direction.map(v=>v/norm);let t=0;
  for(let steps=0;steps<maxSteps&&t<=maxDistance;steps++){
    const point=origin.map((v,i)=>v+d[i]*t),sample=sampleRoad(point,spec);
    if(sample.field<=epsilon)return {point,distance:t,roadId:sample.roadId,steps};
    // This implementation uses exact segment extrusion fields, not arbitrary noise displacement.
    t+=Math.max(epsilon,sample.field*0.9);
  }return null;
}
export function compileRoad(spec){
  const errors=validateSpec(spec);if(errors.length)throw Error(errors.join('; '));
  // Snapshot data prevents external mutation changing an existing compiled query.
  const frozen=structuredClone(spec);
  return Object.freeze({version:VERSION,sample:p=>sampleRoad(p,frozen),trace:(o,d,options)=>traceRoad(o,d,frozen,options),material:(p,options)=>materialAt(p,frozen,options),lane:p=>laneAt(p,frozen),anchors:options=>anchors(frozen,options),graph:()=>laneGraph(frozen),diagnostics:{visualSourceReady:false,geometry:'implicit-segment-extrusion',mesh:false}});
}
