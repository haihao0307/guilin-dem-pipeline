import {NaturalEyeViewer} from '../eye-materials/NaturalEyeViewer.mjs';
import {LipSurface} from './LipSurface.mjs';
export class LipViewer extends NaturalEyeViewer{
 constructor(options){super(options);this.lipSurfaces=new Map();this.update();}
 update(){if(!this.lipSurfaces)return super.update();this.inLipUpdate=true;try{super.update();if(this.model?.lipStructure?.settings.enabled){const source=this.geometry;let surface=this.lipSurfaces.get(source);if(!surface){surface=new LipSurface(source,this.model.lipStructure);this.lipSurfaces.set(source,surface);}this.geometry=surface.update(this.model);this.mesh.geometry=this.geometry;this.currentLip=surface;}else this.currentLip=null;}finally{this.inLipUpdate=false;}this.render();}
 render(){if(this.inLipUpdate)return;return super.render();}
 report(){return {...super.report(),version:'ET17-L1',lips:this.currentLip?.stats||null,lipMaterial:this.skin?.lipExtension||null};}
 dispose(){if(this.lipSurfaces){for(const surface of this.lipSurfaces.values())surface.dispose();this.lipSurfaces.clear();}super.dispose();}
}
