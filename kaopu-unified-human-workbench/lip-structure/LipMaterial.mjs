import * as THREE from '../full/source/registration-vendor/three.module.js';
import {buildLipAtlas} from './LipMicrostructure.mjs';
/** Reference-space vermilion boundaries, aperiodic branching furrows and a
 * narrow moist inner band. Original skin tone/lip color/detail remain masters.
 * Artist-authored real-time approximation, not scanned reflectance or tissue. */
function railGLSL(name,points){
 const f=v=>Number(v).toFixed(9);let text=`float ${name}(float x){`;
 text+=`if(x<=${f(points[0][0])})return ${f(points[0][1])};`;
 for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1],l=points[Math.max(0,i-1)],r=points[Math.min(points.length-1,i+2)],h=q[0]-p[0],m=(q[1]-l[1])/(q[0]-l[0]),n=(r[1]-p[1])/(r[0]-p[0]);text+=`if(x<=${f(q[0])}){float t=clamp((x-(${f(p[0])}))/${f(h)},0.,1.);return (2.*t*t*t-3.*t*t+1.)*${f(p[1])}+(t*t*t-2.*t*t+t)*${f(h*m)}+(-2.*t*t*t+3.*t*t)*${f(q[1])}+(t*t*t-t*t)*${f(h*n)};}`;}
 return text+`return ${f(points.at(-1)[1])};}`;
}
export function attachLipMaterial(skin,api){
 if(skin.lipExtension)return;
 const previous=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material),U={uLEnabled:{value:1},uLFurrows:{value:.65},uLPigment:{value:.68},uLWet:{value:.35},uLRough:{value:.53},uLSoft:{value:.48},uLAtlas:{value:null},uLVariation:{value:.65},uLUpperShade:{value:.45},uLDryness:{value:.3},uLMicro:{value:.65},uLDebug:{value:0}};
 const r=api.rails;const declarations=`
 uniform float uLEnabled,uLFurrows,uLPigment,uLWet,uLRough,uLSoft,uLVariation,uLUpperShade,uLDryness,uLMicro,uLDebug;
 uniform sampler2D uLAtlas;
 ${railGLSL('lpTop',r.top)} ${railGLSL('lpBottom',r.bottom)} ${railGLSL('lpInTop',r.innerTop)} ${railGLSL('lpInBottom',r.innerBottom)}
 `;
 const patch=(s,a,b)=>{if(!s.includes(a))throw Error('Lip shader anchor changed: '+a);return s.replace(a,()=>b);};
 skin.material.onBeforeCompile=shader=>{
  previous(shader);Object.assign(shader.uniforms,U);skin.lipExtension.shaderCompiles++;
  shader.fragmentShader=patch(shader.fragmentShader,'#include <common>','#include <common>\n'+declarations);
  shader.fragmentShader=patch(shader.fragmentShader,'float csMacro=',`
   float lpTopY=lpTop(vFRest.x),lpBotY=lpBottom(vFRest.x),lpIT=lpInTop(vFRest.x),lpIB=lpInBottom(vFRest.x);
   float lpUpper=step((lpIT+lpIB)*.5,vFRest.y),lpV=mix((lpIB-vFRest.y)/max(.001,lpIB-lpBotY),(vFRest.y-lpIT)/max(.001,lpTopY-lpIT),lpUpper);
   vec2 lpMM=(vFRest.xy-vec2(${r.cx.toFixed(9)},${r.cy.toFixed(9)}))*1000.;
   float lpU=(vFRest.x-${r.cx.toFixed(9)})/${r.half.toFixed(9)};
   float lpBroad=csNoise(vec3(lpMM*vec2(.16,.24),31.))-0.5;
   float lpMottle=csNoise(vec3(lpMM*vec2(.65,.84)+lpBroad*.8,67.))-0.5;
   float lpBorderNoise=(csNoise(vec3(lpMM*vec2(2.1,1.2),13.))-.5)*.00013;
   float lpAA=max(fwidth(vFRest.y)*.8,mix(.00016,.00062,uLSoft));
   float lpExtent=1.-smoothstep(1.-.0007/${r.half.toFixed(9)},1.,abs(lpU));
   float lpThickness=smoothstep(0.,.00060,max(0.,lpTopY-lpBotY));
   float lpMask=smoothstep(lpBotY-lpAA,lpBotY+lpAA,vFRest.y+lpBorderNoise)*(1.-smoothstep(lpTopY-lpAA,lpTopY+lpAA,vFRest.y+lpBorderNoise));
   lpMask*=lpExtent*lpThickness*smoothstep(${r.front.toFixed(9)},${(r.front+.006).toFixed(9)},vFRest.z)*csCover*uLEnabled;
   csLip=mix(csLip,lpMask,uLEnabled);
   vec2 lpUV=vec2(clamp(lpU*.5+.5,0.,1.),(lpUpper+.06+.88*clamp(lpV,0.,1.))*.5);
   vec2 lpHeightBands=texture2D(uLAtlas,lpUV).rg-vec2(128./255.);
   float lpFoot=max(length(dFdx(lpMM)),length(dFdy(lpMM)));
   float lpVisible=1.-smoothstep(.12,.48,lpFoot),lpMicroVisible=1.-smoothstep(.045,.20,lpFoot);
   float lpDryPatch=uLDryness*smoothstep(-.12,.30,lpMottle)*smoothstep(.2,.85,lpV);
   float lpMoist=(1.-smoothstep(.015,.30,lpV))*lpMask*clamp(.78+lpMottle*.55+lpBroad*.28,.35,1.);
   float lpFine=lpHeightBands.x;
   float csMacro=`);
  shader.fragmentShader=patch(shader.fragmentShader,'csBase=mix(csBase,csLipColor*(1.+csMacro*.06),csLip*csLipMix);',`
   vec3 lpColor=mix(csBase,csLipColor,clamp(csLipMix*(.94+uLPigment*.38),0.,1.));
   float lpWarmCenter=exp(-pow((lpU-.12)/.56,2.))*exp(-pow((lpV-.32)/.7,2.));
   float lpTissue=(lpBroad*2.05+lpMottle*.64+lpWarmCenter*.11)*uLVariation;
   float lpTone=-lpUpper*uLUpperShade*.14+(1.-lpUpper)*.022;
   lpColor*=vec3(1.+lpTissue*.34+lpTone,1.-lpTissue*.51+lpTone,1.-lpTissue*.34+lpTone);
   lpColor*=1.+lpBroad*.10*uLVariation;
   lpColor=mix(lpColor,lpColor*vec3(1.025,.956,.962),lpMoist*.48);
   lpColor=mix(lpColor,mix(lpColor,csBase,.24)*1.025,lpDryPatch*.42);
   float lpOuterFade=smoothstep(.58,1.,lpV)*(.08+.10*(lpBroad+.5));
   lpColor=mix(lpColor,csBase,lpOuterFade+smoothstep(.60,1.,abs(lpU))*.045);
   // Only a small albedo residual in grooves: shape is carried by the normal.
   lpColor*=1.+lpFine*.030*uLFurrows*lpVisible;
   csBase=mix(csBase,mix(csLipColor*(1.+csMacro*.06),lpColor,uLEnabled),csLip*mix(csLipMix,1.,uLEnabled));
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'csSurface=mix(csSurface,csGrooves*.0000045+csMeso*.000007,csLip);','csSurface=mix(csSurface,csGrooves*.0000045+csMeso*.000007,csLip*(1.-uLEnabled));csSurface*=1.-lpMask;');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   float lpHeight=(lpHeightBands.x*.00025*uLFurrows*lpVisible+lpHeightBands.y*.00010*uLMicro*lpMicroVisible)*(1.-lpMoist*uLWet*.28)*lpMask*clamp(csDetail/.72,0.,2.1);
   vec3 lpDX=dFdx(-vViewPosition),lpDY=dFdy(-vViewPosition),lpR1=cross(lpDY,normal),lpR2=cross(normal,lpDX);float lpDet=dot(lpDX,lpR1);
   if(abs(lpDet)>1e-14)normal=normalize(abs(lpDet)*normal-sign(lpDet)*(dFdx(lpHeight)*lpR1+dFdy(lpHeight)*lpR2));
   roughnessFactor=mix(roughnessFactor,clamp(uLRough+(csRoughness-.62)*.30-lpMoist*uLWet*.21+lpDryPatch*.08+lpMottle*.055-lpFine*.045+.022*(1.-lpVisible),.28,.79),lpMask);
   #include <clearcoat_normal_fragment_maps>
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'h*=fMask*fHostDetail;','h*=fMask*fHostDetail*(1.-lpMask);');
  shader.fragmentShader=patch(shader.fragmentShader,'csPaint=mix(csPaint,paint,fMask);','csPaint=mix(csPaint,paint,fMask*(1.-lpMask));');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <opaque_fragment>',`
   if(uLDebug>.5&&uLDebug<1.5)outgoingLight=vec3(lpMask);
   if(uLDebug>1.5&&uLDebug<2.5)outgoingLight=diffuseColor.rgb;
   if(uLDebug>2.5&&uLDebug<3.5)outgoingLight=normal*.5+.5;
   if(uLDebug>3.5)outgoingLight=vec3(roughnessFactor);
   #include <opaque_fragment>
  `);
 const a='material.clearcoatRoughness=clamp(material.clearcoatRoughness-(.045*vFA.y+.015*vFA.w)*fMask,.23,.55);';
  shader.fragmentShader=patch(shader.fragmentShader,a,a+`
   material.clearcoat=mix(material.clearcoat,.010+csOil*.025+lpMoist*uLWet*.38,lpMask);
   material.clearcoatRoughness=mix(material.clearcoatRoughness,.43-lpMoist*uLWet*.20,lpMask);
  `);
 };
 skin.material.customProgramCacheKey=()=>key()+'/ET18-bounded-graph-vermilion-v2';skin.lipExtension={version:'ET18-L2',shaderCompiles:0,kind:'bounded lip field + seeded curve graph, not a scanned map',sourceHeadReplaced:false,oldSkinMastersRetained:true,distanceFiltering:true};api.skins.add(skin);
 const update=skin.updateFace?.bind(skin),dispose=skin.dispose.bind(skin);skin.updateLips=()=>{const s=api.settings;U.uLEnabled.value=s.enabled?1:0;for(const[k,n]of Object.entries({furrows:'uLFurrows',pigment:'uLPigment',wetness:'uLWet',dryRoughness:'uLRough',borderSoftness:'uLSoft',colorVariation:'uLVariation',upperShade:'uLUpperShade',dryness:'uLDryness',microRelief:'uLMicro'}))U[n].value=s[k];U.uLDebug.value=api.debug||0;
 const atlasKey=[s.patternSeed,s.textureDensity,r.half].join('/');
 if(api.atlasKey!==atlasKey){
  const a=buildLipAtlas({widthMM:r.half*2000,upperMM:Math.max(3,(r.top[3][1]-r.innerTop[2][1])*1000),lowerMM:Math.max(3,(r.innerBottom[2][1]-r.bottom[3][1])*1000),seed:s.patternSeed,density:s.textureDensity});
  const tex=new THREE.DataTexture(a.data,a.width,a.height,THREE.RGBAFormat,THREE.UnsignedByteType);tex.colorSpace=THREE.NoColorSpace;tex.flipY=false;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.anisotropy=Math.min(8,skin.viewer.renderer.capabilities.getMaxAnisotropy());tex.needsUpdate=true;
  api.microTexture?.dispose();api.microTexture=tex;api.atlasKey=atlasKey;api.atlasStats=a.stats;
 }
 U.uLAtlas.value=api.microTexture;skin.lipExtension.atlas=api.atlasStats;
 };skin.updateFace=()=>{update?.();skin.updateLips();};skin.dispose=()=>{api.skins.delete(skin);if(!api.skins.size){api.microTexture?.dispose();api.microTexture=null;api.atlasKey=null;}dispose();};skin.updateLips();skin.material.needsUpdate=true;
}
