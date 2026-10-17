import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {BrowLashGroom} from './brow-lash-r04/Groom.mjs';
import {BrowDomain} from './brow-lash-r04/BrowDomain.mjs';
import {BrowFollicleSystem} from './brow-lash-r05/Follicles.mjs';
const TOPOLOGY='e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de';
const exact=(a,b)=>a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
/** Complete fixed R05 fibers + R04 center-long lashes on the current native head.
 * No source host, camera, controller, identity, skin or blink implementation is installed.
 * The caller owns visibility of the original R65 brow objects and restores them after dispose.
 */
export function attachR05Brows(api){
 const motion=api.motion(),m=motion.controller.model,v=motion.viewer,g=m.gnm;
 if(m.vertexCount!==25417||m.faces.length!==151872||m.canonical.topologySha256!==TOPOLOGY)throw Error('R05 current native topology mismatch');
 if(!(v.mesh?.geometry instanceof THREE.BufferGeometry))throw Error('R05 must use the existing host Three namespace and mesh');
 const before=m.positions.slice(),archiveBefore=JSON.stringify(m.archive()),renderBefore=v.render;
 const map=new Int32Array(g.numVertices).fill(-1),skin=new Uint8Array(m.vertexCount),eyes=[{side:'left',vertices:[]},{side:'right',vertices:[]}];skin.fill(1,0,m.bodyCount);
 for(let k=0;k<m.canonical.gnmRecipes.length;k++){
  const[a,b,t]=m.canonical.gnmRecipes[k],i=m.bodyCount+k,ca=g.componentId[a],cb=g.componentId[b];
  if(a!==b&&t>0&&t<1&&ca!==cb)throw Error('R05 mixed native component support');
  if(a===b||t===0)map[a]=i;else if(t===1)map[b]=i;
  const c=t===1?cb:ca;if(c===0)skin[i]=1;else if(c===1||c===2)eyes[c-1].vertices.push(i);
 }
 if(eyes.some(e=>e.vertices.length!==771))throw Error('R05 requires both complete native eye components');
 const landmark=id=>{const ids=Array.from(g.landmarkIndices.slice(id*3,id*3+3),j=>map[j]),w=Array.from(g.landmarkWeights.slice(id*3,id*3+3)),sum=w.reduce((s,x)=>s+x,0);if(ids.length!==3||ids.some(i=>i<0)||!w.every(Number.isFinite)||Math.abs(sum)<1e-12)throw Error('R05 native landmark mapping failed '+id);return[0,1,2].map(k=>ids.reduce((s,i,j)=>s+m.positions[i*3+k]*w[j]/sum,0));};
 // R04 writes archive helpers only on this facade, never on the real character.
 const model={get positions(){return m.positions},faces:m.faces,vertexCount:m.vertexCount,canonical:m.canonical,eyeSurface:{landmark,eyes,skin},archive:()=>m.archive(),restore:a=>m.restore(a)};
 const controller=new EventTarget();let groom,domain,system,renderHook,disposed=false;
 function cleanup(){system?.dispose();domain?.dispose();groom?.dispose();v.render=renderBefore;}
 try{
  groom=new BrowLashGroom({model,viewer:v,controller});domain=new BrowDomain(groom,{crestFlatten:.18});
  system=new BrowFollicleSystem({groom:()=>groom,domain:()=>domain});system.preset('straight');system.set({"density":1.28,"bandWidth":0.9,"arch":-0.24,"peak":0.65,"headFullness":1.16,"bodyFullness":1.22,"tailFullness":0.62,"fiberWidth":1.2,"vellus":0.08,"headAngle":58,"bodyAngle":7,"tailAngle":-6,"color":"#191916"});
  domain.mode='hidden';domain.sync();const chained=v.render;
  renderHook=function(...args){domain.sync();return chained.apply(this,args);};v.render=renderHook;
  if(!exact(before,m.positions)||JSON.stringify(m.archive())!==archiveBefore)throw Error('R05 attachment changed native identity or coordinates');
 }catch(e){cleanup();throw e;}
 function rootChecks(){let bad=0,nonSkin=0,nonFinite=0,max=0;for(const s of system.strands){if(s.anchor.ids.length!==3||Math.abs(s.anchor.weights.reduce((x,y)=>x+y,0)-1)>1e-7)bad++;if(!s.anchor.ids.every(i=>skin[i]))nonSkin++;if(!s.points.every(p=>p.every(Number.isFinite)))nonFinite++;const p=s.anchor.sampled[s.bound.start];max=Math.max(max,Math.hypot(...p.map((x,k)=>x-s.anchor.sampleCenter[k]))*1000);}return{invalidBarycentrics:bad,nonSkinRoots:nonSkin,nonFiniteStrands:nonFinite,maxRootOffsetMM:max};}
 return{
  set(patch){for(const k of Object.keys(patch))if(!['color','density','arch','fiberWidth'].includes(k))throw Error('Unsupported brow control');system.set(patch);return this.report();},
  settings(){return {...system.settings};},
  report(){return{version:'R21-reference-brow-current-native-bridge/1',donorBuild:'bdf57e5ced76165e1b5315cb4adfd9cd413910e2',donorAppSHA256:'d6262fa07806143e02180a107382d00b6859bcbf62218b8a96358adab7f9e3d9',r04Build:'0e913ae903d43438205aeff3aa4a3eed38f497c6',preset:'u07-authored-low-crest-dark',recipeOverrides:{"density":1.28,"bandWidth":0.9,"arch":-0.24,"peak":0.65,"headFullness":1.16,"bodyFullness":1.22,"tailFullness":0.62,"fiberWidth":1.2,"vellus":0.08,"headAngle":58,"bodyAngle":7,"tailAngle":-6,"color":"#191916"},follicleRevision:system.revision,follicles:system.report(),lashes:groom.report(),domain:domain.report(),rootChecks:rootChecks(),nativeUnchangedAtAttach:true,eyeModelReplaced:false,sourceHostLoaded:false,blinkChainInstalled:false,oldBrowVisibilityOwner:'caller',newLashes:true,hairReplaced:false,disposed,userVisualAccepted:false,limitations:['No hair/skin collision solver added.','Static identity or domain rebuild requires bridge.rebuild(); blink/pose uses existing bound transport.','Current complete-material shader compilation, optical appearance and blink pixels require the real renderer.']};},
  // Explicit rest-shape rebuild. Do not call this every expression frame.
  rebuild(){if(disposed)throw Error('R05 bridge disposed');system.restoreAnchors();groom.build();domain.build();system.build();domain.mode='hidden';domain.sync();v.render();return this.report();},
  dispose(){if(disposed)return;if(v.render!==renderHook)throw Error('Dispose later render layers before R05');disposed=true;cleanup();}
 };
}
