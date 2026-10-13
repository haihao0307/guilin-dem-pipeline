import * as THREE from '../full/source/registration-vendor/three.module.js';
import {EarViewer as TissueViewer} from '../ear-tissue-r05/EarViewer.mjs';
import {EarVisibilityField} from './EarVisibility.mjs';
import {attachContinuityMaterial} from './ContinuityMaterial.mjs';
export class EarViewer extends TissueViewer{
 syncVisibility(){
  if(!this.tissueFields||!this.currentEar||!this.skin?.setEarTissueField)return;
  this.continuityFields??=new Map();this.continuityActive??=true;const g=this.currentEar.geometry;attachContinuityMaterial(this.skin);
  const lights=this.scene.children.filter(o=>o.isDirectionalLight);if(lights.length!==3)throw Error('Unexpected light count: rebind R06 visibility');
  const directions=lights.map(l=>{l.updateMatrixWorld(true);l.target.updateMatrixWorld(true);return new THREE.Vector3().setFromMatrixPosition(l.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(l.target.matrixWorld)).normalize().toArray()});
  let field=this.continuityFields.get(g);if(!field){field=new EarVisibilityField(g,{sampleCount:this.currentEar.count,pairs:this.currentEar.pairs,skullGeometry:this.nativeGeometry});this.continuityFields.set(g,field);g.setAttribute('e6Direct',new THREE.BufferAttribute(field.direct,3));g.setAttribute('e6Deep',new THREE.BufferAttribute(field.deep,3));}
  if(field.update(directions)){g.attributes.e6Direct.needsUpdate=true;g.attributes.e6Deep.needsUpdate=true;}
  this.currentVisibility=field;this.skin.setEarVisibility(field,directions,this.continuityActive&&this.model.earStructure.settings.enabled);
 }
 syncTissue(){super.syncTissue();this.syncVisibility();}
 applyTissueLighting(){super.applyTissueLighting();this.syncVisibility();}
 setContinuity(enabled){this.continuityActive=!!enabled;this.syncVisibility();this.render();}
 report(){return{...super.report(),version:'EAR-R06.0',baselineGeometry:'EAR-R04.0',baselineTissue:'EAR-R05.0',lightContinuity:this.currentVisibility?.report||null,continuityEnabled:this.continuityActive};}
 dispose(){if(this.continuityFields)for(const f of this.continuityFields.values())f.dispose();this.continuityFields?.clear();super.dispose();}
}
