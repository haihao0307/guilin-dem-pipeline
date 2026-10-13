import * as THREE from '../full/source/registration-vendor/three.module.js';
import {attachEarMaterial as attachR04} from '../ear-root-r04/EarMaterial.mjs';
/** The tested R04 ownership/material stack remains the host and live A/B path.
 * Surface pores use barycentric surfels; deep scattering uses model thickness.
 * No alpha transparency, emissive red layer, new head or external texture. */
export function attachEarMaterial(skin,api){
 attachR04(skin,api);const prior=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material);
 const count=skin.viewer.geometry.attributes.position.count;skin.viewer.geometry.setAttribute('eTissue',new THREE.BufferAttribute(new Float32Array(count*4),4));
 const empty=new THREE.DataTexture(new Float32Array([0,0,0,0]),1,1,THREE.RGBAFormat,THREE.FloatType);empty.needsUpdate=true;
 const U={uETIndex:{value:empty},uETPores:{value:empty},uETHash:{value:0},uETActive:{value:1},uETDebug:{value:0}};
 const funcs=`
 uniform sampler2D uETIndex,uETPores;uniform int uETHash;uniform float uETActive,uETDebug;
 varying vec3 vETPosition;varying vec4 vETissue;
 vec4 etRecord(int n){return texelFetch(uETPores,ivec2(n%512,n/512),0);}
 float etPoreHeight(vec3 p,float size,float footprint){
  if(uETHash==0)return 0.;ivec3 cell=ivec3(floor(p/.50));
  uint h=(uint(cell.x)*73856093u)^(uint(cell.y)*19349663u)^(uint(cell.z)*83492791u);int bucket=int(h&uint(uETHash-1));float height=0.;
  vec4 meta=texelFetch(uETIndex,ivec2(bucket%512,bucket/512),0);
  for(int j=0;j<128;j++){if(j>=int(meta.y))break;int slot=int(meta.x)+j,address=slot/4;vec4 etIndices4=texelFetch(uETIndex,ivec2(address%512,address/512),0);int id=int(etIndices4[slot%4]);
   vec4 a=etRecord(id*2),b=etRecord(id*2+1);vec3 d=p-a.xyz;
   float support2=dot(d,d);if(support2>.1296)continue;
   float dn=dot(d,b.xyz),tangent2=max(0.,support2-dn*dn),r=a.w*clamp(size/.28,.55,1.97),r2=r*r;
   float filtered=r2+footprint*footprint*.22;
   float cutoff=1.-smoothstep(.28*.28,.36*.36,support2);
   float bowl=-exp(-tangent2/max(filtered,.0001))+.11*exp(-tangent2/max(filtered*2.7,.0001));
   height+=b.w*bowl*(r2/filtered)*exp(-dn*dn/.009)*cutoff;
  }
  return height*.001;
 }
 vec3 etTransport(float nl,float strength,float lobe){
  float pathMM=clamp(vETissue.x,.15,35.)/max(abs(nl),.40);
  // Artist-calibrated effective attenuation, not measured spectral coefficients.
  vec3 sigma=mix(vec3(.19,.43,.67),vec3(.17,.39,.61),lobe);
  vec3 trans=exp(-sigma*pathMM);
  return trans*max(-nl,0.)*clamp(strength*2.4,0.,1.25)*vETissue.y;
 }
 `;
 const patch=(s,a,b)=>{if(!s.includes(a))throw Error('R05 shader anchor missing: '+a.slice(0,90));return s.replace(a,()=>b)};
 skin.material.onBeforeCompile=shader=>{
  prior(shader);Object.assign(shader.uniforms,U);
  shader.vertexShader='attribute vec4 eTissue;varying vec4 vETissue;varying vec3 vETPosition;\n'+shader.vertexShader;
  shader.vertexShader=patch(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvETissue=eTissue;vETPosition=position;');
  shader.fragmentShader=funcs+'\n'+shader.fragmentShader;
  const colour='eaColour*=1.+eaVariation*.035+eaMottle*.018;';
  shader.fragmentShader=patch(shader.fragmentShader,colour,colour+`
   float etLobe=1.-smoothstep(.253,.264,vFRest.y),etCartilage=1.-etLobe;
   float etTissueRed=eaS.x*(.22+.20*eaBowl+.14*etLobe+.08*eaRim);
   vec3 etColour=csPaint*vec3(1.+etTissueRed*.34,1.-etTissueRed*.23,1.-etTissueRed*.19);
   etColour*=1.+eaVariation*.023+eaMottle*.007;
   eaColour=mix(eaColour,etColour,uETActive);
  `);
  const start=shader.fragmentShader.indexOf('vec2 eaMM=vFRest.zy*1000.;'),end=shader.fragmentShader.indexOf('#include <clearcoat_normal_fragment_maps>',start);
  if(start<0||end<start)throw Error('R04 ear pore block not found');
  const old=shader.fragmentShader.slice(start,end).replace('float eaOil=eaD.z*(.30+.70*eaBowl);','');
  const micro=`
   float eaOil=eaD.z*(.30+.70*eaBowl);
   if(uETActive<.5){${old}}else{
    vec3 etMM=vETPosition*1000.;float etFoot=max(length(dFdx(etMM)),length(dFdy(etMM)));
    float etVisibility=1.-smoothstep(.08,.27,etFoot);
    float etPore=0.;if(eaM>.0001&&uFPass<1.5&&etVisibility>.001)etPore=etPoreHeight(etMM,eaD.x,etFoot);
    float etDensity=.32+eaBowl*.32+etLobe*.10;
    // No pigment dots: pores alter the microscopic surface, not the albedo.
    float etHeight=etPore*eaS.y*etDensity*etVisibility;
    // Isotropic three-dimensional meso relief, never a flat ZY stipple overlay.
    float etMeso=(csNoise(vETPosition*830.)-.5)*.0000020*eaD.y;
    etHeight=(etHeight+etMeso*(1.-smoothstep(.25,.8,etFoot)))*eaM*clamp(csDetail/.72,0.,2.1);
    vec3 etDX=dFdx(-vViewPosition),etDY=dFdy(-vViewPosition),etR1=cross(etDY,normal),etR2=cross(normal,etDX);float etDet=dot(etDX,etR1);
    if(abs(etDet)>1e-14){vec3 slope=sign(etDet)*(dFdx(etHeight)*etR1+dFdy(etHeight)*etR2)/abs(etDet);float slopeLen=length(slope);slope*=min(1.,.28/max(slopeLen,.0001));normal=normalize(normal-slope);}
    float etRough=eaS.z-.090-eaRim*.035-eaBowl*.040+etLobe*.030-eaOil*.025+eaMottle*.020+eaS.y*.014*(1.-etVisibility);
    roughnessFactor=mix(roughnessFactor,clamp(etRough+(csRoughness-.62)*.15,.32,.86),eaM);
   }
   `;
  shader.fragmentShader=shader.fragmentShader.slice(0,start)+micro+shader.fragmentShader.slice(end);
  const light='reflectedLight.directDiffuse+=mix(vec3(dotNL),wrapRGB,vFA.x*uFEnabled)*directLight.color*BRDF_Lambert(material.diffuseColor);float eaBack=pow(max(-fNL,0.),1.8)*eaMask(vFRest)*eaThin(vFRest)*eaSetting(vFRest).w;reflectedLight.directDiffuse+=eaBack*directLight.color*BRDF_Lambert(material.diffuseColor)*vec3(.46,.115,.052);';
  shader.fragmentShader=patch(shader.fragmentShader,light,`
   vec3 etOld=mix(vec3(dotNL),wrapRGB,vFA.x*uFEnabled);
   float eaBack=pow(max(-fNL,0.),1.8)*eaMask(vFRest)*eaThin(vFRest)*eaSetting(vFRest).w;
   etOld+=eaBack*vec3(.46,.115,.052);
   float etMask=eaMask(vFRest)*uETActive,etSoft=1.-smoothstep(.253,.264,vFRest.y);
   vec3 etWrap=clamp((vec3(fNL)+vec3(.22,.10,.055))/vec3(1.22,1.10,1.055),0.,1.);
   vec3 etLight=etWrap+etTransport(fNL,eaSetting(vFRest).w,etSoft);
   reflectedLight.directDiffuse+=mix(etOld,etLight,etMask)*directLight.color*BRDF_Lambert(material.diffuseColor);
  `);
  shader.fragmentShader=shader.fragmentShader.replaceAll('(1.-eaM*.86)','(1.-eaM*mix(.86,.69,uETActive))');
  shader.fragmentShader=patch(shader.fragmentShader,'material.clearcoat=mix(material.clearcoat,.012+eaOil*.15,eaM);','material.clearcoat=mix(material.clearcoat,mix(.012+eaOil*.15,.008+eaOil*.07,uETActive),eaM);');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <opaque_fragment>',`
   if(uETDebug>.5&&uETDebug<1.5){float t=clamp(vETissue.x/12.,0.,1.);outgoingLight=mix(vec3(.03,.08,.13),mix(vec3(.95,.12,.05),vec3(.10,.28,.90),t),eaM);if(vETissue.w<.5&&eaM>.1)outgoingLight=vec3(.12);}
   if(uETDebug>1.5&&uETDebug<2.5){float f=max(length(dFdx(vETPosition*1000.)),length(dFdy(vETPosition*1000.)));float h=etPoreHeight(vETPosition*1000.,eaD.x,f);outgoingLight=mix(vec3(.1),vec3(clamp(.6+h*50000.,0.,1.)),eaM);}
   if(uETDebug>2.5){outgoingLight=mix(vec3(.03),exp(-clamp(vETissue.x,.15,35.)*vec3(.19,.43,.67))*vETissue.y,eaM);}
   #include <opaque_fragment>
  `);
  skin.earExtension.shaderCompilesR05=(skin.earExtension.shaderCompilesR05||0)+1;
 };
 skin.material.customProgramCacheKey=()=>key()+'/EAR-R05-barycentric-surfels-geometric-thickness-1';
 Object.assign(skin.earExtension,{version:'EAR-R05.0',earChart:'area-sampled barycentric seeds + current-space circular tangent kernels',measuredScattering:false,opaque:true,deepScattering:'normal-ray envelope thickness / bounded directional attenuation',planarPoreProjection:false});
 skin.setEarTissueField=field=>{U.uETIndex.value=field.indexTexture;U.uETPores.value=field.poreTexture;U.uETHash.value=field.hashSize;skin.earExtension.tissue=field.report;};
 skin.earTissueActive=on=>{U.uETActive.value=on?1:0;skin.viewer.render();};skin.earTissueDebug=n=>{U.uETDebug.value=n;skin.viewer.render();};
 const dispose=skin.dispose.bind(skin);skin.dispose=()=>{empty.dispose();dispose();};skin.material.needsUpdate=true;
}
