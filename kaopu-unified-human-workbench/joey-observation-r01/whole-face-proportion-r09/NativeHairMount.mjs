/** Isolated display adapter for the original owned HAIR-CHARACTER-R04 modules.
 * No platform UI, archive override, body replacement, rig ownership or eye edits.
 */
import{NativeHeadBinding}from'./adapted/NativeHeadBinding.mjs';
import{makeGroom,COUNT}from'./adapted/Groom.mjs';
import{CollisionProxies}from'./adapted/CollisionProxies.mjs';
import{StrandDynamics}from'./adapted/GuideDynamics.mjs';
import{HairRenderer}from'./adapted/HairRenderer.mjs';
const fingerprint=array=>{let h=2166136261;for(const x of new Uint8Array(array.buffer,array.byteOffset,array.byteLength))h=Math.imul(h^x,16777619);return(h>>>0).toString(16)};
export function attachNativeHair(a,{style='long',color='black'}={}){
 if(!['long','medium'].includes(style))throw Error('Unknown native hairstyle');
 const v=a.motion().viewer,m=a.motion().controller.model,initial=a.positions(),nativeFingerprint=fingerprint(initial),started=performance.now();
 const binding=new NativeHeadBinding(m,v),groom=makeGroom(binding,style);groom.collisions=new CollisionProxies(binding);groom.collisions.volume=style==='medium'?.012:.006;
 const dynamics=new StrandDynamics(groom),hair=new HairRenderer(groom,dynamics,v);hair.color(color);let disposed=false;const supportFingerprint=fingerprint(Float32Array.from(groom.hairs.flatMap(r=>[r.t,...r.b])));
 if(fingerprint(a.positions())!==nativeFingerprint)throw Error('Hair assembly changed native character');
 function report(){return{schema:'joey-owned-hair-display/1',sourceCommit:'aa12eae52fc3bffa5afae079d2fff761b7a6359b',style,color,strands:COUNT,guides:groom.guides.length,nodes:25,geometryReplaced:false,nativeFingerprint,geometryUnchanged:fingerprint(a.positions())===nativeFingerprint,supportFingerprint,headBinding:binding.report(),physics:dynamics.snapshot(),buildMS:performance.now()-started,disposed,limitations:['No per-fiber self collision','No hair cast shadow','Native body section contact intended for static/mild idle','Not accepted as reference hairstyle likeness']};}
 return{mesh:hair.mesh,report,step(dt){if(disposed)throw Error('Disposed');binding.updateFrame();if(dynamics.advance(dt))hair.update();},setWind(on){if(disposed)throw Error('Disposed');dynamics.enabled=!!on;dynamics.wind=.38;},refreshNative(){if(disposed)return;binding.updateFrame();hair.update();},setVisible(value){hair.mesh.visible=!!value;},dispose(){if(disposed)return;disposed=true;hair.dispose();}};
}
