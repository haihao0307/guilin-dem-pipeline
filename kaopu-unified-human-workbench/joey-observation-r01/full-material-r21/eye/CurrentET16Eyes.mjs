import {declarations} from './EyeDeclarationsET16.mjs';
import {validateEyes,DEFAULT_EYE,NATURAL_PRESETS} from './EyeStateET16.mjs';
import {createEyeContactFieldClass} from './EyeContactFieldET16.mjs';
let serial=0;
export function replaceOnce(s,a,b){if(s.split(a).length!==2)throw Error('R21 ET16 shader anchor mismatch: '+a);return s.replace(a,()=>b);}
/** ET16 optics on the frozen R05 chart. No geometry or surrounding-skin edits. */
export function patchCurrentET16(shader,U){
 let f=shader.fragmentShader,v=shader.vertexShader;
 for(const x of ['uniform sampler2D uE1Atlas;','varying vec4 vFEye;','uniform float csLipMix','e1OuterNormal=normal;'])if(!f.includes(x))throw Error('R21 ET16 missing host contract: '+x);
 v='attribute vec4 neContact;varying vec4 vNEContact;\n'+v;
 v=replaceOnce(v,'#include <begin_vertex>','#include <begin_vertex>\nvNEContact=neContact;');
 f=replaceOnce(f,'#include <normal_pars_fragment>','#include <normal_pars_fragment>\n'+declarations);
 // Sampling and its derivatives execute quad-wide, not inside an eye-varying branch.
 f=replaceOnce(f,'if(uE1Enabled>.5)e1CachedColor=e1IrisColor();',`if(uE1Enabled>.5){if(neEnabled>.5){
  e1CachedColor=neEyeColor();e1IrisMask=0.;e1HeightM=0.;
  if(neReference<.5){int s=neSide();float d=vNEContact.x;e1CachedColor*=1.-.27*neContactSettings[s].x*exp(-d*d/1.44)*vNEContact.y;}
 }else e1CachedColor=e1IrisColor();}`);
 f=replaceOnce(f,'roughnessFactor=mix(.25,.65,e1IrisMask);',`if(neEnabled>.5){int neS=neSide();float neRadial=length(vFEye.xy)/neIris[neS].x;
 float neCornea=1.-smoothstep(.94,1.18,neRadial);
 roughnessFactor=mix(neSurface[neS].z,neSurface[neS].y+.08*(1.-neSurface[neS].x),neCornea);
 float neContactWet=exp(-vNEContact.x*vNEContact.x/.12)*vNEContact.y*neContactSettings[neS].y;
 roughnessFactor=mix(roughnessFactor,.10,neContactWet);
 }else roughnessFactor=mix(.25,.65,e1IrisMask);`);
 f=replaceOnce(f,'material.clearcoat=.52;material.clearcoatRoughness=uE1WetRoughness;','material.clearcoat=neEnabled>.5?0.:.52;material.clearcoatRoughness=uE1WetRoughness;if(neEnabled>.5){material.specularColor=vec3(.025);material.specularF90=1.;}');
 f=replaceOnce(f,'#include <opaque_fragment>',`
 vec3 neReflectionR21=vec3(0.);
 #if NUM_DIR_LIGHTS > 0
 for(int neL=0;neL<NUM_DIR_LIGHTS;neL++)neReflectionR21+=directionalLights[neL].color*2.4*neStudioReflection(normalize(e1OuterNormal),directionalLights[neL].direction,.065+neSurface[neSide()].y*.35);
 #endif
 if(neEnabled>.5&&uE1Enabled>.5&&vFEye.z>.01&&vCSType>3.5&&csLayer<.5){int neS=neSide();float neCornea=1.-smoothstep(1.,1.28,length(vFEye.xy)/neIris[neS].x);outgoingLight+=neReflectionR21*neSurface[neS].x*mix(.20,1.,neCornea)*vFEye.z;}
 #include <opaque_fragment>`);
 Object.assign(shader.uniforms,U);shader.fragmentShader=f;shader.vertexShader=v;return shader;
}
function bindNativeContact(model){
 const {canonical:c,gnm:g,bodyCount:B,vertexCount:N}=model;
 if(!c?.gnmRecipes||!g?.componentId||!g.landmarkIndices||!g.landmarkWeights)throw Error('Native component/landmark source unavailable');
 const skin=new Uint8Array(N),component=new Int16Array(N).fill(-1),inverse=new Map();
 c.gnmRecipes.forEach(([a,b,t],hi)=>{const i=B+hi;if(a===b||t===0)inverse.set(a,i);if(t===1)inverse.set(b,i);component[i]=g.componentId[t>.5?b:a];skin[i]=g.materialId[a]===0&&g.materialId[b]===0?1:0;});
 const required=new Set([8,27,30,36,39,42,45]),landmarks=Array.from({length:68},(_,l)=>Array.from({length:3},(_,k)=>{const id=inverse.get(g.landmarkIndices[l*3+k]);if(required.has(l)&&id===undefined)throw Error('Native contact landmark missing '+l);return[id??B,g.landmarkWeights[l*3+k]];}));
 const landmark=l=>{const q=[0,0,0];for(const[i,w]of landmarks[l])for(let k=0;k<3;k++)q[k]+=model.positions[i*3+k]*w;return q;};
 const eyes=['left','right'].map(side=>{const id=g.meta.componentNames.indexOf(side+'_eye'),vertices=[],triangles=[];if(id<0)throw Error('Missing component '+side);for(let i=B;i<N;i++)if(component[i]===id)vertices.push(i);for(let k=0;k<model.faces.length;k+=3){const t=Array.from(model.faces.slice(k,k+3));if(t.every(i=>component[i]===id))triangles.push(t);}if(vertices.length!==771||triangles.length!==1512)throw Error('Frozen R05 ocular component contract changed '+side+' '+vertices.length+'/'+triangles.length);return{side,vertices,triangles};});
 return{skin,eyes,landmark};
}
export async function attachCurrentET16Eyes(api,{assetBase,THREE,parameters={}}={}){
 THREE=THREE||await import('/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js');
 const viewer=api.motion().viewer,model=api.motion().controller.model,skin=viewer.skin,mat=skin.material,geometry=viewer.geometry;
 if(skin.currentET16Eyes)return skin.currentET16Eyes;
 if(viewer.mesh?.geometry!==geometry)throw Error('R21 viewer/mesh geometry mismatch');
 if(skin.nativeEyeSurfaceR54)throw Error('R21 ET16 requires skipping R54 installation');
 if(skin.faceExtension?.version!=='R05-eye-chart-only/1'||!skin.eyeOptics)throw Error('R21 ET16 requires pinned R05/E1 appearance');
 for(const k of ['position','normal','csType','fEye'])if(!geometry.attributes[k]||geometry.attributes[k].count!==geometry.attributes.position.count)throw Error('Missing matching geometry attribute '+k);
 const gl=viewer.renderer.getContext(),limit=gl.getParameter(gl.MAX_VERTEX_ATTRIBS),slots=Object.values(geometry.attributes).reduce((n,a)=>n+Math.ceil(a.itemSize/4),0)+(geometry.attributes.neContact?0:1);
 if(slots>limit)throw Error('R21 eye contact attribute budget '+slots+' > '+limit);
 const initialPositions=model.positions.slice(),initialFaces=model.faces.slice(),initialDisplay=geometry.attributes.position.array.slice(),initialIndex=geometry.index.array.slice();
 const previousContact=geometry.attributes.neContact,previousCompile=mat.onBeforeCompile,previousKey=mat.customProgramCacheKey,previousDispose=skin.dispose,previousEyeEnabled=skin.eyeOptics.uniforms.uE1Enabled.value;
 const binding=bindNativeContact(model),proxy=Object.create(model);proxy.eyeSurface=binding;
 const chart=geometry.attributes.fEye.array,types=geometry.attributes.csType.array;let chartChecked=0;for(const e of binding.eyes){for(const i of e.vertices){if(i>=geometry.attributes.fEye.count||Math.abs(chart[i*4+3]-(e.side==='left'?0:1))>1e-6||!(types[i]>3.5)||![0,1,2,3].every(k=>Number.isFinite(chart[i*4+k])))throw Error('Native ocular chart/component correspondence mismatch '+e.side+' '+i);chartChecked++;}}
 const Contact=createEyeContactFieldClass(THREE),contact=new Contact(proxy),textures=[];let p=validateEyes({left:{...DEFAULT_EYE,...NATURAL_PRESETS.darkBrown.values},right:{...DEFAULT_EYE,...NATURAL_PRESETS.darkBrown.values},...parameters});
 const id=++serial;let compiles=0,disposed=false,installed=false,compileChecks=null;
 const base=new URL(assetBase||'./assets/',import.meta.url),loader=new THREE.TextureLoader();
 try{
  for(const [i,name]of ['Harvey_eye1.png','Harvey_eye2.png','sclera-clean.png','sclera-vessels.png'].entries()){
   const t=await loader.loadAsync(new URL(name,base).href);t.colorSpace=i===3?THREE.NoColorSpace:THREE.SRGBColorSpace;t.flipY=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;textures.push(t);
  }
  contact.update(geometry);
 }catch(e){textures.forEach(t=>t.dispose());contact.dispose();if(previousContact)geometry.setAttribute('neContact',previousContact);else geometry.deleteAttribute('neContact');throw e;}
 const U={neOriginal0:{value:textures[0]},neOriginal1:{value:textures[1]},neClean:{value:textures[2]},neVessels:{value:textures[3]},neEnabled:{value:1},neReference:{value:0},neReady:{value:1}};
 for(const k of ['neIris','neTint','neInner','neSclera','neMisc','neSurface','neEdge','neContactSettings'])U[k]={value:[new THREE.Vector4(),new THREE.Vector4()]};
 function sync(){U.neEnabled.value=p.enabled?1:0;U.neReference.value=p.reference?1:0;['left','right'].forEach((s,i)=>{const e=p[s],t=new THREE.Color(e.tint),c=new THREE.Color(e.innerColor),pupil=p.autoPupil?.59-.35*(p.illumination*p.illumination*(3-2*p.illumination)):e.pupil;U.neIris.value[i].set(e.irisScale,pupil,e.brightness,e.source);U.neTint.value[i].set(t.r,t.g,t.b,e.tintAmount);U.neInner.value[i].set(c.r,c.g,c.b,e.innerAmount);U.neSclera.value[i].set(e.scleraWhite,e.yellow,e.redness,e.veinAmount);U.neMisc.value[i].set(e.veinDensity,e.limbal,e.rotation*Math.PI/180,e.contrast);U.neSurface.value[i].set(e.wetness,e.corneaRoughness,e.scleraRoughness,e.parallax);U.neEdge.value[i].set(e.limbusWidth,e.limbusSoftness,e.pupilFeather,e.vesselSoftness);U.neContactSettings.value[i].set(e.contactShadow,e.tearWetness,0,0);});}
 const compile=function(shader,...args){previousCompile.call(this,shader,...args);patchCurrentET16(shader,U);compiles++;compileChecks={passed:true,host:'R05/E1',replacement:'ET16 sampled eye color, zero E1 relief, ET16 roughness/F0/reflection',noR54:!shader.fragmentShader.includes('uR54EyeEnabled')};};
 const key=function(){return previousKey.call(this)+'/R21-ET16-retained-geometry/'+id;};
 const wrapper=function(...args){result.dispose();return previousDispose.apply(this,args);};
 const same=(a,b)=>a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 function unchanged(){return{nativePositions:same(initialPositions,model.positions),nativeIndices:same(initialFaces,model.faces),displayPositions:same(initialDisplay,geometry.attributes.position.array),displayIndices:same(initialIndex,geometry.index.array)};}
 const result={uniforms:U,report(){return{version:'R21-ET16-optics-retained-R64',sourceCommit:'f1f06cc49b22779831033936cb25e6965836d035',installation:id,compiles,disposed,texturesLoaded:textures.length,shaderAnchorChecks:compileChecks,attributeBudget:{slots,limit,added:1},nativeEyeChartChecked:chartChecked,nativeEyeMask:binding.eyes.map(e=>({side:e.side,vertices:e.vertices.length,triangles:e.triangles.length})),geometryChanged:false,geometryVerification:unchanged(),contact:contact.report,parameters:structuredClone(p),preset:'darkBrown authored derivative; not measured pigment',oldProceduralIrisVisible:false,oldProceduralReliefVisible:false,oldR54ReflectionVisible:false,skinChanged:false,cornealRefraction:'ET16 bounded shader approximation, original opaque surface retained',ocularDisplayRefinement:false,originalOpaqueExteriorCoverRetained:true,eyelidGeometryChanged:false,contactShading:'eye-only; ET16 skin tear shading intentionally excluded',visualAcceptance:false,disposalRestored:disposed?mat.onBeforeCompile===previousCompile&&mat.customProgramCacheKey===previousKey&&geometry.attributes.neContact===previousContact:null};},set(patch,side='both'){if(disposed)throw Error('ET16 disposed');const next=structuredClone(p);if(side==='global')Object.assign(next,patch);else{if(!['left','right','both'].includes(side))throw Error('Invalid eye side');for(const s of side==='both'?['left','right']:[side])Object.assign(next[s],patch);}p=validateEyes(next);sync();viewer.render();return result.report();},refresh(){if(disposed)throw Error('ET16 disposed');if(viewer.geometry!==geometry||viewer.mesh?.geometry!==geometry)throw Error('ET16 retained geometry replaced; reinstall required');contact.update(geometry);return result.report();},dispose(){if(disposed)return;if(installed&&(mat.onBeforeCompile!==compile||mat.customProgramCacheKey!==key||skin.dispose!==wrapper))throw Error('Dispose later material layers before R21 ET16');mat.onBeforeCompile=previousCompile;mat.customProgramCacheKey=previousKey;skin.dispose=previousDispose;skin.eyeOptics.uniforms.uE1Enabled.value=previousEyeEnabled;if(previousContact)geometry.setAttribute('neContact',previousContact);else geometry.deleteAttribute('neContact');textures.forEach(t=>t.dispose());contact.dispose();delete skin.currentET16Eyes;disposed=true;mat.needsUpdate=true;}};
 sync();mat.onBeforeCompile=compile;mat.customProgramCacheKey=key;skin.dispose=wrapper;skin.eyeOptics.uniforms.uE1Enabled.value=1;skin.currentET16Eyes=result;installed=true;mat.needsUpdate=true;return result;
}
