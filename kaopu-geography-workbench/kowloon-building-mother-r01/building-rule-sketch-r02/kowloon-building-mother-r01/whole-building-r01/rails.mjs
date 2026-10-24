/** Continuous, stair-owned analytic rails. No mesh or tessellated curve is created.
 * The line/circular-arc kernel is the original r07 kernel, reused by reference.
 * One template is shared by every storey with the same stair dimensions.
 */
import {filletPath, railDistanceBounded, closestOnLine, closestOnArcTrigFree, railPointAt} from '../r07/field.mjs';

export const STAIR_RAIL_SCHEMA = 'kaopu.whole-building-stair-rail/1';
export const STAIR_RAIL_TEXTURE_WIDTH = 8;
export const STAIR_RAIL_MAX_PRIMITIVES = 64;
const EPS = 1e-9;
const add = (a,b) => a.map((x,i)=>x+b[i]);
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const mul = (a,s) => a.map(x=>x*s);
const dot = (a,b) => a.reduce((n,x,i)=>n+x*b[i],0);
const norm = a => mul(a,1/Math.hypot(...a));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const identityFrame = () => ({origin:[0,0,0],xAxis:[1,0,0],zAxis:[0,0,1]});
const finite3 = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
function frameOf(frame = identityFrame()) {
  const f = {origin: [...(frame.origin ?? [0,0,0])],xAxis:[...(frame.xAxis ?? [1,0,0])],zAxis:[...(frame.zAxis ?? [0,0,1])]};
  if (!Object.values(f).every(finite3) || Math.abs(Math.hypot(...f.xAxis)-1)>1e-6 || Math.abs(Math.hypot(...f.zAxis)-1)>1e-6 || Math.abs(dot(f.xAxis,f.zAxis))>1e-6 || Math.abs(f.xAxis[1])+Math.abs(f.zAxis[1])>1e-6 || f.xAxis[0]*f.zAxis[2]-f.xAxis[2]*f.zAxis[0]<.999999) throw Error('Rail frame must be a rigid, right-handed upright frame');
  return f;
}
export function railToWorld(p,frame) { const f=frameOf(frame); return add(f.origin,add(mul(f.xAxis,p[0]),add([0,p[1],0],mul(f.zAxis,p[2])))); }
export function railToLocal(p,frame) { const f=frameOf(frame),q=sub(p,f.origin); return [dot(q,f.xAxis),q[1],dot(q,f.zAxis)]; }
function directionToLocal(p,f) { return [dot(p,f.xAxis),p[1],dot(p,f.zAxis)]; }
const expand = (bounds,r) => ({min:bounds.min.map(v=>v-r),max:bounds.max.map(v=>v+r)});
function unionBounds(items) { return {min:[0,1,2].map(i=>Math.min(...items.map(p=>p.min[i]))),max:[0,1,2].map(i=>Math.max(...items.map(p=>p.max[i])))}; }
function lineBounds(a,b) { return {min:a.map((v,i)=>Math.min(v,b[i])),max:a.map((v,i)=>Math.max(v,b[i]))}; }
function boundsSquared(p,b) { return p.reduce((s,v,i)=>s+Math.max(b.min[i]-v,0,v-b.max[i])**2,0); }
function validateLayout(layout) {
  const d={floorHeight:layout.floorHeight ?? 3.2,flightWidth:layout.flightWidth ?? 1.1,centerGap:layout.centerGap ?? .2,runLength:layout.runLength ?? 2.2,landingDepth:layout.landingDepth ?? 1,accessLandingDepth:layout.accessLandingDepth ?? 1.1,slabThickness:layout.slabThickness ?? .18,z0:layout.z0 ?? 0};
  for(const [key,v] of Object.entries(d)) if(!Number.isFinite(v) || (key!=='z0'&&v<=0)) throw Error('Invalid rail stair dimension: '+key);
  d.risersPerFlight=layout.risersPerFlight ?? Math.ceil(d.floorHeight/.36);
  if(!Number.isInteger(d.risersPerFlight)||d.risersPerFlight<3||d.risersPerFlight>32) throw Error('Rail stair risersPerFlight must be 3..32');
  d.treadDepth=layout.treadDepth ?? d.runLength/d.risersPerFlight;
  if(!Number.isFinite(d.treadDepth)||Math.abs(d.treadDepth*d.risersPerFlight-d.runLength)>1e-6) throw Error('Rail layout must use complete equal-depth treads that reach the landing');
  d.rise=d.floorHeight/(2*d.risersPerFlight); d.midHeight=d.floorHeight/2; d.z1=d.z0+d.runLength; d.totalWidth=2*d.flightWidth+d.centerGap;
  return d;
}
/** Surface contact reference for authored stair solids. Null means no support.
 * treadIndex is zero-based and stable, with surface IDs assigned by the instance.
 */
export function stairRailSupportSurface(dimensions,point,role) {
  const d=dimensions, [x,,z]=point, side=d.totalWidth/2;
  if (Math.abs(x)>side+EPS) return null;
  if(role==='lower-floor'||role==='upper-floor') return z>=d.z0-d.accessLandingDepth-EPS&&z<=d.z0+EPS ? {height:role==='lower-floor'?0:d.floorHeight,kind:'platform',treadIndex:null} : null;
  if(role==='midlanding') return z>=d.z1-EPS&&z<=d.z1+d.landingDepth+EPS ? {height:d.midHeight,kind:'landing',treadIndex:null} : null;
  if(role==='first-flight'||role==='second-flight') {
    const first=role==='first-flight';
    if((first&&(x < -side-EPS||x > -d.centerGap/2+EPS))||(!first&&(x<d.centerGap/2-EPS||x>side+EPS))||z<d.z0-EPS||z>d.z1+EPS) return null;
    const travel=first ? z-d.z0 : d.z1-z, index=clamp(Math.floor(clamp(travel,0,d.runLength-EPS)/d.treadDepth),0,d.risersPerFlight-1);
    return {height:(first?0:d.midHeight)+(index+1)*d.rise,kind:'tread',treadIndex:index};
  }
  return null;
}
function pieceOwner(piece,d) {
  const p=piece.kind==='line'?mul(add(piece.start,piece.end),.5):railPointAt({pieces:[{...piece,pathOffset:0}],length:piece.length},piece.length/2).point;
  if(p[2]<d.z0-EPS) return p[1]<d.midHeight?'lower-floor':'upper-floor';
  if(p[2]>d.z1-EPS) return 'midlanding';
  return p[0]<0?'first-flight':'second-flight';
}
/** Derive, never independently place, the continuous handrail and its supports.
 * options allow an authored override; dimensions always drive feasibility.
 */
export function deriveStairRails(layout={},options={}) {
  const d=validateLayout(layout), frame=frameOf(layout.frame), railHeight=options.railHeight ?? clamp(d.floorHeight*.31,.88,1.05), radius=options.railRadius ?? clamp(Math.min(d.flightWidth*.03,d.floorHeight*.011),.028,.04);
  const bendRadius=options.railBendRadius ?? Math.min(.2,d.landingDepth*.22,d.flightWidth*.2), extension=Math.min(.42,d.accessLandingDepth*.6), sideInset=Math.max(.085,radius*2+.02), outer=d.totalWidth/2-sideInset, back=d.z1+d.landingDepth-Math.max(.14,bendRadius*.8);
  if(![railHeight,radius,bendRadius].every(v=>Number.isFinite(v)&&v>0)||bendRadius<=2*radius) throw Error('Rail bend radius must exceed twice tube radius');
  if(sideInset>=d.flightWidth/2||extension<=bendRadius||back-d.z1<=bendRadius*1.5||railHeight<=d.rise+radius*2) throw Error('Rail dimensions leave insufficient support/fillet clearance');
  const P=[[-outer,railHeight,d.z0-extension],[-outer,railHeight,d.z0],[-outer,d.midHeight+railHeight,d.z1],[-outer,d.midHeight+railHeight,back],[outer,d.midHeight+railHeight,back],[outer,d.midHeight+railHeight,d.z1],[outer,d.floorHeight+railHeight,d.z0],[outer,d.floorHeight+railHeight,d.z0-extension]];
  const path=filletPath(P,bendRadius,'rounded');
  const supports=[],supportRadius=radius*.62, embedDepth=Math.min(.045,d.slabThickness*.3);
  function support(suffix,role,top) {
    const contact=stairRailSupportSurface(d,top,role);
    if(!contact) throw Error('Rail support has no physical stair/platform surface: '+suffix);
    const anchor=[top[0],contact.height,top[2]], start=[top[0],contact.height-embedDepth,top[2]], centerDistance=railDistanceBounded(path,top).distance;
    if(centerDistance>1e-7||top[1]-contact.height<=2*radius) throw Error('Rail support does not meet the handrail with clearance: '+suffix);
    supports.push({id:suffix,ownerRole:role,surfaceKind:contact.kind,treadIndex:contact.treadIndex,anchor,start,end:[...top],radius:supportRadius,embedDepth,handrailContact:{centerlinePoint:[...top],distance:centerDistance},geometry:'analytic_line_swept_tube',attachment:'embedded_base_to_exact_handrail_centerline'});
  }
  support('support:lower-platform','lower-floor',P[0]);
  for(const first of [true,false]) for(const [station,fraction] of [.2,.5,.8].entries()) {
    const index=clamp(Math.floor(d.risersPerFlight*fraction),0,d.risersPerFlight-1), travel=(index+.5)*d.treadDepth, t=travel/d.runLength, role=first?'first-flight':'second-flight';
    support('support:'+role+':station-'+String(station+1),role,[first?-outer:outer,(first?0:d.midHeight)+d.midHeight*t+railHeight,first?d.z0+travel:d.z1-travel]);
  }
  support('support:landing-left','midlanding',[-outer,d.midHeight+railHeight,(d.z1+back)/2]);
  support('support:landing-back','midlanding',[0,d.midHeight+railHeight,back]);
  support('support:landing-right','midlanding',[outer,d.midHeight+railHeight,(d.z1+back)/2]);
  support('support:upper-platform','upper-floor',P.at(-1));
  const primitives=path.pieces.map((p,index)=>({...p,id:'centerline:'+String(index).padStart(2,'0'),ownerRole:pieceOwner(p,d),tubeRadius:radius,component:'handrail',surfaceBounds:expand(p.bounds,radius+1e-6)}));
  for(const s of supports) { const bounds=lineBounds(s.start,s.end); primitives.push({kind:'line',start:s.start,end:s.end,length:Math.hypot(...sub(s.end,s.start)),pathOffset:0,bounds,surfaceBounds:expand(bounds,s.radius+1e-6),id:s.id,ownerRole:s.ownerRole,tubeRadius:s.radius,component:'support'}); }
  if(primitives.length>STAIR_RAIL_MAX_PRIMITIVES) throw Error('Rail descriptor capacity exceeded');
  const bounds=unionBounds(primitives.map(p=>p.surfaceBounds));
  const result={schema:STAIR_RAIL_SCHEMA,id:layout.id??'stair-template',frame,dimensions:d,path,supports,primitives,bounds,railHeight,radius,bendRadius,sideInset,supportRadius,embedDepth,
    provenance:'authored_continuous_stair_rail_not_measured',representation:'exact_line_and_circular_arc_swept_tubes_no_object_meshes',structuralCertification:false,
    clearanceContract:{nominalHeightAboveFlightPitchLine:railHeight,minimumConservativeHeightAboveTread:railHeight-d.rise-bendRadius-radius,supportEdgeClearance:sideInset-supportRadius,notBuildingCodeCertification:true},
    dependencies:['floorHeight','flightWidth','centerGap','runLength','landingDepth','accessLandingDepth','risersPerFlight','slabThickness'],
    distanceContract:{lipschitzUpperBound:1,outside:'exact minimum constituent tube distance',inside:'conservative signed union field',raySafetyFactor:.85,minimumPositiveStep:0,budgetExhaustion:'unresolved_never_geometric_miss'}};
  result.texture=packStairRailDescriptors(result);
  return result;
}
function ownerIds(instance) { return {'lower-floor':instance.lowerFloorId,'upper-floor':instance.upperFloorId,'first-flight':instance.stairId+':flight:1','second-flight':instance.stairId+':flight:2',midlanding:instance.landingId}; }
export function createRailInstance(template,{id,stairId,lowerFloorId,upperFloorId,landingId,frame}={}) {
  if(template?.schema!==STAIR_RAIL_SCHEMA) throw Error('deriveStairRails template required');
  stairId=stairId??template.id; const instance={schema:STAIR_RAIL_SCHEMA,template,id:id??stairId+':rail:outer',stairId,lowerFloorId:lowerFloorId??stairId+':lower-floor',upperFloorId:upperFloorId??stairId+':upper-floor',landingId:landingId??stairId+':landing:mid',frame:frameOf(frame??template.frame)};
  const owners=ownerIds(instance);
  instance.parentId=stairId;
  instance.supports=template.supports.map(s=>({...s,id:stairId+':'+s.id,railId:instance.id,ownerId:owners[s.ownerRole],anchorWorld:railToWorld(s.anchor,instance.frame),startWorld:railToWorld(s.start,instance.frame),endWorld:railToWorld(s.end,instance.frame)}));
  instance.graph={nodes:[{id:instance.id,parentId:stairId,kind:'continuous-rail',templateId:template.id},...instance.supports.map(s=>({id:s.id,parentId:instance.id,kind:'rail-support',surfaceOwnerId:s.ownerId}))],edges:[{from:stairId,to:instance.id,relation:'owns'},...Object.values(owners).map(owner=>({from:instance.id,to:owner,relation:'follows_or_supported_by'})),...instance.supports.map(s=>({from:s.id,to:s.ownerId,relation:'embedded_in'}))]};
  const corners=[]; for(const x of template.bounds.min.slice(0,1).concat(template.bounds.max.slice(0,1))) for(const y of [template.bounds.min[1],template.bounds.max[1]]) for(const z of [template.bounds.min[2],template.bounds.max[2]]) corners.push(railToWorld([x,y,z],instance.frame));
  instance.bounds=unionBounds(corners.map(p=>({min:p,max:p})));
  return instance;
}
function unpack(spec) { const template=spec.template??spec; if(template?.schema!==STAIR_RAIL_SCHEMA) throw Error('Valid stair rail template/instance required'); return {template,frame:spec.frame??identityFrame()}; }
export function queryStairRailLocal(template,p,{useBounds=true}={}) {
  if(!finite3(p)) throw Error('Finite rail query point required');
  let best={distance:Infinity,primitiveId:null,point:null,ownerRole:null};
  for(const piece of template.primitives) {
    // Skip only by a conservative surface-box bound, never endpoint-only arc bounds.
    if(useBounds&&best.distance>=0&&boundsSquared(p,piece.surfaceBounds)>best.distance*best.distance) continue;
    const hit=piece.kind==='line'?closestOnLine(p,piece.start,piece.end):closestOnArcTrigFree(p,piece),distance=hit.distance-piece.tubeRadius;
    if(distance<best.distance) best={distance,primitiveId:piece.id,point:hit.point,centerlineDistance:hit.distance,ownerRole:piece.ownerRole,component:piece.component,tubeRadius:piece.tubeRadius,t:hit.t};
  }
  return {...best,inside:best.distance<0};
}
export function queryStairRails(spec,p,options) {
  const {template,frame}=unpack(spec),local=railToLocal(p,frame),hit=queryStairRailLocal(template,local,options);
  return {...hit,local,point:railToWorld(hit.point,frame),railId:spec.id,ownerId:spec.template?ownerIds(spec)[hit.ownerRole]:hit.ownerRole};
}
/** Exact slab test, including parallel rays. Returned t is in world metres for
 * normalized rays. Only a proven empty interval is a geometric miss. */
export function stairRailRayInterval(origin,direction,bounds,maxDistance=Infinity) {
  let near=0,far=maxDistance;
  for(let i=0;i<3;i++) {
    if(Math.abs(direction[i])<1e-12) { if(origin[i]<bounds.min[i]||origin[i]>bounds.max[i]) return null; continue; }
    let a=(bounds.min[i]-origin[i])/direction[i],b=(bounds.max[i]-origin[i])/direction[i]; if(a>b)[a,b]=[b,a]; near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
  }
  return {near,far};
}
export function traceStairRails(spec,origin,direction,{maxSteps=160,maxDistance=200,epsilon=.00008,safety=.85}={}) {
  if(!finite3(origin)||!finite3(direction)||Math.hypot(...direction)<EPS) throw Error('Finite nonzero ray required');
  if(!Number.isInteger(maxSteps)||maxSteps<0||!Number.isFinite(maxDistance)||maxDistance<=0||!Number.isFinite(epsilon)||epsilon<=0||!Number.isFinite(safety)||safety<=0||safety>1) throw Error('Invalid rail trace options');
  const {template,frame}=unpack(spec),ro=railToLocal(origin,frame),rd=directionToLocal(norm(direction),frame),interval=stairRailRayInterval(ro,rd,template.bounds,maxDistance);
  if(!interval) return {status:'miss',hit:false,reason:'outside_bounds',steps:0};
  let t=interval.near,lastDistance=null;
  for(let steps=0;steps<maxSteps;steps++) {
    const p=add(ro,mul(rd,t)),hit=queryStairRailLocal(template,p);lastDistance=hit.distance;
    if(Math.abs(hit.distance)<=epsilon) return {...hit,status:'hit',hit:true,steps:steps+1,t,point:railToWorld(p,frame),local:p,railId:spec.id};
    const next=t+Math.abs(hit.distance)*safety;
    if(next>interval.far) return {status:'miss',hit:false,reason:'interval_exhausted',steps:steps+1,t:next};
    if(next===t) return {status:'unresolved',hit:null,reason:'numeric_stall',steps:steps+1,t,lastDistance};
    t=next;
  }
  return {status:'unresolved',hit:null,reason:'step_budget',steps:maxSteps,t,lastDistance,interval};
}
/** Eight RGBA texels per analytic primitive, one texture reused at every level.
 * 0: kind/tubeRadius/curveRadius/sinSweep; 1: start/cosSweep;
 * 2: end/pathOffset; 3: center/length; 4: u; 5: v;
 * 6: expanded exact bounds.min; 7: expanded exact bounds.max.
 */
export function packStairRailDescriptors(template) {
  const data=new Float32Array(template.primitives.length*STAIR_RAIL_TEXTURE_WIDTH*4);
  template.primitives.forEach((p,i)=>{
    const values=[[p.kind==='arc'?1:0,p.tubeRadius,p.radius??0,Math.sin(p.sweep??0)],[...p.start,Math.cos(p.sweep??0)],[...p.end,p.pathOffset??0],[...(p.center??[0,0,0]),p.length],[...(p.u??[0,0,0]),0],[...(p.v??[0,0,0]),0],[...p.surfaceBounds.min,0],[...p.surfaceBounds.max,0]];
    values.forEach((v,j)=>data.set(v,(i*STAIR_RAIL_TEXTURE_WIDTH+j)*4));
  });
  return {data,width:STAIR_RAIL_TEXTURE_WIDTH,height:template.primitives.length,count:template.primitives.length,format:'RGBA32F',filter:'NEAREST',wrap:'CLAMP_TO_EDGE',layout:'one_analytic_primitive_per_row'};
}
/** One fixed-size GLSL kernel: no per-piece or per-storey code generation.
 * Coordinates are stair-local. Apply the stair instance's inverse rigid frame.
 * Bind an archetype texture once, reuse for every equal-height floor span.
 * wholeRailTrace returns 1 hit, 0 proven miss, -1 unresolved; never fake a miss.
 */
export function buildStairRailGLSL() { return `
uniform highp sampler2D uStairRailDescriptors;
uniform int uStairRailPieceCount;
uniform vec3 uStairRailBoundsMin;
uniform vec3 uStairRailBoundsMax;
vec4 wholeRailData(int piece,int column){return texelFetch(uStairRailDescriptors,ivec2(column,piece),0);}
float wholeRailBoxSquared(vec3 p,vec3 lo,vec3 hi){vec3 q=max(max(lo-p,p-hi),0.0);return dot(q,q);}
float wholeRailLineSquared(vec3 p,vec3 a,vec3 b){vec3 ab=b-a,q=p-(a+ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));return dot(q,q);}
float wholeRailArcSquared(vec3 p,vec3 c,vec3 u,vec3 v,float r,float sn,float cs,vec3 a,vec3 b){vec3 q=p-c;float x=dot(q,u),y=dot(q,v),rho2=x*x+y*y;if(rho2>1e-18&&y>=0.0&&x*sn-y*cs>=0.0){vec3 delta=q-r*(u*x+v*y)*inversesqrt(rho2);return dot(delta,delta);}return min(dot(p-a,p-a),dot(p-b,p-b));}
float wholeRailDistance(vec3 p){float best=1e20;for(int i=0;i<${STAIR_RAIL_MAX_PRIMITIVES};i++){if(i>=uStairRailPieceCount)break;vec3 lo=wholeRailData(i,6).xyz,hi=wholeRailData(i,7).xyz;if(best>=0.0&&wholeRailBoxSquared(p,lo,hi)>best*best)continue;vec4 k=wholeRailData(i,0),a=wholeRailData(i,1);vec3 b=wholeRailData(i,2).xyz;float d2;if(k.x<0.5)d2=wholeRailLineSquared(p,a.xyz,b);else d2=wholeRailArcSquared(p,wholeRailData(i,3).xyz,wholeRailData(i,4).xyz,wholeRailData(i,5).xyz,k.z,k.w,a.w,a.xyz,b);best=min(best,sqrt(max(d2,0.0))-k.y);}return best;}
bool wholeRailRayInterval(vec3 ro,vec3 rd,float limit,out vec2 span){span=vec2(0.0,limit);for(int axis=0;axis<3;axis++){if(abs(rd[axis])<1e-12){if(ro[axis]<uStairRailBoundsMin[axis]||ro[axis]>uStairRailBoundsMax[axis])return false;}else{float a=(uStairRailBoundsMin[axis]-ro[axis])/rd[axis],b=(uStairRailBoundsMax[axis]-ro[axis])/rd[axis];span.x=max(span.x,min(a,b));span.y=min(span.y,max(a,b));if(span.x>span.y)return false;}}return true;}
int wholeRailTrace(vec3 ro,vec3 rd,float limit,out float t,out vec3 p){vec2 span;t=0.0;p=ro;if(dot(rd,rd)<1e-18)return -1;rd=normalize(rd);if(!wholeRailRayInterval(ro,rd,limit,span))return 0;t=span.x;for(int i=0;i<160;i++){p=ro+rd*t;float d=wholeRailDistance(p);if(abs(d)<=0.00008)return 1;float next=t+abs(d)*0.85;if(next>span.y)return 0;if(next==t)return -1;t=next;}return -1;}
vec3 wholeRailNormal(vec3 p){float e=0.0001;vec3 g=vec3(wholeRailDistance(p+vec3(e,0,0))-wholeRailDistance(p-vec3(e,0,0)),wholeRailDistance(p+vec3(0,e,0))-wholeRailDistance(p-vec3(0,e,0)),wholeRailDistance(p+vec3(0,0,e))-wholeRailDistance(p-vec3(0,0,e)));return dot(g,g)>1e-20?normalize(g):vec3(0,1,0);}
`; }
