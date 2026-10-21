/** Original R06 analytic field kernel. No renderable object geometry is created.
 * Coordinates: x = R05 lateral, y = up from first FFL, z = R05 stair run, metres.
 * Analytic profile/curve boundary terms are not model triangles or render buffers.
 */
import {createHostRecord,transformHostToLocal,validateHostDomain} from './host.mjs';
const EPS=1e-9;
const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=a=>Math.hypot(...a), norm=a=>mul(a,1/length(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copy=v=>structuredClone(v);
export const FIELD_SCHEMA='kaopu.analytic-building-field/0.1';
export const FIELD_IDS={lowerFloor:101,upperFloor:102,firstFlight:201,secondFlight:202,landing:203,wall:301,rail:401};
export function defaultFieldConfig(){const host=createHostRecord(),toLocal=p=>{const q=transformHostToLocal([p[0],0,-p[1]],host.designFrame);return [q[0],q[2]];};return {floorHeight:3.2,flightWidth:1.2,centerGap:.2,landingDepth:1.2,treadDepth:.28,risersPerFlight:10,
 slabThickness:.2,plateThickness:.2,railHeight:.9,railRadius:.035,railBendRadius:.22,railCornerMode:'rounded',railsEnabled:true,
 wallEnabled:true,wallWidth:2.6,wallHeight:2.5,wallThickness:.12,doorWidth:.9,doorHeight:2.1,
 footprint2D:host.measuredExterior.footprintEastNorth.map(toLocal),serviceVoid2D:host.reservedServiceVoid.footprintEastNorth.map(toLocal),footprintEvidence:'exact_observed_derived_p000_footprint_projected_in_R05_design_frame'};}
const finite=(v,name)=>{if(!Number.isFinite(v))throw Error(name+' must be finite');return v;};
function validateRing(ring,label){
 const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(p,a,b)=>Math.abs(orient(a,b,p))<EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
 const crosses=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0||on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);
 let area=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(length(sub(a,b))<EPS)throw Error(label+' has duplicate adjacent points');area+=a[0]*b[1]-b[0]*a[1];
 for(let j=i+2;j<ring.length;j++){if(i===0&&j===ring.length-1)continue;if(crosses(a,b,ring[j],ring[(j+1)%ring.length]))throw Error(label+' is self-intersecting');}}
 if(Math.abs(area)<EPS)throw Error(label+' has zero area');
}
function validateConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Field config must be an object');
 const defaults=defaultFieldConfig();for(const key of Object.keys(input))if(!(key in defaults))throw Error('Unknown field parameter: '+key);
 const c={...defaults,...copy(input)};
 const ranges={floorHeight:[2.8,4],flightWidth:[.9,1.6],centerGap:[.15,.5],landingDepth:[1,1.8],treadDepth:[.24,.34],
 slabThickness:[.16,.3],plateThickness:[.16,.3],railHeight:[.75,1.2],railRadius:[.02,.055],railBendRadius:[.08,.4],
 wallWidth:[1.8,4],wallHeight:[2.25,3],wallThickness:[.08,.3],doorWidth:[.7,1.3],doorHeight:[1.9,2.4]};
 for(const [key,[a,b]]of Object.entries(ranges)){finite(c[key],key);if(c[key]<a||c[key]>b)throw Error(key+' outside authored experiment range');}
 if(!Number.isInteger(c.risersPerFlight)||c.risersPerFlight<8||c.risersPerFlight>13)throw Error('risersPerFlight must be 8..13');
 if(!['rounded','angular'].includes(c.railCornerMode))throw Error('railCornerMode must be rounded or angular');
 for(const key of ['railsEnabled','wallEnabled'])if(typeof c[key]!=='boolean')throw Error(key+' must be boolean');
 if(c.floorHeight/(2*c.risersPerFlight)>c.slabThickness||c.floorHeight/(2*c.risersPerFlight)>c.plateThickness)throw Error('Final riser requires landing/slab thickness at least the rise for this bounded construction');
 if(c.landingDepth<c.flightWidth)throw Error('Landing depth must preserve the authored flight-width turning region');
 if(c.doorWidth+.3>c.wallWidth||c.doorHeight+.15>c.wallHeight)throw Error('Opening leaves insufficient authored wall side/header');
 if(c.railBendRadius<=c.railRadius*2)throw Error('Bend radius must exceed twice tube radius');
 if(!Array.isArray(c.serviceVoid2D)||c.serviceVoid2D.length!==4||c.serviceVoid2D.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))))throw Error('serviceVoid2D requires preserved four-point authored reserve');
 if(!Array.isArray(c.footprint2D)||c.footprint2D.length<3||c.footprint2D.length>32||c.footprint2D.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))))throw Error('footprint2D requires 3..32 finite source boundary points');
 validateRing(c.footprint2D,'footprint2D');validateRing(c.serviceVoid2D,'serviceVoid2D');
 return c;
}
export function closestOnLine(p,a,b){const ab=sub(b,a),t=clamp(dot(sub(p,a),ab)/dot(ab,ab),0,1),point=add(a,mul(ab,t));return {distance:length(sub(p,point)),point,t};}
/** Exact closest point on a finite circular arc of sweep < pi. */
export function closestOnArc(p,arc){
 const q=sub(p,arc.center),u=dot(q,arc.u),v=dot(q,arc.v),angle=Math.atan2(v,u);
 let t;if(Math.hypot(u,v)>EPS&&angle>=0&&angle<=arc.sweep)t=angle;
 else t=length(sub(p,arc.start))<=length(sub(p,arc.end))?0:arc.sweep;
 const point=add(arc.center,mul(add(mul(arc.u,Math.cos(t)),mul(arc.v,Math.sin(t))),arc.radius));
 return {distance:length(sub(p,point)),point,t:t/arc.sweep};
}
/** Functional path descriptors, never polygonal render geometry. Rounded joins
 * are exact planar circular fillets, including the vertical slope transitions. */
export function filletPath(points,radius,mode='rounded'){
 if(!Array.isArray(points)||points.length<2||points.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v))))throw Error('Path needs two finite 3D points');
 if(!Number.isFinite(radius)||radius<=0)throw Error('Fillet radius must be positive');
 if(!['rounded','angular'].includes(mode))throw Error('Unknown rail corner mode');
 const P=copy(points),edges=P.slice(1).map((p,i)=>sub(p,P[i])),lens=edges.map(length);
 if(lens.some(n=>n<EPS))throw Error('Duplicate rail path points');
 const dirs=edges.map(norm),corners=new Map();
 for(let i=1;i<P.length-1;i++){
  const a=dirs[i-1],b=dirs[i],cos=clamp(dot(a,b),-1,1),angle=Math.acos(cos);
  if(angle<1e-7)continue;
  if(angle>Math.PI-1e-5)throw Error('Rail reversal has no finite fillet');
  if(mode==='angular')continue;
  const trim=radius*Math.tan(angle/2),start=sub(P[i],mul(a,trim)),end=add(P[i],mul(b,trim));
  const inward=norm(sub(b,mul(a,cos))),center=add(start,mul(inward,radius)),u=norm(sub(start,center)),planeNormal=norm(cross(a,b)),v=cross(planeNormal,u);
  corners.set(i,{kind:'arc',radius,sweep:angle,trim,start,end,center,u,v,planeNormal,tangentStart:a,tangentEnd:b,length:radius*angle});
 }
 for(let i=0;i<edges.length;i++)if((corners.get(i)?.trim??0)+(corners.get(i+1)?.trim??0)>lens[i]-1e-5)throw Error('Adjacent rail corner trims overlap; decrease bend radius or enlarge landing');
 const pieces=[];let offset=0;
 for(let i=0;i<edges.length;i++){
  const start=corners.get(i)?.end??P[i],end=corners.get(i+1)?.start??P[i+1],n=length(sub(end,start));
  if(n>EPS){pieces.push({kind:'line',start,end,tangentStart:dirs[i],tangentEnd:dirs[i],length:n,pathOffset:offset});offset+=n;}
  if(corners.has(i+1)){const arc=corners.get(i+1);pieces.push({...arc,pathOffset:offset});offset+=arc.length;}
 }
 return {pieces,length:offset,controlPath:P,mode,tangentContinuous:mode==='rounded',junctionRule:mode==='rounded'?'G1 exact line/circular-arc joins':'C0 angular centerline with hard union of swept tube regions'};
}
export function railPointAt(path,s){
 s=clamp(s,0,path.length);const p=path.pieces.find(q=>s<=q.pathOffset+q.length+EPS)??path.pieces.at(-1),t=clamp((s-p.pathOffset)/p.length,0,1);
 if(p.kind==='line')return {point:add(p.start,mul(sub(p.end,p.start),t)),tangent:p.tangentStart,piece:p};
 const a=t*p.sweep;return {point:add(p.center,mul(add(mul(p.u,Math.cos(a)),mul(p.v,Math.sin(a))),p.radius)),tangent:add(mul(p.u,-Math.sin(a)),mul(p.v,Math.cos(a))),piece:p};
}
export function railDistance(path,p){let best={distance:Infinity};for(const piece of path.pieces){const hit=piece.kind==='line'?closestOnLine(p,piece.start,piece.end):closestOnArc(p,piece);if(hit.distance<best.distance)best={...hit,pathS:piece.pathOffset+hit.t*piece.length,piece};}return best;}
export function deriveField(input={}){
 const c=validateConfig(input),rise=c.floorHeight/(2*c.risersPerFlight),n=c.risersPerFlight-1,run=n*c.treadDepth,W=2*c.flightWidth+c.centerGap,L=c.landingDepth,total=2*L+run,mid=c.floorHeight/2;
 const z0=L,z1=L+run,outer=W/2-.06,back=total-.18;
 const rail=filletPath([[-outer,c.railHeight,z0],[-outer,mid+c.railHeight,z1],[-outer,mid+c.railHeight,back],
 [outer,mid+c.railHeight,back],[outer,mid+c.railHeight,z1],[outer,c.floorHeight+c.railHeight,z0]],c.railBendRadius,c.railCornerMode);
 rail.bounds={min:[0,1,2].map(i=>Math.min(...rail.controlPath.map(p=>p[i]))-c.railRadius),max:[0,1,2].map(i=>Math.max(...rail.controlPath.map(p=>p[i]))+c.railRadius)};
 const minX=Math.min(...c.footprint2D.map(p=>p[0])),maxX=Math.max(...c.footprint2D.map(p=>p[0])),minZ=Math.min(...c.footprint2D.map(p=>p[1])),maxZ=Math.max(...c.footprint2D.map(p=>p[1]));
 validateHostDomain([[-W/2,0],[W/2,0],[W/2,total],[-W/2,total]]);
 validateHostDomain([[-c.wallWidth/2,-c.wallThickness/2],[c.wallWidth/2,-c.wallThickness/2],[c.wallWidth/2,c.wallThickness/2],[-c.wallWidth/2,c.wallThickness/2]]);
 const footprintSamples=[[-W/2,0],[W/2,0],[-W/2,total],[W/2,total],[-c.wallWidth/2,-c.wallThickness/2],[c.wallWidth/2,c.wallThickness/2]];
 if(footprintSamples.some(p=>sdPolygon(p,c.footprint2D)>1e-7))throw Error('Stair/wall design does not fit supplied measured host footprint');
 return {schema:FIELD_SCHEMA,config:c,dimensions:{rise,treadsPerFlight:n,runLength:run,totalWidth:W,totalLength:total,midHeight:mid,z0,z1},rail,
 bounds:{min:[minX,-c.slabThickness,minZ],max:[maxX,c.floorHeight+c.wallHeight,maxZ]},
 semantics:{buildingUse:'unknown',interiorEvidence:'editable_design_not_measured',floorIds:['floor-001','floor-002'],objects:FIELD_IDS,
 graph:[['floor-001','firstFlight'],['firstFlight','landing'],['landing','secondFlight'],['secondFlight','floor-002'],['floor-002','wall'],['wall','doorOpening'],['firstFlight','rail'],['landing','rail'],['secondFlight','rail']]},
 distanceContract:{outside:'nonnegative conservative distance bound; exact primitive/curve exterior distances before CSG',inside:'signed occupancy field, not universally exact interior distance',lipschitzUpperBound:1,raySafetyFactor:.85,minimumPositiveStep:0,zeroSet:'analytic primitive/CSG boundary; no sampled polygonal approximation',hitTolerance:'field-value tolerance, not a universal Euclidean proximity certificate at CSG corners',unresolvedRule:'step budget exhaustion must remain unresolved, never silently treated as a geometric miss'},
 modelRepresentation:'analytic_fields_only_no_object_meshes',structuralCertification:false};
}
export function sdBox(p,b){const q=p.map((v,i)=>Math.abs(v)-b[i]);return length(q.map(v=>Math.max(v,0)))+Math.min(Math.max(...q),0);}
export function sdPolygon(p,poly){let d=Infinity,inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[j],b=poly[i];d=Math.min(d,closestOnLine(p,a,b).distance);
 if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside?-d:d;}
const extrude=(d,y,h)=>{const q=[d,Math.abs(y)-h];return Math.hypot(Math.max(q[0],0),Math.max(q[1],0))+Math.min(Math.max(...q),0);};
/** Exact signed distance to the R05 closed 2-D stepped plate boundary.
 * The final rise is the joining landing/slab face, just as in R05. */
export function stairProfileDistance(z,y,c){
 const rise=c.floorHeight/(2*c.risersPerFlight),n=c.risersPerFlight-1,run=n*c.treadDepth,under=Math.max(0,n*rise-c.plateThickness),brk=Math.min(run,c.plateThickness*c.treadDepth/rise);
 let d=Infinity;const segment=(a,b)=>{if(length(sub(a,b))>EPS)d=Math.min(d,closestOnLine([z,y],a,b).distance);};
 segment([0,0],[0,rise]);
 for(let i=0;i<n;i++){const a=i*c.treadDepth,b=(i+1)*c.treadDepth,h=(i+1)*rise;segment([a,h],[b,h]);if(i<n-1)segment([b,h],[b,h+rise]);}
 segment([run,n*rise],[run,under]);segment([run,under],[brk,0]);segment([brk,0],[0,0]);
 const top=rise*(Math.floor(clamp(z,0,run-EPS)/c.treadDepth)+1),bottom=Math.max(0,z*rise/c.treadDepth-c.plateThickness);
 return z>=0&&z<=run&&y>=bottom&&y<=top?-d:d;
}
export function queryField(spec,p,{useBounds=true}={}){
 if(spec?.schema!==FIELD_SCHEMA||p.length!==3||p.some(v=>!Number.isFinite(v)))throw Error('Valid field and finite 3D point required');
 const c=spec.config,d=spec.dimensions,[x,y,z]=p;let hit={distance:Infinity,objectId:0,materialRole:0,local:copy(p)};
 const take=(distance,objectId,materialRole)=>{if(distance<hit.distance)hit={distance,objectId,materialRole,local:copy(p)};};
 const plan=sdPolygon([x,z],c.footprint2D),service=sdPolygon([x,z],c.serviceVoid2D);
 take(Math.max(extrude(plan,y+c.slabThickness/2,c.slabThickness/2),-service),101,1);
 const upper=extrude(plan,y-c.floorHeight+c.slabThickness/2,c.slabThickness/2);
 const hole=sdBox([x,y-c.floorHeight,z-(d.z0+d.totalLength)/2],[d.totalWidth/2,c.slabThickness+1,(d.totalLength-d.z0)/2]);
 take(Math.max(upper,-hole,-service),102,1);
 const lateral=(c.flightWidth+c.centerGap)/2;
 const flightHeight=d.treadsPerFlight*d.rise;
 if(!useBounds||sdBox([x+lateral,y-flightHeight/2,z-d.z0-d.runLength/2],[c.flightWidth/2,flightHeight/2,d.runLength/2])<hit.distance)take(extrude(stairProfileDistance(z-d.z0,y,c),x+lateral,c.flightWidth/2),201,1);
 if(!useBounds||sdBox([x-lateral,y-d.midHeight-flightHeight/2,z-d.z0-d.runLength/2],[c.flightWidth/2,flightHeight/2,d.runLength/2])<hit.distance)take(extrude(stairProfileDistance(d.z1-z,y-d.midHeight,c),x-lateral,c.flightWidth/2),202,1);
 take(sdBox([x,y-d.midHeight+c.plateThickness/2,z-d.z1-c.landingDepth/2],[d.totalWidth/2,c.plateThickness/2,c.landingDepth/2]),203,1);
 if(c.wallEnabled){const wall=sdBox([x,y-c.floorHeight-c.wallHeight/2,z],[c.wallWidth/2,c.wallHeight/2,c.wallThickness/2]);
 const opening=sdBox([x,y-c.floorHeight-c.doorHeight/2,z],[c.doorWidth/2,c.doorHeight/2+.0001,c.wallThickness+1]);take(Math.max(wall,-opening),301,2);}
 if(c.railsEnabled){const center=spec.rail.bounds.min.map((n,i)=>(n+spec.rail.bounds.max[i])/2),half=spec.rail.bounds.min.map((n,i)=>(spec.rail.bounds.max[i]-n)/2);if(!useBounds||sdBox(sub(p,center),half)<hit.distance)take(railDistance(spec.rail,p).distance-c.railRadius,401,3);}
 return {...hit,inside:hit.distance<0};
}
export function fieldNormal(spec,p,epsilon=1e-4){const g=[0,1,2].map(i=>{const a=copy(p),b=copy(p);a[i]+=epsilon;b[i]-=epsilon;return queryField(spec,a).distance-queryField(spec,b).distance;});return length(g)>1e-12?norm(g):[0,1,0];}
/** CPU reference marcher: abs(field) is also a safe interior bound for this
 * continuous 1-Lipschitz signed field. Never introduce a step larger than it. */
export function traceField(spec,origin,direction,{maxSteps=256,maxDistance=40,epsilon=.0006,safety=.85}={}){
 const rd=norm(direction);let t=0,last=null;
 for(let steps=0;steps<maxSteps;steps++){const p=add(origin,mul(rd,t)),hit=queryField(spec,p);last=hit;
  if(Math.abs(hit.distance)<=epsilon)return {hit:true,t,steps:steps+1,point:p,...hit};
  t+=Math.abs(hit.distance)*safety;if(t>maxDistance)return {hit:false,t,steps:steps+1,reason:'range'};
 }return {hit:false,t,steps:maxSteps,reason:'step_budget',lastDistance:last?.distance};
}
const f=n=>{if(!Number.isFinite(n))throw Error('Nonfinite GLSL constant');return Number(n).toFixed(12).replace(/0+$/,'').replace(/\.$/,'.0');};
const v=p=>'vec'+p.length+'('+p.map(f).join(',')+')';
/** GLSL is emitted from the same validated dimensions/path descriptors used by
 * the CPU evaluator. Its distance algorithms are parity-tested at runtime. */
export function buildFieldGLSL(spec){
 if(spec?.schema!==FIELD_SCHEMA)throw Error('deriveField output required');const c=spec.config,d=spec.dimensions;
 const polyCode=poly=>poly.map((b,i)=>{const a=poly[(i+poly.length-1)%poly.length];return `a=${v(a)};b=${v(b)};best=min(best,segment2(p,a,b));if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}`;}).join('\n');
 const polygon=polyCode(c.footprint2D),servicePolygon=polyCode(c.serviceVoid2D),flightHeight=d.treadsPerFlight*d.rise,railCenter=spec.rail.bounds.min.map((n,i)=>(n+spec.rail.bounds.max[i])/2),railHalf=spec.rail.bounds.min.map((n,i)=>(spec.rail.bounds.max[i]-n)/2);
 const rail=spec.rail.pieces.map(s=>s.kind==='line'?`rd=min(rd,segment3(p,${v(s.start)},${v(s.end)}));`:`rd=min(rd,arc3(p,${v(s.center)},${v(s.u)},${v(s.v)},${f(s.radius)},${f(s.sweep)},${v(s.start)},${v(s.end)}));`).join('\n');
 return `
struct FieldHit { float distance; float objectId; float materialRole; vec3 local; };
float segment2(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;return length(p-(a+ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0)));}
float segment3(vec3 p,vec3 a,vec3 b){vec3 ab=b-a;return length(p-(a+ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0)));}
float arc3(vec3 p,vec3 center,vec3 u,vec3 v,float r,float sweep,vec3 start,vec3 end){vec3 q=p-center;float x=dot(q,u),y=dot(q,v),a=atan(y,x);if(length(vec2(x,y))>1e-9&&a>=0.0&&a<=sweep)return length(q-r*(u*cos(a)+v*sin(a)));return min(length(p-start),length(p-end));}
float fieldBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
float fieldExtrude(float d,float y,float h){vec2 q=vec2(d,abs(y)-h);return length(max(q,0.0))+min(max(q.x,q.y),0.0);}
float footprintDistance(vec2 p){float best=1e20;bool inside=false;vec2 a,b;${polygon}return inside?-best:best;}
float serviceDistance(vec2 p){float best=1e20;bool inside=false;vec2 a,b;${servicePolygon}return inside?-best:best;}
float profileDistance(vec2 p){float z=p.x,y=p.y,rise=${f(d.rise)},td=${f(c.treadDepth)},run=${f(d.runLength)},th=${f(c.plateThickness)};float n=${f(d.treadsPerFlight)},brk=min(run,th*td/rise),under=max(0.0,n*rise-th);float best=segment2(p,vec2(0.0),vec2(0.0,rise));
 for(int i=0;i<${d.treadsPerFlight};i++){float a=float(i)*td,b=float(i+1)*td,h=float(i+1)*rise;best=min(best,segment2(p,vec2(a,h),vec2(b,h)));if(i<${d.treadsPerFlight-1})best=min(best,segment2(p,vec2(b,h),vec2(b,h+rise)));}
 best=min(best,segment2(p,vec2(run,n*rise),vec2(run,under)));if(run-brk>1e-9)best=min(best,segment2(p,vec2(run,under),vec2(brk,0.0)));best=min(best,segment2(p,vec2(brk,0.0),vec2(0.0)));
 float top=rise*(floor(clamp(z,0.0,run-1e-6)/td)+1.0),bottom=max(0.0,z*rise/td-th);bool inside=z>=0.0&&z<=run&&y>=bottom&&y<=top;return inside?-best:best;}
float railDistanceField(vec3 p){float rd=1e20;${rail}return rd-${f(c.railRadius)};}
void fieldTake(inout FieldHit h,float d,float id,float role,vec3 p){if(d<h.distance){h.distance=d;h.objectId=id;h.materialRole=role;h.local=p;}}
FieldHit mapField(vec3 p){FieldHit h;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=p;float plan=footprintDistance(p.xz),service=serviceDistance(p.xz);
 fieldTake(h,max(fieldExtrude(plan,p.y+${f(c.slabThickness/2)},${f(c.slabThickness/2)}),-service),101.0,1.0,p);
 float upper=fieldExtrude(plan,p.y-${f(c.floorHeight-c.slabThickness/2)},${f(c.slabThickness/2)});
 float hole=fieldBox(p-${v([0,c.floorHeight,(d.z0+d.totalLength)/2])},${v([d.totalWidth/2,c.slabThickness+1,(d.totalLength-d.z0)/2])});fieldTake(h,max(max(upper,-hole),-service),102.0,1.0,p);
 if(fieldBox(p-${v([-(c.flightWidth+c.centerGap)/2,flightHeight/2,d.z0+d.runLength/2])},${v([c.flightWidth/2,flightHeight/2,d.runLength/2])})<h.distance)fieldTake(h,fieldExtrude(profileDistance(vec2(p.z-${f(d.z0)},p.y)),p.x+${f((c.flightWidth+c.centerGap)/2)},${f(c.flightWidth/2)}),201.0,1.0,p);
 if(fieldBox(p-${v([(c.flightWidth+c.centerGap)/2,d.midHeight+flightHeight/2,d.z0+d.runLength/2])},${v([c.flightWidth/2,flightHeight/2,d.runLength/2])})<h.distance)fieldTake(h,fieldExtrude(profileDistance(vec2(${f(d.z1)}-p.z,p.y-${f(d.midHeight)})),p.x-${f((c.flightWidth+c.centerGap)/2)},${f(c.flightWidth/2)}),202.0,1.0,p);
 fieldTake(h,fieldBox(p-${v([0,d.midHeight-c.plateThickness/2,d.z1+c.landingDepth/2])},${v([d.totalWidth/2,c.plateThickness/2,c.landingDepth/2])}),203.0,1.0,p);
 ${c.wallEnabled?`float wall=fieldBox(p-${v([0,c.floorHeight+c.wallHeight/2,0])},${v([c.wallWidth/2,c.wallHeight/2,c.wallThickness/2])});float opening=fieldBox(p-${v([0,c.floorHeight+c.doorHeight/2,0])},${v([c.doorWidth/2,c.doorHeight/2+.0001,c.wallThickness+1])});fieldTake(h,max(wall,-opening),301.0,2.0,p);`:''}
 ${c.railsEnabled?`if(fieldBox(p-${v(railCenter)},${v(railHalf)})<h.distance)fieldTake(h,railDistanceField(p),401.0,3.0,p);`:''}return h;}
float mapDistance(vec3 p){return mapField(p).distance;}
vec3 fieldNormal(vec3 p){float e=0.0001;vec3 g=vec3(mapField(p+vec3(e,0,0)).distance-mapField(p-vec3(e,0,0)).distance,mapField(p+vec3(0,e,0)).distance-mapField(p-vec3(0,e,0)).distance,mapField(p+vec3(0,0,e)).distance-mapField(p-vec3(0,0,e)).distance);return length(g)>1e-10?normalize(g):vec3(0,1,0);}
`;
}
