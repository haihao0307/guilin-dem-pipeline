// Opt-in mathematical adapter. Never imports teacher meshes or controls railway equipment.
import {anchorError, transformPoint, crankPin, sliderCrank, placeBuilding,
  facadeGrid, overlaps, crossingInitial, stepCrossing, crossingOutputs} from './source/assembly_rules.mjs';
export const ADAPTER_SCHEMA = 'kaopu.train.assembly.r01';
export const IDENTITY = Object.freeze([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
// Proper rotation, determinant +1: old +X -> new +Z; old +Z -> new -X.
export const BASIS = Object.freeze([0,0,1,0, 0,1,0,0, -1,0,0,0, 0,0,0,1]);
const finite = (x, name) => {if (!Number.isFinite(x)) throw new TypeError(`${name}: finite number required`); return x;};
const positive = (x,name) => {finite(x,name); if(x<=0) throw new RangeError(`${name}: positive number required`); return x;};
const integer = (x,name) => {if(!Number.isSafeInteger(x)||x<0) throw new RangeError(`${name}: nonnegative integer required`); return x;};
const vec = (v,name) => {if(!v||v.length!==3) throw new TypeError(`${name}: vec3 required`); return Array.from(v,(x)=>finite(x,name));};
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const unit = (v) => {v=vec(v,'direction');const n=positive(Math.hypot(...v),'direction length');return v.map(x=>x/n);};
const angle = (a,b,opposed=false) => Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b))*(opposed?-1:1))));
function matrix(m){
  if(!m||m.length!==16) throw new TypeError('column-major mat4 required');
  m=Array.from(m,x=>finite(x,'matrix'));
  if(m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1) throw new TypeError('affine matrix required');
  const det=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);
  if(Math.abs(det)<1e-12) throw new RangeError('singular transform');return m;
}
export function multiply(a,b){a=matrix(a);b=matrix(b);return Array.from({length:16},(_,i)=>{
  const row=i%4,col=Math.floor(i/4);return [0,1,2,3].reduce((s,k)=>s+a[k*4+row]*b[col*4+k],0);
});}
export function legacyVector(v){const [x,y,z]=vec(v,'legacy vector');return [-z,y,x];}
export function assemblyVector(v){const [x,y,z]=vec(v,'assembly vector');return [z,y,-x];}
export function legacyPoint(p,{frame,distance,frontX}){
  p=vec(p,'point');finite(distance,'distance');finite(frontX,'frontX');
  if(!['world','train','render'].includes(frame)) throw new TypeError('explicit world/train/render frame required');
  return legacyVector([p[0]+(frame==='world'?0:distance-frontX),p[1],p[2]]);
}
export function renderedPoint(p,{distance,frontX}){finite(distance,'distance');finite(frontX,'frontX');
  const q=assemblyVector(p);q[0]-=distance-frontX;return q;}
export function renderMatrix(m,{distance,frontX}){
  finite(distance,'distance');finite(frontX,'frontX');const basis=[...BASIS];basis[14]=distance-frontX;
  return multiply(basis,m);
}
export function sessionFrame(view,{tickHz,frontX}){
  positive(tickHz,'tickHz');finite(frontX,'frontX');
  if(view?.version!==1) throw new TypeError('only inspected Session.view version 1 is supported');
  integer(view.tick,'tick');finite(view.elapsed,'elapsed');finite(view.distance,'distance');finite(view.velocity,'velocity');
  if(Math.abs(view.elapsed-view.tick/tickHz)>1e-5) throw new RangeError('Session clock disagrees with tick');
  return {schema:ADAPTER_SCHEMA,unit:'metre',up:'Y',forward:'Z',across:'X',tick:view.tick,
    worldTime:view.tick/tickHz,distance:view.distance,velocity:view.velocity,
    renderOrigin:[0,0,view.distance-frontX],paused:!!view.paused,
    actors:(view.actors||[]).map(a=>({id:a.id,sourceFrame:a.frame,
      position:legacyPoint(a.position,{frame:a.frame,distance:view.distance,frontX})}))};
}
export function wheelKinematics({distance,radius,phase,rotationSign,crankRadius,rodLength}){
  finite(distance,'distance');positive(radius,'rolling radius');finite(phase,'explicit crank phase');
  if(![-1,1].includes(rotationSign)) throw new TypeError('explicit rolling direction required');
  const theta=rotationSign*distance/radius;
  const result={crankParameterAngle:theta,rotationAboutX:-(theta+phase),phase,axis:[1,0,0],assumption:'no-slip; radius and phase are caller declarations'};
  if(crankRadius!==undefined||rodLength!==undefined){finite(crankRadius,'crank radius');positive(rodLength,'rod length');
    result.pin=crankPin({center:[0,0,0],radius:crankRadius,phase,angle:theta});
    result.slider=sliderCrank({angle:theta,phase,radius:crankRadius,rodLength});
  }return result;
}
// Read actual Three Object3D transforms. An InstancedMesh is NOT a single mechanical part.
export function objectMatrix({object,instanceIndex},view,contract){
  if(!object?.matrixWorld?.elements||typeof object.updateWorldMatrix!=='function') throw new TypeError('live Object3D required');
  object.updateWorldMatrix(true,false);let m=Array.from(object.matrixWorld.elements);
  if(object.isInstancedMesh){integer(instanceIndex,'instanceIndex');if(instanceIndex>=object.count)throw new RangeError('instanceIndex outside mesh');
    const local=object.matrixWorld.clone();object.getMatrixAt(instanceIndex,local);m=multiply(m,local.elements);
  }else if(instanceIndex!==undefined)throw new TypeError('instanceIndex supplied for non-instanced object');
  return renderMatrix(m,{distance:view.distance,frontX:contract.frontX});
}
function direction(m,v){v=vec(v,'axis');return unit([m[0]*v[0]+m[4]*v[1]+m[8]*v[2],m[1]*v[0]+m[5]*v[1]+m[9]*v[2],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]]);}
function normal(m,v){
  // Inverse-transpose via cofactors: different from transforming an axis under scale.
  const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]];
  const cross=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
  const x=cross(b,c),y=cross(c,a),z=cross(a,b),det=dot(a,x);v=vec(v,'contact normal');
  return unit(v.map((_,i)=>(x[i]*v[0]+y[i]*v[1]+z[i]*v[2])/det));
}
export const JOINT_DOF = Object.freeze({fixed:[], 'axle-revolute':['rotate-axis'],
  'axlebox-prismatic':['translate-axis'], 'spring-hanger':['elastic-model-required'], 'brake-pivot':['rotate-axis']});
export function jointReport(a,b,rule){
  a=matrix(a);b=matrix(b);if(!Object.hasOwn(JOINT_DOF,rule.kind))throw new TypeError('explicit supported joint kind required');
  const pa=vec(rule.anchorA,'anchorA'),pb=vec(rule.anchorB,'anchorB'),aa=direction(a,rule.axisA),ab=direction(b,rule.axisB);
  const wa=transformPoint(a,pa),wb=transformPoint(b,pb),delta=wb.map((x,i)=>x-wa[i]);
  const tolerance=positive(rule.toleranceMetres,'position tolerance'),angleTolerance=positive(rule.toleranceRadians,'angle tolerance');
  const axisError=Math.min(angle(aa,ab),angle(aa,ab,true));let residual=anchorError(a,pa,b,pb),withinLimits=true;
  const translation=dot(delta,aa);
  if(rule.kind==='axlebox-prismatic'){
    if(!Array.isArray(rule.limits)||rule.limits.length!==2||!rule.limits.every(Number.isFinite)||rule.limits[0]>rule.limits[1])throw new TypeError('explicit prismatic limits required');
    residual=Math.hypot(...delta.map((x,i)=>x-translation*aa[i]));withinLimits=translation>=rule.limits[0]&&translation<=rule.limits[1];
  }
  let contactNormalError=null;
  if(rule.normalA!==undefined||rule.normalB!==undefined)contactNormalError=angle(normal(a,rule.normalA),normal(b,rule.normalB),true);
  const unresolved=rule.kind==='spring-hanger';
  return {kind:rule.kind,dof:[...JOINT_DOF[rule.kind]],worldAnchorA:wa,worldAnchorB:wb,
    anchorDistance:Math.hypot(...delta),residualMetres:residual,axisErrorRadians:axisError,translation,withinLimits,contactNormalError,
    anchorAndAxisValid:!unresolved&&residual<=tolerance&&axisError<=angleTolerance&&withinLimits&&(contactNormalError===null||contactNormalError<=angleTolerance),
    springModelRequired:unresolved,fullOrientationVerified:false,contactAreaVerified:false,physicsSolved:false};
}
function box(b){const min=vec(b?.min,'box min'),max=vec(b?.max,'box max');if(min.some((x,i)=>x>max[i]))throw new RangeError('inverted box');return{min,max};}
export function sweptStraightBox(bounds,delta){bounds=box(bounds);delta=vec(delta,'sweep displacement');return{
  min:bounds.min.map((v,i)=>v+Math.min(0,delta[i])),max:bounds.max.map((v,i)=>v+Math.max(0,delta[i]))};}
export function buildingRule(p){
  for(const key of ['z','width','depth','height','railHalfWidth','clearance'])finite(p[key],key);
  for(const key of ['setback','groundY'])if(p[key]!==undefined)finite(p[key],key);
  const cameras=(p.cameraVolumes||[]).map(box),rails=(p.railVolumes||[]).map(box);
  const result=placeBuilding({...p,cameraVolumes:cameras});
  const railConflicts=rails.flatMap((b,i)=>overlaps(result.bounds,b)?[i]:[]);
  return {...result,railConflicts,clear:!railConflicts.length&&!result.cameraConflicts.length,scope:'straight-track AABB only; not a camera occlusion proof'};
}
export function facadeAttachment(host,attachment){
  if(typeof host.id!=='string'||!host.id)throw new TypeError('stable host id required');
  for(const key of ['floorHeight','bayWidth','frontX'])finite(host[key],key);
  for(const key of ['baseY','centerZ'])if(host[key]!==undefined)finite(host[key],key);
  integer(attachment.floor,'floor');integer(attachment.bay,'bay');const offset=vec(attachment.localOffset,'explicit localOffset');
  const points=facadeGrid(host);if(attachment.floor>=host.floors||attachment.bay>=host.bays)throw new RangeError('attachment outside host grid');
  const point=points[attachment.floor*host.bays+attachment.bay];
  // localOffset is [along-bay(+Z), vertical(+Y), outward-from-facade].
  return {hostFacade:host.id,floor:attachment.floor,bay:attachment.bay,localOffset:offset,
    point:[point.point[0]-host.side*offset[2],point.point[1]+offset[1],point.point[2]+offset[0]],normal:point.normal};
}
export function validateSensors(input){
  if(!input||['powered','roadClear','request','occupied','reset'].some(k=>typeof input[k]!=='boolean'))throw new TypeError('five explicit boolean detector/controller inputs required');
  return Object.fromEntries(['powered','roadClear','request','occupied','reset'].map(k=>[k,input[k]]));
}
export class TickCrossing {
  constructor({tickHz,warningSeconds=2,gateSeconds=4}={}){
    this.tickHz=positive(tickHz,'tickHz');this.config={warningSeconds:positive(warningSeconds,'warningSeconds'),gateSeconds:positive(gateSeconds,'gateSeconds')};
    this.state=crossingInitial();this.tick=0;this.input=null;
  }
  consume(tick,input){
    integer(tick,'tick');const next=validateSensors(input);
    if(tick!==this.tick&&tick!==this.tick+1)throw new RangeError('missing detector history: consume every authority tick');
    if(tick===this.tick&&this.input){if(JSON.stringify(next)!==JSON.stringify(this.input))throw new RangeError('input changed without an authority tick');return this.outputs();}
    this.state=stepCrossing(this.state,next,(tick-this.tick)/this.tickHz,this.config);
    this.tick=tick;this.state.worldTime=tick/this.tickHz;this.input=next;return this.outputs();
  }
  outputs(){
    if(!this.input)return {roadProceed:false,railProceed:false,fault:true,unresolved:'detectors not connected'};
    const out=crossingOutputs(this.state,this.input);
    // FAULT is logical; an unpowered lamp cannot physically emit light.
    return {...out,redLampLeft:out.redLampLeft&&this.input.powered,redLampRight:out.redLampRight&&this.input.powered,gameOnly:true};
  }
  save(){return {schema:ADAPTER_SCHEMA,tickHz:this.tickHz,config:{...this.config},tick:this.tick,state:{...this.state},input:this.input&&{...this.input}};}
  static restore(packet){
    if(packet?.schema!==ADAPTER_SCHEMA)throw new TypeError('unknown crossing save schema');
    const channel=new TickCrossing({tickHz:packet.tickHz,...packet.config});integer(packet.tick,'saved tick');const s=packet.state;
    if(!s||!['OPEN','PREWARN','LOWERING','CLOSED','TRAIN_IN','OPENING','FAULT'].includes(s.phase))throw new TypeError('invalid saved phase');
    finite(s.gate,'saved gate');finite(s.elapsed,'saved elapsed');finite(s.worldTime,'saved worldTime');
    if(s.gate<0||s.gate>1||s.elapsed<0||Math.abs(s.worldTime-packet.tick/packet.tickHz)>1e-10||
      (['OPEN','PREWARN'].includes(s.phase)&&s.gate!==0)||(['CLOSED','TRAIN_IN'].includes(s.phase)&&s.gate!==1)||
      (s.phase==='PREWARN'&&s.elapsed>=channel.config.warningSeconds))throw new RangeError('inconsistent crossing save');
    channel.tick=packet.tick;channel.state={...s};channel.input=packet.input===null?null:validateSensors(packet.input);return channel;
  }
}
