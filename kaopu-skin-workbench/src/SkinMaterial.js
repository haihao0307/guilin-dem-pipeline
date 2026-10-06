import * as THREE from '../vendor/three.module.js';
export const DEFAULT_SKIN=()=>({tone:.42,blood:.48,mottle:.4,pores:.65,scale:1,roughness:.48,freckles:.15,lines:.35,scatter:.3,seed:12,enabled:true,colorLayer:true,microLayer:true,roughLayer:true});
export const PRESETS={porcelain:{tone:.18,blood:.52,mottle:.3,pores:.45,scale:.85,roughness:.48,freckles:.15,lines:.2,scatter:.3,seed:12},olive:{tone:.48,blood:.37,mottle:.5,pores:.7,scale:1,roughness:.46,freckles:.05,lines:.4,scatter:.25,seed:27},umber:{tone:.84,blood:.5,mottle:.45,pores:.6,scale:1.1,roughness:.42,freckles:.12,lines:.35,scatter:.2,seed:63}};
// Immutable reference-position field, attached to vertex IDs. No world-space/time noise.
export function skinAttributes(model,geometry){
 const masks=new Float32Array(model.vertexCount*4),material=new Float32Array(model.vertexCount),gnm=model.gnm;
 for(let i=0;i<model.vertexCount;i++){material[i]=0;if(i<model.bodyCount){masks.set([0,0,.12,0],i*4);continue;}const [a,b,t]=model.canonical.gnmRecipes[i-model.bodyCount];const src=t<.5?a:b,r=gnm.regionId[src],m=gnm.materialId[src];material[i]=m;
 const y=gnm.template[src*3+1],x=gnm.template[src*3],z=gnm.template[src*3+2];
 const lip=(r===17||r===18)?Math.exp(-Math.pow((y-.23)/.0075,2))*Math.max(0,1-Math.pow(x/.035,6)):0;
 const blush=[8,9,13,14,15,16].includes(r)?.8:r===10?.45:[6,7].includes(r)?.3:0;
 const oil=r===10?1:r===0||r===2?.65:r===19?.45:.2;
 masks.set([lip,blush,oil,m===0&&z>.065&&y>.18?1:0],i*4);
 }
 // Smooth regional weights only, never geometry, eyes/oral material IDs, or source data.
 const adjacent=Array.from({length:model.vertexCount},()=>new Set());for(let f=0;f<model.faces.length;f+=3){const a=model.faces[f],b=model.faces[f+1],c=model.faces[f+2];for(const [u,v]of [[a,b],[b,c],[c,a]]){adjacent[u].add(v);adjacent[v].add(u);}}
 for(let pass=0;pass<4;pass++){const next=masks.slice();for(let i=0;i<model.vertexCount;i++)if(material[i]===0){const n=[...adjacent[i]].filter(j=>material[j]===0);for(let k=0;k<4;k++)next[i*4+k]=masks[i*4+k]*.6+n.reduce((s,j)=>s+masks[j*4+k],0)/Math.max(1,n.length)*.4;}masks.set(next);}
 geometry.setAttribute('skinRest',new THREE.BufferAttribute(geometry.attributes.position.array.slice(),3));geometry.setAttribute('skinMask',new THREE.BufferAttribute(masks,4));geometry.setAttribute('skinKind',new THREE.BufferAttribute(material,1));
 return {restBytes:geometry.attributes.skinRest.array.byteLength,maskBytes:masks.byteLength+material.byteLength,uvUsed:false,semanticSource:'GNM official region_id/material_id; canonical barycentric recipes',reference:'immutable neutral canonical metres'};
}
const code=`
uniform float uTone,uBlood,uMottle,uPores,uScale,uRoughness,uFreckles,uLines,uScatter,uSeed,uEnabled,uColorLayer,uMicroLayer,uRoughLayer;
varying vec3 vSkinRest;varying vec4 vSkinMask;varying float vSkinKind;
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33+uSeed*.01);return fract((p.x+p.y)*p.z);}
float skinNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float poreField(vec3 p){vec3 q=p*(2100./uScale);float aa=1.-smoothstep(.3,1.4,max(length(dFdx(q)),length(dFdy(q))));float n=skinNoise(q);return smoothstep(.43,.82,n)*aa;}
vec3 microNormal(vec3 p,vec3 n,float h){vec3 dx=dFdx(p),dy=dFdy(p);vec3 r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);vec3 grad=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);return normalize(abs(det)*n-grad);}
`;
export function createSkin(profile){const uniforms={};for(const [k,v]of Object.entries(profile))uniforms['u'+k[0].toUpperCase()+k.slice(1)]={value:typeof v==='boolean'?+v:v};
 const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5,metalness:0});mat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 skinRest;attribute vec4 skinMask;attribute float skinKind;varying vec3 vSkinRest;varying vec4 vSkinMask;varying float vSkinKind;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSkinRest=skinRest;vSkinMask=skinMask;vSkinKind=skinKind;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+code).replace('#include <color_fragment>',`#include <color_fragment>
 vec3 rp=vSkinRest+vec3(uSeed*.017,0,0);float lip=clamp(vSkinMask.x,0.,1.);float isSkin=1.-step(.5,vSkinKind);float face=clamp(vSkinMask.w,0.,1.);float skinPatch=skinNoise(rp*80.)-.5;float grain=skinNoise(rp*340.)-.5;
 vec3 pale=vec3(.63,.38,.27),mid=vec3(.37,.205,.107),dark=vec3(.115,.052,.029);vec3 base=uTone<.5?mix(pale,mid,uTone*2.):mix(mid,dark,(uTone-.5)*2.);
 base*=1.+uMottle*(skinPatch*.19+grain*.085);base=mix(base,base*vec3(1.14,.77,.76),uBlood*(vSkinMask.y*.6+max(0.,skinPatch)*.6));
 base=mix(base,base*vec3(.92,.40,.39),lip*.83);float spots=smoothstep(.7,.82,skinNoise(rp*950.))*smoothstep(.45,.65,skinNoise(rp*47.));base*=1.-spots*uFreckles*.75*face;
 vec3 tissue=base;if(vSkinKind>.5&&vSkinKind<1.5)tissue=vec3(.75,.69,.55);if(vSkinKind>1.5&&vSkinKind<3.5)tissue=vec3(.28,.065,.075);if(vSkinKind>3.5&&vSkinKind<4.5)tissue=vec3(.72,.70,.64);if(vSkinKind>4.5&&vSkinKind<5.5)tissue=vec3(.085,.115,.065)*(1.+.22*sin(atan(rp.y,rp.x)*120.));if(vSkinKind>5.5)tissue=vec3(.003);
 diffuseColor.rgb=mix(vec3(.5),mix(vec3(.42,.25,.17),tissue,uColorLayer),uEnabled);
`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 float skinRough=clamp(uRoughness-.14*vSkinMask.z-.10*lip+skinPatch*.065,.22,.8);if(vSkinKind>3.5)skinRough=.15;if(vSkinKind>.5&&vSkinKind<3.5)skinRough=.28;roughnessFactor=mix(.64,mix(uRoughness,skinRough,uRoughLayer),uEnabled);
`).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 float pore=poreField(rp);float fine=skinNoise(rp*vec3(850.,1600.,850.))-.5;float wrinkle=sin(rp.y*2300.+skinNoise(rp*130.)*3.);float heightMicro=(-pore*uPores*.000028*(.28+.72*face)*(1.-lip*.85)+fine*.000004+wrinkle*uLines*.000005*face)*isSkin*uMicroLayer*uEnabled;
 normal=microNormal(-vViewPosition,normal,heightMicro);
`).replace('#include <opaque_fragment>',`
 // Thin, view-dependent warm rim approximation. No diffusion, thickness map, or true SSS.
 float grazing=pow(1.-abs(dot(normal,normalize(vViewPosition))),3.);outgoingLight+=diffuseColor.rgb*vec3(1.,.18,.08)*grazing*uScatter*.14*isSkin*uEnabled;
 #include <opaque_fragment>`);};mat.customProgramCacheKey=()=> 'kaopu-procedural-skin-r01';return {material:mat,update:()=>{for(const [k,v]of Object.entries(profile))uniforms['u'+k[0].toUpperCase()+k.slice(1)].value=typeof v==='boolean'?+v:v;}};
}
