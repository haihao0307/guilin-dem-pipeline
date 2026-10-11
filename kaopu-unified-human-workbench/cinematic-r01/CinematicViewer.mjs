import {LipViewer} from '../lip-structure/LipViewer.mjs';
import {CineRig} from './CineRig.mjs';
export class CinematicViewer extends LipViewer{
 constructor(options){super(options);this.cineRig=new CineRig(this);}
 update(){super.update();if(this.cineRig){this.cineRig.reframe();this.cineRig.dirty=true;}}
 render(){if(this.inLipUpdate||this.inNativeUpdate)return;if(this.cineRig)this.cineRig.beforeRender();const s=this.model?.cineProfile?.settings,face=this.model?.faceSurface?.settings,old=face?.radius,oldDiff=face?.diffusion;if(face&&s?.skin&&!this.cineSkinBefore)face.radius=old*s.diffusionScale;if(face&&(this.cineInspect||s?.skin&&!this.cineSkinBefore&&s.diffusionScale===0))face.diffusion=0;try{return super.render();}finally{if(face){face.radius=old;face.diffusion=oldDiff;}}}
 dispose(){this.cineSkin?.dispose();this.cineSkin=null;this.cineRig?.dispose();this.cineRig=null;super.dispose();}
}
