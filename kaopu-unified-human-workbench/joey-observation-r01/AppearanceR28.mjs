import {attachNativeBrows} from './brow-r28/BrowAdapter.mjs';
import {attachR05EyeBridge} from './eye-r14/R05EyeBridge.mjs';
/** Reproducible R05 appearance assembly. No identity/pose changes and no head hair. */
export async function attachAppearanceR28(a,{pigmentScale=.55,browCount=1800,fineBrows=false}={}){
 const v=a.motion().viewer,THREE=await import('/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js'),savedLights=[];let direction=0;
 v.scene.traverse(o=>{if(o.isHemisphereLight||o.isDirectionalLight){savedLights.push({o,color:o.color.clone(),ground:o.groundColor?.clone(),intensity:o.intensity,position:o.position.clone()});o.color.setHex(0xffffff);if(o.isHemisphereLight){o.groundColor.setHex(0x8d9299);o.intensity=2;}else if(direction++===0){o.position.set(0,1,4);o.intensity=2.5;}else o.intensity=.8;}});
 const browOptions={brows:{count:browCount,segments:8,density:.96,length:fineBrows?.0032:.0045,radius:fineBrows?.000035:.000055,maskRadius:.0053,archFlatten:.75,outerLift:.005,color:'#211a18',medialFeatherFloor:.35,tangentFlow:true,smoothBandMask:true},beard:{count:1,visible:false}};
 const brows=attachNativeBrows(a,browOptions),eye=attachR05EyeBridge(v.skin,{THREE}),U=eye.optics.uniforms,outer=U.uE1Outer.value.clone(),inner=U.uE1Inner.value.clone();let scale=1,disposed=false;
 function setPigmentScale(x){if(disposed)throw Error('Appearance disposed');if(!Number.isFinite(x)||x<.15||x>1)throw RangeError('Authored linear pigment scale .15..1');scale=x;U.uE1Outer.value.copy(outer).multiplyScalar(x);U.uE1Inner.value.copy(inner).multiplyScalar(x);v.render();}
 function report(){return{version:'joey-appearance-r28/1',fineBrows,engine:'0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe',brows:brows.report(),eye:eye.report(),pigment:{authoredLinearScale:scale,outerLinear:U.uE1Outer.value.toArray(),innerLinear:U.uE1Inner.value.toArray(),measuredFromPerson:false},lighting:'R11 neutral authored fill; not calibrated photo lighting',headHair:false,geometryChanged:false,likenessAccepted:false};}
 setPigmentScale(pigmentScale);return{setPigmentScale,report,dispose(){if(disposed)return;eye.dispose();brows.dispose();for(const s of savedLights){s.o.color.copy(s.color);if(s.ground)s.o.groundColor.copy(s.ground);s.o.intensity=s.intensity;s.o.position.copy(s.position);}disposed=true;v.render();}};
}
