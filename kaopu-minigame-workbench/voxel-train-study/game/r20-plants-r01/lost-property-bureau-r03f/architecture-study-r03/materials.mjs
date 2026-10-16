import {applyMaterialMothers} from './material-mothers.mjs';
// Authored world-metric detail. No photographs or restricted teacher assets are embedded.
export function applyMaterialDetail(materials){
 for(const [name,m]of Object.entries(materials)){
  if(!['brick','stone','trim','wood','woodLight','roof','floor','paving','plaster'].includes(name))continue;
  m.onBeforeCompile=s=>{
   s.vertexShader='varying vec3 vWorldP; varying vec3 vWorldN;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWorldP=(modelMatrix*vec4(position,1.0)).xyz; vWorldN=normalize(mat3(modelMatrix)*normal);');
   s.fragmentShader='varying vec3 vWorldP; varying vec3 vWorldN;\nfloat kpnoise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n'+s.fragmentShader;
   let code='vec2 q=abs(vWorldN.y)>.65?vWorldP.xz:(abs(vWorldN.x)>abs(vWorldN.z)?vWorldP.zy:vWorldP.xy);';
   if(['brick','stone','trim','roof','floor','paving'].includes(name)){
    const [w,h,j,v]=name==='brick'?[.34,.115,.007,.12]:name==='roof'?[.42,.31,.008,.12]:name==='floor'?[.72,.72,.004,.04]:name==='paving'?[1.2,.72,.008,.08]:[1.15,.48,.007,.07];
    code+=`q.x+=mod(floor(q.y/${h}),2.)*${w*.5};vec2 tile=floor(q/vec2(${w},${h}));vec2 edge=min(fract(q/vec2(${w},${h})),1.-fract(q/vec2(${w},${h})))*vec2(${w},${h});float aa=max(fwidth(q.x),fwidth(q.y));float joint=1.-smoothstep(${j},${j+.003}+aa,min(edge.x,edge.y));float nv=kpnoise(tile);diffuseColor.rgb*=mix(1.-${v}*.5+nv*${v},${name==='brick'?'1.12':'.79'},joint*.72);`;
   }else if(name.startsWith('wood')){code+='float grain=sin(q.y*48.+sin(q.x*3.7)*3.+sin(q.x*19.)*.4);float fine=sin(q.y*131.+sin(q.x*2.)*9.);diffuseColor.rgb*=.94+grain*.055+fine*.018;';}
   else{code+='float plasterNoise=kpnoise(floor(q*9.));diffuseColor.rgb*=.985+plasterNoise*.03;';}
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+code);
  };m.customProgramCacheKey=()=>name+'-kaopu-metric-r03';
 }
 applyMaterialMothers(materials);
}
