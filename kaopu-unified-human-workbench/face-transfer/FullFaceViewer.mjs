import {IntegratedViewer} from '../eye-transfer/IntegratedViewer.mjs';
import {FaceDiffusion} from './FaceDiffusion.mjs';
import {patchGrayEyeMaterial} from './FaceSkin.mjs';
export class FullFaceViewer extends IntegratedViewer{
 constructor(options){super(options);patchGrayEyeMaterial(this.eyeGray);patchGrayEyeMaterial(this.eyeGrid);this.faceDiffusion=new FaceDiffusion(this);this.update();}
 render(){
  if(this.inNativeUpdate)return;
  const s=this.model?.faceSurface?.settings,e=this.model?.eyeSurface?.settings;
  if(this.faceDiffusion&&s?.enabled&&s.diffusion>0&&s.layer==='beauty'&&!e.gray&&!e.grid&&this.skin?.settings.enabled&&this.mesh?.visible&&!this.wire&&!this.lost){this.mesh.material=this.material;return this.faceDiffusion.render();}
  return super.render();
 }
 report(){return {...super.report(),version:'ET12-F1',face:this.model.faceSurface?.report,skin:this.skin?.faceExtension?{ready:this.skin.faceExtension.ready,errors:this.skin.faceExtension.errors,hostMaterialPreserved:true}:null,diffusion:this.faceDiffusion?.report()};}
 dispose(){this.faceDiffusion?.dispose();this.faceDiffusion=null;super.dispose();}
}
