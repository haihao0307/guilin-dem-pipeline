(()=>{'use strict';
const CONTRACT_URL='./sample-contract.json';
const DATA_ROOT='./data/';
const MANIFEST_FILE='NATIVE_ELEVATION_MANIFEST.json';
const HYDROLOGY_MANIFEST_FILE='osm-waterways-manifest.json';
const TILE_FILE='native-r07-c02-2048x2048-i16.bin';
const EXPECTED_SOURCE_SHA='9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4';
const EXPECTED_TILE_SHA='5408050e693e4a4679dd39fe96b473067dec515c23a7f53954c707e74e303215';
const EXPECTED_TILE_BYTES=8388608;
const TILE_GRID=2048,WINDOW_X=1330,WINDOW_Y=521;
const TRUTH_GRID=81,SUBDIVISION=8,RENDER_GRID=(TRUTH_GRID-1)*SUBDIVISION+1;
const TRUTH_SPACING=12.5,RENDER_SPACING=TRUTH_SPACING/SUBDIVISION,SIDE_M=1000;
const CENTER_E=448643.75,CENTER_N=2740856.25;
const SEEDS=Object.freeze({shape:326492026,composition:8157341,pore:440923,weather:730119,field:20260830,water:110156});
const MAX_DPR=1.25;
const $=id=>document.getElementById(id);
const canvas=$('terrain'),loading=$('loading'),loadingText=$('loadingText'),errorBox=$('error'),errorText=$('errorText');
const runtimeErrors=[];
const state={contract:null,manifest:null,hydrologyManifest:null,truth:null,denseTruth:null,fields:null,peaks:[],segments:[],minimum:0,maximum:1,sourceNodeMaxError:Infinity,gl:null,programs:null,uniforms:null,terrain:null,water:null,skirt:null,mode:0,showKarst:true,showField:true,showWater:true,karstStrength:1,detailStrength:1,colorStrength:1,camera:{target:[0,92,0],yaw:-.78,pitch:.52,distance:1380,minDistance:95,maxDistance:4800},projection:new Float32Array(16),view:new Float32Array(16),viewProjection:new Float32Array(16),inverseViewProjection:new Float32Array(16),pointers:new Map(),pinch:null,dirty:true,ready:false,lastFrameAt:0,frameSamples:[],karstRange:[0,0],fieldRange:[0,0],sourceShaVerified:false,tileShaVerified:false,hydrologyShaVerified:false};
window.addEventListener('error',e=>{runtimeErrors.push(String(e.error?.stack||e.message||'window error'));updateQa();});
window.addEventListener('unhandledrejection',e=>{runtimeErrors.push(String(e.reason?.stack||e.reason||'unhandled rejection'));updateQa();});

const TERRAIN_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aTruthNormal;
layout(location=2) in vec3 aEnhancedNormal;
layout(location=3) in vec4 aField0;
layout(location=4) in vec4 aField1;
layout(location=5) in vec4 aField2;
layout(location=6) in vec4 aField3;
uniform mat4 uViewProjection;
uniform float uKarstStrength;
uniform float uFieldStrength;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vField0;
out vec4 vField1;
out vec4 vField2;
out vec4 vField3;
void main(){
  float k=uKarstStrength;
  float f=uFieldStrength;
  vec3 position=aPosition;
  position.y+=aField2.y*k+aField2.z*f;
  float normalMix=clamp(max(k,f),0.0,1.0);
  vNormal=normalize(mix(aTruthNormal,aEnhancedNormal,normalMix));
  vWorld=position;
  vField0=aField0;
  vField1=aField1;
  vField2=aField2;
  vField3=aField3;
  gl_Position=uViewProjection*vec4(position,1.0);
}`;

const WATER_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aClass;
uniform mat4 uViewProjection;
out vec3 vWorld;
out float vClass;
void main(){vWorld=aPosition;vClass=aClass;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;
const WATER_FS=`#version 300 es
precision highp float;
in vec3 vWorld;
in float vClass;
uniform vec3 uEye;
uniform float uTime;
out vec4 outColor;
void main(){
  vec3 V=normalize(uEye-vWorld);
  float fres=pow(1.0-clamp(V.y,0.0,1.0),2.4);
  float ripple=sin(vWorld.x*.075+uTime*.75)+sin(vWorld.z*.092-uTime*.58)+sin((vWorld.x+vWorld.z)*.031+uTime*.37);
  vec3 deep=vClass<.5?vec3(.035,.19,.245):vec3(.045,.25,.29);
  vec3 pale=vec3(.21,.48,.52);
  vec3 color=mix(deep,pale,.16+fres*.55)+ripple*.006;
  outColor=vec4(color,vClass<.5?.88:.76);
}`;

const SKIRT_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
uniform mat4 uViewProjection;
out float vY;
void main(){vY=aPosition.y;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;
const SKIRT_FS=`#version 300 es
precision highp float;
in float vY;
out vec4 outColor;
void main(){float t=clamp((vY+60.0)/140.0,0.0,1.0);outColor=vec4(mix(vec3(.045,.039,.030),vec3(.16,.135,.085),t),1.0);}`;
