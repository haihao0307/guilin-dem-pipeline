import {AnimatedHuman as OriginalAnimatedHuman} from '../full/boxing/AnimatedHuman.mjs';
import {attachFaceMaterial} from './FaceMaterial.mjs';
import {installNativeFaceLayer} from './NativeFaceLayer.mjs';
export class AnimatedHuman extends OriginalAnimatedHuman{
 constructor(model,state,options){
  installNativeFaceLayer(model);super(model,state,options);
  this.faceAppearance=attachFaceMaterial({geometry:this.geometry,skin:this.skin,face:model.faceSurface});
  this.report={...this.report,faceTransfer:'ET12-F1',wholeFaceMaterial:true,scanHeadReplaced:false,nativeCSRWeightsUnchanged:true,displaySubdivisionInMotion:false};
 }
 dispose(){this.faceAppearance?.dispose();this.faceAppearance=null;super.dispose();}
}
