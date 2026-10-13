import * as THREE from '../full/source/registration-vendor/three.module.js';
import {kelvinRGB} from './CineState.mjs';
/** Two world-anchored lights learned from the frozen early gnm-study hair bench.
 * No LTC tables, rect lights or per-pixel 36-tap manual shadow projection. */
export class CineRig{
 constructor(viewer){
  this.v=viewer;this.solo='all';this.comparing=false;this.center=new THREE.Vector3();this.neutralLight=new THREE.Color(0xffffff);this.frames=0;this.shadowUpdates=0;
  const r=viewer.renderer;this.original={lights:viewer.scene.children.filter(x=>x.isLight).map(l=>({l,visible:l.visible})),clear:r.getClearColor(new THREE.Color()),exposure:r.toneMappingExposure,shadow:r.shadowMap.enabled};
  this.group=new THREE.Group();this.group.name='ET21 two-light portrait';viewer.scene.add(this.group);
  this.lights={key:new THREE.DirectionalLight(0xffffff,3.2),fill:new THREE.DirectionalLight(0xffffff,3)};
  for(const l of Object.values(this.lights)){this.group.add(l,l.target);l.castShadow=true;l.shadow.mapSize.set(1024,1024);Object.assign(l.shadow.camera,{left:-.22,right:.22,top:.26,bottom:-.26,near:.05,far:3});l.shadow.camera.updateProjectionMatrix();l.shadow.bias=-.00003;l.shadow.normalBias=.00020;l.shadow.radius=1.3;}
  // Keep the number of shadow-casting lights stable so toggling the cached pass
  // does not rebuild material programs. Fill shadow is never rendered or sampled.
  this.lights.fill.castShadow=false;
  this.ambient=new THREE.HemisphereLight(0xffffff,0x343b49,.35);this.group.add(this.ambient);
  r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.shadowMap.autoUpdate=false;
  viewer.mesh.castShadow=viewer.mesh.receiveShadow=true;
  this.reframe();this.apply();
 }
 reframe(){const v=this.v,P=v.displayPositions;if(!P)return;let ax=Infinity,ay=Infinity,az=Infinity,bx=-Infinity,by=-Infinity,bz=-Infinity;for(let i=v.model.bodyCount*3;i<P.length;i+=3){ax=Math.min(ax,P[i]);ay=Math.min(ay,P[i+1]);az=Math.min(az,P[i+2]);bx=Math.max(bx,P[i]);by=Math.max(by,P[i+1]);bz=Math.max(bz,P[i+2]);}this.center.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);this.dirty=true;}
 apply(){const s=this.v.model.cineProfile.settings,v=this.v,r=v.renderer,mode=window.fullCommonWorkbench?.motion()?.mode,on=s.lighting&&!this.comparing&&(!mode||mode==='shape');this.enabled=on;this.group.visible=on;for(const e of this.original.lights)e.l.visible=on?false:e.visible;
  r.toneMappingExposure=this.original.exposure*(on?2**s.exposureEV:1);r.setClearColor(on?0x172126:this.original.clear);
  const{key,fill}=this.lights;
  if(s.preset==='warmcool'){
   // Early-hair chromatic pair and directions; desaturate in linear light for skin.
   key.color.set('#ffb473').lerp(this.neutralLight,.58);fill.color.set('#7caaff').lerp(this.neutralLight,.48);
   key.position.set(1,.45,.75).normalize().multiplyScalar(1.3).add(this.center);
   fill.position.set(-1,.35,.55).normalize().multiplyScalar(1.3).add(this.center);
  }else{
   key.color.setRGB(...kelvinRGB(s.keyK),THREE.LinearSRGBColorSpace);fill.color.setRGB(...kelvinRGB(s.fillK),THREE.LinearSRGBColorSpace);
   const a=s.keyAzimuth*Math.PI/180,e=s.keyElevation*Math.PI/180;
   key.position.set(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)).multiplyScalar(1.3).add(this.center);
   fill.position.set(-Math.sign(a||-1)*.8,.3,.65).normalize().multiplyScalar(1.3).add(this.center);
  }
  key.intensity=3.2*2**s.keyEV;fill.intensity=key.intensity*2**(-s.fillStops);
  for(const [name,l]of Object.entries(this.lights)){l.target.position.copy(this.center);if(this.solo!=='all'&&this.solo!==name)l.intensity=0;}
  this.ambient.intensity=this.solo==='all'?s.ambient:0;
  v.mesh.receiveShadow=on&&s.shadow;this.dirty=true;
 }
 beforeRender(){const mode=window.fullCommonWorkbench?.motion()?.mode;if(mode!==this.lastMode){this.lastMode=mode;this.apply();}this.frames++;
  const r=this.v.renderer,s=this.v.model.cineProfile.settings;if(!s.shadow||!this.enabled){r.shadowMap.needsUpdate=false;return;}
  const a=this.v.mesh.morphTargetInfluences||[];let h=0;for(let i=0;i<a.length;i++)h+=(i+1)*a[i];
  const dirty=this.dirty||h!==this.lastMorph;if(dirty){r.shadowMap.needsUpdate=true;this.shadowUpdates++;this.lastMorph=h;this.dirty=false;}
 }
 report(){return{method:'two DirectionalLights and hemisphere; optional one cached 1024 key shadow',source:'kaopu-hair-workbench/qa/gnm-study/src/app.js @ ccf5a1ed9ddde8803e292f1e62d777b141ff52d8',sourcePair:['#ffb473','#7caaff'],linearWhiteMix:[.58,.48],enabled:this.enabled,solo:this.solo,lights:Object.fromEntries(Object.entries(this.lights).map(([k,l])=>[k,{position:l.position.toArray(),colorLinear:l.color.toArray(),intensity:l.intensity}])),rectAreaLights:0,manualShadowSamples:0,shadowUpdates:this.shadowUpdates,frames:this.frames};}
 dispose(){const v=this.v;for(const e of this.original.lights)e.l.visible=e.visible;v.scene.remove(this.group);for(const l of Object.values(this.lights))l.shadow.map?.dispose();v.renderer.shadowMap.enabled=this.original.shadow;v.renderer.setClearColor(this.original.clear);v.renderer.toneMappingExposure=this.original.exposure;}
}
