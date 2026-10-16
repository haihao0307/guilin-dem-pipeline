import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {PlannedFiberView} from './f13/src/PlannedFiberView.mjs';
import {readDenseHair} from './f12/src/StrandExchange.mjs';
const TOPOLOGY='e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de';
const INDEX='426c934a70c30c2a1229d1166175f08726943bcaf65087e937b0ba9932e55653';
const R64='8e1a19c8e55d938c546e111783126c73378cb37739152c378e0497debcd4bfc8';
const ADAPTER='4ac1f6b9ffac5ab45d1a427a1eb5e9578af0e7f105d58bff4d48555e4e2027a5';
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const exact=(a,b)=>a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
/** Static complete F13 fiber presentation on the current R64 native mesh.
 * Caller owns old-hair visibility. No source host, skin, camera or motion chain is installed.
 */
export async function attachCurrentF13Hair(api,{denseURL,denseBuffer}={}){
 const {controller,viewer:v}=api.motion(),m=controller.model;
 if(m.vertexCount!==25417||m.faces.length!==151872||m.canonical.topologySha256!==TOPOLOGY||m.adapterFingerprint!==ADAPTER)throw Error('F13 native adapter/topology mismatch');
 if(!(v.mesh?.geometry instanceof THREE.BufferGeometry))throw Error('F13 requires the real existing host Three namespace');
 if(v.scene.getObjectByName('F12-all-root-grown-hairs')||v.scene.getObjectByName('F13-planned-complete-hair'))throw Error('Another F12/F13 candidate is already attached');
 const before=m.positions.slice(),archiveBefore=JSON.stringify(m.archive()),nativeSHA=await hash(before.buffer);
 if(nativeSHA!==R64)throw Error('F13 static candidate requires exact R64 neutral identity');
 if(await hash(new TextEncoder().encode(JSON.stringify(Array.from(m.faces))))!==INDEX)throw Error('F13 triangle index hash mismatch');
 if((denseURL?1:0)+(denseBuffer?1:0)!==1)throw Error('Provide exactly one denseURL or denseBuffer');
 if(denseURL){const response=await fetch(denseURL);if(!response.ok)throw Error('Dense hair fetch failed: '+response.status);denseBuffer=await response.arrayBuffer();}
 if(ArrayBuffer.isView(denseBuffer))denseBuffer=denseBuffer.buffer.slice(denseBuffer.byteOffset,denseBuffer.byteOffset+denseBuffer.byteLength);
 if(!(denseBuffer instanceof ArrayBuffer))throw Error('Dense hair must be a complete uncompressed ArrayBuffer');
 const denseSHA256=await hash(denseBuffer),h=readDenseHair(denseBuffer),current=Array.from(v.geometry.attributes.position.array.slice(0,m.vertexCount*3));
 for(let i=0;i<before.length;i+=3)if(current[i]!==before[i]||current[i+1]!==before[i+2]||current[i+2]!==-before[i+1])throw Error('F13 current viewer geometry is stale');
 if(h.count!==98358||h.parts.length!==43||h.parts.some(p=>p.samples!==49)||h.recipe?.hairDensity!==180)throw Error('F13 R64 complete groom recipe/count mismatch');
 if(await hash(new Float64Array(current).buffer)!==h.nativePositionSHA256)throw Error('Dense paths were generated for another native shape');
 if(h.nativeSource.topology!==TOPOLOGY||h.nativeSource.indexSHA256!==INDEX)throw Error('Dense source topology mismatch');
 const gl=v.renderer.getContext(),maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE),height=Math.ceil(h.count*49/2048);
 if(maxTextureSize<Math.max(2048,height))throw Error('GPU cannot fit complete F13 paths; no downsampling is allowed');
 function activeLights(){const directional=[],ambient=[];v.scene.traverseVisible(o=>{if(!o.isLight||o.intensity===0)return;if(o.isDirectionalLight)directional.push(o);else if(o.isHemisphereLight||o.isAmbientLight)ambient.push({type:o.type,name:o.name,intensity:o.intensity,color:o.color.toArray()});else throw Error('Unsupported active F13 host light type: '+o.type);});if(directional.length>3)throw Error('F13 supports three direct-light slots; refusing to drop active lights');return{directional,ambient};}
 activeLights();
 const source=new THREE.Group();source.name='F12-all-root-grown-hairs';source.visible=false;
 const sourceMaterials=[],nativeHead={positions:current,triangles:Array.from(m.faces),topology:TOPOLOGY},raw={nativeHead,state:{strands:{count:h.count,parts:h.parts}}};
 let maxRootErrorMM=0;const rootCenter=new THREE.Vector3();
 for(const p of h.parts){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(p.positions,3));const material=new THREE.LineBasicMaterial(),line=new THREE.LineSegments(geometry,material);line.name='F12-dense-'+p.id;source.add(line);sourceMaterials.push(material);
  for(let i=0;i<p.count;i++){const f=p.bindings[i*4],w=p.bindings.subarray(i*4+1,i*4+4),root=[0,1,2].map(k=>w.reduce((s,b,j)=>s+b*current[m.faces[f*3+j]*3+k],0)),q=p.positions.subarray(i*49*3,i*49*3+3);maxRootErrorMM=Math.max(maxRootErrorMM,Math.hypot(...root.map((x,k)=>x-q[k]))*1000);rootCenter.add(new THREE.Vector3(...root));}}
 rootCenter.multiplyScalar(1/h.count);if(maxRootErrorMM>.001)throw Error('F13 paths are not attached to the current R64 roots');
 const cacheBefore=v.hairPassCache,rendererRenderBefore=v.renderer.render,viewerDisposeBefore=v.dispose;
 const bridgeAPI={raw:()=>raw,display:({strands})=>{if(strands!==undefined)source.visible=!!strands;},design:()=>({styling:h.motionProfile.styling,motionFreedom:h.motionProfile.freedom}),snapshot:()=>h.recipe};
 let fibers,cache,cacheDisposeHook,disposed=false,lastPositionVersion=-1,rootUpdates=0,compiles=0,lightReport={};
 const wp=new THREE.Vector3(),wt=new THREE.Vector3();
 function syncUniforms(){if(disposed)return;const attr=v.geometry.attributes.position;
  if(attr.version!==lastPositionVersion){if(attr.array.length<m.vertexCount*3)throw Error('F13 current native vertex buffer missing');const data=fibers.restTexture.image.data;for(let i=0;i<m.vertexCount;i++)data.set(attr.array.subarray(i*3,i*3+3),i*4);fibers.restTexture.needsUpdate=true;lastPositionVersion=attr.version;rootUpdates++;}
  const vp=v.renderer.getCurrentViewport(fibers.viewport);fibers.u.viewport.value.set(vp.z,vp.w);fibers.u.nativeMeshWorld.value=v.mesh.matrixWorld;fibers.u.activePose.value=0;fibers.u.physicsOn.value=0;fibers.u.headCenter.value.copy(rootCenter).applyMatrix4(v.mesh.matrixWorld);
  const lights=activeLights();for(let i=0;i<3;i++){const l=lights.directional[i];if(l){l.getWorldPosition(wp);l.target.getWorldPosition(wt);fibers.u.lightDirs.value[i].copy(wp).sub(wt).normalize();fibers.u.lightColors.value[i].set(l.color.r,l.color.g,l.color.b).multiplyScalar(l.intensity);}else{fibers.u.lightDirs.value[i].set(0,1,0);fibers.u.lightColors.value[i].set(0,0,0);}}
  lightReport={directLights:lights.directional.map(l=>({type:l.type,name:l.name,intensity:l.intensity,color:l.color.toArray()})),unusedDirectSlotsZeroed:3-lights.directional.length,hiddenFallbackLights:false,hostAmbientLights:lights.ambient,ambientTreatment:'Original F13 fixed ambient term retained; hemisphere/ambient lights are not converted to invented directional lights.'};
 }
 function cleanup(){cache?.detach(fibers);if(fibers){v.scene.remove(fibers.mesh);fibers.mesh.geometry.dispose();fibers.material.dispose();fibers.pathTexture.dispose();fibers.restTexture.dispose();fibers.deformationTexture.dispose();}v.scene.remove(source);for(const line of source.children)line.geometry.dispose();for(const material of sourceMaterials)material.dispose();source.clear();if(!cacheBefore&&cache){cache.dispose();if(v.hairPassCache===cache)delete v.hairPassCache;v.renderer.render=rendererRenderBefore;if(v.dispose===cacheDisposeHook)v.dispose=viewerDisposeBefore;}}
 try{v.scene.add(source);fibers=new PlannedFiberView(bridgeAPI,v);cache=v.hairPassCache;cacheDisposeHook=v.dispose;fibers.uniforms=syncUniforms;fibers.material.onBeforeCompile=()=>{compiles++;};syncUniforms();if(!exact(before,m.positions)||JSON.stringify(m.archive())!==archiveBefore)throw Error('F13 attachment altered native identity');}
 catch(e){cleanup();throw e;}
 return{
  report(){return{version:'R17-complete-static-F13-current-R64/1',sourceCommit:'b096f916b814c230d367e1bf481d0b80489ba62f',fibers:fibers.report(),denseSHA256,nativeSHA,nativeIdentityUnchangedAtAttach:true,sourceHostLoaded:false,skinReplaced:false,motionChainInstalled:false,physicsInstalled:false,oldHairVisibilityOwner:'caller',rootUpdates,maxRootErrorMM,shaderCompiles:compiles,texture:{maxTextureSize,width:2048,height},lighting:lightReport,hairPassCache:{attached:cache.hairs.has(fibers),nativeMultipassAvailable:Array.isArray(v.faceDiffusion?.targets),stats:{...cache.stats}},disposed,userVisualAccepted:false,limitations:['Static native scene attachment only; dynamics are not installed.','Root frames track changed native buffers, but pose/expression appearance and collisions remain unverified.','Original centerline collision checks do not certify finite-width clearance.']};},
  verifyGPU(){if(disposed)throw Error('F13 bridge disposed');return fibers.verifyGPU();},
  sync(){syncUniforms();return this.report();},
  dispose(){if(disposed)return;if(!cacheBefore&&(v.renderer.render!==cache.forward||v.dispose!==cacheDisposeHook))throw Error('Dispose later renderer/dispose hooks before F13');disposed=true;cleanup();}
 };
}
