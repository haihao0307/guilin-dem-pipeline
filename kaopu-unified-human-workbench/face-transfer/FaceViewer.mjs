import {IntegratedViewer} from '../eye-transfer/IntegratedViewer.mjs';
import {attachFaceMaterial} from './FaceMaterial.mjs';
export class FaceViewer extends IntegratedViewer{
 constructor(options){
  super(options);this.faceAppearance=attachFaceMaterial({geometry:this.nativeGeometry,skin:this.skin,face:this.model.faceSurface,redraw:()=>this.render()});
  // Rebuild the fixed refinement stencils once with the added rest/region fields.
  for(const surface of this.surfaces.values())surface.dispose();this.surfaces.clear();this.geometry=this.nativeGeometry;this.mesh.geometry=this.nativeGeometry;this.update();
 }
 update(){super.update();this.faceAppearance?.sync();}
 report(){return {...super.report(),version:'ET12-F1',wholeFace:this.model?.faceSurface?.report,material:this.faceAppearance?.report(),nativeFaceChannelsReplaced:false};}
 dispose(){this.faceAppearance?.dispose();this.faceAppearance=null;super.dispose();}
}
