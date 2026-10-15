import {LipViewer} from '../lip-structure/LipViewer.mjs';
import {EarSurface} from './EarSurface.mjs';
import * as THREE from '../full/source/registration-vendor/three.module.js';
export class EarViewer extends LipViewer{
 constructor(options){super(options);this.earSurfaces=new Map();this.earLight=new THREE.DirectionalLight(0xffe7d5,0);this.scene.add(this.earLight);this.scene.add(this.earLight.target);this.update();}
 update(){if(!this.earSurfaces)return super.update();this.inEarUpdate=true;try{super.update();const source=this.geometry;let surface=this.earSurfaces.get(source);if(!surface){surface=new EarSurface(source);this.earSurfaces.set(source,surface);}if(this.model?.earStructure?.settings.enabled){this.geometry=surface.update(this.model);this.mesh.geometry=this.geometry;}else{surface.update(this.model);}this.currentEar=surface;}finally{this.inEarUpdate=false;}this.render();}
 render(){if(this.inEarUpdate)return;return super.render();}
 viewEar(side=1,mode='oblique'){const e=this.currentEar;if(!e)return;const c=e.centers[side],f=e.frame;if(!c||!f)return;const d=mode==='macro'?.142:.215,a=mode==='rear'?-.68:mode==='oblique'?.58:0,dir=f.x.map((v,k)=>v*side*Math.cos(a)+f.front[k]*Math.sin(a)),target=c.map((v,k)=>v+f.up[k]*.001);
 this.orbit.target.set(...target);this.camera.position.set(...target.map((v,k)=>v+dir[k]*d+f.up[k]*d*.04));this.camera.zoom=1;this.camera.updateProjectionMatrix();this.orbit.update();this.earLight.intensity=1.7;this.earLight.position.set(...target.map((v,k)=>v+f.x[k]*side*1.7+f.front[k]*1.2+f.up[k]*2.1));this.earLight.target.position.set(...target);this.render();}
 report(){return {...super.report(),version:'ET18-A1',ears:this.currentEar?.stats||null,earEnabled:this.model?.earStructure?.settings.enabled,earMaterial:this.skin?.earExtension||null};}
 dispose(){if(this.earSurfaces){for(const s of this.earSurfaces.values())s.dispose();this.earSurfaces.clear();}this.earLight?.dispose?.();super.dispose();}
}
