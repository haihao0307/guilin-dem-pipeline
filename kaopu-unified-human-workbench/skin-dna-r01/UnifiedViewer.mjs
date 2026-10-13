import {syncEarLatest,disposeEarLatest} from './EarLatest.mjs';
import {CinematicViewer as FoldViewer} from '../skin-folds-r02/FoldViewer.mjs';
import {EarSurface} from './specialists/ear-root-r04/EarSurface.mjs';
import {EarTissueField} from './specialists/ear-tissue-r05/TissueField.mjs';
import {AnatomySurface} from './Anatomy.mjs';
import {FacePores} from './FacePores.mjs';
import * as THREE from '../full/source/registration-vendor/three.module.js';
const LIVE=['l19State','l19Detail'];
function transport(source,target,pairs,oldCount){for(const name of LIVE){const a=source.attributes[name];if(!a)continue;const size=a.itemSize;let b=target.attributes[name];if(!b||b.count!==target.attributes.position.count){b=new THREE.BufferAttribute(new Float32Array(target.attributes.position.count*size),size);target.setAttribute(name,b);}b.array.set(a.array);for(let j=0;j<pairs.length;j++){const[u,v]=pairs[j];for(let k=0;k<size;k++)b.array[(oldCount+j)*size+k]=(a.array[u*size+k]+a.array[v*size+k])*.5;}b.needsUpdate=true;}}
export class UnifiedViewer extends FoldViewer{
 constructor(options){super(options);this.anatomySurfaces=new Map();this.earSurfaces=new Map();this.earFields=new Map();this.faceFields=new Map();this.earLight=new THREE.DirectionalLight('#fff1df',0);this.scene.add(this.earLight,this.earLight.target);this.earInspection=false;this.update();}
 update(){if(!this.anatomySurfaces)return super.update();this.inUnified=true;try{
  super.update();let src=this.currentFold?.source;for(const layer of this.currentFold?.layers||[]){transport(src,layer.geometry,layer.pairs,layer.n);src=layer.geometry;}
  src=this.geometry;let a=this.anatomySurfaces.get(src);if(!a){a=new AnatomySurface(src);this.anatomySurfaces.set(src,a);}this.currentAnatomy=a;this.geometry=a.update(this.model.regionalFace.settings);this.mesh.geometry=this.geometry;
  let e=this.earSurfaces.get(this.geometry);if(!e){e=new EarSurface(this.geometry,this.model.earStructure.domain);this.earSurfaces.set(this.geometry,e);}const eg=e.update(this.model);transport(e.source,eg,e.pairs,e.count);this.currentEar=e;this.geometry=this.model.earStructure.settings.enabled?eg:e.source;this.mesh.geometry=this.geometry;
  if(!(window.lifelikeIdle?.runtime()?.suppressed>0))this.syncSurfaceFields();
 }finally{this.inUnified=false;}this.render();}
 syncSurfaceFields(){if(!this.earFields||!this.currentEar)return;let e=this.earFields.get(this.geometry);if(!e){e=new EarTissueField(this.geometry);this.earFields.set(this.geometry,e);}e.update();this.currentTissue=e;this.skin.setEarTissueField(e);let f=this.faceFields.get(this.geometry);if(!f){f=new FacePores(this.geometry);this.faceFields.set(this.geometry,f);}f.update();this.currentFacePores=f;if(this.regionalSkin)this.regionalSkin.field(f);syncEarLatest(this);}
 refreshEars(){this.update();}
 setFoldLook(){super.setFoldLook();if(!this.foldLights)return;const mode=this.model.foldProfile.settings.light;if(mode==='natural'){this.foldLights.key.intensity=3.1;this.foldLights.fill.intensity=1.15;this.foldLights.ambient.intensity=.27;}if(this.earLight)this.earLight.visible=!!this.earInspection;syncEarLatest(this);}
 render(){if(this.inUnified)return;return super.render();}
 view(name){this.earInspection=false;if(this.earLight)this.earLight.intensity=0;return super.view(name);}
 viewEar(side=1,mode='oblique'){const e=this.currentEar;if(!e?.frame)return;this.earInspection=true;this.earSide=side;const f=e.frame,c=e.centers[side],d=mode==='macro'?.142:.215,a=mode==='rear'?-.68:mode==='oblique'?.58:0,dir=f.x.map((v,k)=>v*side*Math.cos(a)+f.front[k]*Math.sin(a));const target=c.map((v,k)=>v+f.up[k]*.001);this.orbit.target.set(...target);this.camera.position.set(...target.map((v,k)=>v+dir[k]*d+f.up[k]*d*.04));this.camera.zoom=1;this.camera.updateProjectionMatrix();const back=this.earLighting==='back';this.earLight.intensity=back?3.4:1.25;this.earLight.position.set(...target.map((v,k)=>v+f.x[k]*side*(back?-1.7:1.7)+f.front[k]*(back?-.6:1.2)+f.up[k]*1.3));this.earLight.target.position.set(...target);this.orbit.update();this.render();}
 report(){return {...super.report(),version:'HUMAN-INTEGRATED-R04',earLatest:this.earLatestReport,lipTransport:'P3',anatomy:this.currentAnatomy?.report,ears:this.currentEar?.stats,earTissue:this.currentTissue?.report,faceSurface:this.currentFacePores?.report,regionalSkin:this.regionalSkin?.report,earEnabled:this.model.earStructure?.settings.enabled,earMaterial:this.skin?.earExtension,lipMother:this.model.lipStructure?.mother?.version,oneCharacter:true,oneCanvas:true};}
 dispose(){disposeEarLatest(this);this.regionalSkin?.dispose();if(this.earFields)for(const f of this.earFields.values())f.dispose();if(this.faceFields)for(const f of this.faceFields.values())f.dispose();if(this.earSurfaces)for(const f of this.earSurfaces.values())f.dispose();if(this.anatomySurfaces)for(const f of this.anatomySurfaces.values())f.dispose();this.earFields?.clear();this.faceFields?.clear();this.earSurfaces?.clear();this.anatomySurfaces?.clear();super.dispose();}
}
