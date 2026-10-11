import * as THREE from '../full/source/registration-vendor/three.module.js';
import original0 from './assets/Harvey_eye1.png';
import original1 from './assets/Harvey_eye2.png';
import cleanURL from './assets/sclera-clean.png';
import vesselsURL from './assets/sclera-vessels.png';
let texturesPromise;
function textures(){
 if(!texturesPromise){const loader=new THREE.TextureLoader();texturesPromise=Promise.all([original0,original1,cleanURL,vesselsURL].map((url,i)=>loader.loadAsync(url).then(t=>{t.colorSpace=i===3?THREE.NoColorSpace:THREE.SRGBColorSpace;t.flipY=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t;})));}return texturesPromise;
}
const declarations=`
uniform sampler2D neOriginal0,neOriginal1,neClean,neVessels;
uniform float neEnabled,neReference,neReady;
uniform vec4 neIris[2],neTint[2],neInner[2],neSclera[2],neMisc[2],neSurface[2];
uniform vec3 neLightView;
int neSide(){return vFEye.w>.5?1:0;}
vec2 neAtlas(vec2 q,int side,float source){vec2 center=side==0?vec2(.7104,.3032):vec2(.2896,.6988);float radius=source<.5?.1185:.1215;return clamp(center+vec2(q.x,-q.y)*radius,vec2(.001),vec2(.999));}
vec3 neSource(vec2 uv,float source){vec3 a=texture2D(neOriginal0,uv).rgb,b=texture2D(neOriginal1,uv).rgb;return mix(a,b,step(.5,source));}
vec2 neRefract(vec2 q,int side){
 // Bounded view-dependent refraction approximation. The native eyeball remains
 // the outer envelope; the iris is sampled as a recessed optical layer.
 vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);vec2 ux=dFdx(vFEye.xy),uy=dFdy(vFEye.xy);float det=ux.x*uy.y-ux.y*uy.x;
 if(abs(det)>1e-12){vec3 tx=(dx*uy.y-dy*ux.y)/det,ty=(dy*ux.x-dx*uy.x)/det;vec3 n=normalize(vNormal),ray=refract(-normalize(vViewPosition),n,1./1.376);float z=max(.35,abs(dot(ray,n)));vec2 shift=vec2(dot(ray,normalize(tx))/max(length(tx),.002),dot(ray,normalize(ty))/max(length(ty),.002))*.0012*neSurface[side].w/z;q+=clamp(shift,vec2(-.16),vec2(.16))*(1.-smoothstep(.8,1.18,length(q)));}return q;
}
vec3 neEyeColor(){
 int side=neSide();vec4 iris=neIris[side],tint=neTint[side],inner=neInner[side],sclera=neSclera[side],misc=neMisc[side];vec2 q=vFEye.xy;
 if(neReference>.5)return neSource(neAtlas(q,side,iris.w),iris.w);
 q=neRefract(q,side)/iris.x;float rotation=misc.z;q=mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation))*q;
 float r=length(q),aa=max(fwidth(r),.004),sourcePupil=iris.w<.5?.405:.295;
 float nativeRadius=sourcePupil+clamp((r-iris.y)/(1.-iris.y),0.,1.)*(1.-sourcePupil);
 vec2 iq=q/max(r,.0001)*nativeRadius;vec3 color=neSource(neAtlas(iq,side,iris.w),iris.w);
 float lum=max(dot(color,vec3(.2126,.7152,.0722)),.006);
 vec3 recolored=tint.rgb*clamp(lum/.125,.16,2.4);color=mix(color,recolored,tint.a);
 float innerMask=1.-smoothstep(iris.y+.04,iris.y+.32,r);vec3 innerPaint=inner.rgb*clamp(lum/.125,.16,2.4);color=mix(color,innerPaint,inner.a*innerMask);
 color=max(vec3(.001),mix(vec3(lum),color,misc.w));color*=iris.z;
 color*=1.-misc.y*.38*smoothstep(.82,.985,r);
 vec2 sq=vFEye.xy;float sr=length(sq);sq*=min(1.,2.3/max(sr,.001));vec2 suv=neAtlas(sq,side,0.);
 vec3 white=texture2D(neClean,suv).rgb;white=mix(white,vec3(.73,.72,.68),sclera.x*.68);
 white*=vec3(1.,1.-sclera.y*.11,1.-sclera.y*.38);
 float corner=smoothstep(1.05,2.15,sr);white*=vec3(1.+sclera.z*.055,1.-sclera.z*(.09+.18*corner),1.-sclera.z*(.065+.13*corner));
 vec4 vein=texture2D(neVessels,suv);float coverage=smoothstep(vein.b-.045,vein.b+.045,misc.x)*step(.001,misc.x);float vascular=clamp(vein.r*coverage*sclera.w,0.,1.);
 white=mix(white,white*vec3(.70,.23,.19),vascular*.70);
 float irisMask=1.-smoothstep(.987-aa,1.02+aa,r);vec3 result=mix(white,color,irisMask);
 float pupilMask=1.-smoothstep(iris.y-aa,iris.y+aa,r);result=mix(result,vec3(.0015,.0019,.0022),pupilMask);
 return result;
}
float neStudioReflection(vec3 n){
 vec3 eyeView=normalize(vViewPosition),reflection=reflect(-eyeView,n),L=normalize(neLightView);vec3 X=normalize(cross(vec3(0.,1.,0.),L)),Y=cross(L,X);float forward=dot(reflection,L);
 vec2 projected=vec2(dot(reflection,X),dot(reflection,Y))/max(forward,.001);
 float box=(1.-smoothstep(.055,.095,abs(projected.x)))*(1.-smoothstep(.13,.19,abs(projected.y)))*step(0.,forward);
 float fresnel=.025+(.975)*pow(1.-max(dot(eyeView,n),0.),5.);return box*fresnel;
}
`;
export function attachNaturalEyeMaterial(skin,api){
 if(skin.naturalEyeExtension)return;
 const before=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material),oldDispose=skin.dispose.bind(skin),oldUpdate=skin.updateFace?.bind(skin),oldRender=skin.material.onBeforeRender;
 const fallback=new THREE.DataTexture(new Uint8Array([180,178,166,255]),1,1);fallback.needsUpdate=true;
 const U={neOriginal0:{value:fallback},neOriginal1:{value:fallback},neClean:{value:fallback},neVessels:{value:fallback},neEnabled:{value:1},neReference:{value:0},neReady:{value:0},neLightView:{value:new THREE.Vector3(-.45,.65,1).normalize()}};
 for(const k of ['neIris','neTint','neInner','neSclera','neMisc','neSurface'])U[k]={value:[new THREE.Vector4(),new THREE.Vector4()]};
 const ext={version:'ET15-E1',ready:false,shaderCompiles:0,errors:[],originalTextures:[1024,1024],sourceAuthors:['callharvey3d'],sourcePack:'system_eye_materials03',license:'CC-BY as listed by source pack',unmodifiedSourcePNGs:true,bodyMaterialChanged:false,medicalSimulation:false};skin.naturalEyeExtension=ext;api.skins.add(skin);
 function patch(text,anchor,replacement){if(text.split(anchor).length!==2)throw Error('眼球材质接口不匹配：'+anchor);return text.replace(anchor,()=>replacement);}
 skin.material.customProgramCacheKey=()=>key()+'/ET15-source-eye-optics-v1';
 skin.material.onBeforeCompile=shader=>{
  before(shader);Object.assign(shader.uniforms,U);ext.shaderCompiles++;
  const original=shader.fragmentShader.match(/vec3 fEyeColor\(\)\{[^\n]*\}/g);if(original?.length!==1)throw Error('未找到原生眼球颜色接口');
  shader.fragmentShader=patch(shader.fragmentShader,original[0],original[0]+'\n'+declarations);
  shader.fragmentShader=patch(shader.fragmentShader,'if(vFEye.z>.01&&vCSType>3.5)csPaint=mix(csPaint,fEyeColor(),vFEye.z*uFEnabled);',`if(vCSType>3.5){vec3 priorEye=mix(csPaint,fEyeColor(),vFEye.z*uFEnabled);csPaint=mix(priorEye,neEyeColor(),neEnabled*neReady);}`);
  shader.fragmentShader=patch(shader.fragmentShader,'roughnessFactor=mix(vCSType>3.5?.25:.46,csSurfaceRough,csCover);',`roughnessFactor=mix(vCSType>3.5?.25:.46,csSurfaceRough,csCover);
   if(vCSType>3.5&&neEnabled*neReady>.5){int side=neSide();float radial=length(vFEye.xy)/neIris[side].x;float cornea=1.-smoothstep(.94,1.18,radial);float wet=neSurface[side].x;roughnessFactor=mix(neSurface[side].z,neSurface[side].y+(.08*(1.-wet)),cornea);}
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'material.clearcoatRoughness=clamp(material.clearcoatRoughness-(.045*vFA.y+.015*vFA.w)*fMask,.23,.55);',`material.clearcoatRoughness=clamp(material.clearcoatRoughness-(.045*vFA.y+.015*vFA.w)*fMask,.23,.55);
   if(vCSType>3.5&&neEnabled*neReady>.5){material.clearcoat=0.;material.specularColor=vec3(.025);material.specularF90=1.;}
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'#include <opaque_fragment>',`
   if(vCSType>3.5&&neEnabled*neReady>.5&&uFLayer<.5&&csLayer<.5){int side=neSide();float cornea=1.-smoothstep(1.,1.28,length(vFEye.xy)/neIris[side].x);outgoingLight+=vec3(4.,3.9,3.75)*neStudioReflection(normal)*neSurface[side].x*mix(.20,1.,cornea);}
   #include <opaque_fragment>
  `);
 };
 const rgb=color=>new THREE.Color(color);
 skin.updateNaturalEyes=()=>{const s=api.settings;U.neEnabled.value=s.enabled?1:0;U.neReference.value=s.reference?1:0;['right','left'].forEach((side,i)=>{const e=s[side],t=rgb(e.tint),c=rgb(e.innerColor),pupil=s.autoPupil?.59-.35*(s.illumination*s.illumination*(3-2*s.illumination)):e.pupil;U.neIris.value[i].set(e.irisScale,pupil,e.brightness,e.source);U.neTint.value[i].set(t.r,t.g,t.b,e.tintAmount);U.neInner.value[i].set(c.r,c.g,c.b,e.innerAmount);U.neSclera.value[i].set(e.scleraWhite,e.yellow,e.redness,e.veinAmount);U.neMisc.value[i].set(e.veinDensity,e.limbal,e.rotation*Math.PI/180,e.contrast);U.neSurface.value[i].set(e.wetness,e.corneaRoughness,e.scleraRoughness,e.parallax);});};
 skin.material.onBeforeRender=(renderer,scene,camera,...args)=>{oldRender?.call(skin.material,renderer,scene,camera,...args);U.neLightView.value.set(-.45,.65,1).transformDirection(camera.matrixWorldInverse);};
 skin.updateFace=()=>{oldUpdate?.();skin.updateNaturalEyes();};skin.dispose=()=>{api.skins.delete(skin);fallback.dispose();oldDispose();};
 skin.naturalEyesReady=textures().then(list=>{if(skin.disposed)return false;['neOriginal0','neOriginal1','neClean','neVessels'].forEach((k,i)=>{U[k].value=list[i];});U.neReady.value=1;ext.ready=true;fallback.dispose();skin.viewer.render();return true;}).catch(e=>{ext.errors.push(String(e));return false;});
 skin.updateNaturalEyes();skin.material.needsUpdate=true;
}
