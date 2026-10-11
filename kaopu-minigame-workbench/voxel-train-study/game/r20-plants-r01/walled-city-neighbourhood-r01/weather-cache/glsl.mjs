import {V26_WATER_WEATHER_FUNCTIONS as F,V26_SOURCE_LOCK,V26_WATER_WEATHER_FUNCTION_PROVENANCE} from '../weather-audit/original-water-weather.mjs';

// Reconstructed from the original worker tool transcript after executor reset.
// Algebraic extraction only: every stochastic function and water constant is V26.
const rename=s=>Object.keys(F).sort((a,b)=>b.length-a.length).reduce((t,k)=>t.replace(new RegExp('\\b'+k+'\\b','g'),'w26_'+k),s);
const original=F.waterWeatherMasks;
const section=(a,b)=>{const i=original.indexOf(a),j=original.indexOf(b,i);if(i<0||j<0)throw Error('V26 source split guard failed');return original.slice(i,j);};
const cheap=section('  vec3 an = abs(n);','  vec3 waterCoord');
const low=section('  vec3 waterCoord','  float waterMask');
const broad=section('  vec3 waterCoord','  float lowerDamp');
const lowerFactor='smoothstep(0.35, 0.78, fbmValueFast(vec3(p.x * 1.3, p.z * 1.3, waterSeed * 0.011)))';
if(!low.includes(lowerFactor))throw Error('V26 lowerDamp split guard failed');
const compose=section('  float waterMask','\n\n  vec3 edgeCoord');
export const WATER_CACHE_PROVENANCE=Object.freeze({source:V26_SOURCE_LOCK,functions:V26_WATER_WEATHER_FUNCTION_PROVENANCE,split:'V26 broad and height-independent lowerDamp factor cached; original streak, verticalGate, height gate and water sum retained',normalConvention:'One fixed parent-surface normal in parent coordinates selects the source horizontal axis. Fine brick normals still belong to the original material.',omitted:'weatherMask/weatherFine, window or eave shelter, runoff sources, drainage, fluid simulation and time evolution are not implemented.'});
export const WATER_HASH_GLSL=rename(F.hash31);
export const WATER_LOW_GLSL=rename([F.hash31,F.valueNoise3,F.fbmValueFast,F.domainWarp].join('\n\n')+`
vec2 waterLowState(vec3 p,vec3 n,vec3 parentLocalMetres,vec3 fullDimensionsMetres,float waterSeed){
 float horizontal=abs(n.x)>abs(n.z)?p.z:p.x;
 float yNorm=clamp(parentLocalMetres.y/max(fullDimensionsMetres.y,0.001)+0.5,0.0,1.0);
${broad} return vec2(broad,${lowerFactor});
}`);
export const WATER_CHEAP_GLSL=rename(`float waterMaskFromCached(vec3 p,vec3 n,vec3 vLocalPos,vec3 uDimensions,float waterSeed,vec2 cachedLow){
${cheap}  float broad=cachedLow.x;
  float lowerDamp=(1.0-smoothstep(0.06,0.34,yNorm))*cachedLow.y;
${compose}
 return waterMask;
}`);
export const ORIGINAL_QA_GLSL=rename(Object.values(F).join('\n\n'));

export function numericVertexGLSL(mode='low'){return `#version 300 es
precision highp float;precision highp int;
in vec3 samplePosition;in vec2 sampleCached;
uniform int targetWidth;uniform int targetHeight;
flat out vec3 sampleLocal;flat out vec2 sampleLow;
${mode==='patchCompare'?patchVertexDeclarations():''}
void main(){${mode==='patchCompare'?patchVertexAssignments():''}sampleLocal=samplePosition;sampleLow=sampleCached;int id=gl_VertexID;vec2 pixel=vec2(float(id%targetWidth)+.5,float(id/targetWidth)+.5);gl_Position=vec4(pixel/vec2(float(targetWidth),float(targetHeight))*2.-1.,0.,1.);gl_PointSize=1.;}`;}
export function numericFragmentGLSL(mode){
 if(!['low','compare','patchCompare'].includes(mode))throw Error('Unknown V26 sample program');
 const header=`#version 300 es
precision highp float;precision highp int;
flat in vec3 sampleLocal;flat in vec2 sampleLow;
uniform vec3 parentNormal;uniform vec3 uDimensions;uniform float fieldScaleMetres;uniform float waterSeed;uniform float weatherSeed;
layout(location=0)out vec4 result;
`;
 if(mode==='low')return header+WATER_LOW_GLSL+`\nvoid main(){vec2 state=waterLowState(sampleLocal/fieldScaleMetres,parentNormal,sampleLocal,uDimensions,waterSeed);result=vec4(state,0.,1.);}`;
 if(mode==='patchCompare')return header+'vec3 vLocalPos;\n'+patchFragmentGLSL()+'\n'+rename(Object.entries(F).filter(([n])=>n!=='hash31').map(([,f])=>f).join('\n\n'))+`\nvoid main(){vLocalPos=sampleLocal;vec3 p=sampleLocal/fieldScaleMetres;vec2 reference=w26_waterWeatherMasks(p,parentNormal,waterSeed,weatherSeed);float cached=waterMaskFromCached(p,parentNormal,sampleLocal,uDimensions,waterSeed,w26CachedLowAtParent(sampleLocal));result=vec4(reference,cached,abs(reference.x-cached));}`;
 return header+'vec3 vLocalPos;\n'+ORIGINAL_QA_GLSL+'\n'+WATER_CHEAP_GLSL+`\nvoid main(){vLocalPos=sampleLocal;vec3 p=sampleLocal/fieldScaleMetres;vec2 reference=w26_waterWeatherMasks(p,parentNormal,waterSeed,weatherSeed);float cached=waterMaskFromCached(p,parentNormal,sampleLocal,uDimensions,waterSeed,sampleLow);result=vec4(reference,cached,abs(reference.x-cached));}`;
}

// 9 vec4 instance attributes, 9 flat vec4 varyings. Receiver position must be
// pre-modelMatrix group-local metres, independent of host world-origin rebasing.
export const PATCH_ATTRIBUTE_NAMES=Object.freeze([...Array.from({length:8},(_,i)=>'w26Patch'+i),'w26PatchOrigins']);
export function patchVertexDeclarations(){return PATCH_ATTRIBUTE_NAMES.map(n=>`in vec4 ${n};flat out vec4 v_${n};`).join('\n');}
export function patchVertexAssignments(){return PATCH_ATTRIBUTE_NAMES.map(n=>`v_${n}=${n};`).join('\n');}
export function waterReceiverFragmentGLSL(){return `
uniform vec3 w26ParentOriginMetres;
uniform mat3 w26ReceiverToParent;
uniform vec3 w26FullDimensionsMetres;
uniform vec3 w26ParentNormal;
uniform float w26FieldScaleMetres;
uniform float w26WaterSeed;
${WATER_HASH_GLSL}
${WATER_CHEAP_GLSL}
float w26WaterAtReceiverWithLow(vec3 receiverMetres,vec2 cachedLow){
 vec3 parent=w26ReceiverToParent*(receiverMetres-w26ParentOriginMetres);
 return waterMaskFromCached(parent/w26FieldScaleMetres,w26ParentNormal,parent,w26FullDimensionsMetres,w26WaterSeed,cachedLow);
}
`;}
export function patchFragmentGLSL(){return PATCH_ATTRIBUTE_NAMES.map(n=>`flat in vec4 v_${n};`).join('\n')+waterReceiverFragmentGLSL()+`
uniform vec3 w26GridOriginMetres;
uniform vec3 w26GridStepMetres;
uniform int w26HorizontalAxis;
float w26PatchValue(int field,int x,int y){
 if(field==0){if(y==0)return v_w26Patch0[x];if(y==1)return v_w26Patch1[x];if(y==2)return v_w26Patch2[x];return v_w26Patch3[x];}
 if(y==0)return v_w26Patch4[x];if(y==1)return v_w26Patch5[x];if(y==2)return v_w26Patch6[x];return v_w26Patch7[x];
}
float w26InterpolatePatch(int field,vec2 q,vec2 patchOrigin){
 // Global floor/fract precedes subtraction of integer patch origins.
 vec2 globalCell=floor(q),f=fract(q);ivec2 cell=ivec2(globalCell-patchOrigin);
 if(cell.x==3){cell.x=2;f.x=1.;}if(cell.y==3){cell.y=2;f.y=1.;}
 return mix(mix(w26PatchValue(field,cell.x,cell.y),w26PatchValue(field,cell.x+1,cell.y),f.x),mix(w26PatchValue(field,cell.x,cell.y+1),w26PatchValue(field,cell.x+1,cell.y+1),f.x),f.y);
}
vec2 w26CachedLowAtParent(vec3 p){
 vec3 q=(p-w26GridOriginMetres)/w26GridStepMetres;
 // Common 0.00002-cell numerical band, never brick-local snapping.
 q=mix(q,round(q),lessThan(abs(q-round(q)),vec3(0.00002)));
 return vec2(w26InterpolatePatch(0,vec2(q[w26HorizontalAxis],q.y),v_w26PatchOrigins.xy),w26InterpolatePatch(1,q.xz,v_w26PatchOrigins.zw));
}
float w26CachedWaterAtReceiver(vec3 receiverMetres){
 vec3 parent=w26ReceiverToParent*(receiverMetres-w26ParentOriginMetres);
 return w26WaterAtReceiverWithLow(receiverMetres,w26CachedLowAtParent(parent));
}`;}
