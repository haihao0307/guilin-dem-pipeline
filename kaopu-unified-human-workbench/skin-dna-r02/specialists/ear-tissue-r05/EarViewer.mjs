import {EarViewer as RootViewer} from '../ear-root-r04/EarViewer.mjs';
import {EarTissueField} from './TissueField.mjs';
export class EarViewer extends RootViewer{
 constructor(options){super(options);this.tissueFields=new Map();this.tissueMode='neutral';this.savedTissueLights=this.scene.children.filter(o=>o.isLight&&o!==this.earLight).map(light=>({light,intensity:light.intensity}));this.syncTissue();}
 // The inherited viewer chain can request many complete multi-pass frames for
 // a single UI edit. Coalesce those requests; do not draw half-updated fields.
 render(){if(!this.tissueFields)return super.render();if(this.tissueDisposed||this.inTissueUpdate||this.inEarUpdate||this.inLipUpdate||this.inNativeUpdate)return;if(this.tissueFrame!=null)return;this.tissueFrame=requestAnimationFrame(()=>{this.tissueFrame=null;if(!this.tissueDisposed)super.render();});}
 flushTissueRender(){if(this.tissueFrame!=null){cancelAnimationFrame(this.tissueFrame);this.tissueFrame=null;}if(!this.tissueDisposed&&!this.inTissueUpdate)return super.render();}
 syncTissue(){if(!this.tissueFields||!this.currentEar||!this.skin?.setEarTissueField)return;const g=this.currentEar.geometry;let field=this.tissueFields.get(g);if(!field){field=new EarTissueField(g);this.tissueFields.set(g,field);}field.update();this.currentTissue=field;this.skin.setEarTissueField(field);this.render();}
 update(){this.inTissueUpdate=true;try{super.update();this.syncTissue();}finally{this.inTissueUpdate=false;}this.render();}
 refreshEars(){this.inTissueUpdate=true;try{super.refreshEars();this.syncTissue();}finally{this.inTissueUpdate=false;}this.render();}
 restoreTissueLights(){if(this.savedTissueLights)for(const {light,intensity}of this.savedTissueLights)light.intensity=intensity;this.tissueMode='neutral';if(this.earLight)this.earLight.intensity=0;}
 view(name){this.restoreTissueLights();return super.view(name);}
 setTissueLighting(mode){if(!['neutral','raking','back'].includes(mode))throw Error('Unknown ear light rig');this.tissueMode=mode;this.applyTissueLighting();this.render();}
 applyTissueLighting(){if(!this.savedTissueLights||!this.currentEar||!this.earLight)return;const mode=this.tissueMode,side=this.tissueSide||-1,e=this.currentEar,f=e.frame,c=e.centers[side];
  for(const {light,intensity}of this.savedTissueLights)light.intensity=mode==='neutral'?intensity:light.isHemisphereLight?.52:.30;
  if(mode==='neutral'){this.earLight.intensity=1.25;this.earLight.color.set('#fff5eb');this.earLight.position.set(...c.map((v,k)=>v+f.x[k]*side*1.7+f.front[k]*1.2+f.up[k]*1.3));this.earLight.target.position.set(...c);return;}
  const back=mode==='back',target=c;this.earLight.color.set('#fff5ed');this.earLight.intensity=back?5.0:4.0;this.earLight.position.set(...target.map((v,k)=>v+f.x[k]*side*(back?-1.8:1.0)+f.front[k]*(back?-.38:2.)+f.up[k]*(back?.55:.35)));this.earLight.target.position.set(...target);
 }
 viewEar(side=1,mode='oblique'){this.tissueSide=side;super.viewEar(side,mode);this.applyTissueLighting();this.render();}
 report(){return{...super.report(),version:'EAR-R05.0',geometryVersion:'EAR-R04.0',tissue:this.currentTissue?.report||null,renderScheduling:'coalesced one settled frame per animation tick'};}
 dispose(){this.tissueDisposed=true;if(this.tissueFrame!=null)cancelAnimationFrame(this.tissueFrame);if(this.tissueFields){for(const f of this.tissueFields.values())f.dispose();this.tissueFields.clear();}super.dispose();}
}
