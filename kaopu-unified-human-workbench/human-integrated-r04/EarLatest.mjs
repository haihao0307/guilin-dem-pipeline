import * as THREE from '../full/source/registration-vendor/three.module.js';
import {EarVisibilityField} from './specialists/ear-continuity-r06/EarVisibility.mjs';
import {attachContinuityMaterial} from './specialists/ear-continuity-r06/ContinuityMaterial.mjs';
const WORLD=new THREE.Vector3(),TARGET=new THREE.Vector3();
/** R06 algorithm/material remain pinned. Only the host's three light bindings
 * and GPU transport differ: exact Float32 texel fetch, no extra attributes. */
export function syncEarLatest(v){
 if(!v.currentEar||!v.foldLights||!v.earLight||!v.skin?.setEarTissueField||window.lifelikeIdle?.runtime()?.suppressed>0)return;
 if(!v.latestEar){
  attachContinuityMaterial(v.skin);
  const U={uE6Packed:{value:null},uE6Width:{value:1024}},material=v.skin.material,prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);};material.customProgramCacheKey=()=>key()+'/r04-float32-texel-binding';material.needsUpdate=true;
  v.latestEar={fields:new Map(),U,enabled:true,lastGeometry:null,lastPositionVersion:-1,lastLightKey:'',checks:0};
 }
 const A=v.latestEar,g=v.geometry;
 const dirs=[v.foldLights.key,v.foldLights.fill,v.earLight].map(l=>{l.updateMatrixWorld(true);l.target.updateMatrixWorld(true);WORLD.setFromMatrixPosition(l.matrixWorld);TARGET.setFromMatrixPosition(l.target.matrixWorld);WORLD.sub(TARGET);if(WORLD.lengthSq()<1e-10)WORLD.set(1,1,1);return WORLD.normalize().toArray();});
 const lightKey=dirs.flat().map(x=>x.toFixed(8)).join('/');
 let row=A.fields.get(g);
 if(!row){const count=g.attributes.position.count,width=1024,height=Math.ceil(count*2/width),data=new Float32Array(width*height*4),texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;const field=new EarVisibilityField(g,{sampleCount:v.currentEar.count,pairs:v.currentEar.pairs,skullGeometry:v.nativeGeometry});row={field,data,texture};A.fields.set(g,row);}
 if(A.lastGeometry!==g||A.lastPositionVersion!==g.attributes.position.version||A.lastLightKey!==lightKey){
  A.checks++;if(row.field.update(dirs)){const n=g.attributes.position.count;for(let i=0;i<n;i++){row.data.set(row.field.direct.subarray(i*3,i*3+3),i*8);row.data.set(row.field.deep.subarray(i*3,i*3+3),i*8+4);}row.texture.needsUpdate=true;}
  A.lastGeometry=g;A.lastPositionVersion=g.attributes.position.version;A.lastLightKey=lightKey;
 }
 A.U.uE6Packed.value=row.texture;
 const supported=v.model.foldProfile.settings.light!=='original';v.skin.setEarVisibility(row.field,dirs,A.enabled&&supported&&v.model.earStructure.settings.enabled);
 v.currentVisibility=row.field;v.earLatestReport={...row.field.report,sourceCommit:'38a8a2140b42561eecbd31af5df074e9210d0c64',active:A.enabled&&supported,hostLights:'fold key + fold fill + ear inspection lamp',gpuBinding:'Float32 texelFetch by display vertex ID; zero added vertex attributes',textureBytes:row.data.byteLength,fullCinemaAreaLightVisibility:false};
}
export function disposeEarLatest(v){if(v.latestEar){for(const row of v.latestEar.fields.values()){row.field.dispose();row.texture.dispose();}v.latestEar.fields.clear();v.latestEar=null;}}
