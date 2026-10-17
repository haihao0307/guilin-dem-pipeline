// Exact Three shader integration compile/link in native EGL, not browser visual QA.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import * as T from '../../material-master-workbench-r02/vendor/three.module.js';import {buildRoadCase} from '../road.mjs';
const expand=s=>s.replace(/#include <(.*?)>/g,(_,name)=>{if(!T.ShaderChunk[name])throw Error('Missing shader chunk '+name);return expand(T.ShaderChunk[name]);});
const defs=`#define STANDARD
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
uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix,viewMatrix;uniform mat3 normalMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;
in vec3 position;in vec3 normal;in vec2 uv;
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
for(const family of ['asphalt','concrete']){
 const g=buildRoadCase(T,{family});const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};g.userData.material.onBeforeCompile(s);
 const sources={vertex:vertexPrefix+expand(s.vertexShader),fragment:fragmentPrefix+expand(s.fragmentShader)};
 const result=JSON.parse(execFileSync('python',[new URL('../../material-master-workbench-r04/qa/egl-compile.py',import.meta.url).pathname],{input:JSON.stringify(sources),encoding:'utf8',env:{...process.env,MESA_SHADER_CACHE_DISABLE:'true'}}));checks.push({family,...result});g.userData.dispose();
}
const receipt={passed:checks.every(c=>c.passed),environment:'surfaceless native Mesa EGL / ES 3',checks,scope:'actual modified Three r170 standard vertex/fragment sources; compile+link only. Browser, shadow/PMREM variants and visual acceptance remain separate.'};
fs.writeFileSync(new URL('./road-shader-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
