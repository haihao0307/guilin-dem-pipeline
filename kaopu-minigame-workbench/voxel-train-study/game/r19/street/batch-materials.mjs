import * as THREE from '../../../vendor/three.module.js';
import {SURFACE_SHADER,FAMILIES} from './materials.mjs';
export const BATCH_MATERIAL_REVISION='KST1-district-batch-1';
const attributes=Array.from({length:5},(_,i)=>`attribute vec4 stData${i};\nvarying vec4 vStData${i};`).join('\n');
const varyings=Array.from({length:5},(_,i)=>`varying vec4 vStData${i};`).join('\n');
const macros=`
#define stAge vStData0.x
#define stRepair vStData0.y
#define stSalt vStData0.z
#define stSeed vStData0.w
#define stOrigin vStData1.xyz
#define stWetness vStData1.w
#define stGrid vStData2.xyz
#define stSill vec2(vStData2.w,vStData3.x)
#define stGrainAxis vec3(float(vStData3.y<.5),float(vStData3.y>.5&&vStData3.y<1.5),float(vStData3.y>1.5))
`;
export const CLOTH_DECLARATIONS=`attribute vec4 stMotion; attribute float stMotionHeight; uniform float stTime;`;
export const CLOTH_POSITION=`
float stPhase=stTime*stMotion.w*6.28318530718+stMotion.y;
transformed.x+=sin(stPhase)*stMotion.z*.35*stMotion.x;
transformed.z+=sin(stPhase+.3)*stMotion.z*stMotion.x*stMotion.x;
`;
const clothNormal=`
float snPhase=stTime*stMotion.w*6.28318530718+stMotion.y;
float snDx=cos(snPhase)*stMotion.z*.35*stMotion.x*1.8;
float snDy=sin(snPhase)*stMotion.z*.35*stMotionHeight;
float snZx=cos(snPhase+.3)*stMotion.z*stMotion.x*stMotion.x*1.8;
float snZy=sin(snPhase+.3)*stMotion.z*2.0*stMotion.x*stMotionHeight;
float snNx=(objectNormal.x-snZx*objectNormal.z)/max(.5,1.0+snDx);
objectNormal=normalize(vec3(snNx,objectNormal.y-snDy*snNx-snZy*objectNormal.z,objectNormal.z));
`;
const add=(s,marker,part)=>{if(!s.includes(marker))throw Error('R19 shader hook missing '+marker);return s.replace(marker,marker+'\n'+part);};
export function createBatchMaterials(){
 const materials=new Map(),depth=new Map(),worldOffset=new THREE.Vector3(),time={value:0};
 function get(family,transparent=false){
  const index=FAMILIES.indexOf(family),key=family+':'+transparent;if(index<0)throw Error('Unknown batch family');if(materials.has(key))return materials.get(key);
  const cloth=family==='cloth',m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:1,emissive:0xffffff,emissiveIntensity:1,transparent,depthWrite:!transparent,side:cloth||family==='paper'?THREE.DoubleSide:THREE.FrontSide});
  m.name='R19-shared/'+key;m.userData.streetBatch={family,sourceFamilies:1,perInstanceAppearance:true};
  m.customProgramCacheKey=()=>BATCH_MATERIAL_REVISION+'/'+index+'/'+transparent;
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{stTime:time,stWorldOffset:{value:worldOffset}});
   shader.vertexShader=attributes+'\n'+SURFACE_SHADER.vertexDeclarations+(cloth?CLOTH_DECLARATIONS:'')+'\n'+shader.vertexShader;
   shader.vertexShader=add(shader.vertexShader,'#include <begin_vertex>',Array.from({length:5},(_,i)=>`vStData${i}=stData${i};`).join('\n')+(cloth?CLOTH_POSITION:''));
   if(cloth)shader.vertexShader=add(shader.vertexShader,'#include <beginnormal_vertex>',clothNormal);
   shader.vertexShader=add(shader.vertexShader,'#include <project_vertex>',SURFACE_SHADER.vertexPosition);
   let decl=SURFACE_SHADER.fragmentDeclarations.replace('uniform float stAge, stRepair, stWetness, stSeed, stTime, stSalt;','uniform float stTime;').replace('uniform vec3 stOrigin, stWorldOffset, stGrid, stGrainAxis;','uniform vec3 stWorldOffset;').replace('uniform vec2 stSill;','');
   shader.fragmentShader=`#define ST_FAMILY ${index}\n`+varyings+'\n'+macros+decl+shader.fragmentShader;
   shader.fragmentShader=add(shader.fragmentShader,'#include <color_fragment>', 'diffuseColor.a*=vStData4.w;\n'+SURFACE_SHADER.surface);
   shader.fragmentShader=add(shader.fragmentShader,'#include <roughnessmap_fragment>','roughnessFactor=vStData3.z;\n'+SURFACE_SHADER.roughness);
   shader.fragmentShader=add(shader.fragmentShader,'#include <metalnessmap_fragment>','metalnessFactor=vStData3.w;\n'+SURFACE_SHADER.metalness);
   shader.fragmentShader=add(shader.fragmentShader,'#include <normal_fragment_maps>',SURFACE_SHADER.normal);
   shader.fragmentShader=add(shader.fragmentShader,'#include <emissivemap_fragment>','totalEmissiveRadiance=vStData4.rgb;\n'+SURFACE_SHADER.emissive);
  };
  materials.set(key,m);return m;
 }
 function depthFor(family){if(family!=='cloth')return null;if(depth.has(family))return depth.get(family);const m=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});m.customProgramCacheKey=()=>BATCH_MATERIAL_REVISION+'/cloth-depth';m.onBeforeCompile=s=>{s.uniforms.stTime=time;s.vertexShader=CLOTH_DECLARATIONS+'\n'+s.vertexShader;s.vertexShader=add(s.vertexShader,'#include <begin_vertex>',CLOTH_POSITION);};depth.set(family,m);return m;}
 return{get,depthFor,update(t,distance,groundY){time.value=t;worldOffset.set(-distance,groundY,0);},get count(){return materials.size;},dispose(){for(const m of materials.values())m.dispose();for(const m of depth.values())m.dispose();materials.clear();depth.clear();}};
}
// Linear-space colours and all original appearance parameters survive batching.
export function packAppearance(material,center,wetness){
 const s=material.userData.street;if(!s)throw Error('Batch requires native street material metadata');const c=s.config,color=material.color,emissive=material.emissive.clone().multiplyScalar(material.emissiveIntensity);
 return{family:s.family,transparent:material.transparent,color:[color.r,color.g,color.b],data:[
  c.age,c.repair,c.salt,c.seed,c.origin[0]+center,c.origin[1],c.origin[2],c.wetness??wetness,
  ...c.grid,c.sill[0],c.sill[1],c.axis==='x'?0:c.axis==='z'?2:1,c.roughness,c.metalness,
  emissive.r,emissive.g,emissive.b,c.opacity]};
}
