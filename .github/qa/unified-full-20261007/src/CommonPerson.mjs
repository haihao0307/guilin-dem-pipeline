import{UnifiedModel}from'../source/neck-baseline/src/UnifiedModel.js';
import{validateState,defaultState}from'./State.mjs';
import{cranialBones,applyGNMRootToBody}from'./HeadRigBridge.mjs';
/** First rebuild checkpoint: real GNM native channels + official Anny body.
 * Anny semantic head/actions and MHR transfer remain explicit pending adapters.
 * This class never substitutes a different mesh for the canonical one. */
export class CommonPerson extends UnifiedModel{
 constructor(anny,gnm,canonical,fingerprint,neckSurface,mhrMeta){super(anny,gnm,canonical,null,fingerprint,neckSurface);this.mhrMeta=mhrMeta;this.cranialBoneIndices=cranialBones(anny);this.state=defaultState();this.hasValidState=false;this.coverage={gnmNativePose:true,annyBodyRotvec:true,annyHeadTransfer:false,annyFacialActions:false,mhrTransfer:false};}
 applyHeadRigBridge(context){applyGNMRootToBody(this,context);}
 activeInput(s){this.activeHeadRig=s.owners.headRig;this.gnm.resetPose();if(s.owners.headRig==='gnm'){for(let j=0;j<4;j++)this.gnm.setJointRotation(j,...s.gnm.rotation.slice(j*3,j*3+3));this.gnm.setTranslation(...s.gnm.translation);}const pose={};for(const key of new Set([...Object.keys(s.anny.pose),...Object.keys(s.anny.translations)])){// GNM owns the cranial neck/head/eye branch in this mode; saved Anny values remain intact.
 if(s.owners.headRig==='gnm'&&this.cranialBoneIndices.has(this.anny.boneLabels.indexOf(key)))continue;pose[key]={rotation:s.anny.pose[key]||[0,0,0],translation:s.anny.translations[key]||[0,0,0]};}return{phenotypes:s.anny.phenotypes,localChanges:s.anny.localChanges,pose,headIdentity:s.gnm.identity,headExpression:s.gnm.expression,mhr:{amount:0,channel:null}};}
 compute(input=this.state){const s=validateState(input,this.anny,this.mhrMeta),previous=this.state,old=this.positions.slice();try{const v=super.compute(this.activeInput(s));this.state=s;this.hasValidState=true;return v;}catch(e){if(this.hasValidState)super.compute(this.activeInput(previous));this.positions.set(old);this.state=previous;throw e;}}
 archive(){return{schema:'kaopu-common-archive/rebuild-1',topologySha256:this.canonical.topologySha256,adapterFingerprint:this.adapterFingerprint,state:structuredClone(this.state)};}
 restore(p){if(p?.schema!=='kaopu-common-archive/rebuild-1'||p.topologySha256!==this.canonical.topologySha256||p.adapterFingerprint!==this.adapterFingerprint)throw Error('Unknown common archive version');return this.compute(p.state);}
}
