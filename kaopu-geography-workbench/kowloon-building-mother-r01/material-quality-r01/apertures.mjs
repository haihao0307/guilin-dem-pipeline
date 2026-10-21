/**
 * Material-quality scoped fork of R07 hosted aperture functions, in metres.
 * Original source/host aperture untouched. Optional DESIGN front 45-degree chamfer.
 * This is actual implicit geometry, not a material normal modification.
 * One validated recipe drives CPU fields, finite analytic rays and GPU records.
 * A rounded rectangle is a real field, not a polygon with decorative arcs.
 * Door hinge: a simplified, front-mounted rigid axis, NOT friction-stay hardware.
 * Unknown vehicle/freight mechanisms can keep only their jamb: leafEnabled:false.
 */
export const JOINERY_BEVEL_PROFILE = Object.freeze({kind:'design_front_45_degree_chamfer',defaultMetres:0,targetMetres:.0015,minimumPositiveMetres:.0001,maximumMetres:.002,sourceMeasured:false});
export const APERTURE_SCHEMA = 'kaopu.hosted-aperture-function/0.1';
export const APERTURE_ROLES = Object.freeze({host:2,frame:4,leaf:5,glass:6});
export const APERTURE_STRUCT = 'struct FieldHit{float distance;float objectId;float materialRole;vec3 local;};';
const EPS=1e-9, INF=1e30, copy=x=>structuredClone(x);
const finite=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]), mul=(a,t)=>a.map(x=>x*t), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0), length=a=>Math.hypot(...a);
const unit=a=>mul(a,1/length(a));
const rotate=(p,a)=>[Math.cos(a)*p[0]-Math.sin(a)*p[2],p[1],Math.sin(a)*p[0]+Math.cos(a)*p[2]];
const axesPoint=(f,p)=>add(f.origin,axesDirection(f,p));
const axesDirection=(f,p)=>add(mul(f.u,p[0]),add(mul(f.v,p[1]),mul(f.w,p[2])));
const inverseDirection=(f,p)=>[dot(p,f.u),dot(p,f.v),dot(p,f.w)];
const inversePoint=(f,p)=>inverseDirection(f,sub(p,f.origin));
function rect(half,radius=0,center=[0,0]){if(!finite(half,2)||half.some(x=>x<=0)||!finite(center,2)||!Number.isFinite(radius)||radius<0||radius>Math.min(...half))throw Error('Rounded rectangle radius must fit its remaining positive half dimensions');return {half,radius,center};}
function positive(v,name,min=0){if(!Number.isFinite(v)||v<=min)throw Error(`${name} must be finite and greater than ${min}`);return v;}
function assertSpec(s){if(s?.schema!==APERTURE_SCHEMA)throw Error('deriveAperture result required');}
function specs(input){const a=Array.isArray(input)?input:[input];if(a.length>64)throw Error('At most 64 hosted apertures');const seen=new Set();for(const s of a){assertSpec(s);if(seen.has(s.instanceId))throw Error('Duplicate aperture instanceId');seen.add(s.instanceId);}return a;}
function parts(input){return specs(input).flatMap(s=>s.primitives);}
function hostFrame(h){
 if(!h||!finite(h.origin,3))throw Error('Finite host origin and rigid basis required');
 const f={origin:copy(h.origin),u:copy(h.u??h.xAxis),v:copy(h.v??h.yAxis),w:copy(h.w??h.zAxis)};
 if([f.u,f.v,f.w].some(x=>!finite(x,3)||Math.abs(length(x)-1)>1e-8)||Math.abs(dot(f.u,f.v))+Math.abs(dot(f.u,f.w))+Math.abs(dot(f.v,f.w))>1e-8)throw Error('Host basis must be orthonormal; no scale or shear');
 if(f.origin.some(x=>Math.abs(x)>10000))throw Error('Host origin exceeds bounded source-local domain');
 return {...f,nodeId:h.nodeId??null,sourcePatchId:h.sourcePatchId??null,sourceObjectId:h.sourceObjectId??null,emitWall:h.emitWall??false,wallWidth:h.wallWidth,wallHeight:h.wallHeight,wallCenter:copy(h.wallCenter??[0,0])};
}
function configuration(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Aperture parameters required');
 const c={kind:'window',width:1.2,height:1.4,frameDepth:.12,wallThickness:.18,frameWidth:.06,roundRadius:0,hingeOrSlider:'hinge-left',openT:0,enabled:true,leafEnabled:true,clearance:.004,sashWidth:.045,leafThickness:.035,glassThickness:.006,glassSeat:.006,mountGap:.004,maxAngleRadians:Math.PI/2,thresholdHeight:0,frontBevel:0,...copy(input)};
 if(!Number.isInteger(c.instanceId)||c.instanceId<0||c.instanceId>511)throw Error('Stable integer instanceId in 0..511 required');
 if(!['window','door'].includes(c.kind))throw Error('kind must be window or door');
 c.host=hostFrame(c.host);
 for(const name of ['width','height','frameDepth','wallThickness','frameWidth','clearance','sashWidth','leafThickness','glassThickness','glassSeat','mountGap'])positive(c[name],name);
 if(c.width>12||c.height>12||c.width<.08||c.height<.08||c.frameDepth>2||c.wallThickness>2||c.leafThickness>1)throw Error('Aperture dimensions exceed bounded joinery domain');
 if(c.clearance<.0001||c.mountGap<.0001||c.glassThickness<.0001)throw Error('Finite clearance, mounting gap and glass thickness must be at least 0.1 mm');
 if(!Number.isFinite(c.roundRadius)||c.roundRadius<0||c.roundRadius>Math.min(c.width,c.height)/2)throw Error('roundRadius must fit outer aperture');
 if(!Number.isFinite(c.thresholdHeight)||c.thresholdHeight<0||c.thresholdHeight>.02)throw Error('thresholdHeight must be in 0..0.02 metres');
 if(c.kind==='window'&&c.thresholdHeight!==0)throw Error('thresholdHeight is for doors only');
 if(!['hinge-left','hinge-right','slider-left','slider-right','fixed'].includes(c.hingeOrSlider))throw Error('Unknown hingeOrSlider mechanism');
 if(!Number.isFinite(c.openT)||c.openT<0||c.openT>1)throw Error('openT must be in [0,1]');
 if(!Number.isFinite(c.maxAngleRadians)||c.maxAngleRadians<0||c.maxAngleRadians>Math.PI/2)throw Error('Simplified outward hinge supports only 0..90 degrees');
 for(const n of ['enabled','leafEnabled'])if(typeof c[n]!=='boolean')throw Error(n+' must be boolean');
 if(typeof c.host.emitWall!=='boolean'||!finite(c.host.wallCenter,2))throw Error('Host emitWall must be boolean and wallCenter finite');
 const clearW=c.width-2*c.frameWidth,clearH=c.height-(c.kind==='door'?c.frameWidth+c.thresholdHeight:2*c.frameWidth);
 if(clearW<=2*c.clearance+.01||clearH<=2*c.clearance+.01)throw Error('Hole/frame overlap: frame consumes clear aperture');
 const leafW=clearW-2*c.clearance,leafH=clearH-2*c.clearance;
 if(c.kind==='window'&&(leafW<=2*c.sashWidth+.01||leafH<=2*c.sashWidth+.01||c.glassSeat>=c.sashWidth||c.glassThickness>c.leafThickness))throw Error('Glass/sash dimensions overlap invalidly or glass exceeds leaf thickness');
 if(!Number.isFinite(c.frontBevel)||c.frontBevel<0||c.frontBevel>.002||(c.frontBevel>0&&c.frontBevel<.0001))throw Error('frontBevel must be 0 or finite 0.1..2 mm; invalid designs are rejected, never clipped');
 if(c.frontBevel>0){
  if(c.frontBevel>=c.frameDepth/2||c.frontBevel>c.frameWidth/4)throw Error('frontBevel consumes fixed-frame depth or remaining rail; original shape is not clipped');
  if(c.kind==='window'&&c.leafEnabled&&(c.frontBevel>=c.leafThickness/2||c.frontBevel>c.sashWidth/4||c.frontBevel>=(c.leafThickness-c.glassThickness)/2))throw Error('frontBevel consumes sash depth, rail or original glass seat; original shape is not clipped');
 }
 if(c.slideDistance===undefined)c.slideDistance=leafW+2*c.frameWidth+c.clearance;
 if(!Number.isFinite(c.slideDistance)||c.slideDistance<0||c.slideDistance>24)throw Error('Finite slideDistance in 0..24 required');
 if(c.host.emitWall){positive(c.host.wallWidth,'host.wallWidth');positive(c.host.wallHeight,'host.wallHeight');const [x,y]=c.host.wallCenter;
  if(c.host.wallWidth/2-Math.abs(x)<c.width/2+EPS||c.host.wallHeight/2-Math.abs(y)<c.height/2-EPS)throw Error('Host wall must contain the entire rough aperture with lateral jamb support');
  if(c.kind==='window'&&c.host.wallHeight/2-Math.abs(y)<=c.height/2+EPS)throw Error('Window aperture must not touch host wall edge');
 }
 return c;
}
function primitive(c,part,outer,inner,halfDepth,frame=c.host){
 const p={kind:'rounded_rectangle_extrusion',frontBevel:(part==='frame'||(part==='leaf'&&c.kind==='window'))?c.frontBevel:0,part,objectId:4000+c.instanceId*8+({host:0,frame:1,leaf:2,glass:3}[part]),materialRole:APERTURE_ROLES[part],instanceId:c.instanceId,nodeId:c.host.nodeId,outer,inner,halfDepth,origin:copy(frame.origin),u:copy(frame.u),v:copy(frame.v),w:copy(frame.w)};
 const points=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])points.push(axesPoint(p,[outer.center[0]+x*outer.half[0],outer.center[1]+y*outer.half[1],z*halfDepth]));
 p.bounds={min:[0,1,2].map(i=>Math.min(...points.map(q=>q[i]))),max:[0,1,2].map(i=>Math.max(...points.map(q=>q[i])))};return p;
}
/** width/height are the rough hole's OUTER dimensions. Host origin is hole centre.
 * A door has three jamb sides; thresholdHeight defaults to zero, never frameWidth.
 * The proud-mounted moving leaf remains beyond both wall and fixed-frame fronts.
 * This deliberately simple arrangement has a continuous 0..90 degree clearance
 * proof, but is not a construction-detail claim or a friction-stay simulation.
 */
export function deriveAperture(input){
 const c=configuration(input),out=rect([c.width/2,c.height/2],c.roundRadius),fw=c.frameWidth;
 const innerR=Math.max(c.roundRadius-fw,0),door=c.kind==='door';
 const frameInner=door&&c.thresholdHeight===0?rect([c.width/2-fw,c.height/2+(innerR+fw)/2],innerR,[0,-(innerR+3*fw)/2]):door?rect([c.width/2-fw,(c.height-fw-c.thresholdHeight)/2],innerR,[0,(c.thresholdHeight-fw)/2]):rect([c.width/2-fw,c.height/2-fw],innerR);
 // For zero-threshold doors, cutter top is H/2-fw, bottom extends below FFL.
 const leafHalf=[c.width/2-fw-c.clearance,(c.height-(door?fw+c.thresholdHeight:2*fw))/2-c.clearance],leafY=door?(c.thresholdHeight-fw)/2:0;
 const leafRadius=Math.max(0,c.roundRadius-fw-c.clearance),front=Math.max(c.wallThickness,c.frameDepth)/2+c.mountGap;
 const side=c.hingeOrSlider.endsWith('right')?1:-1,pivot=[side*leafHalf[0],leafY,front],angle=c.hingeOrSlider.startsWith('hinge')?-side*c.maxAngleRadians*c.openT:0;
 let center=[0,leafY,front+c.leafThickness/2];
 if(c.hingeOrSlider.startsWith('hinge'))center=add(pivot,rotate(sub(center,pivot),angle));
 if(c.hingeOrSlider.startsWith('slider'))center[0]+=side*c.slideDistance*c.openT;
 const moving={origin:axesPoint(c.host,center),u:axesDirection(c.host,rotate([1,0,0],angle)),v:copy(c.host.v),w:axesDirection(c.host,rotate([0,0,1],angle))};
 const pp=[];
 if(c.enabled){
  if(c.host.emitWall)pp.push(primitive(c,'host',rect([c.host.wallWidth/2,c.host.wallHeight/2],0,c.host.wallCenter),out,c.wallThickness/2));
  pp.push(primitive(c,'frame',out,frameInner,c.frameDepth/2));
  if(c.leafEnabled){
   const sashInner=door?null:rect(leafHalf.map(x=>x-c.sashWidth),Math.max(leafRadius-c.sashWidth,0));
   pp.push(primitive(c,'leaf',rect(leafHalf,Math.min(leafRadius,...leafHalf)),sashInner,c.leafThickness/2,moving));
   if(!door)pp.push(primitive(c,'glass',rect(sashInner.half.map(x=>x+c.glassSeat),sashInner.radius+c.glassSeat),null,c.glassThickness/2,moving));
  }
 }
 const bb=pp.length?pp.map(p=>p.bounds):[primitive(c,'frame',out,frameInner,c.frameDepth/2).bounds];
 return {joineryProfile:{...JOINERY_BEVEL_PROFILE,metres:c.frontBevel,onlyFrontPositiveLocalZ:true,outerBoundsRetained:true,minimumOpeningUnchanged:true,glassSeatUnchanged:true},schema:APERTURE_SCHEMA,fieldKind:'hosted-aperture',instanceId:c.instanceId,kind:c.kind,enabled:c.enabled,config:c,parameters:copy(c),initialParameters:copy(c),host:copy(c.host),primitives:pp,roughOpening:out,pose:{pivotLocal:pivot,pivotWorld:axesPoint(c.host,pivot),angleRadians:angle,leafFrame:copy(moving),frontPlane:front},bounds:{min:[0,1,2].map(i=>Math.min(...bb.map(b=>b.min[i]))),max:[0,1,2].map(i=>Math.max(...bb.map(b=>b.max[i])))},dependencies:[{type:'hostedBy',nodeId:c.host.nodeId}],counts:{primitives:pp.length,modelTriangles:0,modelVertexBuffers:0},distanceContract:{kind:'one_lipschitz_signed_csg_lower_bound',certifiedSDF:false,lipschitzUpperBound:1,rayMethod:'analytic_rounded_rectangle_affine_level_cones_and_csg_boundary_events',stepBudgetRequired:false,numerics:'double_cpu_float32_gpu_finite_tolerance'},clearanceContract:{kind:'continuous_front_halfspace_separation',minimumHostFrameGap:c.mountGap,domain:'openT in [0,1], outward hinge <= pi/2 or parallel slider',proof:'All moving slab points have x-from-hinge of the outward sign and nonnegative z-from-hinge; z(openT) >= max(frameDepth,wallThickness)/2 + mountGap.',doesNotCertifySurroundingObjects:true},hardware:{kind:'simplified_rigid_axis_or_parallel_slide',frictionStay:false,seals:false,buildingCompliance:false}};
}
export function updateAperture(spec,changes={}){assertSpec(spec);const next=deriveAperture({...copy(spec.config),...copy(changes),host:changes.host?{...copy(spec.host),...copy(changes.host)}:copy(spec.host)});next.initialParameters=copy(spec.initialParameters);return next;}
export function resetAperture(spec){assertSpec(spec);return deriveAperture(copy(spec.initialParameters));}
export function apertureLocalToWorld(spec,p){assertSpec(spec);if(!finite(p,3))throw Error('Finite aperture point required');return axesPoint(spec.host,p);}
export function apertureWorldToLocal(spec,p){assertSpec(spec);if(!finite(p,3))throw Error('Finite world point required');return inversePoint(spec.host,p);}
/** Exact planar rounded-rectangle distance, and exact extrusion when no cutter. */
export function roundedRectangleDistance(p,r){const q=[Math.abs(p[0]-r.center[0])-r.half[0]+r.radius,Math.abs(p[1]-r.center[1])-r.half[1]+r.radius];return Math.hypot(Math.max(q[0],0),Math.max(q[1],0))+Math.min(Math.max(...q),0)-r.radius;}
function rectangleNormal(p,r){const d=sub(p.slice(0,2),r.center),q=d.map((x,i)=>Math.abs(x)-r.half[i]+r.radius),outside=q.map(x=>Math.max(x,0));if(length(outside)>1e-14)return unit(outside).map((x,i)=>x*(d[i]<0?-1:1));const i=q[0]>q[1]?0:1;return [0,1].map(a=>a===i?(d[a]<0?-1:1):0);}
function partDistance(p,point){const q=inversePoint(p,point),a=roundedRectangleDistance(q,p.outer),b=Math.abs(q[2])-p.halfDepth,d=Math.hypot(Math.max(a,0),Math.max(b,0))+Math.min(Math.max(a,b),0),inner=p.inner?-roundedRectangleDistance(q,p.inner):-Infinity;let f=Math.max(d,inner);if(p.frontBevel>0){const front=q[2]-p.halfDepth+p.frontBevel;f=Math.max(f,(a+front)*Math.SQRT1_2,(inner+front)*Math.SQRT1_2);}return f;}
function partLocalNormal(p,q){const a=roundedRectangleDistance(q,p.outer),b=Math.abs(q[2])-p.halfDepth,da=rectangleNormal(q,p.outer),dz=q[2]<0?-1:1;let n;if(a>0&&b>0)n=unit([da[0]*a,da[1]*a,dz*b]);else n=a>b?[...da,0]:[0,0,dz];let f=Math.hypot(Math.max(a,0),Math.max(b,0))+Math.min(Math.max(a,b),0),inner=p.inner?-roundedRectangleDistance(q,p.inner):-Infinity;if(inner>f+1e-12){f=inner;n=[...rectangleNormal(q,p.inner).map(x=>-x),0];}if(p.frontBevel>0){const front=q[2]-p.halfDepth+p.frontBevel,outerChamfer=(a+front)*Math.SQRT1_2,innerChamfer=(inner+front)*Math.SQRT1_2;if(outerChamfer>f+1e-12){f=outerChamfer;n=[da[0]*Math.SQRT1_2,da[1]*Math.SQRT1_2,Math.SQRT1_2];}if(innerChamfer>f+1e-12){const ni=rectangleNormal(q,p.inner);n=[-ni[0]*Math.SQRT1_2,-ni[1]*Math.SQRT1_2,Math.SQRT1_2];}}return n;}
export function apertureOpeningDistance(spec,p){assertSpec(spec);return roundedRectangleDistance(apertureWorldToLocal(spec,p),spec.roughOpening);}
export function apertureMaskContains(spec,p,{depthPadding=1e-6}={}){if(!Number.isFinite(depthPadding)||depthPadding<0)throw Error('Nonnegative finite depthPadding required');const q=apertureWorldToLocal(spec,p);return spec.enabled&&roundedRectangleDistance(q,spec.roughOpening)<=0&&Math.abs(q[2])<=spec.config.wallThickness/2+depthPadding;}
export function queryApertures(input,p){if(!finite(p,3))throw Error('Finite point required');const pp=parts(input);let best=Infinity,winning=null;for(const r of pp){const d=partDistance(r,p);if(d<best-1e-12){best=d;winning=r;}}if(!winning)return {distance:Infinity,inside:false,occupancy:false,objectId:0,materialRole:0,local:copy(p),normal:[0,1,0],part:null};const q=inversePoint(winning,p);return {distance:best,inside:best<0,occupancy:best<=0,objectId:winning.objectId,materialRole:winning.materialRole,local:q,normal:axesDirection(winning,partLocalNormal(winning,q)),part:winning.part,instanceId:winning.instanceId,nodeId:winning.nodeId};}
export const queryAperture=queryApertures;
export function apertureNormal(input,p){return queryApertures(input,p).normal;}
export function apertureMaterialDirection(input,objectId,d){if(!finite(d,3))throw Error('Finite material direction required');const p=parts(input).find(x=>x.objectId===objectId);if(!p)throw Error('Unknown aperture objectId');return inverseDirection(p,d);}

// Convex 2D rounded rectangle = two central rectangles + four complete discs.
// Each component lies inside it and their union is exactly the rounded rectangle.
// Its intersection with a line is convex, so the hull of valid intervals is exact.
function slabInterval(o,d,lo,hi){if(d===0)return o>=lo&&o<=hi?[-INF,INF]:null;const a=(lo-o)/d,b=(hi-o)/d;return a<=b?[a,b]:[b,a];}
function intersection(a,b){if(!a||!b)return null;const lo=Math.max(a[0],b[0]),hi=Math.min(a[1],b[1]);return lo<=hi?[lo,hi]:null;}
function box2Interval(o,d,h){return intersection(slabInterval(o[0],d[0],-h[0],h[0]),slabInterval(o[1],d[1],-h[1],h[1]));}
function discInterval(o,d,c,r){const q=sub(o,c),a=dot(d,d),b=dot(q,d),cc=dot(q,q)-r*r;if(a===0)return cc<=0?[-INF,INF]:null;const det=b*b-a*cc,tol=16*Number.EPSILON*(Math.abs(b*b)+Math.abs(a*cc));if(det < -tol)return null;const root=Math.sqrt(Math.max(0,det));if(root===0)return[-b/a,-b/a];const v=-b-(b<0?-root:root),t1=v/a,t2=cc/v;return t1<=t2?[t1,t2]:[t2,t1];}
function planInterval(o,d,r){const q=sub(o.slice(0,2),r.center),v=d.slice(0,2);if(r.radius===0)return box2Interval(q,v,r.half);const h=r.half.map(x=>x-r.radius),all=[box2Interval(q,v,[h[0],r.half[1]]),box2Interval(q,v,[r.half[0],h[1]])];for(const sx of [-1,1])for(const sy of [-1,1])all.push(discInterval(q,v,[sx*h[0],sy*h[1]],r.radius));const good=all.filter(Boolean);return good.length?[Math.min(...good.map(x=>x[0])),Math.max(...good.map(x=>x[1]))]:null;}
// Outer halfspaces and quadratics are intersected with a finite base-ray span.
// Inner cutters remain unbounded so a clipped domain endpoint is never
// mistaken for the cutter's actual boundary during CSG subtraction.
// An affine rounded-rectangle level set is convex, including negative radius
// levels: below -radius it is an inset box, NOT a negative-radius round corner.
function halfspace(iv,o,d){if(!iv)return null;if(d===0)return o>=0?iv:null;const t=-o/d;return intersection(iv,d>0?[t,INF]:[-INF,t]);}
function affineBox(iv,q,d,h,R,Rd,axis=null){for(let k=0;k<2;k++){const varying=axis===null||axis===k;iv=halfspace(iv,h[k]+(varying?R:0)-q[k],(varying?Rd:0)-d[k]);iv=halfspace(iv,h[k]+(varying?R:0)+q[k],(varying?Rd:0)+d[k]);}return iv;}
function coneInterval(q,d,R,Rd,domain){
 if(!domain)return null;const A=dot(d,d)-Rd*Rd,B=dot(q,d)-R*Rd,C=dot(q,q)-R*R;
 if(A===0)return halfspace(domain,-C,-2*B);
 const D=B*B-A*C,tol=32*Number.EPSILON*(Math.abs(B*B)+Math.abs(A*C));
 if(D < -tol)return A<0?domain:null;
 const root=Math.sqrt(Math.max(0,D)),v=-B-(B<0?-root:root);let a,b;if(v===0){a=b=-B/A;}else{a=v/A;b=C/v;if(a>b)[a,b]=[b,a];}
 if(A>0)return intersection(domain,[a,b]);
 const spans=[intersection(domain,[-INF,a]),intersection(domain,[b,INF])].filter(Boolean);return spans.length?[Math.min(...spans.map(x=>x[0])),Math.max(...spans.map(x=>x[1]))]:null;
}
function affinePlanInterval(o,d,r,level,levelD,domain){
 const q=sub(o.slice(0,2),r.center),v=d.slice(0,2),h=r.half.map(x=>x-r.radius),R=r.radius+level,Rd=levelD;
 const intervals=[affineBox(halfspace(domain,-R,-Rd),q,v,h,R,Rd)],positive=halfspace(domain,R,Rd);
 if(positive){intervals.push(affineBox(positive,q,v,h,R,Rd,0),affineBox(positive,q,v,h,R,Rd,1));for(const sx of [-1,1])for(const sy of [-1,1])intervals.push(coneInterval(sub(q,[sx*h[0],sy*h[1]]),v,R,Rd,positive));}
 const good=intervals.filter(Boolean);return good.length?[Math.min(...good.map(x=>x[0])),Math.max(...good.map(x=>x[1]))]:null;
}
function subtractInterval(spans,cut){if(!cut)return spans;const result=[];for(const a of spans){if(cut[1]<a[0]||cut[0]>a[1]){result.push(a);continue;}if(cut[0]>=a[0])result.push([a[0],Math.min(a[1],cut[0])]);if(cut[1]<=a[1])result.push([Math.max(a[0],cut[1]),a[1]]);}return result;}
function partIntervals(r,ro,rd){
 let o=inversePoint(r,ro);const d=inverseDirection(r,rd);let outer=intersection(planInterval(o,d,r.outer),slabInterval(o[2],d[2],-r.halfDepth,r.halfDepth));if(!outer)return [];
 if(!(r.frontBevel>0)||Math.max(o[2]+d[2]*outer[0],o[2]+d[2]*outer[1])<=r.halfDepth-r.frontBevel)return r.inner?subtractInterval([outer],planInterval(o,d,r.inner)):[outer];
 // Rebase to the finite primitive span to avoid distant-camera cancellation in
 // cone coefficients. This never advances a ray by an arbitrary minimum step.
 const anchor=(outer[0]+outer[1])/2;o=add(o,mul(d,anchor));outer=outer.map(t=>t-anchor);
 outer=affinePlanInterval(o,d,r.outer,r.halfDepth-r.frontBevel-o[2],-d[2],outer);if(!outer)return [];
 let result=[outer];if(r.inner){result=subtractInterval(result,planInterval(o,d,r.inner));result=subtractInterval(result,affinePlanInterval(o,d,r.inner,o[2]-r.halfDepth+r.frontBevel,d[2],[-INF,INF]));}
 return result.map(iv=>iv.map(t=>t+anchor));
}
/** Complete intervals, up to three per chamfered ring, in unit ray metres. */
export function apertureOccludesSegment(part,origin,direction,minT,maxT){if(!part||!finite(origin,3)||!finite(direction,3)||Math.abs(length(direction)-1)>1e-6||!Number.isFinite(minT)||!Number.isFinite(maxT)||minT<0||maxT<minT)throw Error('Primitive, unit world ray and ordered finite metre range required');return partIntervals(part,origin,direction).some(iv=>Math.max(iv[0],minT)<Math.min(iv[1],maxT));}
export function aperturePartRayIntervals(input,objectId,origin,direction){if(!finite(origin,3)||!finite(direction,3)||length(direction)<1e-14)throw Error('Finite interval ray required');const p=parts(input).find(p=>p.objectId===objectId);if(!p)throw Error('Unknown aperture objectId');return partIntervals(p,origin,unit(direction));}
function pointBounds(p,b,e=EPS){return p.every((x,i)=>x>=b.min[i]-e&&x<=b.max[i]+e);}
/** Final union validation uses an analytic normal-line interval, not a probe step.
 * A candidate's outward open half-neighbourhood must not be filled by another
 * component. Small comparisons acknowledge floating point, never hide exhaustion.
 */
function outwardCovered(pp,r,p,n){for(const other of pp){if(other===r||!pointBounds(p,other.bounds))continue;for(const iv of partIntervals(other,p,n))if(iv[0]<=EPS&&iv[1]>EPS)return true;}return false;}
function intervalNormal(r,worldPoint){return axesDirection(r,partLocalNormal(r,inversePoint(r,worldPoint)));}
export function intersectAperturesRay(input,origin,direction,{maxDistance=10000,minDistance=0,skipGlass=false,skipObjectId=0}={}){
 if(!finite(origin,3)||!finite(direction,3)||length(direction)<1e-14||!Number.isFinite(maxDistance)||maxDistance<=0||!Number.isFinite(minDistance)||minDistance<0||minDistance>maxDistance||typeof skipGlass!=='boolean'||!Number.isInteger(skipObjectId)||skipObjectId<0)throw Error('Valid aperture ray and range required');
 const rd=unit(direction),pp=parts(input).filter(p=>(!skipGlass||p.part!=='glass')&&p.objectId!==skipObjectId);let t=maxDistance,win=null,normal=null,grazing=false,visits=0;
 for(const r of pp){const intervals=partIntervals(r,origin,rd);visits++;for(const iv of intervals)for(const candidate of iv){if(candidate<minDistance||candidate>t||candidate>=INF/2)continue;const point=add(origin,mul(rd,candidate)),n=intervalNormal(r,point);if(!partIntervals(r,point,mul(n,-1)).some(v=>v[0]<=EPS&&v[1]>EPS)||outwardCovered(pp,r,point,n))continue;if(win&&Math.abs(candidate-t)<EPS&&r.objectId>win.objectId)continue;t=candidate;win=r;normal=n;grazing=Math.abs(dot(rd,n))<1e-6||Math.abs(iv[1]-iv[0])<EPS;}}
 if(!win)return {hit:false,status:'miss',visits,method:'analytic_rounded_rectangle_affine_chamfer_csg_intervals'};
 const point=add(origin,mul(rd,t));return {hit:true,status:grazing?'grazing':'hit',t,point,normal,local:inversePoint(win,point),distance:partDistance(win,point),inside:false,objectId:win.objectId,materialRole:win.materialRole,part:win.part,instanceId:win.instanceId,nodeId:win.nodeId,visits,method:'analytic_rounded_rectangle_affine_chamfer_csg_intervals'};
}
export const intersectApertureRay=intersectAperturesRay;
/** A convex finite pane's exact physical interval. A start inside the pane has
 * pathLength=exit; a start outside has pathLength=exit-entry. Unit metres always.
 */
export function apertureGlassInterval(input,objectId,origin,direction){if(!finite(origin,3)||!finite(direction,3)||length(direction)<1e-14)throw Error('Finite glass ray required');const r=parts(input).find(p=>p.objectId===objectId&&p.part==='glass');if(!r)return {hit:false,status:'unknown_glass'};const rd=unit(direction),iv=partIntervals(r,origin,rd)[0];if(!iv||iv[1]<0)return {hit:false,status:'miss'};const entry=Math.max(0,iv[0]),exit=iv[1],exitPoint=add(origin,mul(rd,exit));return {hit:true,status:exit-entry<EPS?'grazing':'hit',entry,exit,pathLength:exit-entry,exitPoint,exitNormal:intervalNormal(r,exitPoint),objectId,materialRole:6};}

/** Deterministic real geometry witnesses for CPU/GPU ray, distance and normal QA.
 * World coordinates use each component's current rigid frame and stable ID.
 * Approach is only test-ray construction, not a renderer marching increment.
 */
export function apertureBevelProbeRays(input){const result=[];for(const p of parts(input)){if(!(p.frontBevel>0))continue;const b=p.frontBevel,z=p.halfDepth-b/2,S=Math.SQRT1_2,out=p.outer,inner=p.inner;
 const addProbe=(name,q,n)=>{const point=axesPoint(p,q),normal=axesDirection(p,n);result.push({name:p.part+'_'+name,objectId:p.objectId,part:p.part,instanceId:p.instanceId,local:q,expectedPoint:point,expectedNormal:normal,origin:add(point,mul(normal,.01)),direction:mul(normal,-1),expectedT:.01,frontBevel:b});};
 addProbe('outer_straight',[out.center[0]+out.half[0]-b/2,out.center[1],z],[S,0,S]);
 if(inner){addProbe('inner_straight',[inner.center[0]+inner.half[0]+b/2,inner.center[1],z],[-S,0,S]);addProbe('front_plane',[(out.center[0]+out.half[0]+inner.center[0]+inner.half[0])/2,out.center[1],p.halfDepth],[0,0,1]);}
 const a=.61,n=[Math.cos(a),Math.sin(a)];if(out.radius>b/2)addProbe('outer_corner',[out.center[0]+out.half[0]-out.radius+(out.radius-b/2)*n[0],out.center[1]+out.half[1]-out.radius+(out.radius-b/2)*n[1],z],[n[0]*S,n[1]*S,S]);
 if(inner)addProbe('inner_corner',[inner.center[0]+inner.half[0]-inner.radius+(inner.radius+b/2)*n[0],inner.center[1]+inner.half[1]-inner.radius+(inner.radius+b/2)*n[1],z],[-n[0]*S,-n[1]*S,S]);
 }return result;}

/** Float RGBA function records, never model vertices or an index buffer. */
export function packApertureDescriptors(input){const pp=parts(input),records=1+9*pp.length,width=Math.min(128,2**Math.ceil(Math.log2(Math.max(1,Math.sqrt(records))))),height=Math.ceil(records/width),data=new Float32Array(width*height*4);data.set([pp.length,9,0,0]);const put=(i,v)=>data.set(v,4*i);pp.forEach((p,k)=>{const i=1+9*k;put(i,[...p.origin,p.inner?1:0]);put(i+1,[...p.u,p.objectId]);put(i+2,[...p.v,p.materialRole]);put(i+3,[...p.w,p.halfDepth]);put(i+4,[...p.outer.center,...p.outer.half]);put(i+5,[p.outer.radius,p.inner?.radius??0,p.instanceId,p.frontBevel??0]);put(i+6,p.inner?[...p.inner.center,...p.inner.half]:[0,0,0,0]);put(i+7,[...p.bounds.min,0]);put(i+8,[...p.bounds.max,0]);});return {data,width,height,primitiveCount:pp.length,records,recordStride:9,format:'RGBA32F_function_parameters_not_model_geometry'};}

/** Same parameter records and interval algebra as CPU. The code is independent
 * of instance count; changing a pose uploads records rather than recompiling.
 * A complete analytic candidate pass is finite. No step budget or hidden mesh.
 */
export function buildAperturesGLSL(input){specs(input);return `
${APERTURE_STRUCT}
uniform highp sampler2D uApertureDescriptors;
const float apertureINF=1e30;
// GPU tolerance is in metres; it is not an advancement step or glass thickness.
const float apertureEPS=0.000002;
struct AperturePart{vec3 origin;vec3 u;vec3 v;vec3 w;vec4 outer;vec4 inner;vec2 radii;float halfDepth;float frontBevel;float objectId;float role;bool hasInner;vec3 low;vec3 high;};
vec4 apertureRecord(int i){ivec2 s=textureSize(uApertureDescriptors,0);return texelFetch(uApertureDescriptors,ivec2(i%s.x,i/s.x),0);}
AperturePart apertureLoad(int k){int b=1+9*k;AperturePart p;vec4 a=apertureRecord(b),u=apertureRecord(b+1),v=apertureRecord(b+2),w=apertureRecord(b+3);p.origin=a.xyz;p.hasInner=a.w>.5;p.u=u.xyz;p.objectId=u.w;p.v=v.xyz;p.role=v.w;p.w=w.xyz;p.halfDepth=w.w;p.outer=apertureRecord(b+4);p.radii=apertureRecord(b+5).xy;p.frontBevel=apertureRecord(b+5).w;p.inner=apertureRecord(b+6);p.low=apertureRecord(b+7).xyz;p.high=apertureRecord(b+8).xyz;return p;}
vec3 aperturePartDirection(AperturePart p,vec3 d){return vec3(dot(d,p.u),dot(d,p.v),dot(d,p.w));}
vec3 aperturePartLocal(AperturePart p,vec3 x){return aperturePartDirection(p,x-p.origin);}
vec3 aperturePartWorldDirection(AperturePart p,vec3 d){return p.u*d.x+p.v*d.y+p.w*d.z;}
float apertureRectDistance(vec2 p,vec4 r,float radius){vec2 q=abs(p-r.xy)-r.zw+radius;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;}
vec2 apertureRectNormal(vec2 p,vec4 r,float radius){vec2 v=p-r.xy,q=abs(v)-r.zw+radius,o=max(q,0.0),sg=vec2(v.x<0.0?-1.0:1.0,v.y<0.0?-1.0:1.0);if(dot(o,o)>1e-20)return normalize(o)*sg;return q.x>q.y?vec2(sg.x,0):vec2(0,sg.y);}
float aperturePartLocalDistance(AperturePart p,vec3 q){float a=apertureRectDistance(q.xy,p.outer,p.radii.x),b=abs(q.z)-p.halfDepth,d=length(max(vec2(a,b),0.0))+min(max(a,b),0.0),inner=p.hasInner?-apertureRectDistance(q.xy,p.inner,p.radii.y):-apertureINF;float f=max(d,inner);if(p.frontBevel>0.0){float front=q.z-p.halfDepth+p.frontBevel;f=max(f,max(a+front,inner+front)*0.7071067811865476);}return f;}
vec3 aperturePartLocalNormal(AperturePart p,vec3 q){float a=apertureRectDistance(q.xy,p.outer,p.radii.x),b=abs(q.z)-p.halfDepth,f=length(max(vec2(a,b),0.0))+min(max(a,b),0.0),nz=q.z<0.0?-1.0:1.0;vec2 na=apertureRectNormal(q.xy,p.outer,p.radii.x);vec3 n=a>0.0&&b>0.0?normalize(vec3(na*a,nz*b)):(a>b?vec3(na,0):vec3(0,0,nz));float inner=p.hasInner?-apertureRectDistance(q.xy,p.inner,p.radii.y):-apertureINF;if(inner>f+1e-7){f=inner;n=vec3(-apertureRectNormal(q.xy,p.inner,p.radii.y),0);}if(p.frontBevel>0.0){float front=q.z-p.halfDepth+p.frontBevel,outerChamfer=(a+front)*0.7071067811865476,innerChamfer=(inner+front)*0.7071067811865476;if(outerChamfer>f+1e-7){f=outerChamfer;n=vec3(na,1)*0.7071067811865476;}if(innerChamfer>f+1e-7)n=vec3(-apertureRectNormal(q.xy,p.inner,p.radii.y),1)*0.7071067811865476;}return n;}
vec2 apertureInvalid(){return vec2(1.0,-1.0);}
bool apertureValid(vec2 v){return v.x<=v.y;}
vec2 apertureIntersect(vec2 a,vec2 b){if(!apertureValid(a)||!apertureValid(b))return apertureInvalid();return vec2(max(a.x,b.x),min(a.y,b.y));}
vec2 apertureSlab(float o,float d,float lo,float hi){if(d==0.0)return o>=lo&&o<=hi?vec2(-apertureINF,apertureINF):apertureInvalid();vec2 v=(vec2(lo,hi)-o)/d;return vec2(min(v.x,v.y),max(v.x,v.y));}
vec2 apertureBox2(vec2 o,vec2 d,vec2 h){return apertureIntersect(apertureSlab(o.x,d.x,-h.x,h.x),apertureSlab(o.y,d.y,-h.y,h.y));}
vec2 apertureDisc(vec2 o,vec2 d,vec2 center,float r){vec2 q=o-center;float a=dot(d,d);if(a==0.0)return dot(q,q)<=r*r?vec2(-apertureINF,apertureINF):apertureInvalid();float mid=-dot(q,d)/a;vec2 nearest=q+d*mid;float discriminant=r*r-dot(nearest,nearest);if(discriminant<0.0)return apertureInvalid();float span=sqrt(discriminant/a);return vec2(mid-span,mid+span);}
void apertureHull(inout vec2 a,vec2 b){if(!apertureValid(b))return;if(!apertureValid(a))a=b;else a=vec2(min(a.x,b.x),max(a.y,b.y));}
vec2 aperturePlanInterval(vec3 o,vec3 d,vec4 r,float radius){vec2 q=o.xy-r.xy;if(radius==0.0)return apertureBox2(q,d.xy,r.zw);vec2 h=max(r.zw-radius,0.0),iv=apertureBox2(q,d.xy,vec2(h.x,r.w));apertureHull(iv,apertureBox2(q,d.xy,vec2(r.z,h.y)));for(int i=0;i<4;i++){vec2 center=vec2((i&1)==0?-h.x:h.x,(i&2)==0?-h.y:h.y);apertureHull(iv,apertureDisc(q,d.xy,center,radius));}return iv;}
// Complete ring representation: subtraction of two convex cutters can create
// THREE spans. No vec4 truncation, no traversal budget and no distance stepping.
struct ApertureIntervals{vec2 a;vec2 b;vec2 c;};
ApertureIntervals apertureEmptyIntervals(){return ApertureIntervals(apertureInvalid(),apertureInvalid(),apertureInvalid());}
vec2 apertureSpan(ApertureIntervals iv,int k){return k==0?iv.a:(k==1?iv.b:iv.c);}
void apertureAppend(inout ApertureIntervals iv,vec2 span){if(!apertureValid(span))return;if(!apertureValid(iv.a))iv.a=span;else if(!apertureValid(iv.b))iv.b=span;else iv.c=span;}
vec2 apertureHalfspace(vec2 iv,float o,float d){if(!apertureValid(iv))return apertureInvalid();if(d==0.0)return o>=0.0?iv:apertureInvalid();float t=-o/d;return apertureIntersect(iv,d>0.0?vec2(t,apertureINF):vec2(-apertureINF,t));}
vec2 apertureAffineBox(vec2 iv,vec2 q,vec2 d,vec2 h,float R,float Rd,int axis){for(int k=0;k<2;k++){bool varying=axis<0||axis==k;float r=varying?R:0.0,rd=varying?Rd:0.0;iv=apertureHalfspace(iv,h[k]+r-q[k],rd-d[k]);iv=apertureHalfspace(iv,h[k]+r+q[k],rd+d[k]);}return iv;}
vec2 apertureCone(vec2 q,vec2 d,float R,float Rd,vec2 domain){
 if(!apertureValid(domain))return apertureInvalid();float A=dot(d,d)-Rd*Rd,B=dot(q,d)-R*Rd,C=dot(q,q)-R*R;if(A==0.0)return apertureHalfspace(domain,-C,-2.0*B);
 float D=B*B-A*C;if(D<0.0)return A<0.0?domain:apertureInvalid();float root=sqrt(max(0.0,D)),v=-B-(B<0.0?-root:root),a,b;if(v==0.0){a=-B/A;b=a;}else{a=v/A;b=C/v;if(a>b){float t=a;a=b;b=t;}}
 if(A>0.0)return apertureIntersect(domain,vec2(a,b));vec2 result=apertureIntersect(domain,vec2(-apertureINF,a));apertureHull(result,apertureIntersect(domain,vec2(b,apertureINF)));return result;
}
vec2 apertureAffinePlanInterval(vec3 o,vec3 d,vec4 rect,float radius,float level,float levelD,vec2 domain){
 vec2 q=o.xy-rect.xy,h=rect.zw-radius;float R=radius+level,Rd=levelD;vec2 result=apertureAffineBox(apertureHalfspace(domain,-R,-Rd),q,d.xy,h,R,Rd,-1),positive=apertureHalfspace(domain,R,Rd);
 if(apertureValid(positive)){apertureHull(result,apertureAffineBox(positive,q,d.xy,h,R,Rd,0));apertureHull(result,apertureAffineBox(positive,q,d.xy,h,R,Rd,1));for(int k=0;k<4;k++){vec2 center=vec2((k&1)==0?-h.x:h.x,(k&2)==0?-h.y:h.y);apertureHull(result,apertureCone(q-center,d.xy,R,Rd,positive));}}return result;
}
ApertureIntervals apertureSubtract(ApertureIntervals iv,vec2 cut){if(!apertureValid(cut))return iv;ApertureIntervals result=apertureEmptyIntervals();for(int k=0;k<3;k++){vec2 a=apertureSpan(iv,k);if(!apertureValid(a))continue;if(cut.y<a.x||cut.x>a.y){apertureAppend(result,a);continue;}if(cut.x>=a.x)apertureAppend(result,vec2(a.x,min(a.y,cut.x)));if(cut.y<=a.y)apertureAppend(result,vec2(max(a.x,cut.y),a.y));}return result;}
ApertureIntervals apertureIntervals(AperturePart p,vec3 ro,vec3 rd){
 vec3 o=aperturePartLocal(p,ro),d=aperturePartDirection(p,rd);vec2 outer=apertureIntersect(aperturePlanInterval(o,d,p.outer,p.radii.x),apertureSlab(o.z,d.z,-p.halfDepth,p.halfDepth));ApertureIntervals result=apertureEmptyIntervals();if(!apertureValid(outer))return result;
 if(!(p.frontBevel>0.0)||max(o.z+d.z*outer.x,o.z+d.z*outer.y)<=p.halfDepth-p.frontBevel){result.a=outer;return p.hasInner?apertureSubtract(result,aperturePlanInterval(o,d,p.inner,p.radii.y)):result;}
 float anchor=(outer.x+outer.y)*0.5;o+=d*anchor;outer-=anchor;outer=apertureAffinePlanInterval(o,d,p.outer,p.radii.x,p.halfDepth-p.frontBevel-o.z,-d.z,outer);if(!apertureValid(outer))return result;result.a=outer;
 if(p.hasInner){result=apertureSubtract(result,aperturePlanInterval(o,d,p.inner,p.radii.y));result=apertureSubtract(result,apertureAffinePlanInterval(o,d,p.inner,p.radii.y,o.z-p.halfDepth+p.frontBevel,d.z,vec2(-apertureINF,apertureINF)));}
 if(apertureValid(result.a))result.a+=anchor;if(apertureValid(result.b))result.b+=anchor;if(apertureValid(result.c))result.c+=anchor;return result;
}
bool aperturePositiveNeighbour(ApertureIntervals iv){for(int k=0;k<3;k++){vec2 span=apertureSpan(iv,k);if(apertureValid(span)&&span.x<=apertureEPS&&span.y>apertureEPS)return true;}return false;}
// Light visibility uses the same exact analytic shape, not material-normal bias.
// rd must be unit length; minT/maxT are metre ranges, never marching steps.
bool apertureOccludesSegment(AperturePart p,vec3 ro,vec3 rd,float minT,float maxT){ApertureIntervals iv=apertureIntervals(p,ro,rd);for(int k=0;k<3;k++){vec2 span=apertureSpan(iv,k);if(apertureValid(span)&&max(span.x,minT)<min(span.y,maxT))return true;}return false;}
bool apertureInBounds(AperturePart p,vec3 q){return all(greaterThanEqual(q,p.low-vec3(apertureEPS)))&&all(lessThanEqual(q,p.high+vec3(apertureEPS)));}
bool apertureOutwardCovered(int own,vec3 point,vec3 normal,bool skipGlass,float skipObjectId){int count=int(apertureRecord(0).x);for(int k=0;k<count;k++){if(k==own)continue;AperturePart p=apertureLoad(k);if((skipGlass&&p.role==6.0)||p.objectId==skipObjectId||!apertureInBounds(p,point))continue;if(aperturePositiveNeighbour(apertureIntervals(p,point,normal)))return true;}return false;}
FieldHit mapField(vec3 point){FieldHit h;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=point;int count=int(apertureRecord(0).x);for(int k=0;k<count;k++){AperturePart p=apertureLoad(k);vec3 q=aperturePartLocal(p,point);float d=aperturePartLocalDistance(p,q);if(d<h.distance-1e-8){h.distance=d;h.objectId=p.objectId;h.materialRole=p.role;h.local=q;}}return h;}
float mapDistance(vec3 p){return mapField(p).distance;}
vec3 fieldNormal(vec3 point){FieldHit h=mapField(point);int count=int(apertureRecord(0).x);for(int k=0;k<count;k++){AperturePart p=apertureLoad(k);if(p.objectId==h.objectId)return normalize(aperturePartWorldDirection(p,aperturePartLocalNormal(p,h.local)));}return vec3(0,1,0);}
vec3 apertureMaterialDirection(float objectId,vec3 direction){int count=int(apertureRecord(0).x);for(int k=0;k<count;k++){AperturePart p=apertureLoad(k);if(p.objectId==objectId)return aperturePartDirection(p,direction);}return direction;}
vec3 fieldRayNormal=vec3(0,1,0);
bool apertureRayGrazing=false;
bool apertureTraceRayFiltered(vec3 ro,vec3 rd,bool skipGlass,float skipObjectId,out float t,out FieldHit h,out int visits){t=1e20;visits=0;bool found=false;apertureRayGrazing=false;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=ro;int count=int(apertureRecord(0).x);for(int k=0;k<count;k++){AperturePart p=apertureLoad(k);if((skipGlass&&p.role==6.0)||p.objectId==skipObjectId)continue;ApertureIntervals iv=apertureIntervals(p,ro,rd);visits++;for(int segment=0;segment<3;segment++){vec2 span=apertureSpan(iv,segment);if(!apertureValid(span))continue;for(int endpoint=0;endpoint<2;endpoint++){float candidate=endpoint==0?span.x:span.y;if(candidate<0.0||candidate>t||candidate>1e19)continue;vec3 point=ro+rd*candidate,q=aperturePartLocal(p,point),n=normalize(aperturePartWorldDirection(p,aperturePartLocalNormal(p,q)));if(!aperturePositiveNeighbour(apertureIntervals(p,point,-n))||apertureOutwardCovered(k,point,n,skipGlass,skipObjectId))continue;if(found&&abs(candidate-t)<apertureEPS&&p.objectId>h.objectId)continue;t=candidate;h.distance=aperturePartLocalDistance(p,q);h.objectId=p.objectId;h.materialRole=p.role;h.local=q;fieldRayNormal=n;apertureRayGrazing=abs(dot(rd,n))<1e-6||abs(span.y-span.x)<apertureEPS;found=true;}}}return found;}
bool caseTraceRay(vec3 ro,vec3 rd,out float t,out FieldHit h,out int visits){return apertureTraceRayFiltered(ro,rd,false,0.0,t,h,visits);}
bool apertureGlassExit(float objectId,vec3 ro,vec3 rd,out float pathLength,out vec3 exitNormal,out vec3 exitPoint){pathLength=0.0;exitNormal=vec3(0,1,0);exitPoint=ro;int count=int(apertureRecord(0).x);for(int k=0;k<count;k++){AperturePart p=apertureLoad(k);if(p.objectId!=objectId||p.role!=6.0)continue;vec2 iv=apertureIntervals(p,ro,rd).a;if(!apertureValid(iv)||iv.y<0.0)return false;pathLength=iv.y-max(iv.x,0.0);exitPoint=ro+rd*iv.y;exitNormal=normalize(aperturePartWorldDirection(p,aperturePartLocalNormal(p,aperturePartLocal(p,exitPoint))));return true;}return false;}
`;}
export const buildApertureGLSL=buildAperturesGLSL;
