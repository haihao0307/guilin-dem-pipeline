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
 for(const piece of pieces)piece.bounds=railPieceBounds(piece);
 return {pieces,length:offset,controlPath:P,mode,tangentContinuous:mode==='rounded',junctionRule:mode==='rounded'?'G1 exact line/circular-arc joins':'C0 angular centerline with hard union of swept tube regions'};
}
export function railPointAt(path,s){
 s=clamp(s,0,path.length);const p=path.pieces.find(q=>s<=q.pathOffset+q.length+EPS)??path.pieces.at(-1),t=clamp((s-p.pathOffset)/p.length,0,1);
 if(p.kind==='line')return {point:add(p.start,mul(sub(p.end,p.start),t)),tangent:p.tangentStart,piece:p};
 const a=t*p.sweep;return {point:add(p.center,mul(add(mul(p.u,Math.cos(a)),mul(p.v,Math.sin(a))),p.radius)),tangent:add(mul(p.u,-Math.sin(a)),mul(p.v,Math.cos(a))),piece:p};
}
/** Exact analytic arc coordinate extrema, not samples or endpoint-only bounds. */
export function railPieceBounds(piece){const points=[piece.start,piece.end];if(piece.kind==='arc')for(let axis=0;axis<3;axis++){
 const base=Math.atan2(piece.v[axis],piece.u[axis]);for(let k=-2;k<=2;k++){const a=base+k*Math.PI;if(a>=0&&a<=piece.sweep)points.push(add(piece.center,mul(add(mul(piece.u,Math.cos(a)),mul(piece.v,Math.sin(a))),piece.radius)));}}
 return {min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))-1e-9),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))+1e-9)};}
export function closestOnArcTrigFree(p,arc){const q=sub(p,arc.center),x=dot(q,arc.u),y=dot(q,arc.v),rho=Math.hypot(x,y);
 if(rho>EPS&&y>=0&&x*Math.sin(arc.sweep)-y*Math.cos(arc.sweep)>=0){const point=add(arc.center,mul(add(mul(arc.u,x),mul(arc.v,y)),arc.radius/rho));return {distance:length(sub(p,point)),point,t:Math.atan2(y,x)/arc.sweep};}
 const start=length(sub(p,arc.start)),end=length(sub(p,arc.end));return start<=end?{distance:start,point:arc.start,t:0}:{distance:end,point:arc.end,t:1};}
export function railDistanceBounded(path,p){let best={distance:Infinity};for(const piece of path.pieces){const b=piece.bounds??railPieceBounds(piece),q=p.map((v,i)=>Math.max(b.min[i]-v,0,v-b.max[i]));if(dot(q,q)>best.distance*best.distance)continue;const hit=piece.kind==='line'?closestOnLine(p,piece.start,piece.end):closestOnArcTrigFree(p,piece);if(hit.distance<best.distance)best={...hit,pathS:piece.pathOffset+hit.t*piece.length,piece};}return best;}
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
 const dimensions={rise,treadsPerFlight:n,runLength:run,totalWidth:W,totalLength:total,midHeight:mid,z0,z1};
 return {schema:FIELD_SCHEMA,config:c,dimensions,rail,structurePlanes:deriveStructurePlanes(c,dimensions),
 bounds:{min:[minX,-c.slabThickness,minZ],max:[maxX,c.floorHeight+c.wallHeight,maxZ]},
 semantics:{buildingUse:'unknown',interiorEvidence:'editable_design_not_measured',floorIds:['floor-001','floor-002'],objects:FIELD_IDS,
 graph:[['floor-001','firstFlight'],['firstFlight','landing'],['landing','secondFlight'],['secondFlight','floor-002'],['floor-002','wall'],['wall','doorOpening'],['firstFlight','rail'],['landing','rail'],['secondFlight','rail']]},
 distanceContract:{outside:'nonnegative conservative distance bound; exact primitive/curve exterior distances before CSG',inside:'signed occupancy field, not universally exact interior distance',lipschitzUpperBound:1,raySafetyFactor:.85,minimumPositiveStep:0,zeroSet:'analytic constituent/CSG zero surfaces; touching solids can retain internal zeros, rejected by occupancy-transition tests; no sampled polygonal approximation',hitTolerance:'field-value tolerance, not a universal Euclidean proximity certificate at CSG corners',unresolvedRule:'step budget exhaustion must remain unresolved, never silently treated as a geometric miss',primaryTrace:'up to 128 conservative evaluations with 10 micrometre field tolerance, occupancy-transition and grazing checks; unresolved candidates use analytic rescue within shared 512-distance-evaluation budget'},
 modelRepresentation:'analytic_fields_only_no_object_meshes',structuralCertification:false};
}
export function sdBox(p,b){const q=p.map((v,i)=>Math.abs(v)-b[i]);return length(q.map(v=>Math.max(v,0)))+Math.min(Math.max(...q),0);}
const segmentSquared=(p,a,b)=>{const ab=sub(b,a),t=clamp(dot(sub(p,a),ab)/dot(ab,ab),0,1),q=sub(p,add(a,mul(ab,t)));return dot(q,q);};
export function sdPolygon(p,poly){let d2=Infinity,inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[j],b=poly[i];d2=Math.min(d2,segmentSquared(p,a,b));
 if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }const d=Math.sqrt(d2);return inside?-d:d;}
export function polygonContains(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const a=ring[j],b=ring[i],cross=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 if(Math.abs(cross)<1e-9&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]))return true;
 if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function stairProfileContains(z,y,c){const rise=c.floorHeight/(2*c.risersPerFlight),run=(c.risersPerFlight-1)*c.treadDepth;
 if(z<0||z>run)return false;const top=rise*(Math.floor(clamp(z,0,run-EPS)/c.treadDepth)+1),bottom=Math.max(0,z*rise/c.treadDepth-c.plateThickness);return y>=bottom&&y<=top;}
export function structureOccupied(spec,p,clipX=-1e20){const c=spec.config,d=spec.dimensions,[x,y,z]=p;if(x<clipX)return false;
 const lower=y>=-c.slabThickness&&y<=0,upper=y>=c.floorHeight-c.slabThickness&&y<=c.floorHeight;
 if((lower||upper)&&polygonContains([x,z],c.footprint2D)&&!polygonContains([x,z],c.serviceVoid2D)){
  if(lower||!(Math.abs(x)<d.totalWidth/2&&z>d.z0&&z<d.totalLength))return true;}
 const lateral=(c.flightWidth+c.centerGap)/2;
 if(Math.abs(x+lateral)<=c.flightWidth/2&&stairProfileContains(z-d.z0,y,c))return true;
 if(Math.abs(x-lateral)<=c.flightWidth/2&&stairProfileContains(d.z1-z,y-d.midHeight,c))return true;
 if(Math.abs(x)<=d.totalWidth/2&&y>=d.midHeight-c.plateThickness&&y<=d.midHeight&&z>=d.z1&&z<=d.totalLength)return true;
 if(c.wallEnabled&&Math.abs(x)<=c.wallWidth/2&&y>=c.floorHeight&&y<=c.floorHeight+c.wallHeight&&Math.abs(z)<=c.wallThickness/2){
  if(!(Math.abs(x)<c.doorWidth/2&&y>c.floorHeight-.0001&&y<c.floorHeight+c.doorHeight+.0001))return true;}
 return false;}
const extrude=(d,y,h)=>{const q=[d,Math.abs(y)-h];return Math.hypot(Math.max(q[0],0),Math.max(q[1],0))+Math.min(Math.max(...q),0);};
/** Exact signed distance to the R05 closed 2-D stepped plate boundary.
 * The final rise is the joining landing/slab face, just as in R05. */
export function stairProfileDistance(z,y,c){
 const rise=c.floorHeight/(2*c.risersPerFlight),n=c.risersPerFlight-1,run=n*c.treadDepth,under=Math.max(0,n*rise-c.plateThickness),brk=Math.min(run,c.plateThickness*c.treadDepth/rise);
 let d2=Infinity;const segment=(a,b)=>{if(length(sub(a,b))>EPS)d2=Math.min(d2,segmentSquared([z,y],a,b));};
 segment([0,0],[0,rise]);
 for(let i=0;i<n;i++){const a=i*c.treadDepth,b=(i+1)*c.treadDepth,h=(i+1)*rise;segment([a,h],[b,h]);if(i<n-1)segment([b,h],[b,h+rise]);}
 segment([run,n*rise],[run,under]);segment([run,under],[brk,0]);segment([brk,0],[0,0]);
 const top=rise*(Math.floor(clamp(z,0,run-EPS)/c.treadDepth)+1),bottom=Math.max(0,z*rise/c.treadDepth-c.plateThickness);
 const d=Math.sqrt(d2);return z>=0&&z<=run&&y>=bottom&&y<=top?-d:d;
}
export function queryField(spec,p,{useBounds=true,includeRail=true}={}){
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
 if(c.railsEnabled&&includeRail){const center=spec.rail.bounds.min.map((n,i)=>(n+spec.rail.bounds.max[i])/2),half=spec.rail.bounds.min.map((n,i)=>(spec.rail.bounds.max[i]-n)/2);if(!useBounds||sdBox(sub(p,center),half)<hit.distance)take(railDistance(spec.rail,p).distance-c.railRadius,401,3);}
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
 const polyCode=poly=>poly.map((b,i)=>{const a=poly[(i+poly.length-1)%poly.length];return `a=${v(a)};b=${v(b)};best=min(best,segment2Squared(p,a,b));if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}`;}).join('\n');
 const insideCode=poly=>poly.map((b,i)=>{const a=poly[(i+poly.length-1)%poly.length];return `a=${v(a)};b=${v(b)};float cross${i}=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(abs(cross${i})<1e-7&&all(greaterThanEqual(p,min(a,b)))&&all(lessThanEqual(p,max(a,b))))return true;if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}`;}).join('\n');
 const footprintInside=insideCode(c.footprint2D),serviceInside=insideCode(c.serviceVoid2D);
 const polygon=polyCode(c.footprint2D),servicePolygon=polyCode(c.serviceVoid2D),flightHeight=d.treadsPerFlight*d.rise,railCenter=spec.rail.bounds.min.map((n,i)=>(n+spec.rail.bounds.max[i])/2),railHalf=spec.rail.bounds.min.map((n,i)=>(spec.rail.bounds.max[i]-n)/2);
 const rail=spec.rail.pieces.map(s=>`if(fieldBoundsSquared(p,${v(s.bounds.min)},${v(s.bounds.max)})<=rd){rd=min(rd,${s.kind==='line'?`segment3Squared(p,${v(s.start)},${v(s.end)})`:`arc3Squared(p,${v(s.center)},${v(s.u)},${v(s.v)},${f(s.radius)},${f(Math.sin(s.sweep))},${f(Math.cos(s.sweep))},${v(s.start)},${v(s.end)})`});}`).join('\n');
 return `
#ifndef FIELD_TRACE_VARIANT
#define FIELD_TRACE_VARIANT 0
#endif
#ifndef FIELD_KERNEL_STAGE
#define FIELD_KERNEL_STAGE 0
#endif
struct FieldHit { float distance; float objectId; float materialRole; vec3 local; };
float segment2Squared(vec2 p,vec2 a,vec2 b){vec2 ab=b-a,q=p-(a+ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));return dot(q,q);}
float fieldBoundsSquared(vec3 p,vec3 lo,vec3 hi){vec3 q=max(max(lo-p,p-hi),0.0);return dot(q,q);}
float segment3Squared(vec3 p,vec3 a,vec3 b){vec3 ab=b-a,q=p-(a+ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));return dot(q,q);}
float arc3Squared(vec3 p,vec3 center,vec3 u,vec3 v,float r,float sinSweep,float cosSweep,vec3 start,vec3 end){vec3 q=p-center;float x=dot(q,u),y=dot(q,v),rho2=x*x+y*y;if(rho2>1e-18&&y>=0.0&&x*sinSweep-y*cosSweep>=0.0){vec3 delta=q-r*(u*x+v*y)*inversesqrt(rho2);return dot(delta,delta);}return min(dot(p-start,p-start),dot(p-end,p-end));}
float fieldBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
float fieldExtrude(float d,float y,float h){vec2 q=vec2(d,abs(y)-h);return length(max(q,0.0))+min(max(q.x,q.y),0.0);}
float footprintDistance(vec2 p){float best=1e20;bool inside=false;vec2 a,b;${polygon}return inside?-sqrt(best):sqrt(best);}
float serviceDistance(vec2 p){float best=1e20;bool inside=false;vec2 a,b;${servicePolygon}return inside?-sqrt(best):sqrt(best);}
bool fieldFootprintInside(vec2 p){bool inside=false;vec2 a,b;${footprintInside}return inside;}
bool fieldServiceInside(vec2 p){bool inside=false;vec2 a,b;${serviceInside}return inside;}
bool fieldProfileInside(vec2 p){float z=p.x,y=p.y,rise=${f(d.rise)},td=${f(c.treadDepth)},run=${f(d.runLength)};if(z<0.0||z>run)return false;float top=rise*(floor(clamp(z,0.0,run-1e-6)/td)+1.0),bottom=max(0.0,z*rise/td-${f(c.plateThickness)});return y>=bottom&&y<=top;}
float profileDistance(vec2 p){float z=p.x,y=p.y,rise=${f(d.rise)},td=${f(c.treadDepth)},run=${f(d.runLength)},th=${f(c.plateThickness)};float n=${f(d.treadsPerFlight)},brk=min(run,th*td/rise),under=max(0.0,n*rise-th);float best=segment2Squared(p,vec2(0.0),vec2(0.0,rise));
 for(int i=0;i<${d.treadsPerFlight};i++){float a=float(i)*td,b=float(i+1)*td,h=float(i+1)*rise;best=min(best,segment2Squared(p,vec2(a,h),vec2(b,h)));if(i<${d.treadsPerFlight-1})best=min(best,segment2Squared(p,vec2(b,h),vec2(b,h+rise)));}
 best=min(best,segment2Squared(p,vec2(run,n*rise),vec2(run,under)));if(run-brk>1e-9)best=min(best,segment2Squared(p,vec2(run,under),vec2(brk,0.0)));best=min(best,segment2Squared(p,vec2(brk,0.0),vec2(0.0)));
 float top=rise*(floor(clamp(z,0.0,run-1e-6)/td)+1.0),bottom=max(0.0,z*rise/td-th);bool inside=z>=0.0&&z<=run&&y>=bottom&&y<=top;return inside?-sqrt(best):sqrt(best);}
float railDistanceField(vec3 p){float rd=1e20;${rail}return sqrt(rd)-${f(c.railRadius)};}
void fieldTake(inout FieldHit h,float d,float id,float role,vec3 p){if(d<h.distance){h.distance=d;h.objectId=id;h.materialRole=role;h.local=p;}}
bool fieldStructureOccupied(vec3 p,float clipX){if(p.x<clipX)return false;bool lower=p.y>=${f(-c.slabThickness)}&&p.y<=0.0,upper=p.y>=${f(c.floorHeight-c.slabThickness)}&&p.y<=${f(c.floorHeight)};if((lower||upper)&&fieldFootprintInside(p.xz)&&!fieldServiceInside(p.xz)){if(lower||!(abs(p.x)<${f(d.totalWidth/2)}&&p.z>${f(d.z0)}&&p.z<${f(d.totalLength)}))return true;}
 if(abs(p.x+${f((c.flightWidth+c.centerGap)/2)})<=${f(c.flightWidth/2)}&&fieldProfileInside(vec2(p.z-${f(d.z0)},p.y)))return true;
 if(abs(p.x-${f((c.flightWidth+c.centerGap)/2)})<=${f(c.flightWidth/2)}&&fieldProfileInside(vec2(${f(d.z1)}-p.z,p.y-${f(d.midHeight)})))return true;
 if(abs(p.x)<=${f(d.totalWidth/2)}&&p.y>=${f(d.midHeight-c.plateThickness)}&&p.y<=${f(d.midHeight)}&&p.z>=${f(d.z1)}&&p.z<=${f(d.totalLength)})return true;
 ${c.wallEnabled?`if(abs(p.x)<=${f(c.wallWidth/2)}&&p.y>=${f(c.floorHeight)}&&p.y<=${f(c.floorHeight+c.wallHeight)}&&abs(p.z)<=${f(c.wallThickness/2)}){if(!(abs(p.x)<${f(c.doorWidth/2)}&&p.y>${f(c.floorHeight-.0001)}&&p.y<${f(c.floorHeight+c.doorHeight+.0001)}))return true;}`:''}return false;}
FieldHit mapStructure(vec3 p){FieldHit h;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=p;float plan=footprintDistance(p.xz),service=serviceDistance(p.xz);
 fieldTake(h,max(fieldExtrude(plan,p.y+${f(c.slabThickness/2)},${f(c.slabThickness/2)}),-service),101.0,1.0,p);
 float upper=fieldExtrude(plan,p.y-${f(c.floorHeight-c.slabThickness/2)},${f(c.slabThickness/2)});
 float hole=fieldBox(p-${v([0,c.floorHeight,(d.z0+d.totalLength)/2])},${v([d.totalWidth/2,c.slabThickness+1,(d.totalLength-d.z0)/2])});fieldTake(h,max(max(upper,-hole),-service),102.0,1.0,p);
 if(fieldBox(p-${v([-(c.flightWidth+c.centerGap)/2,flightHeight/2,d.z0+d.runLength/2])},${v([c.flightWidth/2,flightHeight/2,d.runLength/2])})<h.distance)fieldTake(h,fieldExtrude(profileDistance(vec2(p.z-${f(d.z0)},p.y)),p.x+${f((c.flightWidth+c.centerGap)/2)},${f(c.flightWidth/2)}),201.0,1.0,p);
 if(fieldBox(p-${v([(c.flightWidth+c.centerGap)/2,d.midHeight+flightHeight/2,d.z0+d.runLength/2])},${v([c.flightWidth/2,flightHeight/2,d.runLength/2])})<h.distance)fieldTake(h,fieldExtrude(profileDistance(vec2(${f(d.z1)}-p.z,p.y-${f(d.midHeight)})),p.x-${f((c.flightWidth+c.centerGap)/2)},${f(c.flightWidth/2)}),202.0,1.0,p);
 fieldTake(h,fieldBox(p-${v([0,d.midHeight-c.plateThickness/2,d.z1+c.landingDepth/2])},${v([d.totalWidth/2,c.plateThickness/2,c.landingDepth/2])}),203.0,1.0,p);
 ${c.wallEnabled?`float wall=fieldBox(p-${v([0,c.floorHeight+c.wallHeight/2,0])},${v([c.wallWidth/2,c.wallHeight/2,c.wallThickness/2])});float opening=fieldBox(p-${v([0,c.floorHeight+c.doorHeight/2,0])},${v([c.doorWidth/2,c.doorHeight/2+.0001,c.wallThickness+1])});fieldTake(h,max(wall,-opening),301.0,2.0,p);`:''}
 return h;}
FieldHit mapField(vec3 p){FieldHit h=mapStructure(p);
 ${c.railsEnabled?`if(fieldBox(p-${v(railCenter)},${v(railHalf)})<h.distance)fieldTake(h,railDistanceField(p),401.0,3.0,p);`:''}return h;}
float mapDistance(vec3 p){return mapField(p).distance;}
vec3 fieldNormal(vec3 p){float e=0.0001;vec3 g=vec3(mapField(p+vec3(e,0,0)).distance-mapField(p-vec3(e,0,0)).distance,mapField(p+vec3(0,e,0)).distance-mapField(p-vec3(0,e,0)).distance,mapField(p+vec3(0,0,e)).distance-mapField(p-vec3(0,0,e)).distance);return length(g)>1e-10?normalize(g):vec3(0,1,0);}
${buildTraceGLSL(spec)}
`;
}

/** Plane equations of the analytic structural zero-set, not tessellation.
 * Domain/CSG membership is always checked at the resulting candidate point. */
function deriveStructurePlanes(c,d){
 const planes=[],seen=new Map();
 const plane=(normal,offset,role,domain)=>{const len=length(normal);if(len<EPS)return;let n=mul(normal,1/len),k=offset/len;
  if(n.find(v=>Math.abs(v)>EPS)<0){n=mul(n,-1);k=-k;}const key=[...n,k].map(v=>v.toFixed(9)).join(':');
  if(seen.has(key)){const q=seen.get(key);q.roles.push(role);q.domains.push(domain);return;}const q={normal:n,offset:k,roles:[role],domains:[domain]};planes.push(q);seen.set(key,q);};
 const axis=(i,value,role,domain)=>{const n=[0,0,0];n[i]=1;plane(n,value,role,domain);};
 const boxDomain=(min,max,excludeOpening=false)=>({kind:'bounds',min,max,excludeOpening});
 const faceBox=(min,max,role,excludeOpening=false)=>{for(let i=0;i<3;i++)for(const value of [min[i],max[i]]){const a=[...min],b=[...max];a[i]=b[i]=value;axis(i,value,role,boxDomain(a,b,excludeOpening));}};
 for(const floor of [0,1]){const top=floor*c.floorHeight,bottom=top-c.slabThickness;
  for(const y of [top,bottom])axis(1,y,'slab-face',{kind:'slabPlan',floor});
  for(const [ring,role]of [[c.footprint2D,'source-footprint-face'],[c.serviceVoid2D,'service-void-face']])for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1];plane([dz,0,-dx],dz*a[0]-dx*a[1],role,boxDomain([Math.min(a[0],b[0]),bottom,Math.min(a[1],b[1])],[Math.max(a[0],b[0]),top,Math.max(a[1],b[1])]));}
 }
 for(const x of [-d.totalWidth/2,d.totalWidth/2])axis(0,x,'stair-hole-side',boxDomain([x,c.floorHeight-c.slabThickness,d.z0],[x,c.floorHeight,d.totalLength]));
 for(const z of [d.z0,d.totalLength])axis(2,z,'stair-hole-end',boxDomain([-d.totalWidth/2,c.floorHeight-c.slabThickness,z],[d.totalWidth/2,c.floorHeight,z]));
 for(const [start,dir,base,x]of [[d.z0,1,0,-(c.flightWidth+c.centerGap)/2],[d.z1,-1,d.midHeight,(c.flightWidth+c.centerGap)/2]]){
  const xlo=x-c.flightWidth/2,xhi=x+c.flightWidth/2,zAt=q=>start+dir*q,rect=(q0,q1,y0,y1)=>boxDomain([xlo,base+y0,Math.min(zAt(q0),zAt(q1))],[xhi,base+y1,Math.max(zAt(q0),zAt(q1))]);
  for(const side of [-1,1])axis(0,x+side*c.flightWidth/2,'flight-lateral-face',{kind:'profile',start,dir,base});
  const brk=Math.min(d.runLength,c.plateThickness*c.treadDepth/d.rise),under=Math.max(0,d.treadsPerFlight*d.rise-c.plateThickness);
  axis(1,base,'flight-bottom-flat',rect(0,brk,0,0));
  for(let k=0;k<d.treadsPerFlight;k++){
   axis(1,base+(k+1)*d.rise,'tread-face',rect(k*c.treadDepth,(k+1)*c.treadDepth,(k+1)*d.rise,(k+1)*d.rise));
   axis(2,zAt(k*c.treadDepth),'riser-face',rect(k*c.treadDepth,k*c.treadDepth,k*d.rise,(k+1)*d.rise));}
  axis(2,zAt(d.runLength),'flight-end-face',rect(d.runLength,d.runLength,under,d.treadsPerFlight*d.rise));
  const slope=d.rise/c.treadDepth;plane([0,1,-slope*dir],base-c.plateThickness-slope*dir*start,'flight-sloping-underside',rect(brk,d.runLength,0,under));
 }
 faceBox([-d.totalWidth/2,d.midHeight-c.plateThickness,d.z1],[d.totalWidth/2,d.midHeight,d.totalLength],'landing-face');
 if(c.wallEnabled){faceBox([-c.wallWidth/2,c.floorHeight,-c.wallThickness/2],[c.wallWidth/2,c.floorHeight+c.wallHeight,c.wallThickness/2],'wall-face',true);
  for(const x of [-c.doorWidth/2,c.doorWidth/2])axis(0,x,'door-reveal',boxDomain([x,c.floorHeight,-c.wallThickness/2],[x,c.floorHeight+c.doorHeight+.0001,c.wallThickness/2]));
  const top=c.floorHeight+c.doorHeight+.0001;axis(1,top,'door-head-reveal',boxDomain([-c.doorWidth/2,top,-c.wallThickness/2],[c.doorWidth/2,top,c.wallThickness/2]));}
 const footprintMin=[Math.min(...c.footprint2D.map(p=>p[0])),Math.min(...c.footprint2D.map(p=>p[1]))],footprintMax=[Math.max(...c.footprint2D.map(p=>p[0])),Math.max(...c.footprint2D.map(p=>p[1]))];
 for(const p of planes){const boxes=p.domains.map(q=>q.kind==='bounds'?q:q.kind==='profile'?{min:[p.offset/p.normal[0],q.base,d.z0],max:[p.offset/p.normal[0],q.base+d.treadsPerFlight*d.rise,d.z1]}:{min:[footprintMin[0],p.offset/p.normal[1],footprintMin[1]],max:[footprintMax[0],p.offset/p.normal[1],footprintMax[1]]});p.bounds={min:[0,1,2].map(i=>Math.min(...boxes.map(q=>q.min[i]))),max:[0,1,2].map(i=>Math.max(...boxes.map(q=>q.max[i])))};}
 return planes;
}
function planeDomainContains(spec,domain,p){const c=spec.config,d=spec.dimensions;
 if(domain.kind==='bounds'){
  for(let i=0;i<3;i++){const lo=domain.min[i],hi=domain.max[i],tol=hi-lo<EPS?3e-5:0;if(p[i]<lo-tol||p[i]>hi+tol)return false;}
  if(domain.excludeOpening&&Math.abs(p[0])<c.doorWidth/2&&p[1]>c.floorHeight-.0001&&p[1]<c.floorHeight+c.doorHeight+.0001)return false;return true;
 }
 if(domain.kind==='profile')return stairProfileContains(domain.dir*(p[2]-domain.start),p[1]-domain.base,c);
 if(domain.kind==='slabPlan'){if(!polygonContains([p[0],p[2]],c.footprint2D)||polygonContains([p[0],p[2]],c.serviceVoid2D))return false;
  return !domain.floor||!(Math.abs(p[0])<d.totalWidth/2&&p[2]>d.z0&&p[2]<d.totalLength);}
 return false;
}
export function queryStructure(spec,p){return queryField(spec,p,{includeRail:false});}
function rayInterval(origin,direction,bounds){let lo=-Infinity,hi=Infinity;for(let i=0;i<3;i++){
 if(Math.abs(direction[i])<1e-14){if(origin[i]<bounds.min[i]||origin[i]>bounds.max[i])return null;continue;}
 const a=(bounds.min[i]-origin[i])/direction[i],b=(bounds.max[i]-origin[i])/direction[i];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return null;}
 return [lo,hi];}
/** Exact planar-candidate structural trace + bounded rail-only conservative
 * marching. maxSteps counts rail evaluations, NOT plane tests or full queries. */
export function traceFieldAnalytic(spec,origin,direction,{maxSteps=512,maxDistance=100,clipX=null,epsilon=.00015,epsilonScale=.000025,diagnosticMode=0}={}){
 if(![0,1,2].includes(diagnosticMode))throw Error('diagnosticMode must be 0 (combined), 1 (structure) or 2 (rail)');
 const rd=norm(direction),span=rayInterval(origin,rd,spec.bounds),cut=clipX??-1e20;
 if(!span||span[1]<0)return {hit:false,status:2,reason:'outside_bounds',steps:0,structuralPlaneTests:0};
 const planeCount=diagnosticMode===2?0:spec.structurePlanes.length;
 const start=Math.max(0,span[0]),end=Math.min(span[1],maxDistance);if(end<start)return {hit:false,status:2,reason:'empty_ray_interval',steps:0,structuralPlaneTests:0};let nearest=end+1,structural=null,candidates=0;
 const accept=(t,n,domains=null)=>{if(t<start-1e-6||t>end||t>=nearest)return;const p=add(origin,mul(rd,t));if(domains&&!domains.some(q=>planeDomainContains(spec,q,p)))return;candidates++;const e=.0004,dp=structureOccupied(spec,plusVector(p,n,e),cut),dm=structureOccupied(spec,plusVector(p,n,-e),cut);
  // Reject internal touching faces: a true union boundary has exterior on at
  // least one normal side. This is a domain check, never a new polygon surface.
  if(dp===dm)return;nearest=t;structural={point:p,normal:mul(n,dp?-1:1)};};
 if(diagnosticMode!==2)for(const p of spec.structurePlanes){const den=dot(p.normal,rd);if(Math.abs(den)>1e-12)accept((p.offset-dot(p.normal,origin))/den,p.normal,p.domains);}
 if(diagnosticMode!==2&&clipX!==null&&Math.abs(rd[0])>1e-12)accept((cut-origin[0])/rd[0],[1,0,0]);
 let steps=0;
 if(diagnosticMode!==1&&spec.config.railsEnabled){const bounds=copy(spec.rail.bounds);bounds.min[0]=Math.max(bounds.min[0],cut);const railSpan=bounds.min[0]<=bounds.max[0]?rayInterval(origin,rd,bounds):null;
  if(railSpan){let t=Math.max(start,railSpan[0]),limit=Math.min(end,railSpan[1],structural?nearest:end);if(limit>=t){
   for(;steps<maxSteps;steps++){const p=add(origin,mul(rd,t)),d=Math.max(railDistanceBounded(spec.rail,p).distance-spec.config.railRadius,cut-p[0]);
    if(Math.abs(d)<Math.max(epsilon,t*epsilonScale)){const closest=railDistance(spec.rail,p),normal=cut-p[0]>=closest.distance-spec.config.railRadius?[-1,0,0]:norm(sub(p,closest.point));return {hit:true,status:1,reason:'rail_field',t,point:p,normal,...queryField(spec,p),steps:steps+1,structuralPlaneTests:planeCount,structuralDomainQueries:candidates};}
    t+=Math.abs(d)*.85;if(t>limit)break;
   }
   if(steps>=maxSteps)return {hit:false,status:3,reason:'rail_step_budget',t,steps,structuralPlaneTests:planeCount,structuralDomainQueries:candidates};
  }}
 }
 if(structural)return {hit:true,status:1,reason:'analytic_structural_boundary',t:nearest,...structural,...queryField(spec,structural.point),steps,structuralPlaneTests:planeCount,structuralDomainQueries:candidates};
 return {hit:false,status:2,reason:'all_bounded_candidates_excluded',steps,structuralPlaneTests:planeCount,structuralDomainQueries:candidates};
}
/** Conservative primary traversal with analytic rescue only for exhausted or
 * grazing candidates. Total distance-query budget is shared with rescue rails.
 * A tight fixed field tolerance avoids distance-dependent early planar hits. */
export function traceFieldHybrid(spec,origin,direction,{maxSteps=512,primaryBudget=128,maxDistance=100,clipX=null}={}){
 const rd=norm(direction),span=rayInterval(origin,rd,spec.bounds),cut=clipX??-1e20;
 if(!span||span[1]<0)return {hit:false,status:2,reason:'outside_bounds',steps:0,primarySteps:0,rescueUsed:false};
 let t=Math.max(0,span[0]),end=Math.min(span[1],maxDistance),steps=0,rescueReason='primary_budget';
 if(end<t)return {hit:false,status:2,reason:'empty_ray_interval',steps:0,primarySteps:0,rescueUsed:false};
 for(;steps<Math.min(primaryBudget,maxSteps);steps++){
  const p=add(origin,mul(rd,t)),h=queryField(spec,p),d=Math.max(h.distance,cut-p[0]);
  if(Math.abs(d)<1e-5){const normal=cut-p[0]>=h.distance?[-1,0,0]:fieldNormal(spec,p),cosine=Math.abs(dot(normal,rd));
   const boundaryCrossing=h.objectId===401||structureOccupied(spec,plusVector(p,normal,.0004),cut)!==structureOccupied(spec,plusVector(p,normal,-.0004),cut);
   if(cosine>=.08&&boundaryCrossing)return {hit:true,status:1,reason:'primary_field',t,point:p,normal,...h,steps:steps+1,primarySteps:steps+1,rescueUsed:false};
   steps++;rescueReason='grazing_candidate';break;
  }
  t+=Math.abs(d)*.85;if(t>end)return {hit:false,status:2,reason:'primary_bounds_exit',t,steps:steps+1,primarySteps:steps+1,rescueUsed:false};
 }
 const result=traceFieldAnalytic(spec,add(origin,mul(rd,t)),rd,{clipX,maxDistance:Math.max(0,maxDistance-t),maxSteps:Math.max(0,maxSteps-steps),epsilon:1e-5,epsilonScale:0});
 return {...result,t:result.t===undefined?undefined:t+result.t,steps:steps+result.steps,primarySteps:steps,rescueUsed:true,rescueReason,reason:'analytic_rescue_'+result.reason};
}
export function traceFieldPrimaryOnly(spec,origin,direction,{maxSteps=512,primaryBudget=128,maxDistance=100,clipX=null}={}){
 const rd=norm(direction),span=rayInterval(origin,rd,spec.bounds),cut=clipX??-1e20;
 if(!span||span[1]<0)return {hit:false,status:2,reason:'outside_bounds',steps:0,primarySteps:0,rescueUsed:false};
 let t=Math.max(0,span[0]),end=Math.min(span[1],maxDistance),steps=0,rescueReason='primary_budget';
 if(end<t)return {hit:false,status:2,reason:'empty_ray_interval',steps:0,primarySteps:0,rescueUsed:false};
 for(;steps<Math.min(primaryBudget,maxSteps);steps++){
  const p=add(origin,mul(rd,t)),h=queryField(spec,p),d=Math.max(h.distance,cut-p[0]);
  if(Math.abs(d)<1e-5){const normal=cut-p[0]>=h.distance?[-1,0,0]:fieldNormal(spec,p),cosine=Math.abs(dot(normal,rd));
   const boundaryCrossing=h.objectId===401||structureOccupied(spec,plusVector(p,normal,.0004),cut)!==structureOccupied(spec,plusVector(p,normal,-.0004),cut);
   if(cosine>=.08&&boundaryCrossing)return {hit:true,status:1,reason:'primary_field',t,point:p,normal,...h,steps:steps+1,primarySteps:steps+1,rescueUsed:false};
   steps++;rescueReason='grazing_candidate';break;
  }
  t+=Math.abs(d)*.85;if(t>end)return {hit:false,status:2,reason:'primary_bounds_exit',t,steps:steps+1,primarySteps:steps+1,rescueUsed:false};
 }
 return {hit:false,status:3,reason:rescueReason,t:Math.max(0,t-Math.max(1e-5,Math.abs(t)*2e-6)),steps,primarySteps:steps,rescueUsed:false,rescueRequired:true};
}
export function traceFieldRescueFrom(spec,origin,direction,startT,usedPrimarySteps,{maxSteps=512,maxDistance=100,clipX=null}={}){
 if(!Number.isFinite(startT)||startT<0||!Number.isInteger(usedPrimarySteps)||usedPrimarySteps<0||usedPrimarySteps>maxSteps)throw Error('A valid safe handoff distance and primary step count are required');
 const rd=norm(direction),result=traceFieldAnalytic(spec,add(origin,mul(rd,startT)),rd,{clipX,maxDistance:Math.max(0,maxDistance-startT),maxSteps:Math.max(0,maxSteps-usedPrimarySteps),epsilon:1e-5,epsilonScale:0});
 return {...result,t:result.t===undefined?undefined:startT+result.t,steps:usedPrimarySteps+result.steps,primarySteps:usedPrimarySteps,rescueUsed:true,reason:'analytic_rescue_'+result.reason};
}
const plusVector=(p,n,s)=>p.map((v,i)=>v+n[i]*s);
function buildTraceGLSL(spec){const planes=spec.structurePlanes.map(p=>v([...p.normal,p.offset])).join(',\n'),c=spec.config,d=spec.dimensions;
 const domainCode=q=>q.kind==='bounds'?`(fieldDomainBounds(p,${v(q.min)},${v(q.max)})${q.excludeOpening?`&&!(abs(p.x)<${f(c.doorWidth/2)}&&p.y>${f(c.floorHeight-.0001)}&&p.y<${f(c.floorHeight+c.doorHeight+.0001)})`:''})`:q.kind==='profile'?`(fieldProfileInside(vec2(${f(q.dir)}*(p.z-${f(q.start)}),p.y-${f(q.base)})))`:`(fieldFootprintInside(p.xz)&&!fieldServiceInside(p.xz)${q.floor?`&&!(abs(p.x)<${f(d.totalWidth/2)}&&p.z>${f(d.z0)}&&p.z<${f(d.totalLength)})`:''})`;
 const railClosest=spec.rail.pieces.map(s=>s.kind==='line'?`q=fieldLineClosest(p,${v(s.start)},${v(s.end)});d=dot(p-q,p-q);if(d<best){best=d;closest=q;}`:`q=fieldArcClosest(p,${v(s.center)},${v(s.u)},${v(s.v)},${f(s.radius)},${f(Math.sin(s.sweep))},${f(Math.cos(s.sweep))},${v(s.start)},${v(s.end)});d=dot(p-q,p-q);if(d<best){best=d;closest=q;}`).join('\n');
 const boundMin=spec.structurePlanes.map(p=>v(p.bounds.min)).join(','),boundMax=spec.structurePlanes.map(p=>v(p.bounds.max)).join(',');
 const domains=spec.structurePlanes.map((p,i)=>`case ${i}:return ${p.domains.map(domainCode).join('||')};`).join('\n');return `
vec3 fieldRayNormal=vec3(0,1,0);
int fieldRailStepBudget=512;
float fieldRailTolerance=.00015;
float fieldRailToleranceScale=.000025;
int fieldPrimarySteps=0;
bool fieldRayUsedRescue=false;
bool fieldRayInterval(vec3 ro,vec3 rd,vec3 bmin,vec3 bmax,out vec2 span){float lo=-1e20,hi=1e20;for(int i=0;i<3;i++){if(abs(rd[i])<1e-12){if(ro[i]<bmin[i]||ro[i]>bmax[i])return false;}else{float a=(bmin[i]-ro[i])/rd[i],b=(bmax[i]-ro[i])/rd[i];lo=max(lo,min(a,b));hi=min(hi,max(a,b));if(lo>hi)return false;}}span=vec2(lo,hi);return true;}
#if FIELD_KERNEL_STAGE != 1
vec3 fieldLineClosest(vec3 p,vec3 a,vec3 b){vec3 ab=b-a;return a+ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0);}
vec3 fieldArcClosest(vec3 p,vec3 center,vec3 u,vec3 v,float r,float sinSweep,float cosSweep,vec3 start,vec3 end){vec3 q=p-center;float x=dot(q,u),y=dot(q,v),rho2=x*x+y*y;if(rho2>1e-18&&y>=0.0&&x*sinSweep-y*cosSweep>=0.0)return center+r*(u*x+v*y)*inversesqrt(rho2);return dot(p-start,p-start)<=dot(p-end,p-end)?start:end;}
vec3 fieldRailNormal(vec3 p,float clipX){float best=1e20,d;vec3 closest=p,q;${railClosest}if(clipX-p.x>=sqrt(best)-${f(c.railRadius)})return vec3(-1,0,0);return normalize(p-closest);}
const int FIELD_STRUCTURE_PLANE_COUNT=${spec.structurePlanes.length};
const vec4 FIELD_BOUNDARY_EQUATIONS[${spec.structurePlanes.length}]=vec4[](${planes});
const vec3 FIELD_DOMAIN_MIN[${spec.structurePlanes.length}]=vec3[](${boundMin});
const vec3 FIELD_DOMAIN_MAX[${spec.structurePlanes.length}]=vec3[](${boundMax});

bool fieldDomainBounds(vec3 p,vec3 lo,vec3 hi){for(int i=0;i<3;i++){float tol=hi[i]-lo[i]<1e-9?.00003:0.0;if(p[i]<lo[i]-tol||p[i]>hi[i]+tol)return false;}return true;}
bool fieldBoundaryDomain(int index,vec3 p){switch(index){${domains}}return false;}
float fieldClippedStructure(vec3 p,float clipX){return max(mapStructure(p).distance,clipX-p.x);}
void fieldConsiderPlane(vec3 ro,vec3 rd,vec4 equation,int planeIndex,float start,float finish,float clipX,inout float nearest,inout bool found){float den=dot(equation.xyz,rd);if(abs(den)<1e-8)return;float t=(equation.w-dot(equation.xyz,ro))/den;if(t<start-.00001||t>finish||t>=nearest)return;vec3 p=ro+rd*t;if(planeIndex>=0&&(!fieldDomainBounds(p,FIELD_DOMAIN_MIN[planeIndex],FIELD_DOMAIN_MAX[planeIndex])||!fieldBoundaryDomain(planeIndex,p)))return;float e=.0004;bool dp=fieldStructureOccupied(p+equation.xyz*e,clipX),dm=fieldStructureOccupied(p-equation.xyz*e,clipX);if(dp==dm)return;nearest=t;found=true;fieldRayNormal=dp?-equation.xyz:equation.xyz;}
bool fieldTraceRayAnalyticClipped(vec3 ro,vec3 rd,float clipX,int diagnosticMode,out float t,out FieldHit hit,out int steps,out int status){
 fieldRayNormal=vec3(0,1,0);hit.distance=1e20;hit.objectId=0.0;hit.materialRole=0.0;hit.local=ro;steps=0;status=2;t=0.0;vec2 span;
 if(!fieldRayInterval(ro,rd,${v(spec.bounds.min)},${v(spec.bounds.max)},span)||span.y<0.0)return false;
 float start=max(span.x,0.0),finish=span.y,nearest=finish+1.0;bool found=false;
 #if FIELD_TRACE_VARIANT != 2
 if(diagnosticMode!=2)for(int i=0;i<FIELD_STRUCTURE_PLANE_COUNT;i++)fieldConsiderPlane(ro,rd,FIELD_BOUNDARY_EQUATIONS[i],i,start,finish,clipX,nearest,found);
 if(diagnosticMode!=2&&clipX>-1e10)fieldConsiderPlane(ro,rd,vec4(1,0,0,clipX),-1,start,finish,clipX,nearest,found);
 #endif
 #if FIELD_TRACE_VARIANT != 1
 ${spec.config.railsEnabled?`vec3 railMin=${v(spec.rail.bounds.min)},railMax=${v(spec.rail.bounds.max)};railMin.x=max(railMin.x,clipX);vec2 railSpan;
 if(diagnosticMode!=1&&railMin.x<=railMax.x&&fieldRayInterval(ro,rd,railMin,railMax,railSpan)){
  float rayT=max(start,railSpan.x),limit=min(min(finish,railSpan.y),found?nearest:finish);bool escaped=limit<rayT;
  if(!escaped)for(int i=0;i<512;i++){if(i>=fieldRailStepBudget)break;steps=i+1;vec3 p=ro+rd*rayT;float d=max(railDistanceField(p),clipX-p.x),eps=max(fieldRailTolerance,rayT*fieldRailToleranceScale);
   if(abs(d)<eps){t=rayT;hit=mapField(p);fieldRayNormal=fieldRailNormal(p,clipX);status=1;return true;}
   rayT+=abs(d)*.85;if(rayT>limit){escaped=true;break;}
  }
  if(!escaped){t=rayT;status=3;return false;}
 }`:''}
 #endif
 if(found){t=nearest;hit=mapField(ro+rd*t);status=1;return true;}return false;
}
#endif
#if FIELD_KERNEL_STAGE != 2
bool fieldTracePrimaryOnlyClipped(vec3 ro,vec3 rd,float clipX,out float t,out FieldHit hit,out int steps,out int status){
 fieldRayNormal=vec3(0,1,0);fieldPrimarySteps=0;fieldRayUsedRescue=false;fieldRailStepBudget=512;fieldRailTolerance=.00015;fieldRailToleranceScale=.000025;steps=0;status=2;t=0.0;hit.distance=1e20;hit.objectId=0.0;hit.materialRole=0.0;hit.local=ro;vec2 span;
 if(!fieldRayInterval(ro,rd,${v(spec.bounds.min)},${v(spec.bounds.max)},span)||span.y<0.0)return false;
 t=max(0.0,span.x);float finish=span.y;
 for(int i=0;i<128;i++){
  fieldPrimarySteps=i+1;steps=i+1;vec3 p=ro+rd*t;hit=mapField(p);float d=max(hit.distance,clipX-p.x);
  if(abs(d)<.00001){vec3 n=clipX-p.x>=hit.distance?vec3(-1,0,0):fieldNormal(p);
   bool boundaryCrossing=hit.objectId==401.0||fieldStructureOccupied(p+n*.0004,clipX)!=fieldStructureOccupied(p-n*.0004,clipX);
   if(abs(dot(n,rd))>=.08&&boundaryCrossing){fieldRayNormal=n;status=1;return true;}break;
  }
  t+=abs(d)*.85;if(t>finish){status=2;return false;}
 }
 t=max(0.0,t-max(.00001,abs(t)*.000002));status=3;return false;
}
#endif
#if FIELD_KERNEL_STAGE != 1
bool fieldTraceRescueFromClipped(vec3 ro,vec3 rd,float clipX,float startT,int usedPrimarySteps,out float t,out FieldHit hit,out int steps,out int status){
 fieldPrimarySteps=usedPrimarySteps;fieldRayUsedRescue=true;fieldRailStepBudget=max(0,512-usedPrimarySteps);fieldRailTolerance=.00001;fieldRailToleranceScale=0.0;
 float rest;int rescueSteps;bool found=fieldTraceRayAnalyticClipped(ro+rd*startT,rd,clipX,0,rest,hit,rescueSteps,status);t=startT+rest;steps=usedPrimarySteps+rescueSteps;fieldRailStepBudget=512;return found;
}
#endif
#if FIELD_KERNEL_STAGE == 0
bool fieldTraceRayHybridClipped(vec3 ro,vec3 rd,float clipX,out float t,out FieldHit hit,out int steps,out int status){
 bool found=fieldTracePrimaryOnlyClipped(ro,rd,clipX,t,hit,steps,status);if(status!=3)return found;
 float safeStart=t;int used=steps;return fieldTraceRescueFromClipped(ro,rd,clipX,safeStart,used,t,hit,steps,status);
}
#endif
bool fieldTraceRayModeClipped(vec3 ro,vec3 rd,float clipX,int diagnosticMode,out float t,out FieldHit hit,out int steps,out int status){
 fieldRailStepBudget=512;fieldRailTolerance=.00015;fieldRailToleranceScale=.000025;fieldPrimarySteps=0;fieldRayUsedRescue=false;
 #if FIELD_KERNEL_STAGE == 1
 return fieldTracePrimaryOnlyClipped(ro,rd,clipX,t,hit,steps,status);
 #elif FIELD_KERNEL_STAGE == 2
 return fieldTraceRayAnalyticClipped(ro,rd,clipX,diagnosticMode,t,hit,steps,status);
 #else
 #if FIELD_TRACE_VARIANT == 1 || FIELD_TRACE_VARIANT == 2
 return fieldTraceRayAnalyticClipped(ro,rd,clipX,diagnosticMode,t,hit,steps,status);
 #else
 if(diagnosticMode!=0)return fieldTraceRayAnalyticClipped(ro,rd,clipX,diagnosticMode,t,hit,steps,status);
 return fieldTraceRayHybridClipped(ro,rd,clipX,t,hit,steps,status);
 #endif
 #endif
}
bool fieldTraceRayClipped(vec3 ro,vec3 rd,float clipX,out float t,out FieldHit hit,out int steps,out int status){return fieldTraceRayModeClipped(ro,rd,clipX,0,t,hit,steps,status);}
bool fieldTraceRay(vec3 ro,vec3 rd,out float t,out FieldHit hit,out int steps,out int status){return fieldTraceRayClipped(ro,rd,-1e20,t,hit,steps,status);}
`;}
