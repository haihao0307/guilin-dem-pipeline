import {FullFaceViewer} from '../face-transfer/FullFaceViewer.mjs';
import {EyeContactField} from './EyeContactField.mjs';
import {OcularRefinement} from './OcularRefinement.mjs';
export class NaturalEyeViewer extends FullFaceViewer{
 constructor(options){super(options);this.ocularSurfaces=new Map();this.eyeContact=new EyeContactField(this.model);this.update();}
 update(){
  if(!this.ocularSurfaces)return super.update();
  this.inOcularUpdate=true;
  try{
   super.update();
   if(this.model?.naturalEyes?.settings.enabled){const source=this.geometry;let surface=this.ocularSurfaces.get(source);if(!surface){surface=new OcularRefinement(source);this.ocularSurfaces.set(source,surface);}this.geometry=surface.update();this.mesh.geometry=this.geometry;this.currentOcular=surface;}
   else this.currentOcular=null;
   this.eyeContact?.update(this.geometry);
  }finally{this.inOcularUpdate=false;}
  this.render();
 }
 render(){if(this.inOcularUpdate)return;return super.render();}
 report(){return{...super.report(),version:'ET16-E1',contact:this.eyeContact?.report||null,ocular:this.currentOcular?.report()||null,naturalEyes:this.skin?.naturalEyeExtension||null};}
 dispose(){this.eyeContact?.dispose();this.eyeContact=null;if(this.ocularSurfaces){for(const s of this.ocularSurfaces.values())s.dispose();this.ocularSurfaces.clear();}super.dispose();}
}
