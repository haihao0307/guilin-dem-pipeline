// SKIN_DNA_REVIEW_REFINED_V2
import {seedVector} from './SkinProfile.mjs';
const declarations=`
uniform float uSDOn,uSDMel,uSDBlood,uSDVariation,uSDFreckles,uSDSun,uSDAge,uSDOil,uSDHydration,uSDPores,uSDPoreScale,uSDDetail,uSDFlush,uSDSweat,uSDDry,uSDView,uSDSeed;
uniform vec3 uSDOffset;
float sdCover=0.,sdSkin=0.,sdRough=.6,sdOil=0.,sdHeight=0.,sdPigment=0.;
float sdHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float sdNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(sdHash(i),sdHash(i+vec3(1,0,0)),f.x),mix(sdHash(i+vec3(0,1,0)),sdHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(sdHash(i+vec3(0,0,1)),sdHash(i+vec3(1,0,1)),f.x),mix(sdHash(i+vec3(0,1,1)),sdHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
// Smooth, sparse pigment islands. Pigment NEVER displaces the surface.
float sdSpots(vec2 p,float amount,float footprint){vec2 cell=floor(p),f=fract(p);float v=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec2 o=vec2(float(x),float(y));vec3 k=vec3(cell+o,uSDSeed*.001);float h=sdHash(k);vec2 c=vec2(sdHash(k+13.),sdHash(k+71.));vec2 delta=f-o-c;delta.x*=mix(.78,1.28,sdHash(k+53.));float angle=atan(delta.y,delta.x);float r=mix(.075,.28,sdHash(k+39.))*(1.+.17*sin(angle*3.+h*13.)+.10*sin(angle*5.+h*29.));float d=length(delta),aa=max(r*.25,footprint);float island=1.-smoothstep(max(0.,r-aa),r+aa,d);v+=island*step(h,amount*.42)*mix(.28,1.,sdHash(k+29.));}return clamp(v,0.,1.);}
`;
export function installSkinMaterial(viewer){
 const m=viewer.skin.material,prior=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m),U={};
 for(const k of ['On','Mel','Blood','Variation','Freckles','Sun','Age','Oil','Hydration','Pores','PoreScale','Detail','Flush','Sweat','Dry','View','Seed'])U['uSD'+k]={value:0};U.uSDOffset={value:[0,0,0]};
 const report={version:'SKIN-DNA-MATERIAL-R01',compiles:0,sourceGeometryChanged:false,wholeBodyIdentity:true,measuredOptics:false,chromophores:'RGB absorption surrogate, not spectral concentrations',pores:'seeded subset and dimensions of retained area-sampled surface candidates',poreColourDots:false,specularIndependentOfMelanin:true};
 function once(s,a,b){if(s.split(a).length!==2)throw Error('Skin DNA shader anchor changed: '+a.slice(0,100));return s.replace(a,()=>b);}
 m.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);let f=declarations+'\n'+s.fragmentShader;
 const colour='diffuseColor.rgb*=mix(vec3(1.),rfBlood*(1.+rfChroma),rfArea);';
 f=once(f,colour,colour+`
 sdCover=clamp(csCover,0.,1.)*(1.-csBandVertex)*uSDOn;
 sdSkin=sdCover*(1.-clamp(lpMask,0.,1.))*(1.-clamp(eaM,0.,1.));
 vec3 sdP=vCSRest,sdQ=sdP+uSDOffset;
 float sdCoarse=sdNoise(sdP*47.+uSDOffset),sdMedium=sdNoise(sdP*191.+uSDOffset*1.7),sdFine=sdNoise(sdP*641.+uSDOffset*2.3);
 float sdExposure=clamp(.26+.49*csT+.29*rfCheek+.13*rfForehead-.35*csPalm,0.,1.);
 float sdVar=(sdCoarse-.5)*.046+(sdMedium-.5)*.044+(sdFine-.5)*.022;
 vec2 sdChart=mix(sdP.xy,vFRest.xy,clamp(vFA.x,0.,1.))*510.+uSDOffset.xy;
 float sdFoot=max(length(dFdx(sdChart)),length(dFdy(sdChart)));
 float sdFreckle=sdSpots(sdChart,uSDFreckles,sdFoot*.6)*(1.-smoothstep(.35,1.3,sdFoot));
 sdFreckle*=mix(.045,clamp(.16+.75*rfCheek+.64*rfNose,0.,1.),clamp(vFA.x,0.,1.));
 float sdAgeSpot=smoothstep(.57,.79,sdNoise(sdP*139.+uSDOffset*2.1))*uSDAge*uSDSun*.12;
 sdPigment=max(0.,uSDMel+uSDSun*sdExposure*.075+sdVar*uSDVariation+sdFreckle*.145+sdAgeSpot);
 sdPigment*=1.-csPalm*.32;
 float sdVascular=uSDBlood*(.70+.48*rfCheek+.29*rfNose+.15*csThin)+uSDFlush*(.12+.30*rfCheek+.18*rfNose);
 sdVascular*=1.+uSDVariation*((sdNoise(sdP*83.+uSDOffset*3.1)-.5)*.35+(sdMedium-.5)*.16);
 vec3 sdAlbedo=vec3(.69,.62,.53)*exp(-sdPigment*vec3(2.75,3.35,3.85)-sdVascular*vec3(.20,1.05,.74));
 // Preserve the specialist ear's colour ratios; make its base identity agree
 // with the surrounding head. Preserve ET19 lip structure/wetness/creases.
 sdAlbedo*=mix(vec3(1.),vec3(1.03,.96,.97),clamp(eaM,0.,1.));
 diffuseColor.rgb=mix(diffuseColor.rgb,sdAlbedo,sdCover*(1.-clamp(lpMask,0.,1.)));
 diffuseColor.rgb*=mix(vec3(1.),exp(-uSDMel*vec3(.62,.74,.86)),sdCover*clamp(lpMask,0.,1.)*.72);
 `);
 // Preserve a bounded part of the actual inherited micro-normal rather than
 // resetting all face relief. A/B at On=0 reproduces the original reset.
 f=once(f,'normal=normalize(mix(normal,nonPerturbedNormal,rfArea));','normal=normalize(mix(normal,nonPerturbedNormal,rfArea*(1.-uSDOn*.06)));');
 f=once(f,'vec4 a=rfRecord(id*2),b=rfRecord(id*2+1);','vec4 a=rfRecord(id*2),b=rfRecord(id*2+1);float sdId=sdHash(vec3(float(id),uSDSeed,7.));if(uSDOn>.5){if(sdId>.86)continue;a.w*=uSDPoreScale*mix(.82,1.14,sdId);b.w*=uSDPores*mix(.62,1.22,sdHash(vec3(float(id),uSDSeed,19.)));}');
 const surface='cSkinMask*=1.-eaM;cLobeWeight*=1.-rfArea*.82;';
 f=once(f,surface,surface+`
 float sdDryness=clamp((1.-uSDHydration)*.7+uSDDry*.6+csDry*.28,0.,1.);
 sdOil=clamp(uSDOil*(.28+.72*csT)+uSDSweat*.58,0.,1.);
 sdRough=clamp(.56+sdDryness*.105+uSDAge*.025-sdOil*.19+(sdMedium-.5)*.068*uSDVariation,.33,.84);
 roughnessFactor=mix(roughnessFactor,sdRough,sdSkin);
 cLobeWeight=mix(cLobeWeight,.06+sdOil*.25,sdSkin);
 vec3 sdMicro=sdP*vec3(1900.,2300.,1900.)+uSDOffset;
 float sdPixel=max(length(dFdx(sdP)),length(dFdy(sdP)));
 float sdFade=1.-smoothstep(.00010,.00048,sdPixel);
 float sdGrain=sdNoise(sdMicro)-.5;
 float sdCrease=pow(max(0.,.65-sdNoise(sdP*vec3(470.,1780.,590.)+uSDOffset*2.)),3.);
 sdHeight=((sdGrain*.000018+((sdFine-.5)*.000010))*(.5+sdDryness*.8)-sdCrease*.000035*uSDAge)*uSDDetail*sdFade*sdSkin;
 vec3 sdX=dFdx(-vViewPosition),sdY=dFdy(-vViewPosition),sdR1=cross(sdY,normal),sdR2=cross(normal,sdX);float sdDet=dot(sdX,sdR1);
 if(abs(sdDet)>1e-14){vec3 sdSlope=sign(sdDet)*(dFdx(sdHeight)*sdR1+dFdy(sdHeight)*sdR2)/abs(sdDet);sdSlope*=min(1.,.18/max(length(sdSlope),.00001));normal=normalize(normal-sdSlope);}
 // Lost subpixel relief contributes to roughness instead of glitter.
 roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor+(1.-sdFade)*uSDDetail*.015,.30,.86),sdSkin);
 `);
 const spec='material.specularColor=mix(material.specularColor,vec3(.032)*(1.+uRFOil*.10),rfArea);';
 f=once(f,spec,spec+'material.specularColor=mix(material.specularColor,vec3(.028),sdSkin);');
 const coat='material.clearcoatRoughness=mix(material.clearcoatRoughness,.50,rfArea);';
 f=once(f,coat,coat+'material.clearcoat=mix(material.clearcoat,uSDSweat*.12,sdSkin);material.clearcoatRoughness=mix(material.clearcoatRoughness,.32,sdSkin);');
 f=once(f,'vec3 rfW=vec3(.28,.14,.075)*uRFScatter;','vec3 rfW=vec3(.28,.14,.075)*uRFScatter*mix(1.,.62*(1.-uSDMel*.48),uSDOn);');
 f=once(f,'#include <opaque_fragment>',`
 if(uSDView>.5&&uSDView<1.5)outgoingLight=diffuseColor.rgb;
 if(uSDView>1.5&&uSDView<2.5)outgoingLight=mix(outgoingLight,vec3(roughnessFactor),sdCover);
 if(uSDView>2.5&&uSDView<3.5)outgoingLight=normal*.5+.5;
 if(uSDView>3.5&&uSDView<4.5)outgoingLight=mix(outgoingLight,vec3(sdPigment),sdCover);
 #include <opaque_fragment>`);
 s.fragmentShader=f;report.compiles++;report.fragmentBytes=f.length;report.uniforms=Object.keys(U);};
 m.customProgramCacheKey=()=>key()+'/skin-dna-r01-v2';m.needsUpdate=true;
 return{U,report,update(record,view=0){const p=record.profile,t=record.state,vals={On:record.enabled?1:0,Mel:p.melanin,Blood:p.blood,Variation:p.variation,Freckles:p.freckles,Sun:p.sun,Age:p.age,Oil:p.oil,Hydration:p.hydration,Pores:p.pores,PoreScale:p.poreScale,Detail:p.detail,Flush:t.flush,Sweat:t.sweat,Dry:t.dryness,View:view,Seed:p.seed};for(const[k,v]of Object.entries(vals))U['uSD'+k].value=v;U.uSDOffset.value=seedVector(p.seed);},dispose(){m.onBeforeCompile=prior;m.customProgramCacheKey=key;m.needsUpdate=true;}};
}
