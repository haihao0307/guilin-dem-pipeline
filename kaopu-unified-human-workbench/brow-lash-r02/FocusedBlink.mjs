import * as THREE from '../full/source/registration-vendor/three.module.js';
const clone=structuredClone;
/** Two original Anny eyeBlink targets. No replacement face or authored body action. */
export class FocusedBlink {
 constructor(groom){this.groom=groom;this.ready=false;this.promise=null;this.time=0;this.frames=0;this.sequence=0;this.weights=[0,0];this.errors=[];this.invalidate=()=>{this.cancel();this.detach();this.promise=null;};groom.controller.addEventListener('change',this.invalidate);}
 prepare(){if(this.ready)return Promise.resolve(true);if(this.promise)return this.promise;this.promise=this.bake().catch(e=>{this.promise=null;this.errors.push(String(e));throw e;});return this.promise;}
 async bake(){
  const start=performance.now(),groom=this.groom,m=groom.model,v=groom.viewer,base=clone(m.state),before=m.positions.slice(),indices=m.faces,archive=JSON.stringify(m.archive());
  if(window.lifelikeIdle?.ready())throw Error('完整待机已占用形变通道；请使用其原生眨眼控制，不能叠加第二套驱动。');
  const neutral=clone(base);neutral.owners.expression='anny';neutral.anny.facialActions={};
  const left=clone(neutral);left.anny.facialActions={eyeBlinkLeft:1};const right=clone(neutral);right.anny.facialActions={eyeBlinkRight:1};
  for(const state of [neutral,left,right])if(m.r05Stream?.needs(state))await m.r05Stream.prepare(state);
  if(JSON.stringify(m.archive())!==archive)throw Error('准备期间人物参数已改变，请重新准备当前人物。');
  const savedRender=v.render,savedIdle=window.lifelikeIdle;groom.ready=false;v.render=()=>{};
  window.lifelikeIdle={...savedIdle,runtime:()=>({suppressed:1})};
  const take=state=>{m.compute(state);v.update();const g=v.geometry;return{p:g.attributes.position.array.slice(),n:g.attributes.normal.array.slice(),indexCount:g.index.count};};
  let reference,samples;
  try{reference=take(neutral);samples=[take(left),take(right)];}
  finally{m.compute(base);v.update();v.render=savedRender;window.lifelikeIdle=savedIdle;groom.ready=true;}
  if(m.faces!==indices||!m.positions.every((x,i)=>x===before[i])||JSON.stringify(m.archive())!==archive)throw Error('Blink preparation changed native source or recipe');
  const raw=v.geometry,g=raw.clone();const targets=samples.map((sample,j)=>{
   if(sample.p.length!==raw.attributes.position.array.length||sample.indexCount!==raw.index.count)throw Error('Native eye target topology changed');
   const p=new Float32Array(sample.p.length),n=new Float32Array(sample.n.length);let max=0;
   for(let k=0;k<p.length;k++){p[k]=sample.p[k]-reference.p[k];n[k]=sample.n[k]-reference.n[k];max=Math.max(max,Math.abs(p[k]));}
   if(max<1e-5)throw Error('Native eye target is empty');const P=new THREE.BufferAttribute(p,3),N=new THREE.BufferAttribute(n,3);P.name=N.name=j?'native-eyeBlinkRight':'native-eyeBlinkLeft';return {p:P,n:N,max};
  });
  g.morphAttributes.position=targets.map(t=>t.p);g.morphAttributes.normal=targets.map(t=>t.n);g.morphTargetsRelative=true;g.computeBoundingSphere();g.boundingSphere.radius+=.025;
  this.raw=raw;this.geometry=g;v.geometry=v.mesh.geometry=g;v.mesh.updateMorphTargets();this.targetMax=targets.map(t=>t.max);this.ready=true;this.preparationMS=performance.now()-start;this.set(0);return true;
 }
 set(left,right=left){if(!this.ready)throw Error('请先准备原生眨眼');if(![left,right].every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw Error('闭眼值必须在0–1');this.weights=[left,right];const v=this.groom.viewer;if(v.mesh.geometry!==this.geometry)throw Error('人物已改变，请重新准备原生眨眼');v.mesh.morphTargetInfluences[0]=left;v.mesh.morphTargetInfluences[1]=right;this.groom.sync();v.render();return this.report();}
 cancel(){this.sequence++;if(this.raf)cancelAnimationFrame(this.raf);this.raf=null;}
 once(){if(!this.ready)throw Error('原生眨眼未准备');this.cancel();const ticket=this.sequence,begin=performance.now(),S=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};const tick=now=>{if(ticket!==this.sequence||!this.ready)return;const t=(now-begin)/1000,w=t<.11?S(t/.11):t<.135?1:1-S((t-.135)/.19);this.set(Math.max(0,w));this.frames++;this.time=t;if(t<.325)this.raf=requestAnimationFrame(tick);else this.raf=null;};this.raf=requestAnimationFrame(tick);}
 detach(){if(this.geometry){const v=this.groom.viewer;if(v.mesh.geometry===this.geometry){v.geometry=v.mesh.geometry=this.raw;v.mesh.morphTargetInfluences=[];v.mesh.morphTargetDictionary={};}this.geometry.dispose();this.geometry=null;}this.ready=false;}
 report(){return {version:'FOCUSED-NATIVE-BLINK-R02',ready:this.ready,nativeTargetCount:2,preparationMS:this.preparationMS,cacheBytes:this.geometry?this.geometry.morphAttributes.position.reduce((n,a)=>n+a.array.byteLength*2,0):0,weights:[...this.weights],maxNativeDelta:this.targetMax,source:'retained Anny eyeBlinkLeft/Right',timeline:'authored single-blink inspection timing',frames:this.frames,errors:[...this.errors]};}
 dispose(){this.cancel();this.detach();this.groom.controller.removeEventListener('change',this.invalidate);}
}
