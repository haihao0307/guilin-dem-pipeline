import * as THREE from '../full/source/registration-vendor/three.module.js';
/** Additive extension of CommonSkinLayer. Its color, lip masks, settings,
 * material instance and original body shading remain the host, not a fallback.
 * F1.1: original detail, variation and oil are master controls for the extra
 * surface bands. Defaults preserve the F1 look; zero never leaves a hidden layer.
 */
let atlasPromise=null;
export function faceAtlases(){
 if(!atlasPromise){const loader=new THREE.TextureLoader();atlasPromise=Promise.all(['detail.png','chroma.png'].map(name=>loader.loadAsync(new URL('./assets/'+name,import.meta.url).href).then(t=>{t.colorSpace=THREE.NoColorSpace;t.flipY=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t;})));}return atlasPromise;
}
const neutral=()=>{const t=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);t.needsUpdate=true;return t;};
const declaration=`
uniform float uFEnabled,uFDetail,uFMeso,uFColor,uFPigment,uFBlood,uFOil,uFWrap,uFAge,uFLayer,uFPass;
uniform sampler2D uFAtlas,uFChroma;
varying vec3 vFRest;varying vec4 vFA,vFB,vFEye;
vec2 fAtlasUV(vec2 mm,float tile,vec2 span){vec2 q=fract(mm/span);q=(q*252.+2.)/256.;return (vec2(mod(tile,4.),floor(tile/4.))+q)/vec2(4.,2.);}
vec3 fPatch(sampler2D tex,vec2 mm,float tile,vec2 span){return texture2D(tex,fAtlasUV(mm,tile,span)).rgb;}
vec3 fBands(sampler2D tex,vec2 mm){vec3 r=fPatch(tex,mm,vFRest.x>0.?7.:0.,vFRest.x>0.?vec2(14.):vec2(18.));
 if(vFB.x>.001)r=mix(r,fPatch(tex,mm,1.,vec2(20.)),vFB.x);
 if(vFA.w>.001)r=mix(r,fPatch(tex,mm,2.,vec2(10.,14.)),vFA.w);
 // Chin uses clean adjacent skin frequency, not the scan's beard stubble.
 if(vFB.w>.001)r=mix(r,fPatch(tex,mm,7.,vec2(14.)),vFB.w);
 if(vFA.z>.001)r=mix(r,fPatch(tex,mm,6.,vec2(12.)),vFA.z);
 if(vFA.y>.001)r=mix(r,fPatch(tex,mm,3.,vec2(25.,8.)),vFA.y);
 return r;
}
vec2 fHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float fPores(vec2 mm){vec2 p=mm/.38;vec2 cell=floor(p),f=fract(p);float h=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 c=vec2(float(x),float(y)),r=fHash(cell+c),d=c+.2+.6*r-f;float angle=6.28*r.x;d=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;d*=vec2(1.35,.8+.35*r.y);float rr=dot(d,d);h+=(-exp(-rr*75.)+.2*exp(-rr*22.))*(.65+.5*r.x);}return h;}
vec3 fEyeColor(){float r=length(vFEye.xy),aa=max(fwidth(r),.008),iris=1.-smoothstep(.97-aa,1.+aa,r),pupil=1.-smoothstep(.43-aa,.43+aa,r);float a=atan(vFEye.y,vFEye.x)+vFEye.w*.43;float fiber=.65+.15*sin(a*97.+r*18.)+.10*sin(a*177.-r*31.);vec3 irisColor=vec3(.095,.058,.029)*fiber;irisColor*=mix(1.,.26,smoothstep(.76,.96,r));vec3 c=mix(vec3(.69,.71,.66),irisColor,iris);return mix(c,vec3(.004,.0045,.005),pupil);}
`;
export function attachFaceSkin(skin){
 const api=skin.viewer.model.faceSurface;if(!api||skin.faceExtension)return;
 const f=api.fields,g=skin.viewer.geometry;for(const[name,data,size]of[['fRest',f.rest,3],['fA',f.a,4],['fB',f.b,4],['fEye',f.eye,4]])g.setAttribute(name,new THREE.BufferAttribute(data,size));
 const a=neutral(),b=neutral(),U={uFEnabled:{value:1},uFDetail:{value:1},uFMeso:{value:.75},uFColor:{value:.5},uFPigment:{value:0},uFBlood:{value:.35},uFOil:{value:.55},uFWrap:{value:.28},uFAge:{value:.5},uFLayer:{value:0},uFPass:{value:0},uFAtlas:{value:a},uFChroma:{value:b}};
 const prior=skin.material.onBeforeCompile,cache=skin.material.customProgramCacheKey.bind(skin.material);const ext={version:'ET12-F1.1',U,ready:false,errors:[],fields:f.report,shaderCompiles:0,hostMasters:{detail:'csDetail / 0.72',colorVariation:'csVariation / 0.4',oil:'csOil / 0.18'},masterControlLimits:'normalized artistic gains, not physical measurement'};skin.faceExtension=ext;api.skins.add(skin);
 skin.material.customProgramCacheKey=()=>cache()+'/ET12-composed-face-master-controls-v1';
 const patch=(text,anchor,replacement)=>{if(!text.includes(anchor))throw Error('Native skin integration anchor missing: '+anchor);return text.replace(anchor,()=>replacement);};
 skin.material.onBeforeCompile=shader=>{
  prior(shader);ext.shaderCompiles++;Object.assign(shader.uniforms,U);shader.vertexShader='attribute vec3 fRest;attribute vec4 fA,fB,fEye;varying vec3 vFRest;varying vec4 vFA,vFB,vFEye;\n'+shader.vertexShader;
  shader.vertexShader=patch(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvFRest=fRest;vFA=fA;vFB=fB;vFEye=fEye;');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <common>','#include <common>\n'+declaration);
  shader.fragmentShader=patch(shader.fragmentShader,'vec3 csPaint=mix(csOther,csBase,csCover);',`vec3 csPaint=mix(csOther,csBase,csCover);
   vec2 fMM=vFRest.xy*1000.;float fMask=clamp(vFA.x,0.,1.)*uFEnabled;vec3 fData=vec3(.5),fChroma=vec3(.5);
   float fHostDetail=clamp(csDetail/.72,0.,2.1),fHostVariation=clamp(csVariation/.4,0.,2.5),fHostOil=clamp(csOil/.18,0.,2.);
   if(fMask>.001){fData=fBands(uFAtlas,fMM);fChroma=fBands(uFChroma,fMM);
    // The donor contributes residuals; the host keeps complexion and lip color.
    float chromaGain=uFColor*(1.-vFB.w*.8)*fHostVariation;vec3 residual=exp(clamp(fChroma-.5,vec3(-.18),vec3(.18))*chromaGain*.65);
    vec3 paint=csPaint*residual*exp(-uFPigment*vec3(1.,1.43,1.8));
    float blood=clamp(vFB.y*.5+vFA.w*.27+vFB.z*.60,0.,1.);paint*=vec3(1.+uFBlood*blood*.055,1.-uFBlood*blood*.075,1.-uFBlood*blood*.060);
    csPaint=mix(csPaint,paint,fMask);
   }
   if(vFEye.z>.01&&vCSType>3.5)csPaint=mix(csPaint,fEyeColor(),vFEye.z*uFEnabled);
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'float csHeight=csSurface*csDetail*csCover;', 'float csHeight=csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65);');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   if(fMask>.001){float visibility=1.-smoothstep(.6,1.6,max(length(dFdx(fMM)),length(dFdy(fMM)))/.38);
    float thin=1.-vFA.z*.70,lip=1.-vFA.y*.78,maturity=smoothstep(.25,.65,uFAge);
    float ageGain=mix(.28,1.,maturity);
    float h=((fData.r-.5)*.000032*uFDetail+(fData.g-.5)*.000090*uFMeso)*(thin*lip)*ageGain;
    h+=fPores(fMM)*.000006*uFDetail*visibility*ageGain*(1.-vFA.y)*(1.-vFA.z*.85)*(1.+vFA.w*.35);h*=fMask*fHostDetail;
    vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),R1=cross(dy,normal),R2=cross(normal,dx);float det=dot(dx,R1);
    if(abs(det)>1e-14)normal=normalize(abs(det)*normal-sign(det)*(dFdx(h)*R1+dFdy(h)*R2));
    roughnessFactor=clamp(roughnessFactor+(fData.b-.5)*.18*fMask*fHostDetail-vFA.w*.025*fMask+vFA.z*.015*fMask,.24,.90);
   }
   #include <clearcoat_normal_fragment_maps>
   #ifdef USE_CLEARCOAT
   clearcoatNormal=normal;
   #endif
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   #ifdef USE_CLEARCOAT
   material.clearcoat=clamp(material.clearcoat+fMask*uFOil*fHostOil*(.04+.08*vFA.w+.08*vFA.y),0.,.60);material.clearcoatRoughness=clamp(material.clearcoatRoughness-(.045*vFA.y+.015*vFA.w)*fMask,.23,.55);
   #endif
  `);
  let physical=THREE.ShaderChunk.lights_physical_pars_fragment;
  physical=patch(physical,'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',`float fNL=dot(geometryNormal,directLight.direction);float halfLambert=max(fNL*.5+.5,0.);vec3 wrapRGB=mix(vec3(dotNL),vec3(halfLambert),vec3(.675,.45,.45)*uFWrap);reflectedLight.directDiffuse+=mix(vec3(dotNL),wrapRGB,vFA.x*uFEnabled)*directLight.color*BRDF_Lambert(material.diffuseColor);`);
  shader.fragmentShader=patch(shader.fragmentShader,'#include <lights_physical_pars_fragment>',physical);
  shader.fragmentShader=patch(shader.fragmentShader,'#include <opaque_fragment>',`
   vec3 fDiffuse=totalDiffuse;
   #ifdef USE_CLEARCOAT
   fDiffuse*=1.-material.clearcoat*Fcc;
   #endif
   if(uFPass>.5&&uFPass<1.5){gl_FragColor=vec4(fDiffuse,fMask);return;}
   if(uFPass>1.5){gl_FragColor=vec4(diffuseColor.rgb,fMask);return;}
   if(uFLayer>.5&&uFLayer<1.5)outgoingLight=diffuseColor.rgb;
   if(uFLayer>1.5&&uFLayer<2.5)outgoingLight=normal*.5+.5;
   if(uFLayer>2.5&&uFLayer<3.5)outgoingLight=vec3(roughnessFactor);
   if(uFLayer>3.5)outgoingLight=mix(outgoingLight,vec3(vFA.y+vFA.w*.5,vFB.x+vFB.y*.35,vFA.z+vFB.z*.5),fMask);
   #include <opaque_fragment>
  `);
 };
 const previousUpdate=skin.update.bind(skin),previousDispose=skin.dispose.bind(skin);
 skin.updateFace=()=>{const s=api.settings;for(const[k,n]of Object.entries({detail:'uFDetail',meso:'uFMeso',colorDetail:'uFColor',pigment:'uFPigment',blood:'uFBlood',oil:'uFOil',wrap:'uFWrap'}))U[n].value=s[k];U.uFEnabled.value=s.enabled?1:0;U.uFLayer.value=['beauty','color','normal','roughness','regions'].indexOf(s.layer);U.uFAge.value=skin.viewer.model.state?.anny?.phenotypes?.age??.66;};
 skin.update=()=>{previousUpdate();skin.updateFace();};skin.dispose=()=>{api.skins.delete(skin);a.dispose();b.dispose();previousDispose();};
 skin.faceReady=faceAtlases().then(([detail,chroma])=>{if(skin.disposed)return;U.uFAtlas.value=detail;U.uFChroma.value=chroma;ext.ready=true;a.dispose();b.dispose();skin.viewer.render();}).catch(e=>{ext.errors.push(String(e));throw e;});
 skin.updateFace();skin.material.needsUpdate=true;
}
export function installFaceSkinBridge(model){model.faceSurface.attachSkin=attachFaceSkin;}
export function patchGrayEyeMaterial(material){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();material.customProgramCacheKey=()=>key+'/ET12-circular-pupil';material.onBeforeCompile=s=>{before(s);s.vertexShader='attribute vec4 fEye;varying vec4 vEyeGray;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeGray=fEye;');s.fragmentShader='varying vec4 vEyeGray;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('diffuseColor.rgb*=tone;',`float r=length(vEyeGray.xy),aa=max(fwidth(r),.008);if(vEyeGray.z>.01&&vETType>3.5){float iris=1.-smoothstep(.97-aa,1.+aa,r),pupil=1.-smoothstep(.43-aa,.43+aa,r);tone=mix(tone,mix(mix(1.,.45,iris),.12,pupil),vEyeGray.z);}diffuseColor.rgb*=tone;`);
 };material.needsUpdate=true;
}
