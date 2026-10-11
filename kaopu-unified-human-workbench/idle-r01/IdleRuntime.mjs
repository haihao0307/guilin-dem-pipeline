import * as THREE from '../full/source/registration-vendor/three.module.js';
import {IDLE_DEFAULTS,validateIdle,IdleTimeline,blinkEnvelope} from './IdleTimeline.mjs';
import {installIdleSkin} from './IdleSkin.mjs';
const authoringJSON=m=>{const a=m.archive();delete a.lifelikeIdle;return JSON.stringify(a);};
const clone=structuredClone,wait=()=>new Promise(r=>setTimeout(r,20));
const face=(name,actions)=>({name,source:'native Anny facial actions',kind:'expression',mutate:s=>{s.owners.expression='anny';s.anny.facialActions=actions;}});
const BASIS=[face('blinkL',{eyeBlinkLeft:1}),face('blinkR',{eyeBlinkRight:1}),face('jaw',{jawOpen:.20}),face('press',{mouthPressLeft:.35,mouthPressRight:.35}),face('smile',{mouthSmileLeft:.25,mouthSmileRight:.20,cheekSquintLeft:.10,cheekSquintRight:.08}),face('brow',{browInnerUp:.20,browOuterUpLeft:.09,browOuterUpRight:.06})];
for(const [axis,indices,angle] of [['gazeX',[7,10],.12],['gazeY',[6,9],.085],['headX',[4],.075],['headY',[3],.055]])for(const sign of [1,-1])BASIS.push({name:axis+(sign===1?'P':'N'),source:'native GNM axis-angle radians',kind:'pose',axis,sign,mutate:s=>{for(const i of indices)s.gnm.rotation[i]+=sign*angle;}});
BASIS.push({name:'breath',kind:'pose',source:'native fixed-length Anny spine rotations; postural breathing proxy',mutate:s=>{for(const [name,angle]of [['spine03',.22],['spine02',-.10]]){const v=s.anny.pose[name]||[0,0,0];s.anny.pose[name]=[v[0]+angle,v[1],v[2]];}}});
export function installIdleProfile(model){
 if(model.idleProfile)return model.idleProfile;
 const api={schema:'kaopu/lifelike-idle@1',settings:{...IDLE_DEFAULTS}},archive=model.archive.bind(model),restore=model.restore.bind(model);
 model.archive=()=>({...archive(),lifelikeIdle:{schema:api.schema,settings:{...api.settings}}});
 model.restore=input=>{const old=api.settings,p=input?.lifelikeIdle;if(p&&p.schema!==api.schema)throw Error('Unsupported idle profile');const next=validateIdle(p?.settings||{});try{api.settings=next;return restore(input);}catch(e){api.settings=old;throw e;}};
 model.idleProfile=api;return api;
}
/** One existing Mesh, immutable authoring state, transient native-derived GPU bases.
 * Rebuilds on ANY geometry edit. Never saves cached vertices as source assets.
 * Interpolated pose bases are limited to small angles; not a physics/cloth solver.
 */
export class IdleRuntime extends EventTarget{
 constructor({model,viewer,controller}){super();this.model=model;this.viewer=viewer;this.controller=controller;this.profile=installIdleProfile(model);this.time=0;this.playing=true;this.comparing=false;this.ready=false;this.generation=0;this.disposed=false;this.suppressed=0;this.errors=[];this.status='正在连接原生面部动作';this.basisInfo=[];this.bakeMS=0;this.frameCount=0;this.frameMS=[];this.weights={};this.timeline=new IdleTimeline(this.settings.seed,this.settings.profile);this.skin=installIdleSkin(viewer,this.settings);
  this.originalUpdate=viewer.update.bind(viewer);this.originalRender=viewer.render.bind(viewer);
  viewer.render=()=>{if(!this.suppressed)this.originalRender();};
  viewer.update=()=>{if(this.suppressed)return this.originalUpdate();this.detach();this.originalUpdate();this.invalidate();};
  const self=this,originalDispose=viewer.dispose.bind(viewer);viewer.dispose=()=>{self.dispose();originalDispose();};
  this.last=performance.now();this.raf=requestAnimationFrame(t=>this.tick(t));this.visibility=()=>{this.last=performance.now();};document.addEventListener('visibilitychange',this.visibility);this.invalidate();
 }
 get settings(){return this.profile.settings;}
 notify(){this.dispatchEvent(new Event('change'));}
 detach(){if(this.geometry){this.viewer.geometry=this.rawGeometry;this.viewer.mesh.geometry=this.rawGeometry;this.viewer.mesh.morphTargetInfluences=[];this.viewer.mesh.morphTargetDictionary={};this.geometry.dispose();this.geometry=null;}this.ready=false;}
 invalidate(){if(this.disposed)return;const ticket=++this.generation;this.ready=false;this.status='正在按当前人物重新校准待机';clearTimeout(this.debounce);this.debounce=setTimeout(()=>{void this.bake(ticket);},180);this.notify();}
 async bake(ticket){if(this.disposed||ticket!==this.generation)return;
  const start=performance.now(),m=this.model,v=this.viewer,base=clone(m.state),positionRef=m.positions,indexRef=m.faces,savedPositions=m.positions.slice(),schemaBefore=authoringJSON(m);this.detach();this.rawGeometry=v.geometry;const snapshot=()=>({p:v.geometry.attributes.position.array.slice(),n:v.geometry.attributes.normal.array.slice()}),rest=snapshot();const targets=[],info=[];
  const take=s=>{this.suppressed++;try{m.compute(s);this.originalUpdate();if(v.geometry.attributes.position.count*3!==rest.p.length)throw Error('Display topology changed during native sample');return snapshot();}finally{m.compute(base);this.originalUpdate();this.suppressed--;}};
  try{
   let neutralState=clone(base);neutralState.owners.expression='anny';neutralState.anny.facialActions={};const neutral=take(neutralState);
   for(let i=0;i<BASIS.length;i++){
    if(this.disposed||ticket!==this.generation)return;
    const d=BASIS[i],s=clone(base);d.mutate(s);const sample=take(s),reference=d.kind==='expression'?neutral:rest,P=new Float32Array(rest.p.length),N=new Float32Array(rest.n.length);let max=0,changed=0;
    for(let k=0;k<P.length;k+=3){for(let j=0;j<3;j++){P[k+j]=sample.p[k+j]-reference.p[k+j];N[k+j]=sample.n[k+j]-reference.n[k+j];}const dist=Math.hypot(P[k],P[k+1],P[k+2]);max=Math.max(max,dist);if(dist>1e-7)changed++;}
    if(!P.every(Number.isFinite)||!N.every(Number.isFinite))throw Error('Nonfinite native idle basis '+d.name);
    const supported=max>=1e-7;
    targets.push({p:new THREE.BufferAttribute(P,3),n:new THREE.BufferAttribute(N,3)});info.push({name:d.name,source:d.source,supported,maxMM:max*1000,affectedDisplayVertices:changed});
    this.status=`校准 ${i+1}/${BASIS.length} · ${d.name}`;this.notify();await wait();
   }
   if(this.disposed||ticket!==this.generation)return;
   if(m.positions!==positionRef||m.faces!==indexRef||!m.positions.every((x,i)=>x===savedPositions[i]))throw Error('Idle bake changed canonical authoring data');
   if(authoringJSON(m)!==schemaBefore)throw Error('Idle bake changed authoring archive');
   this.rawGeometry=v.geometry;const g=this.rawGeometry.clone();g.morphAttributes.position=targets.map(x=>x.p);g.morphAttributes.normal=targets.map(x=>x.n);g.morphTargetsRelative=true;targets.forEach((x,i)=>{x.p.name=BASIS[i].name;x.n.name=BASIS[i].name;});g.computeBoundingSphere();g.boundingSphere.radius+=.025;this.geometry=g;v.geometry=g;v.mesh.geometry=g;v.mesh.updateMorphTargets();this.basisInfo=info;this.bakeMS=performance.now()-start;this.ready=true;this.status='待机已连接 · 当前人物原生动作';this.last=performance.now();this.apply(this.time);this.notify();
  }catch(e){this.errors.push(String(e));this.status='待机未就绪：'+e.message;this.detach();this.notify();}
 }
 set(patch){const s=validateIdle({...this.settings,...patch}),reset=s.seed!==this.settings.seed||s.profile!==this.settings.profile;this.profile.settings=s;if(reset){this.timeline=new IdleTimeline(s.seed,s.profile);this.time=0;}this.skin.update(s,this.weights);if(this.ready)this.apply(this.time);this.notify();return{...s};}
 pause(value=true){this.playing=!value;this.last=performance.now();this.notify();}
 compare(value){this.comparing=!!value;if(this.ready)this.apply(this.time);this.notify();}
 seek(time){if(!Number.isFinite(time)||time<0||time>86400)throw Error('Time outside [0,86400]');this.time=time;if(this.ready)this.apply(time);this.last=performance.now();this.notify();return this.weights;}
 apply(time,manual=null){if(!this.ready||!this.geometry)return;const t=performance.now(),v=this.viewer,s=this.settings,m=this.model,raw=manual||this.timeline.sample(time,s),w={...raw};
  // Never compete with manual expression ownership or active body-motion actors.
  const fa=m.state.anny.facialActions,expr=m.state.owners.expression,manualFace=expr==='gnm'?m.state.gnm.expression.some(x=>Math.abs(x)>.0001):expr==='mhr'?m.state.mhr.expression.some(x=>Math.abs(x)>.0001):Object.values(fa).some(x=>Math.abs(x)>.0001);
  if(manualFace&&!manual)for(const k of ['blinkL','blinkR','jaw','press','smile','brow'])w[k]=0;
  if(m.state.owners.gaze!=='gnm'){w.gazeX=0;w.gazeY=0;}if(m.state.owners.headRig!=='gnm'){w.headX=0;w.headY=0;}if(m.state.owners.rig!=='anny')w.breath=0;
  if(this.oneShot){const age=time-this.oneShot.at;if(age>2.5)this.oneShot=null;else if(this.oneShot.kind==='blink'){w.blinkL=blinkEnvelope(age);w.blinkR=blinkEnvelope(age-.006);}else{const pulse=age<0?0:Math.sin(Math.min(1,age/2)*Math.PI)**2;w[this.oneShot.kind]=pulse*.60;}}
  const mode=window.fullCommonWorkbench?.motion()?.mode,suspended=!!mode&&mode!=='shape';const zero=this.comparing||!s.enabled||suspended;
  for(let i=0;i<BASIS.length;i++){const d=BASIS[i],weight=d.axis?Math.max(0,(w[d.axis]||0)*d.sign):(w[d.name]||0);v.mesh.morphTargetInfluences[i]=zero?0:Math.max(0,Math.min(1,weight));}
  this.weights=zero?Object.fromEntries(Object.keys(raw).map(k=>[k,k==='events'?[]:0])):w;this.skin.update({...s,surface:s.surface&&!this.comparing},this.weights);this.originalRender();this.frameCount++;this.frameMS.push(performance.now()-t);if(this.frameMS.length>180)this.frameMS.shift();
 }
 tick(now){if(this.disposed)return;this.raf=requestAnimationFrame(t=>this.tick(t));const dt=Math.max(0,Math.min(.1,(now-this.last)/1000));this.last=now;const mode=window.fullCommonWorkbench?.motion()?.mode;if(document.hidden||!this.ready||mode&&mode!=='shape')return;if(this.playing&&this.settings.enabled&&!this.comparing){this.time+=dt;this.apply(this.time);}if(!this.lastNotify||now-this.lastNotify>250){this.lastNotify=now;this.notify();}}
 trigger(kind){if(!['blink','jaw','press','smile','brow'].includes(kind))throw Error('Unsupported single action');this.oneShot={kind,at:this.time};this.playing=true;this.last=performance.now();this.notify();}
 samplePositions(){if(!this.geometry)return null;const out=this.geometry.attributes.position.array.slice(),targets=this.geometry.morphAttributes.position;for(let j=0;j<targets.length;j++){const w=this.viewer.mesh.morphTargetInfluences[j]||0;if(!w)continue;const a=targets[j].array;for(let i=0;i<out.length;i++)out[i]+=a[i]*w;}return out;}
 report(){return{version:'ET19-IDLE-R01',ready:this.ready,status:this.status,playing:this.playing,time:this.time,settings:{...this.settings},weights:{...this.weights},basis:this.basisInfo,bakeMS:this.bakeMS,cacheBytes:this.geometry?this.geometry.attributes.position.array.byteLength*2*BASIS.length:0,frames:this.frameCount,meanSubmitMS:this.frameMS.reduce((a,b)=>a+b,0)/(this.frameMS.length||1),singleMesh:true,canonicalStateChangedByPlayback:false,skin:this.skin.report,errors:[...this.errors],manualExpressionPriority:true,limitations:['small-angle native-derived blendshape cache, not a new muscle/physics solver','breathing is a spine-pose proxy, no rib volume or respiratory simulation','only current shape-mode person; existing locomotion/crowd modes are not newly animated','all profile-specific eyelid contact quality remains inherited and needs visual review']};}
 dispose(){if(this.disposed)return;this.disposed=true;this.generation++;clearTimeout(this.debounce);cancelAnimationFrame(this.raf);document.removeEventListener('visibilitychange',this.visibility);this.detach();this.skin.dispose();this.viewer.update=this.originalUpdate;this.viewer.render=this.originalRender;this.disposeUI?.();}
}
