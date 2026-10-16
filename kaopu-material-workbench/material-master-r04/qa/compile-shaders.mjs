// Standalone Mesa/EGL syntax + link check. It does not emulate browser rendering.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const deployedRuntime=new URL('../../material-master-r02/vendor/three.module.js',import.meta.url);
const T=await import(fs.existsSync(deployedRuntime)?deployedRuntime:new URL('../../material-master-workbench-r02/vendor/three.module.js',import.meta.url));
import {buildTileCase} from '../ceramic.mjs';
const expand=s=>s.replace(/#include <(.*?)>/g,(_,name)=>{if(!T.ShaderChunk[name])throw Error('Missing shader chunk '+name);return expand(T.ShaderChunk[name]);});
const defs=`#define PHYSICAL
#define USE_CLEARCOAT
#define NUM_DIR_LIGHTS 2
#define NUM_POINT_LIGHTS 0
#define NUM_SPOT_LIGHTS 0
#define NUM_SPOT_LIGHT_MAPS 0
#define NUM_SPOT_LIGHT_COORDS 0
#define NUM_RECT_AREA_LIGHTS 0
#define NUM_HEMI_LIGHTS 1
#define NUM_DIR_LIGHT_SHADOWS 0
#define NUM_POINT_LIGHT_SHADOWS 0
#define NUM_SPOT_LIGHT_SHADOWS 0
#define NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS 0
#define NUM_CLIPPING_PLANES 0
#define UNION_CLIPPING_PLANES 0
#define HIGH_PRECISION
`;
const common='#version 300 es\nprecision highp float;precision highp int;\n'+defs;
const vertexPrefix=common+`#define attribute in
#define varying out
#define USE_INSTANCING
uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix,viewMatrix;uniform mat3 normalMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;
in vec3 position;in vec3 normal;in vec2 uv;in mat4 instanceMatrix;
`;
const fragmentPrefix=common+`#define varying in
#define texture2D texture
#define textureCube texture
out vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
uniform mat4 viewMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;
vec4 linearToOutputTexel(vec4 value){return value;}
`;
const checks=[];
for(const finish of ['glazed','unglazed','mosaic']){
 const group=buildTileCase(T,{finish,variant:1});
 for(const [i,mat] of group.userData.materials.entries())if(mat.isMeshPhysicalMaterial){
  const s={vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader,uniforms:{}};mat.onBeforeCompile(s);
  const result=JSON.parse(execFileSync('python',[new URL('./egl-compile.py',import.meta.url).pathname],{input:JSON.stringify({vertex:vertexPrefix+expand(s.vertexShader),fragment:fragmentPrefix+expand(s.fragmentShader)}),encoding:'utf8',env:{...process.env,MESA_SHADER_CACHE_DISABLE:'true'}}));
  checks.push({finish,material:i===0?'tile body + glaze':'mortar',...result});
 }
 group.userData.dispose();
}
const receipt={passed:checks.every(c=>c.passed),environment:'surfaceless Mesa EGL / OpenGL ES 3',checks,scope:'actual modified Three r170 material source, instanced vertex and physical-lighting fragment compile + link; excludes browser/PMREM/shadow variants and visual inspection'};
fs.writeFileSync(new URL('./shader-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
