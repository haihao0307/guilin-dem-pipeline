import {CinematicViewer as ParentViewer} from '../cinematic-r01/CinematicViewer.mjs';
import {LipViewer} from '../lip-structure/LipViewer.mjs';
import * as THREE from '../full/source/registration-vendor/three.module.js';
import {FoldSurface} from './FoldSurface.mjs';
export class CinematicViewer extends ParentViewer {
 constructor(options){super(options);this.foldSurfaces=new Map();this.foldFrames=0;this.foldTimings=[];this.update();}
 update(){
  if(!this.foldSurfaces)return super.update();this.inFoldUpdate=true;
  try{super.update();const src=this.geometry;let surface=this.foldSurfaces.get(src);if(!surface){surface=new FoldSurface(src,this.model);this.foldSurfaces.set(src,surface);}this.geometry=surface.update(this.model.foldProfile.settings);this.mesh.geometry=this.geometry;this.currentFold=surface;}
  finally{this.inFoldUpdate=false;}this.render();
 }
 initFoldLights(){
  if(this.foldLights)return;const group=new THREE.Group();group.name='ET21-retained-hair-warm-cool';
  const key=new THREE.DirectionalLight('#ffb473',3.2),fill=new THREE.DirectionalLight('#7caaff',3),ambient=new THREE.HemisphereLight(0xffffff,0x393130,.35);
  group.add(key,key.target,fill,fill.target,ambient);this.scene.add(group);key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-.22,right:.22,top:.25,bottom:-.25,near:.05,far:3});key.shadow.bias=-.00002;key.shadow.normalBias=.00025;key.shadow.radius=1.3;key.shadow.camera.updateProjectionMatrix();this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
  this.foldLights={group,key,fill,ambient};this.foldLightKey='';
 }
 setFoldLook(){
  this.initFoldLights();const s=this.model.foldProfile.settings,F=this.foldLights,original=s.light==='original';F.group.visible=!original;
  if(original){this.renderer.shadowMap.enabled=false;if(this.foldLastMode!=='original'){this.cineRig.comparing=false;this.cineRig.apply();}this.foldLastMode='original';return;}
  this.cineRig.group.visible=false;this.cineRig.U.uCShadowEnable.value=0;
  for(const light of this.scene.children)if(light.isLight)light.visible=false;
  const changed=JSON.stringify([s.light,s.chroma,s.exposure,s.shadows,this.cineRig.center?.toArray()]);
  if(changed!==this.foldLightKey||this.foldLastMode==='original'){const center=this.cineRig.center||new THREE.Vector3(0,1.6,0),dir=s.light==='raking'?[[1,.15,.18],[-1,.30,.80]]:[[1,.45,.75],[-1,.35,.55]];
   for(const [i,l]of [F.key,F.fill].entries()){l.target.position.copy(center);l.position.copy(center).add(new THREE.Vector3(...dir[i]).normalize().multiplyScalar(1.3));}
   const mix=s.light==='neutral'?0:s.light==='hair'?1:s.chroma;F.key.color.set('#ffb473').lerp(new THREE.Color('#fff7ef'),1-mix);F.fill.color.set('#7caaff').lerp(new THREE.Color('#e5efff'),1-mix);
   F.key.intensity=s.light==='raking'?3.1:3.2;F.fill.intensity=s.light==='raking'?.38:s.light==='neutral'?2.25:s.light==='hair'?3:2.15;F.ambient.intensity=s.light==='raking'?.22:.35;F.key.castShadow=s.shadows;F.fill.castShadow=false;this.renderer.shadowMap.enabled=s.shadows;this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.renderer.shadowMap.needsUpdate=true;this.foldLightKey=changed;
  }
  this.renderer.setClearColor(0x242c32);this.renderer.toneMappingExposure=1.0*2**s.exposure;this.foldLastMode=s.light;
 }
 render(){
  if(this.inFoldUpdate||this.inLipUpdate||this.inOcularUpdate||this.inNativeUpdate)return;
  if(!this.foldLights){const f=this.model?.faceSurface?.settings,old=f?.diffusion;if(f&&this.model.foldProfile&&!this.model.foldProfile.settings.diffusion)f.diffusion=0;try{return super.render();}finally{if(f)f.diffusion=old;}}
  const s=this.model.foldProfile.settings,face=this.model.faceSurface.settings,eye=this.model.eyeSurface.settings,oldDiff=face.diffusion,oldGray=eye.gray,oldGrid=eye.grid;
  this.setFoldLook();if(!s.diffusion||s.gray)face.diffusion=0;if(s.gray){eye.gray=true;eye.grid=false;}
  const begin=performance.now();try{
   if(s.shadows&&s.light!=='original'){const weights=this.mesh.morphTargetInfluences||[],key=weights.join(',')+'|'+this.geometry.attributes.position.version;if(key!==this.foldShadowKey){this.renderer.shadowMap.needsUpdate=true;this.foldShadowKey=key;}}
   if(s.light==='original')super.render();else LipViewer.prototype.render.call(this);
   this.foldFrames++;this.foldTimings.push(performance.now()-begin);if(this.foldTimings.length>120)this.foldTimings.shift();
  }finally{face.diffusion=oldDiff;eye.gray=oldGray;eye.grid=oldGrid;}
 }
 report(){return {...super.report(),geometricFolds:this.currentFold?.stats,foldFrames:this.foldFrames,foldLook:this.model.foldProfile?.settings,submitMeanMS:this.foldTimings?.reduce((a,b)=>a+b,0)/(this.foldTimings?.length||1),performanceMeaning:'CPU WebGL submission only; not GPU time or certified hardware FPS'};}
 dispose(){this.foldSkin?.dispose();if(this.foldLights){this.foldLights.key.shadow.dispose();this.scene.remove(this.foldLights.group);this.foldLights=null;}if(this.foldSurfaces){for(const s of this.foldSurfaces.values())s.dispose();this.foldSurfaces.clear();}super.dispose();}
}
