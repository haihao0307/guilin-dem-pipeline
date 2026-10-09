import initJolt from './vendor/jolt-physics.wasm-compat.js';

const sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]);
const scale=(a,s)=>a.map(v=>v*s),length=a=>Math.hypot(...a),dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0);
const vec=v=>[v.GetX(),v.GetY(),v.GetZ()];
const valid=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
let modulePromise;
export const loadJolt=()=>modulePromise??=initJolt().catch(e=>{modulePromise=null;throw e;});

/** Actual Jolt WASM narrow-phase queries, not a rigid-body dynamics solver.
 * World axes: metres, Y up. Sphere attacker versus a translating capsule.
 * Capsule orientation is frozen at the start of each fixed step; rotating
 * target CCD is therefore approximate. Call at <= 1/120 s. Visual geometry
 * and animation target poses remain separate from these collision proxies.
 */
export class CollisionWorld {
 static async create(options={}){return new CollisionWorld(await loadJolt(),options);}
 constructor(J,{minimumClosingSpeed=.08,cooldown=.18}={}){
  this.J=J;this.minimumClosingSpeed=minimumClosingSpeed;this.cooldown=cooldown;
  this.gates=new Map();this.shapes=new Map();this.disposed=false;this.queries=0;
  const of=new J.ObjectLayerPairFilterTable(1);of.EnableCollision(0,0);
  const bp=new J.BroadPhaseLayerInterfaceTable(1,1),layer=new J.BroadPhaseLayer(0);bp.MapObjectToBroadPhaseLayer(0,layer);J.destroy(layer);
  const bf=new J.ObjectVsBroadPhaseLayerFilterTable(bp,1,of,1),settings=new J.JoltSettings();
  settings.mObjectLayerPairFilter=of;settings.mBroadPhaseLayerInterface=bp;settings.mObjectVsBroadPhaseLayerFilter=bf;
  this.world=new J.JoltInterface(settings);J.destroy(settings);
  this.settings=new J.ShapeCastSettings();this.settings.mReturnDeepestPoint=true;
  this.filter=new J.ShapeFilter();this.collector=new J.CastShapeClosestHitCollisionCollector();
  this.one=new J.Vec3(1,1,1);this.zero=new J.RVec3(0,0,0);this.identity=new J.Quat(0,0,0,1);
 }
 shape(kind,radius,halfHeight=0){
  if(!(Number.isFinite(radius)&&radius>0&&Number.isFinite(halfHeight)&&halfHeight>=0))throw Error('Invalid proxy dimensions');
  const key=[kind,radius,halfHeight].join(':');if(!this.shapes.has(key)){
   const shape=kind==='sphere'?new this.J.SphereShape(radius):new this.J.CapsuleShape(halfHeight,radius);
   shape.AddRef();this.shapes.set(key,shape);
  }return this.shapes.get(key);
 }
 /** Raw cast used by both diagnostics and contact policy. No animation state
  * is consulted. Target translation is subtracted from the swept glove path.
  * The returned normal points FROM the glove INTO the target.
  */
 cast({from,to,radius,target}){
  if(this.disposed)throw Error('Collision world disposed');
  for(const p of [from,to,target.from,target.to])if(!valid(p))throw Error('Non-finite world position');
  const J=this.J,owned=[],own=x=>(owned.push(x),x),tMove=sub(target.to,target.from),relative=sub(sub(to,from),tMove);
  const shape=this.shape('sphere',radius),targetShape=this.shape(target.halfHeight>0?'capsule':'sphere',target.radius,target.halfHeight||0);
  try{
   const ts=own(new J.TransformedShape());ts.mShape=targetShape;
   const pos=own(new J.RVec3(...target.from)),q=target.rotation||[0,0,0,1];
   if(q.length!==4||!q.every(Number.isFinite)||Math.abs(Math.hypot(...q)-1)>1e-4)throw Error('Target rotation must be a unit xyzw quaternion');
   const rotation=own(new J.Quat(...q));ts.SetWorldTransform(pos,rotation,this.one);
   const start=own(new J.RVec3(...from)),matrix=own(J.RMat44.prototype.sRotationTranslation(this.identity,start)),direction=own(new J.Vec3(...relative));
   const cast=own(new J.RShapeCast(shape,this.one,matrix,direction));this.collector.Reset();this.queries++;
   ts.CastShape(cast,this.settings,this.zero,this.collector,this.filter);
   if(!this.collector.HadHit())return null;
   const h=this.collector.mHit,axis=vec(h.mPenetrationAxis),n=length(axis);if(n<1e-9)return null;
   const toi=h.mFraction;
   return {toi,contactPoint:add(vec(h.mContactPointOn2),scale(tMove,toi)),normal:scale(axis,1/n),relativeDisplacement:relative,penetrationDepth:h.mPenetrationDepth,source:'JoltPhysics.js/1.1.0 WASM TransformedShape.CastShape',proxyApproximation:true,rotationalCCD:false};
  }finally{for(let i=owned.length-1;i>=0;i--)J.destroy(owned[i]);}
 }
 /** Select the earliest target per attacker hand and de-bounce sustained
  * contact. A hand must first miss all opposing proxies before it re-arms.
  * No phase/time-scheduled hit exists. Pass all intended opposing regions.
  */
 step({time,dt,attacks,targets}){
  if(!(Number.isFinite(time)&&Number.isFinite(dt)&&dt>0&&dt<=1/120+1e-9))throw Error('Use fixed dt <= 1/120 s');
  const events=[];
  for(const attack of attacks){
   const key=`${attack.pairId}:${attack.actorId}:${attack.hand}`,gate=this.gates.get(key)||{armed:true,lastHit:-Infinity};let closest=null;
   for(const target of targets){
    if(target.pairId!==attack.pairId||target.actorId===attack.actorId)continue;
    const hit=this.cast({...attack,target});
    if(hit&&(!closest||hit.toi<closest.hit.toi))closest={target,hit};
   }
   if(!closest){gate.armed=true;}else{
    const {target,hit}=closest,relativeVelocity=scale(hit.relativeDisplacement,1/dt),closingSpeed=dot(relativeVelocity,hit.normal);
    if(gate.armed&&time-gate.lastHit>=this.cooldown&&closingSpeed>=this.minimumClosingSpeed){
     events.push({schema:'kaopu-contact-event/1',pairId:attack.pairId,attackerId:attack.actorId,defenderId:target.actorId,hand:attack.hand,bodyRegion:target.bodyRegion,time:time-dt+dt*hit.toi,contactPoint:hit.contactPoint,normal:hit.normal,relativeVelocity,closingSpeed,toi:hit.toi,source:hit.source,confidence:'geometric-proxy',proxyApproximation:true,rotationalCCD:false,impulseSolved:false});
     gate.lastHit=time;gate.armed=false;
    }
   }this.gates.set(key,gate);
  }return events;
 }
 reset(){this.gates.clear();this.queries=0;}
 diagnostics(){return {backend:'JoltPhysics.js',version:'1.1.0',wasm:true,queries:this.queries,cachedShapes:this.shapes.size,solver:'narrow-phase shape cast',rigidBodyDynamics:false,clothSelfCollision:false,clothInterCollision:false};}
 dispose(){if(this.disposed)return;const J=this.J;for(const x of [this.settings,this.filter,this.collector,this.one,this.zero,this.identity])J.destroy(x);for(const shape of this.shapes.values())shape.Release();this.shapes.clear();J.destroy(this.world);this.disposed=true;}
}
