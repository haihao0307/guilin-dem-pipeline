import * as THREE from '../full/source/registration-vendor/three.module.js';
import {LipViewer} from '../lip-structure/LipViewer.mjs';
import {FoldSurface} from './FoldSurface.mjs';
import {CineRig} from './CineRig.mjs';
export class CinematicViewer extends LipViewer{
 constructor(options){super(options);this.foldSurfaces=new Map();this.cineInspect=0;this.foldBefore=false;this.submitTimes=[];this.cineRig=new CineRig(this);this.foldClay=new THREE.MeshStandardMaterial({color:0xafa89b,roughness:.82});this.foldNormal=new THREE.MeshNormalMaterial();this.update();}
 update(){
  if(!this.foldSurfaces)return super.update();this.inFoldUpdate=true;
  try{super.update();const source=this.geometry;let f=this.foldSurfaces.get(source);if(!f){f=new FoldSurface(source,this.model);this.foldSurfaces.set(source,f);}this.currentFold=f;this.geometry=f.update(this.model,this.model.cineProfile.settings,this.foldBefore);this.mesh.geometry=this.geometry;this.cineRig?.reframe();this.cineRig?.apply();}finally{this.inFoldUpdate=false;}this.render();
 }
 refreshFolds(){
  const f=this.currentFold;if(!f)return;const runtime=window.lifelikeIdle?.runtime?.(),g=f.update(this.model,this.model.cineProfile.settings,this.foldBefore);
  if(runtime?.ready&&runtime.geometry){for(const name of ['position','normal','kFoldMM']){const a=runtime.geometry.attributes[name],b=g.attributes[name];if(a&&a.count===b.count){a.array.set(b.array);a.needsUpdate=true;}}runtime.geometry.computeBoundingSphere();this.geometry=runtime.geometry;this.mesh.geometry=this.geometry;}
  else{this.geometry=g;this.mesh.geometry=g;if(runtime&&!runtime.disposed)runtime.invalidate();}
  if(this.cineRig)this.cineRig.dirty=true;this.render();
 }
 render(){
  if(this.inFoldUpdate||this.inLipUpdate||this.inNativeUpdate||!this.active||this.lost)return;
  const start=performance.now(),s=this.model?.cineProfile?.settings,face=this.model?.faceSurface?.settings,oldRadius=face?.radius,oldDiff=face?.diffusion;
  this.cineRig?.beforeRender();
  try{
   if(this.cineInspect>=1&&this.cineInspect<=3&&this.foldClay){const saved=this.mesh.material;this.mesh.material=this.cineInspect===2?this.foldNormal:this.foldClay;this.foldClay.wireframe=this.cineInspect===3;this.renderer.render(this.scene,this.camera);this.mesh.material=saved;this.renders++;return;}
   if(face&&s){if(s.quality==='balanced'||this.cineInspect||s.diffusionScale===0)face.diffusion=0;else face.radius=oldRadius*s.diffusionScale;}
   return super.render();
  }finally{if(face){face.radius=oldRadius;face.diffusion=oldDiff;}if(this.submitTimes){this.submitTimes.push(performance.now()-start);if(this.submitTimes.length>60)this.submitTimes.shift();}}
 }
 report(){return{...super.report(),version:'ET21-SKIN-FOLD-R02.0',folds:this.currentFold?.stats,lookdev:{geometryTextureWrinkles:false,geometryProofModes:['clay','geometric-normal','wireframe'],submitMeanMS:this.submitTimes?.reduce((a,b)=>a+b,0)/(this.submitTimes?.length||1),submitIsNotGPUTime:true}};}
 dispose(){this.cineSkin?.dispose();this.cineSkin=null;this.cineRig?.dispose();this.cineRig=null;this.foldClay?.dispose();this.foldNormal?.dispose();if(this.foldSurfaces){for(const f of this.foldSurfaces.values())f.dispose();this.foldSurfaces.clear();}super.dispose();}
}
