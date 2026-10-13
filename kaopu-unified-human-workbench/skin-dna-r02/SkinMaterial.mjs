import * as THREE from '../full/source/registration-vendor/three.module.js';
import LUT from './BioSkinLUT.json';
// SKIN_DNA_REVIEW_REFINED_V2
import {seedVector} from './SkinProfile.mjs';
const declarations=`
uniform float uSDOn,uSDMel,uSDBlood,uSDVariation,uSDFreckles,uSDSun,uSDAge,uSDOil,uSDHydration,uSDPores,uSDPoreScale,uSDDetail,uSDFlush,uSDSweat,uSDDry,uSDView,uSDSeed;
uniform vec3 uSDOffset;
float sdCover=0.,sdSkin=0.,sdRough=.6,sdOil=0.,sdHeight=0.,sdPigment=0.;
float sdHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float sdNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(sdHash(i),sdHash(i+vec3(1,0,0)),f.x),mix(sdHash(i+vec3(0,1,0)),sdHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(sdHash(i+vec3(0,0,1)),sdHash(i+vec3(1,0,1)),f.x),mix(sdHash(i+vec3(0,1,1)),sdHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
// Official BioSkin fixed-property slice, sampled in LINEAR RGB.
uniform sampler2D uSDBioLUT;
vec3 sdBio(vec2 uv){vec2 p=clamp(uv,0.,1.)*vec2(32.,16.);ivec2 a=ivec2(floor(p)),b=min(a+ivec2(1),ivec2(32,16));vec2 f=fract(p);return mix(mix(texelFetch(uSDBioLUT,a,0).rgb,texelFetch(uSDBioLUT,ivec2(b.x,a.y),0).rgb,f.x),mix(texelFetch(uSDBioLUT,ivec2(a.x,b.y),0).rgb,texelFetch(uSDBioLUT,b,0).rgb,f.x),f.y);}
`;
export function installSkinMaterial(viewer){
 const m=viewer.skin.material,prior=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m),U={};
 for(const k of ['On','Mel','Blood','Variation','Freckles','Sun','Age','Oil','Hydration','Pores','PoreScale','Detail','Flush','Sweat','Dry','View','Seed'])U['uSD'+k]={value:0};U.uSDOffset={value:[0,0,0]};
 if(LUT.width!==33||LUT.height!==17||LUT.colorSpace!=='linear-sRGB')throw Error('BioSkin LUT contract changed');const pixels=new Float32Array(33*17*4);for(let i=0;i<33*17;i++){pixels.set(LUT.data.slice(i*3,i*3+3),i*4);pixels[i*4+3]=1;}const tex=new THREE.DataTexture(pixels,33,17,THREE.RGBAFormat,THREE.FloatType);tex.minFilter=THREE.NearestFilter;tex.magFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;U.uSDBioLUT={value:tex};
 const report={version:'SKIN-DNA-MATERIAL-R02',compiles:0,sourceGeometryChanged:false,wholeBodyIdentity:true,measuredOptics:false,chromophores:'Official BioSkin spectral decoder offline LUT; fixed 2D slice, not medical concentrations',bioSkinSource:LUT.sourceCommit,lutBytes:pixels.byteLength,addedWrinkleGeometry:false,noiseCreaseLayer:false,randomPigmentIslands:false,pores:'seeded subset and dimensions of retained area-sampled surface candidates',poreColourDots:false,specularIndependentOfMelanin:true};
 function once(s,a,b){if(s.split(a).length!==2)throw Error('Skin DNA shader anchor changed: '+a.slice(0,100));return s.replace(a,()=>b);}
 m.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);let f=declarations+'\n'+s.fragmentShader;
 const colour='diffuseColor.rgb*=mix(vec3(1.),rfBlood*(1.+rfChroma),rfArea);';
 f=once(f,colour,colour+`
 sdCover=clamp(csCover,0.,1.)*(1.-csBandVertex)*uSDOn;
 sdSkin=sdCover*(1.-clamp(lpMask,0.,1.))*(1.-clamp(eaM,0.,1.));
 // Anatomical envelopes are retained authored masks, not measured biomaps.
 vec3 sdP=vCSRest;
 float sdExposure=clamp(.26+.49*csT+.29*rfCheek+.13*rfForehead-.35*csPalm,0.,1.);
 sdPigment=clamp(uSDMel+uSDSun*sdExposure*.04,0.,1.)*(1.-csPalm*.18);
 float sdVascular=clamp(uSDBlood+uSDVariation*(.04*rfCheek+.02*rfNose-.012*csPalm)+uSDFlush*(.05+.18*rfCheek+.06*rfNose),0.,1.);
 vec3 sdAlbedo=sdBio(vec2(sdPigment,sdVascular));
 // Preserve the specialist ear's colour ratios; make its base identity agree
 // with the surrounding head. Preserve ET19 lip structure/wetness/creases.
 sdAlbedo*=mix(vec3(1.),vec3(1.03,.96,.97),clamp(eaM,0.,1.));
 diffuseColor.rgb=mix(diffuseColor.rgb,sdAlbedo,sdCover*(1.-clamp(lpMask,0.,1.)));
 diffuseColor.rgb*=mix(vec3(1.),exp(-uSDMel*vec3(.62,.74,.86)),sdCover*clamp(lpMask,0.,1.)*.72);
 `);
 // Preserve a bounded part of the actual inherited micro-normal rather than
 // resetting all face relief. A/B at On=0 reproduces the original reset.
 f=once(f,'normal=normalize(mix(normal,nonPerturbedNormal,rfArea));','normal=normalize(mix(normal,nonPerturbedNormal,rfArea*(1.-uSDOn*(.025+clamp(uSDDetail,0.,1.5)*.03))));');
 f=once(f,'vec4 a=rfRecord(id*2),b=rfRecord(id*2+1);','vec4 a=rfRecord(id*2),b=rfRecord(id*2+1);float sdId=sdHash(vec3(float(id),uSDSeed,7.));if(uSDOn>.5){if(sdId>.86)continue;a.w*=uSDPoreScale*mix(.82,1.14,sdId);b.w*=uSDPores*mix(.62,1.22,sdHash(vec3(float(id),uSDSeed,19.)));}');
 const surface='cSkinMask*=1.-eaM;cLobeWeight*=1.-rfArea*.82;';
 f=once(f,surface,surface+`
 float sdDryness=clamp((1.-uSDHydration)*.7+uSDDry*.6+csDry*.28,0.,1.);
 sdOil=clamp(uSDOil*(.28+.72*csT)+uSDSweat*.58,0.,1.);
 sdRough=clamp(.56+sdDryness*.105-sdOil*.19,.33,.84);
 roughnessFactor=mix(roughnessFactor,sdRough,sdSkin);
 cLobeWeight=mix(cLobeWeight,.06+sdOil*.25,sdSkin);
 // No synthesized noise heights or age-shaped channels in R02.
 // Preserved native microdetail is bounded above, not replaced by invented marks.

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
 m.customProgramCacheKey=()=>key()+'/skin-dna-r02-bioskin-v1';m.needsUpdate=true;
 return{U,report,update(record,view=0){const p=record.profile,t=record.state,vals={On:record.enabled?1:0,Mel:p.melanin,Blood:p.blood,Variation:p.variation,Freckles:p.freckles,Sun:p.sun,Age:p.age,Oil:p.oil,Hydration:p.hydration,Pores:p.pores,PoreScale:p.poreScale,Detail:p.detail,Flush:t.flush,Sweat:t.sweat,Dry:t.dryness,View:view,Seed:p.seed};for(const[k,v]of Object.entries(vals))U['uSD'+k].value=v;U.uSDOffset.value=seedVector(p.seed);},dispose(){tex.dispose();m.onBeforeCompile=prior;m.customProgramCacheKey=key;m.needsUpdate=true;}};
}
