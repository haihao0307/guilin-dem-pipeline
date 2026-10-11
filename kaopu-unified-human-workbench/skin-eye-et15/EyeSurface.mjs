import * as THREE from '../full/source/registration-vendor/three.module.js';
import {makeSpline} from '../eye-transfer/EyelidKnowledge.mjs';
export const OPTIC_SCHEMA='kaopu/native-eye-optics@1';
export const OPTIC_DEFAULTS=Object.freeze({enabled:true,irisColor:'#6a513a',irisSize:1,pupil:.37,limbal:.58,sclera:.48,vessels:.17,wetness:.78,contactShadow:.46,fiber:.65});
export const OPTIC_FIELDS=[['irisSize','虹膜尺寸',.85,1.15,.01],['pupil','瞳孔半径比例',.20,.62,.01],['limbal','虹膜外缘深浅',0,1,.05],['sclera','巩膜亮度',.30,.68,.01],['vessels','巩膜细血丝',0,.6,.02],['wetness','眼表与睑缘湿润反射',0,1,.05],['contactShadow','眼睑接触遮蔽',0,.8,.05],['fiber','虹膜纤维',0,1,.05]];
export function validateOptics(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid eye optics');
 const s={...OPTIC_DEFAULTS,...input};for(const k of Object.keys(s))if(!(k in OPTIC_DEFAULTS))throw Error('Unknown eye optic '+k);
 if(typeof s.enabled!=='boolean'||!/^#[a-f0-9]{6}$/i.test(s.irisColor))throw Error('Invalid ocular color/switch');
 for(const[k,,lo,hi]of OPTIC_FIELDS)if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)throw Error('Eye optic outside authoring range '+k);return s;
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>{const d=Math.hypot(...a);return d>1e-9?a.map(v=>v/d):[0,0,1];},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function liveFrame(api,side){
 const ids=side==='right'?{top:[39,38,37,36],low:[39,40,41,36]}:{top:[42,43,44,45],low:[42,47,46,45]};
 const origin=api.landmark(ids.top[0]),tip=api.landmark(ids.top[3]),axis=unit(sub(tip,origin)),width=Math.max(.003,Math.hypot(...sub(tip,origin)));
 const up0=sub(api.landmark(27),api.landmark(8)),up=unit(up0.map((v,j)=>v-axis[j]*dot(up0,axis)));
 const project=p=>{const d=sub(p,origin);return[dot(d,axis)/width,dot(d,up)];};
 function curve(list){const a=list.map(i=>project(api.landmark(i)));return makeSpline([[0,a[0][1]],[clamp(a[1][0],.10,.48),a[1][1]],[clamp(a[2][0],.52,.90),a[2][1]],[1,a[3][1]]]);}
 return {project,top:curve(ids.top),low:curve(ids.low),width};
}
// One dynamic attribute on the existing native geometry, not an extra eye shell.
// Distances use the current deformed landmarks, not a camera-space dark decal.
export function updateContactAttribute(viewer){
 const m=viewer.model,source=viewer.nativeGeometry||viewer.geometry,attribute='e15Contact',N=m.vertexCount;
 let attr=source.getAttribute(attribute);if(!attr){attr=new THREE.BufferAttribute(new Float32Array(N*3),3);source.setAttribute(attribute,attr);}
 const a=attr.array;for(let i=0;i<N;i++){a[i*3]=a[i*3+1]=100;a[i*3+2]=0;}
 const rows=[];for(const eye of m.eyeSurface.eyes){
  const f=liveFrame(m.eyeSurface,eye.side),point=i=>Array.from(m.positions.subarray(i*3,i*3+3));
  for(const i of eye.vertices){const [s,y]=f.project(point(i)),x=clamp(s,0,1);a[i*3]=(f.top(x)-y)*1000;a[i*3+1]=(y-f.low(x))*1000;}
  for(const {index:i,outer}of eye.patch){const[s,y]=f.project(point(i));if(s<0||s>1)continue;const d=Math.min(Math.abs(y-f.top(s)),Math.abs(y-f.low(s)))*1000;const taper=Math.pow(Math.max(0,Math.sin(Math.PI*s)),.35);a[i*3+2]=Math.max(a[i*3+2],Math.exp(-d*d/(.30*.30))*outer*taper);}
  rows.push({side:eye.side,widthMM:f.width*1000,openingMM:(f.top(.5)-f.low(.5))*1000,eyeVertices:eye.vertices.length});
 }
 attr.needsUpdate=true;
 // DenseSurface only updates position/color itself. Propagate this attribute
 // explicitly, including surfaces cached before the asynchronous skin was ready.
 for(const surface of viewer.surfaces?.values?.()||[]){let previous=source;for(const layer of surface.levels){const g=layer.geometry,P=previous.getAttribute(attribute);let q=g.getAttribute(attribute);if(!q){q=new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3),3);g.setAttribute(attribute,q);}q.array.set(P.array);for(let j=0;j<layer.pairs.length;j++){const[x,y]=layer.pairs[j],i=layer.oldCount+j;for(let k=0;k<3;k++)q.array[i*3+k]=(P.array[x*3+k]+P.array[y*3+k])*.5;}q.needsUpdate=true;previous=g;}}
 return rows;
}
const GLSL=`
uniform float uE15Enabled,uE15IrisSize,uE15Pupil,uE15Limbal,uE15Sclera,uE15Vessels,uE15Wetness,uE15ContactShadow,uE15Fiber;
uniform vec3 uE15IrisColor;
varying vec3 vE15Contact;
float e15Wave(float phase){return sin(phase)*(1.-smoothstep(.45,2.5,fwidth(phase)));}
vec3 fEyeColor(){
 float r=length(vFEye.xy)/uE15IrisSize,aa=max(fwidth(r),.003);
 float inside=1.-smoothstep(1.-aa,1.+aa,r),pupil=1.-smoothstep(uE15Pupil-aa,uE15Pupil+aa,r);
 float angle=atan(vFEye.y,vFEye.x)+vFEye.w*.71;
 float t=clamp((r-uE15Pupil)/max(.1,1.-uE15Pupil),0.,1.);
 float phase=angle*121.+e15Wave(angle*19.)*.8+t*7.;
 float fibers=.50+.19*e15Wave(phase)+.11*e15Wave(angle*211.-t*15.);
 float crypts=.5+.5*e15Wave(angle*37.+t*11.);
 vec3 iris=uE15IrisColor*mix(1.,.50+fibers,uE15Fiber);
 iris=mix(iris,iris*vec3(1.32,1.13,.78),exp(-pow((t-.22)/.13,2.))*.22*crypts);
 iris*=1.-uE15Limbal*.69*smoothstep(.80,1.0,r);
 float vesselPhase=angle*21.+2.3*e15Wave(r*10.+angle*3.);
 float narrow=1.-smoothstep(.018+fwidth(vesselPhase)*.12,.085+fwidth(vesselPhase)*.2,abs(sin(vesselPhase)));
 float vascular=narrow*smoothstep(1.05,1.8,r)*uE15Vessels;
 vec3 sclera=vec3(1.,.97,.90)*uE15Sclera;sclera*=vec3(1.-vascular*.12,1.-vascular*.56,1.-vascular*.47);
 vec3 c=mix(sclera,iris,inside);c=mix(c,vec3(.0015,.0018,.002),pupil);
 float contact=(.70*exp(-max(0.,vE15Contact.x)/.8)+.17*exp(-max(0.,vE15Contact.y)/.42))*uE15ContactShadow;
 c*=1.-clamp(contact,0.,.64);
 return mix(e15OldEye(),c,uE15Enabled);
}
`;
export function attachOptics(skin,api){
 if(skin.et15Optics)return skin.et15Optics;const v=skin.viewer,before=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material);
 const U={uE15Enabled:{value:1},uE15IrisColor:{value:new THREE.Color()}};for(const[k]of OPTIC_FIELDS)U['uE15'+k[0].toUpperCase()+k.slice(1)]={value:0};
 const ext={compiles:0,sync(){const s=api.settings;U.uE15Enabled.value=s.enabled?1:0;U.uE15IrisColor.value.set(s.irisColor);for(const[k]of OPTIC_FIELDS)U['uE15'+k[0].toUpperCase()+k.slice(1)].value=s[k];this.contacts=updateContactAttribute(v);},report(){return{compiles:this.compiles,contacts:this.contacts,sameMesh:true,refraction:false,tearMeniscusGeometry:false,lightDrivenSpecular:true};}};
 skin.et15Optics=ext;api.skins.add(skin);skin.material.customProgramCacheKey=()=>key()+'/ET15-ocular-contact-v1';
 skin.material.onBeforeCompile=shader=>{
  before(shader);Object.assign(shader.uniforms,U);ext.compiles++;
  shader.vertexShader='attribute vec3 e15Contact;varying vec3 vE15Contact;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvE15Contact=e15Contact;');
  const eye=/vec3 fEyeColor\(\)\{[^\n]*\}/;if(!eye.test(shader.fragmentShader))throw Error('Missing pinned native iris function');
  shader.fragmentShader=shader.fragmentShader.replace(eye,old=>old.replace('fEyeColor','e15OldEye')+'\n'+GLSL);
  const anchor='#include <lights_fragment_begin>';if(!shader.fragmentShader.includes(anchor))throw Error('Missing native physical lighting anchor');
  shader.fragmentShader=shader.fragmentShader.replace(anchor,`
   float e15Eye=uE15Enabled*step(3.5,vCSType)*clamp(vFEye.z,0.,1.);
   float e15Cornea=1.-smoothstep(1.05,1.24,length(vFEye.xy)/uE15IrisSize);
   material.roughness=mix(material.roughness,mix(.27,.115,uE15Wetness)*mix(1.,.7,e15Cornea),e15Eye);
   material.specularColor=mix(material.specularColor,vec3(.025),e15Eye);
   #ifdef USE_CLEARCOAT
   material.clearcoat=mix(material.clearcoat,uE15Wetness*.75,e15Eye);
   material.clearcoatRoughness=mix(material.clearcoatRoughness,.085,e15Eye);
   float e15Rim=clamp(vE15Contact.z,0.,1.)*uE15Enabled*uE15Wetness;
   material.clearcoat=mix(material.clearcoat,.68,e15Rim);material.clearcoatRoughness=mix(material.clearcoatRoughness,.13,e15Rim);
   #endif
   `+anchor);
 };
 const update=skin.update.bind(skin),dispose=skin.dispose.bind(skin);skin.update=()=>{update();ext.sync();};skin.dispose=()=>{api.skins.delete(skin);dispose();};
 ext.sync();skin.material.needsUpdate=true;v.render();return ext;
}
