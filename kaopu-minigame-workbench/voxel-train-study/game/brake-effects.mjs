// Small cinematic friction sparks/haze, not a claim that routine railway braking sparks.
// Sources are fixed to the driving-wheel tread in the direction of the existing shoe.
// The game's scenery moves around a train-centred render origin, as in steam-dynamics.
import * as THREE from '../vendor/three.module.js';
import {STEAM_SPEC} from './steam-model.mjs';
import {brakeDemand} from './brake-effort.mjs';
export {brakeDemand} from './brake-effort.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const smooth=value=>{const x=clamp(value,0,1);return x*x*(3-2*x);};
const hash=value=>{let x=Math.imul(value^0x9e3779b9,0x85ebca6b);x^=x>>>13;return((Math.imul(x,0xc2b2ae35)^(x>>>16))>>>0)/4294967296;};
const timeOf=view=>Number.isFinite(view.elapsed)?view.elapsed:Number.isFinite(view.tick)?view.tick/30:0;
const wheelY=STEAM_SPEC.railHead+STEAM_SPEC.driverRadius,shoeX=.39,shoeY=.89;
const radialLength=Math.hypot(shoeX,shoeY-wheelY),radialX=shoeX/radialLength,radialY=(shoeY-wheelY)/radialLength;

export const BRAKE_EFFECTS_SPEC=Object.freeze({
  version:'r14-cinematic-brake-friction',sparkCapacity:48,hazeCapacity:20,lightCount:2,
  maxSparkRate:44,maxHazeRate:7,maxSparkLifetime:.26,maxHazeLifetime:.62,
  maxSparkLength:.14,maxSparkWidth:.017,maxHazeSize:.45,maxHazeOpacity:.12,
  minimumSpeed:.20,fullSpeed:5.5,fullDeceleration:3.10,maximumCatchUp:.25,
  stopDecay:.09,glowDecay:.055,maxLightIntensity:.65,lightReach:1.05,
  shoeOffset:Object.freeze([shoeX,shoeY,.84]),
  assumptions:'Bounded film/game exaggeration. Existing stylized shoe centres are projected radially onto the actual driver tread; no physical overheating or fluid simulation is implied.',
});

export const BRAKE_EMITTERS=Object.freeze(STEAM_SPEC.driverAxles.flatMap((axle,axleIndex)=>[-1,1].map(side=>Object.freeze({
  index:axleIndex*2+(side>0?1:0),axleIndex,side,
  shoe:Object.freeze([axle+shoeX,shoeY,side*.84]),
  // The outboard tread edge keeps the tiny streak visible without putting it at the hub.
  position:Object.freeze([axle+radialX*STEAM_SPEC.driverRadius,wheelY+radialY*STEAM_SPEC.driverRadius,side*.972]),
  tangent:Object.freeze([radialY,-radialX,0]),
}))));

export function brakeEffectIntensity(view={},deceleration=0){
  deceleration=Math.max(0,finite(deceleration));
  const spec=BRAKE_EFFECTS_SPEC,speed=Math.abs(finite(view.velocity)),demand=brakeDemand(view);
  if(!demand||speed<=spec.minimumSpeed||deceleration<=.05)return 0;
  const speedFactor=smooth((speed-spec.minimumSpeed)/(spec.fullSpeed-spec.minimumSpeed));
  return clamp(demand/spec.fullDeceleration,0,1)*speedFactor*clamp(deceleration/demand,0,1);
}

const VERTEX=`
attribute vec3 particleCenter;
attribute vec3 particleTail;
attribute vec2 particleScale;
attribute float particleOpacity;
varying vec2 vUv;
varying float vOpacity;
void main(){
  vUv=uv;vOpacity=particleOpacity;
  vec4 center=modelViewMatrix*vec4(particleCenter,1.0);
  vec4 tail=modelViewMatrix*vec4(particleTail,1.0);
  vec2 delta=center.xy-tail.xy;
  vec2 along=length(delta)>.00001?normalize(delta):vec2(0.0,1.0);
  vec2 across=vec2(-along.y,along.x);
  center.xy+=along*position.x*particleScale.x+across*position.y*particleScale.y;
  gl_Position=projectionMatrix*center;
}`;
const SPARK_FRAGMENT=`
varying vec2 vUv;
varying float vOpacity;
void main(){
  float edge=1.0-smoothstep(.12,.5,abs(vUv.y-.5));
  float end=1.0-smoothstep(.25,.5,abs(vUv.x-.5));
  float alpha=edge*end*vOpacity;
  if(alpha<.001)discard;
  gl_FragColor=vec4(mix(vec3(1.0,.18,.015),vec3(1.0,.82,.36),edge*end),alpha);
  #include <colorspace_fragment>
}`;
const HAZE_FRAGMENT=`
varying vec2 vUv;
varying float vOpacity;
void main(){
  vec2 p=(vUv-.5)*2.0;
  float radius=length(p);
  float cloud=(1.0-smoothstep(.18,1.0,radius))*(.87+.13*sin(p.x*9.0+p.y*6.0));
  float alpha=cloud*vOpacity;
  if(alpha<.0005)discard;
  gl_FragColor=vec4(.43,.44,.43,alpha);
  #include <colorspace_fragment>
}`;

function particleBatch(count,fragmentShader,additive){
  const quad=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
  geometry.index=quad.index;geometry.setAttribute('position',quad.attributes.position);geometry.setAttribute('uv',quad.attributes.uv);geometry.instanceCount=count;
  for(const[name,size]of Object.entries({particleCenter:3,particleTail:3,particleScale:2,particleOpacity:1}))geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(count*size),size).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=false;
  return{mesh,attributes:geometry.attributes};
}

/**
 * Add root to the scene at identity (not to the moving upper body).
 * update(view,{emitters: train.root.matrixWorld}) accepts a Matrix4, or
 * {matrixWorld: Matrix4}. The caller updates that matrix after positioning the train.
 * Frozen slots and proof have stable identities; copy them when retaining a snapshot.
 */
export function createBrakeEffects({lights=true}={}){
  const spec=BRAKE_EFFECTS_SPEC,root=new THREE.Group();root.name='Bounded brake shoe sparks and thin friction haze';
  const sparks=particleBatch(spec.sparkCapacity,SPARK_FRAGMENT,true),haze=particleBatch(spec.hazeCapacity,HAZE_FRAGMENT,false);
  sparks.mesh.name='48 fixed amber brake spark streak slots';haze.mesh.name='20 fixed thin friction haze slots';root.add(haze.mesh,sparks.mesh);
  const slots=Array.from({length:spec.sparkCapacity+spec.hazeCapacity},(_,index)=>({index,kind:index<spec.sparkCapacity?'spark':'haze',active:false,id:0,emitter:0,born:0,age:0,life:0,birthDistance:0,energy:0,size:0,opacity:0,length:0,width:0,releaseFade:1,birthPosition:[0,0,0],position:[0,0,0],velocity:[0,0,0],forward:[1,0,0],up:[0,1,0]}));
  const lightSlots=lights?[-1,1].map(side=>{const light=new THREE.PointLight(0xff9a3b,0,spec.lightReach,2);light.name='Brief brake rim reflection '+side;light.castShadow=false;root.add(light);return{light,side,strength:0,emitter:side<0?0:1};}):[];
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),forward=new THREE.Vector3(1,0,0),up=new THREE.Vector3(0,1,0),across=new THREE.Vector3(0,0,1),tangent=new THREE.Vector3();
  const origins=BRAKE_EMITTERS.map(source=>source.position.slice());
  const state={intensity:0,demand:0,deceleration:0,speed:0,active:false};
  const proof={version:spec.version,assumptions:spec.assumptions,original:true,cinematic:true,physicalOverheat:false,sparkCapacity:spec.sparkCapacity,hazeCapacity:spec.hazeCapacity,lightCount:lightSlots.length,drawCalls:2,steamSlotsUsed:0,activeSparks:0,activeHaze:0,peakSparks:0,peakHaze:0,emitted:{sparks:0,haze:0},droppedBirths:0,liveSlotOverwrites:0,frameBirths:0,gapDrops:0,sourceOrigins:origins,sourceManifest:BRAKE_EMITTERS,clock:'Session elapsed or tick/30; duplicate/paused frames freeze',worldMode:'Train-centred render origin; historical source positions and distance compensation',maxObservedSparkLength:0,maxObservedHazeOpacity:0,generation:0,resetReason:'initial',state};
  root.userData.effects=proof;
  let lastTime=null,lastSpeed=0,lastDistance=0,lastSeed=null,serial=0,sparkCursor=0,hazeCursor=0,sparkCredit=0,hazeCredit=0;

  function configure(emitters){
    const supplied=emitters?.isMatrix4?emitters:emitters?.matrixWorld;
    if(supplied?.isMatrix4)matrix.copy(supplied);else matrix.identity();
    forward.set(1,0,0).transformDirection(matrix);up.set(0,1,0).transformDirection(matrix);across.set(0,0,1).transformDirection(matrix);
    for(let i=0;i<BRAKE_EMITTERS.length;i++)point.fromArray(BRAKE_EMITTERS[i].position).applyMatrix4(matrix).toArray(origins[i]);
  }
  function render(){
    proof.activeSparks=proof.activeHaze=0;
    for(const particle of slots){
      const spark=particle.kind==='spark',attributes=spark?sparks.attributes:haze.attributes,index=spark?particle.index:particle.index-spec.sparkCapacity;
      attributes.particleCenter.setXYZ(index,...particle.position);
      const velocity=particle.velocity,position=particle.position;
      attributes.particleTail.setXYZ(index,position[0]-velocity[0]*.015,position[1]-velocity[1]*.015,position[2]-velocity[2]*.015);
      attributes.particleScale.setXY(index,spark?particle.length:particle.size,spark?particle.width:particle.size*.78);
      attributes.particleOpacity.setX(index,particle.active?particle.opacity:0);
      if(particle.active){if(spark)proof.activeSparks++;else proof.activeHaze++;}
    }
    for(const batch of[sparks,haze])for(const attribute of Object.values(batch.attributes))if(attribute.isInstancedBufferAttribute)attribute.needsUpdate=true;
    proof.peakSparks=Math.max(proof.peakSparks,proof.activeSparks);proof.peakHaze=Math.max(proof.peakHaze,proof.activeHaze);
    for(const entry of lightSlots){entry.light.position.fromArray(origins[entry.emitter]).addScaledVector(across,entry.side*.075);entry.light.intensity=entry.strength;}
    state.active=proof.activeSparks+proof.activeHaze>0||lightSlots.some(entry=>entry.strength>0);
    return api;
  }
  function reset(view={},reason='explicit-reset'){
    for(const p of slots){p.active=false;p.id=0;p.age=p.opacity=p.size=p.length=p.width=0;p.releaseFade=1;p.position.fill(0);p.birthPosition.fill(0);p.velocity.fill(0);}
    for(const entry of lightSlots)entry.strength=0;
    Object.assign(state,{intensity:0,demand:0,deceleration:0,speed:0,active:false});
    Object.assign(proof,{activeSparks:0,activeHaze:0,peakSparks:0,peakHaze:0,droppedBirths:0,frameBirths:0,gapDrops:0,maxObservedSparkLength:0,maxObservedHazeOpacity:0,resetReason:reason,generation:proof.generation+1});proof.emitted.sparks=proof.emitted.haze=0;
    sparkCursor=hazeCursor=sparkCredit=hazeCredit=serial=0;lastTime=arguments.length?timeOf(view):null;lastSpeed=Math.abs(finite(view.velocity));lastDistance=finite(view.distance);lastSeed=view.seed??null;
    return render();
  }
  function spawn(kind,time,view){
    const spark=kind==='spark',offset=spark?0:spec.sparkCapacity,count=spark?spec.sparkCapacity:spec.hazeCapacity,cursor=spark?sparkCursor:hazeCursor;
    let p=null;
    for(let i=0;i<count;i++){const candidate=slots[offset+(cursor+i)%count];if(!candidate.active){p=candidate;break;}}
    if(!p){proof.droppedBirths++;return;}
    if(spark)sparkCursor=(p.index+1)%count;else hazeCursor=(p.index-offset+1)%count;
    const id=++serial,a=hash(id*7+1),b=hash(id*7+2),c=hash(id*7+3),emitter=(id-1)%BRAKE_EMITTERS.length,source=BRAKE_EMITTERS[emitter],direction=Math.sign(finite(view.velocity))||1;
    Object.assign(p,{active:true,id,emitter,born:time,age:0,life:spark?.12+a*.14:.28+a*.34,birthDistance:finite(view.distance),energy:state.intensity,releaseFade:1});
    for(let axis=0;axis<3;axis++){p.birthPosition[axis]=p.position[axis]=origins[emitter][axis];p.forward[axis]=forward.getComponent(axis);p.up[axis]=up.getComponent(axis);}
    tangent.fromArray(source.tangent).transformDirection(matrix).multiplyScalar(direction*(spark?.9+b*.8:.12));
    point.copy(forward).multiplyScalar(finite(view.velocity)* (spark?.72:.45)).add(tangent).addScaledVector(across,source.side*(spark?.17+c*.37:.10+c*.10));
    if(!spark)point.addScaledVector(up,.24+b*.17);
    point.toArray(p.velocity);p.length=spark?.055+b*.065:0;p.width=spark?.009+c*.008:0;p.size=spark?0:.12+b*.07;p.opacity=spark?.88:Math.min(spec.maxHazeOpacity,.07+.05*state.intensity);
    if(spark){proof.emitted.sparks++;for(const entry of lightSlots)if(entry.side===source.side){entry.emitter=emitter;entry.strength=Math.max(entry.strength,spec.maxLightIntensity*state.intensity);}}
    else proof.emitted.haze++;
    proof.frameBirths++;
  }
  function update(view={},options={}){
    const time=timeOf(view),speed=Math.abs(finite(view.velocity)),distance=finite(view.distance),seed=view.seed??null;
    if(lastTime===null){configure(options.emitters);return reset(view,'initial');}
    if(time<lastTime-1e-9||seed!==lastSeed||view.started===false){configure(options.emitters);return reset(view,time<lastTime?'time-rewound':seed!==lastSeed?'session-changed':'inactive');}
    // Do not age, change credit, move lights, or consume PRNG samples on render-only calls.
    if(view.paused||time<=lastTime+1e-9)return api;
    const dt=time-lastTime,deceleration=Math.max(0,(lastSpeed-speed)/dt),gap=dt>spec.maximumCatchUp||Math.abs(distance-lastDistance)>2+25*dt;
    lastTime=time;lastSpeed=speed;lastDistance=distance;configure(options.emitters);
    state.speed=speed;state.demand=brakeDemand(view);state.deceleration=deceleration;state.intensity=gap?0:brakeEffectIntensity(view,deceleration);proof.frameBirths=0;
    if(gap)proof.gapDrops++;
    for(const entry of lightSlots){entry.strength=gap?0:entry.strength*Math.exp(-dt/spec.glowDecay);if(entry.strength<.001)entry.strength=0;}
    for(const p of slots){
      if(!p.active)continue;
      p.age=time-p.born;
      if(p.age>=p.life||gap){p.active=false;p.opacity=0;continue;}
      if(!state.intensity)p.releaseFade*=Math.exp(-dt/spec.stopDecay);
      const age=p.age,spark=p.kind==='spark',drift=distance-p.birthDistance,fall=spark?4*age*age:0;
      for(let axis=0;axis<3;axis++)p.position[axis]=p.birthPosition[axis]+p.velocity[axis]*age-p.forward[axis]*drift-p.up[axis]*fall;
      const fade=(1-age/p.life)*p.releaseFade;
      p.opacity=(spark?.88:Math.min(spec.maxHazeOpacity,.07+.05*p.energy))*fade;
      if(p.opacity<.002){p.active=false;p.opacity=0;continue;}
      if(!spark)p.size=Math.min(spec.maxHazeSize,.15+age*.46);
      proof.maxObservedSparkLength=Math.max(proof.maxObservedSparkLength,spark?p.length:0);proof.maxObservedHazeOpacity=Math.max(proof.maxObservedHazeOpacity,spark?0:p.opacity);
    }
    if(state.intensity>0){
      sparkCredit+=state.intensity*spec.maxSparkRate*dt;hazeCredit+=state.intensity*spec.maxHazeRate*dt;
      while(sparkCredit>=1){sparkCredit--;spawn('spark',time,view);}
      while(hazeCredit>=1){hazeCredit--;spawn('haze',time,view);}
    }else sparkCredit=hazeCredit=0;
    return render();
  }
  const api={root,state,proof,slots,update,reset,dispose(){for(const batch of[sparks,haze]){batch.mesh.geometry.dispose();batch.mesh.material.dispose();}root.clear();}};
  render();return api;
}
