import FIT from './ReferenceSurfaceFit.json';
import {packLabialSignal,signalReport} from './LabialSignal.mjs';
import {appendSkinSignal,skinSignalMeans,skinSignalNormalMeans,skinSignalReport} from './SkinSignal.mjs';
import AO from './SurfaceOcclusionFit.json';
// Measured low-frequency fields, independent seeded high-frequency synthesis.
// No reference bitmap, mesh, normal map or displacement map is loaded here.
const num=n=>Number(n).toFixed(7),v4=a=>'vec4('+a.map(num).join(',')+')';
const grid=FIT.grid.map(a=>v4(a.slice(0,4))).join(',');
const tissueGrid=FIT.grid.map(a=>v4(a.slice(4,8))).join(',');
const lip=(which,offset=0)=>Array.from({length:15},(_,i)=>v4(FIT[which].coefficients.slice(offset,offset+4).map(c=>c[i]))).join(',');
const occlusionBody=AO.centres.map(c=>`{vec3 q=(p-vec3(${c.p.map(num)}))/vec3(${c.span.map(num)});float d=dot(q,q);if(d<16.)depth+=${num(c.amplitude)}*exp(-.5*d);}`).join('\n');
const declarations=`
uniform float uPSRelief,uPSWet,uPSTone,uPSSeed;
uniform int uPSSkinRow;
float psSurfaceOcclusion(vec3 p){float depth=0.;${occlusionBody}return clamp(exp(-depth),.06,1.);}
const vec4 psSkinCoefficients[56]=vec4[56](${grid});
const vec4 psTissueCoefficients[56]=vec4[56](${tissueGrid});
const vec4 psUpperCoefficients[15]=vec4[15](${lip('upper')});
const vec4 psLowerCoefficients[15]=vec4[15](${lip('lower')});
const vec4 psUpperTissueCoefficients[15]=vec4[15](${lip('upper',4)});
const vec4 psLowerTissueCoefficients[15]=vec4[15](${lip('lower',4)});
const float psRoughMeans[4]=float[4](${skinSignalMeans.map(num).join(',')});
const vec2 psSignalMeans[4]=vec2[4](${skinSignalNormalMeans.map(a=>'vec2('+a.map(num).join(',')+')').join(',')});
vec3 psSkinSignal(int tileIndex,vec2 mm){
 vec2 centre=tileIndex==0?vec2(40.,270.):tileIndex==1?vec2(10.,264.):tileIndex==2?vec2(0.,205.):vec2(25.,330.);
 vec2 p=(mm-centre)/10.+.5;
 // The retained reference signal is mirrored smoothly, with a small continuous
 // flow warp; random pits are not substituted for the measured pore pattern.
 p+=vec2(sdNoise(vec3(mm*.12,13.))-.5,sdNoise(vec3(mm*.11,31.))-.5)*.06;
 vec2 uv=1.-abs(fract(p*.5)*2.-1.),q=clamp(uv*64.-.5,0.,63.);ivec2 a=ivec2(floor(q)),b=min(a+1,ivec2(63));vec2 f=fract(q);
 a.x+=tileIndex*64;b.x+=tileIndex*64;a.y+=uPSSkinRow;b.y+=uPSSkinRow;
 vec3 v=mix(mix(texelFetch(uRFPores,a,0).rgb,texelFetch(uRFPores,ivec2(b.x,a.y),0).rgb,f.x),mix(texelFetch(uRFPores,ivec2(a.x,b.y),0).rgb,texelFetch(uRFPores,b,0).rgb,f.x),f.y);
 vec2 orientation=vec2(1.)-2.*step(vec2(.5),fract(p*.5));
 return vec3((v.xy-psSignalMeans[tileIndex])*orientation+psSignalMeans[tileIndex]*.15,v.z-psRoughMeans[tileIndex]);
}
vec4 psField(vec2 p){
 vec2 q=clamp((p-vec2(-.08,.20))/vec2(.16,.145),0.,1.)*vec2(6.,7.);
 ivec2 a=ivec2(floor(q)),b=min(a+1,ivec2(6,7));vec2 f=fract(q);f=f*f*(3.-2.*f);
 return mix(mix(psSkinCoefficients[a.y*7+a.x],psSkinCoefficients[a.y*7+b.x],f.x),mix(psSkinCoefficients[b.y*7+a.x],psSkinCoefficients[b.y*7+b.x],f.x),f.y);
}
vec4 psTissueField(vec2 p){
 vec2 q=clamp((p-vec2(-.08,.20))/vec2(.16,.145),0.,1.)*vec2(6.,7.);ivec2 a=ivec2(floor(q)),b=min(a+1,ivec2(6,7));vec2 f=fract(q);f=f*f*(3.-2.*f);
 return mix(mix(psTissueCoefficients[a.y*7+a.x],psTissueCoefficients[a.y*7+b.x],f.x),mix(psTissueCoefficients[b.y*7+a.x],psTissueCoefficients[b.y*7+b.x],f.x),f.y);
}
vec4 psLabial(float u,float v,float upper){
 u=clamp(u,-1.,1.);v=clamp(v,0.,1.);float a=abs(u);
 float b[15]=float[15](1.,u,u*u,u*u*u,v,v*v,v*v*v,u*v,u*u*v,u*v*v,sin(3.14159265*v),cos(3.14159265*u),a,a*v,a*v*v);
 vec4 c=vec4(0.);for(int i=0;i<15;i++)c+=mix(psLowerCoefficients[i],psUpperCoefficients[i],upper)*b[i];
 return clamp(c,vec4(.005,.005,.005,.30),vec4(.85,.8,.8,.78));
}
vec4 psLabialTissue(float u,float v,float upper){
 u=clamp(u,-1.,1.);v=clamp(v,0.,1.);float a=abs(u);float b[15]=float[15](1.,u,u*u,u*u*u,v,v*v,v*v*v,u*v,u*u*v,u*v*v,sin(3.14159265*v),cos(3.14159265*u),a,a*v,a*v*v);
 vec4 c=vec4(0.);for(int i=0;i<15;i++)c+=mix(psLowerTissueCoefficients[i],psUpperTissueCoefficients[i],upper)*b[i];return clamp(c,vec4(.01),vec4(1.));
}
`;
export function installReferenceProceduralSurface({model,viewer}){
 if(window.referenceSurface)return window.referenceSurface;
 const material=viewer.skin.material,prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.shadowSide=2;
 const U={uPSOn:{value:1},uPSRelief:{value:1},uPSWet:{value:.35},uPSTone:{value:1},uPSSeed:{value:41731},uPSScatter:{value:.22},uPSSkinRow:{value:0}};
 let enabled=true,preset='reference',compiles=0;
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Reference surface anchor changed: '+a.slice(0,80));return s.replace(a,()=>b);};
 material.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);let f='uniform float uPSOn,uPSScatter;vec3 psTissueTint=vec3(0.);float psTissueCover=0.;\n'+s.fragmentShader;
 // Inject after the shared noise implementation so all helper declarations are available.
 f=once(f,'void main() {',declarations+'\nvoid main() {');
 const colour='diffuseColor.rgb=mix(diffuseColor.rgb,lsLip,lsLipCoverage*uLSOn);';
 f=once(f,colour,colour+`
 float psFace=clamp(max(vFA.x,lpMask),0.,1.)*sdCover*(1.-clamp(eaM,0.,1.))*uPSOn;
 vec4 psSkin=psField(vFRest.xy),psLip=psLabial(lpU,lpV,lpUpper);
 vec3 psIdentity=clamp(sdBio(vec2(uSDMel,uSDBlood))/max(sdBio(vec2(.22,.24)),vec3(.015)),vec3(.12),vec3(2.5));
 vec3 psTissueRatio=clamp(lsAlbedo/max(sdBio(vec2(sdPigment,lsReferenceBlood)),vec3(.02)),vec3(.82),vec3(1.17));
 vec3 psBase=psSkin.rgb*psIdentity*mix(vec3(1.),psTissueRatio,.38);
 float psMeso=sdNoise(vFRest*360.+uSDOffset)-.5;
 psBase*=vec3(1.+psMeso*.025,1.-psMeso*.035,1.-psMeso*.024);
 // Fit-derived vermilion RGB, separate upper/lower polynomial fields.
 vec3 psRed=psLip.rgb*pow(psIdentity,vec3(.72));
 psRed*=mix(vec3(1.),vec3(1.015,.97,.98),lpMucosa*.55);
 float psTransition=smoothstep(.58,1.10,lpV)*mix(.86,.98,lpUpper);
 psRed=mix(psRed,psBase,psTransition);
 psRed*=1.+lpBroad*.025*uLVariation;
 vec3 psAlbedo=mix(psBase,psRed,clamp(lpMask,0.,1.));
 diffuseColor.rgb=mix(diffuseColor.rgb,psAlbedo,psFace);
 vec4 psTissue=mix(psTissueField(vFRest.xy),psLabialTissue(lpU,lpV,lpUpper),clamp(lpMask,0.,1.));
 float psAO=psSurfaceOcclusion(vFRest);
 psTissueTint=psTissue.rgb*pow(psIdentity,vec3(.7));psTissueCover=psFace*psAO*psAO;
 `);
 const direct='rfAngular,max(rfArea,lsLipCoverage*uLSOn))*directLight.color*BRDF_Lambert(material.diffuseColor);';
 f=once(f,direct,direct+`
 // Reference-informed, view-dependent thin-tissue light term. It is an
 // appearance approximation; the measured source tint remains independent.
 vec3 psBent=normalize(directLight.direction+geometryNormal*.23);
 float psBack=pow(max(0.,dot(geometryViewDir,-psBent)),2.)*.6;
 reflectedLight.directDiffuse+=(.2+psBack)*.4*uPSScatter*psTissueTint*directLight.color*psTissueCover;
 `);
 f=once(f,'vec3 rfAngular=max((vec3(fNL)+rfW)/(1.+rfW),vec3(0.))/(1.+rfW);','vec3 rfAngular=mix(max((vec3(fNL)+rfW)/(1.+rfW),vec3(0.))/(1.+rfW),vec3(dotNL),uPSOn);');
 f=once(f,'#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=mix(1.,psAO,psFace);reflectedLight.indirectSpecular*=mix(1.,sqrt(psAO),psFace);');
 const rough='float lsOil=clamp(uSDOil*(.18+.82*csT)*uLSFilm+uSDSweat*.35,0.,1.);';
 f=once(f,rough,`
 // Own procedural surface replaces the former stacked relief on the face.
 vec3 psRestMM=vFRest*1000.;float psFoot=max(length(dFdx(psRestMM)),length(dFdy(psRestMM)));
 vec2 psSignalMM=vec2(abs(psRestMM.x),psRestMM.y);
 vec3 psSkinSample=psSkinSignal(0,psSignalMM);
 psSkinSample=mix(psSkinSample,psSkinSignal(1,psSignalMM),clamp(rfNose,0.,1.));
 psSkinSample=mix(psSkinSample,psSkinSignal(2,psSignalMM),1.-smoothstep(.212,.238,vFRest.y));
 psSkinSample=mix(psSkinSample,psSkinSignal(3,psSignalMM),smoothstep(.305,.325,vFRest.y));
 normal=normalize(mix(normal,nonPerturbedNormal,psFace));
 // Sparse functions fitted to actual teacher normal data own the labial relief.
 // No handmade pore or lip-curve relief is added by this module.
 vec2 psN=(texture2D(uLAtlas,lpUV).ba*2.-1.)*vec2(.4,-.4)*uPSRelief;
 vec3 psDP1=dFdx(-vViewPosition),psDP2=dFdy(-vViewPosition);vec2 psDU1=dFdx(vFRest.xy),psDU2=dFdy(vFRest.xy);
 float psD=psDU1.x*psDU2.y-psDU1.y*psDU2.x;
 if(abs(psD)>1e-14){vec3 psT=normalize((psDP1*psDU2.y-psDP2*psDU1.y)/psD),psB=normalize((psDP2*psDU1.x-psDP1*psDU2.x)/psD);
  psT=normalize(psT-nonPerturbedNormal*dot(psT,nonPerturbedNormal));
  psB=normalize(cross(nonPerturbedNormal,psT))*sign(dot(cross(nonPerturbedNormal,psT),psB));
  vec2 psSkinSlope=psSkinSample.xy*vec2(.4,-.4)*.70*uPSRelief*(1.-smoothstep(.18,.60,psFoot));
  vec2 psFitSlope=mix(psSkinSlope,psN,clamp(lpMask,0.,1.));
  vec3 psFitNormal=normalize(nonPerturbedNormal+psT*psFitSlope.x+psB*psFitSlope.y);
  normal=normalize(mix(normal,psFitNormal,psFace));
 }
 `+rough);
 const after='roughnessFactor=mix(roughnessFactor,lsLipRough,lsLipCoverage*uLSOn);';
 f=once(f,after,after+`
 float psRough=mix(psSkin.a,psLip.a,clamp(lpMask,0.,1.));
 psRough+=psSkinSample.z*(1.-lpMask)+(sdNoise(vFRest*1700.+uSDOffset)-.5)*.015;
 psRough-=max(0.,uSDOil-.27)*.10*(1.-lpMask);
 psRough-=lpMoist*uPSWet*.075;psRough+=lpDryPatch*.05;
 roughnessFactor=mix(roughnessFactor,clamp(psRough,.34,.78),psFace);
 `);
 // Previous R02's extra regular cosine striae must not stack with the fit-based curves.
 f=once(f,'if(uLSOn>.5){\n  float lsPhase=','if(uLSOn>.5&&uPSOn<.5){\n  float lsPhase=');
 
 // Use the existing stable layer boundary rather than relying on a numeric F0 literal.
 const anchor='material.clearcoatRoughness=mix(material.clearcoatRoughness,.30-lpMoist*lpWetGain*.13,lsLipCoverage*uLSOn);';
 f=once(f,anchor,anchor+`
 material.clearcoat=mix(material.clearcoat,.005+lpMoist*max(0.,uPSWet-.35)*.12,lsLipCoverage*uPSOn);
 material.clearcoatRoughness=mix(material.clearcoatRoughness,.36-lpMoist*uPSWet*.13,lsLipCoverage*uPSOn);
 material.clearcoat=mix(material.clearcoat,.008+lsOil*.02,sdSkin*uPSOn);
 material.clearcoatRoughness=mix(material.clearcoatRoughness,.37,sdSkin*uPSOn);
 `);
 const sheen='material.sheenColor=vec3(.8,.76,.70)*uCFuzz*cSkinMask*(1.-csT*.72)*(.55+.45*csNoise(vCSRest*1900.));material.sheenRoughness=.8;';
 f=once(f,sheen,sheen+'material.sheenColor=mix(material.sheenColor,psTissueTint*.85,psFace);');
 f=once(f,'lsWrapWidth=mix(lsWrapWidth,vec3(.28,.14,.09),clamp(lpMask,0.,1.));','lsWrapWidth=mix(lsWrapWidth,mix(vec3(.28,.14,.09),vec3(.11,.055,.03),uPSOn),clamp(lpMask,0.,1.));');
 s.fragmentShader=f;compiles++;};
 material.customProgramCacheKey=()=>key()+'/reference-surface-procedural-r03';material.needsUpdate=true;
 function select(id){const settings={reference:[1,.35],soft:[.72,.5],defined:[1.18,.22]}[id];if(!settings)throw Error('Unknown reference surface preset');preset=id;U.uPSRelief.value=settings[0];U.uPSWet.value=settings[1];viewer.render();}
 const nativeUpdateLips=viewer.skin.updateLips.bind(viewer.skin);
 const pack=()=>packLabialSignal(model.lipStructure.microTexture);
 viewer.skin.updateLips=()=>{nativeUpdateLips();pack();};pack();
 const bindTable=t=>{U.uPSSkinRow.value=appendSkinSignal(t);};bindTable(viewer.currentFacePores.poreTexture);
 const api={select,bindTable,tune(p){for(const[k,v]of Object.entries(p)){if(!['Scatter','Relief','Wet'].includes(k)||!Number.isFinite(v)||v<0||v>2)throw Error('Invalid appearance value');U['uPS'+k].value=v;}viewer.render();},setEnabled(on){enabled=!!on;U.uPSOn.value=enabled?1:0;viewer.render();return enabled;},compare(){return this.setEnabled(!enabled);},archive:()=>({schema:'kaopu.reference-surface/1',enabled,preset}),restore(o){if(o?.schema!=='kaopu.reference-surface/1')throw Error('Invalid surface archive');select(o.preset);this.setEnabled(o.enabled);},report:()=>({version:'REFERENCE-PROCEDURAL-SURFACE-R03',enabled,preset,compiles,source:FIT.source,fit:{upper:FIT.upper.rmse,lower:FIT.lower.rmse,regionalCoefficients:FIT.grid.length,lipTermsPerChannel:15,normalSignal:signalReport(),skinSignal:skinSignalReport()},externalImagesLoaded:0,geometryOperations:0,vertexDisplacement:false,extraSamplers:0,normalMethod:'reference-data-fitted sparse cosine fields on lips and four skin regions; bounded normal transfer, correlated roughness and continuous phase warp',limits:FIT.limits})};window.referenceSurface=api;
 // Fine appearance no longer relies on the older lip mesh furrow generator.
 model.lipStructure.anatomy.set({microGeometry:0});
 const nativeUpdate=viewer.update.bind(viewer);
 viewer.update=(...args)=>{model.foldProfile.settings.strength=0;model.foldProfile.settings.makeup=0;model.faceSurface.settings.structure=0;return nativeUpdate(...args);};
 model.foldProfile.settings.strength=0;model.foldProfile.settings.makeup=0;model.faceSurface.settings.structure=0;
 return api;
}
