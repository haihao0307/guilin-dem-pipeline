import {FullFaceViewer} from '../face-transfer/FullFaceViewer.mjs';
import {OcularRefinement} from './OcularRefinement.mjs';
export class NaturalEyeViewer extends FullFaceViewer{
 constructor(options){super(options);this.ocularSurfaces=new Map();this.update();}
 update(){
  if(!this.ocularSurfaces)return super.update();
  this.inOcularUpdate=true;try{super.update();if(this.model?.naturalEyes?.settings.enabled){const source=this.geometry;let surface=this.ocularSurfaces.get(source);if(!surface){surface=new OcularRefinement(source);this.ocularSurfaces.set(source,surface);}this.geometry=surface.update();this.mesh.geometry=this.geometry;this.currentOcular=surface;}else this.currentOcular=null;}finally{this.inOcularUpdate=false;}this.render();
 }
 render(){if(this.inOcularUpdate)return;return super.render();}
 report(){return{...super.report(),version:'ET15-E1',ocular:this.currentOcular?.report()||null,naturalEyes:this.skin?.naturalEyeExtension||null};}
 dispose(){if(this.ocularSurfaces){for(const s of this.ocularSurfaces.values())s.dispose();this.ocularSurfaces.clear();}super.dispose();}
}
