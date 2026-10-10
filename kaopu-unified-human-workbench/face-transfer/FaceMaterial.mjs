import * as THREE from '../full/source/registration-vendor/three.module.js';
import {DONOR_TILES} from './DonorTiles.generated.mjs';
import {FACE_MODES,hashArray} from './NativeFaceLayer.mjs';
let resource=null;
function donorTexture(){
 if(resource)return resource;const placeholder=new THREE.DataTexture(new Uint8Array([128,128,128,128]),1,1,THREE.RGBAFormat);placeholder.needsUpdate=true;
 const r=resource={texture:placeholder,ready:false,error:null,users:0};
 r.promise=new THREE.TextureLoader().loadAsync(DONOR_TILES.uri).then(t=>{t.flipY=false;t.colorSpace=THREE.NoColorSpace;t.wrapS=THREE.ClampToEdgeWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;r.texture=t;r.ready=true;placeholder.dispose();return t;}).catch(e=>{r.error=e.message;return null;});return r;
}
const declarations=`
uniform sampler2D ftAtlas;
uniform float ftEnabled,ftMicro,ftMeso,ftPigment,ftRegional,ftWrap,ftMode,ftMaturity;
varying vec4 vFTRegion,vFTExtra;varying vec3 vFTCoord;
vec4 ftTile(float tile,vec2 uv){vec2 p=fract(uv);return texture2D(ftAtlas,vec2((tile+.012+.976*p.x)/5.,.012+.976*p.y));}
vec4 ftBands(vec2 uv,float lip){
 lip=clamp(lip,0.,1.);vec4 w=max(vFTRegion,vec4(0.));float sum=w.x+w.y+w.z+w.w;
 if(sum>1.)w/=sum;float cheek=max(0.,1.-w.x-w.y-w.w);
 vec4 b=ftTile(0.,uv*.87)*w.x+ftTile(1.,uv)*cheek+ftTile(2.,uv*1.20)*w.y+ftTile(3.,uv*1.15)*w.w;
 return mix(b,ftTile(4.,uv*vec2(1.25,.8)),lip);
}
`;
/** Shader composition, not material replacement: invoke the original callback
 * (including native skin and any full-CSR motion skinning) before adding fields.
 * Wrapped diffuse is adapted from EmilyTransferKernel.js; GGX remains native.
 * This is NOT the source screen-space SSS/transmission renderer.
 */
export function attachFaceMaterial({geometry,skin,face,redraw=()=>{}}){
 if(!face)throw Error('Face generator must be attached before material');
 const f=face.fields;for(const[name,array,size]of[['ftRegion',f.fields,4],['ftExtra',f.extra,4],['ftCoord',f.coords,3]])geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
 const r=donorTexture();r.users++;let disposed=false,compiled=0;const mat=skin.material,prior=mat.onBeforeCompile.bind(mat),key=mat.customProgramCacheKey.bind(mat),oldUpdate=skin.update.bind(skin);
 const U={ftAtlas:{value:r.texture},ftEnabled:{value:1},ftMicro:{value:1},ftMeso:{value:.8},ftPigment:{value:.65},ftRegional:{value:1},ftWrap:{value:.32},ftMode:{value:0},ftMaturity:{value:1}};
 function sync(){const s=face.settings;U.ftAtlas.value=r.texture;U.ftEnabled.value=s.enabled?1:0;U.ftMicro.value=s.micro;U.ftMeso.value=s.meso;U.ftPigment.value=s.pigment;U.ftRegional.value=s.regional;U.ftWrap.value=s.wrap;U.ftMode.value=s.enabled?FACE_MODES.indexOf(s.mode):0;U.ftMaturity.value=face.report?.maturityGate??1;}
 const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Native skin shader integration anchor missing: '+a);return s.replace(a,()=>b);};
 mat.onBeforeCompile=s=>{
  prior(s);compiled++;Object.assign(s.uniforms,U);
  s.vertexShader='attribute vec4 ftRegion,ftExtra;attribute vec3 ftCoord;varying vec4 vFTRegion,vFTExtra;varying vec3 vFTCoord;\n'+s.vertexShader;
  s.vertexShader=replace(s.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvFTRegion=ftRegion;vFTExtra=ftExtra;vFTCoord=ftCoord;');
  s.fragmentShader=replace(s.fragmentShader,'#include <common>','#include <common>\n'+declarations);
  // The original masks still decide skin versus lips versus eye/teeth material.
  s.fragmentShader=replace(s.fragmentShader,'diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);',`
   float ftHead=clamp(vFTExtra.w,0.,1.)*csCover*ftEnabled;
   vec2 ftUV=vFTCoord.xy/.009;ftUV=mix(ftUV,vFTCoord.zy/.009,clamp(vFTExtra.y,0.,1.));
   ftUV+=vec2(csNoise(vFTCoord*66.),csNoise(vFTCoord*73.+vec3(17.)))*.40;
   vec4 ftData=ftBands(ftUV,csLip);
   float ftVariation=(ftData.b-.5)*ftPigment;
   vec3 ftColor=csPaint*(1.+ftVariation*.18);
   ftColor*=vec3(1.+vFTRegion.z*csRedness*.022,1.-vFTRegion.z*csRedness*.018,1.-vFTRegion.z*csRedness*.014);
   csPaint=mix(csPaint,ftColor,ftHead);
   if(ftMode>.5&&ftMode<1.5)csPaint=vec3(vCSType>5.5?.075:vCSType>4.5?.29:vCSType>3.5?.63:.46);
   diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);
  `);
  s.fragmentShader=replace(s.fragmentShader,'roughnessFactor=mix(vCSType>3.5?.25:.46,csSurfaceRough,csCover);',`
   roughnessFactor=mix(vCSType>3.5?.25:.46,csSurfaceRough,csCover);
   roughnessFactor=clamp(roughnessFactor+ftHead*ftRegional*(-vFTRegion.y*.045+vFTRegion.w*.032+vFTRegion.z*.018-csLip*.055+(ftData.a-.5)*.07),.24,.92);
   if(ftMode>.5&&ftMode<1.5)roughnessFactor=1.;
  `);
  s.fragmentShader=replace(s.fragmentShader,'float csHeight=csSurface*csDetail*csCover;',`
   float ftAA=1.-smoothstep(.35,1.0,max(length(dFdx(ftUV)),length(dFdy(ftUV)))*128.);
   float ftAmplitude=(1.+vFTRegion.y*.32-vFTRegion.w*.62)*(0.50+ftMaturity*.50);
   float ftHeight=((ftData.r-.5)*.000045*ftMicro*ftAA+(ftData.g-.5)*.00010*ftMeso)*ftAmplitude;
   float ftLipLines=(sin(vFTCoord.x*13700.+csNoise(vFTCoord*430.)*4.)*.5)*.000005*ftMicro*ftAA;
   ftHeight=mix(ftHeight,ftHeight*.33+ftLipLines,csLip);
   float csHeight=mix(csSurface,ftHeight,ftHead)*csDetail*csCover;
   if(ftMode>.5&&ftMode<1.5)csHeight=0.;
  `);
  const physical=THREE.ShaderChunk.lights_physical_pars_fragment;
  const wrapped=replace(physical,'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',`
   float ftNL=dot(geometryNormal,directLight.direction);
   float ftGate=ftEnabled*clamp(vFTExtra.w,0.,1.)*clamp(vCSRegion.x,0.,1.);
   if(ftMode>.5&&ftMode<1.5)ftGate=0.;
   vec3 ftDiff=mix(vec3(dotNL),vec3(max(ftNL*.5+.5,0.)),vec3(.675,.45,.45)*ftWrap*ftGate);
   reflectedLight.directDiffuse += ftDiff * directLight.color * BRDF_Lambert(material.diffuseColor);
  `);
  s.fragmentShader=replace(s.fragmentShader,'#include <lights_physical_pars_fragment>',wrapped);
  s.fragmentShader=replace(s.fragmentShader,'material.clearcoatRoughness=.4-csT*.08-csLip*.1;',`material.clearcoatRoughness=.4-csT*.08-csLip*.1;
   material.clearcoat=clamp(material.clearcoat+ftHead*ftRegional*(csOil*vFTRegion.y*.10+csLip*.025),0.,.65);
   if(ftMode>.5&&ftMode<1.5)material.clearcoat=0.;`);
  s.fragmentShader=replace(s.fragmentShader,'#include <opaque_fragment>',`#include <opaque_fragment>
   if(ftMode>1.5&&ftMode<2.5)gl_FragColor.rgb=mix(vec3(.18),vFTRegion.x*vec3(.24,.48,.90)+vFTRegion.y*vec3(.90,.58,.20)+vFTRegion.z*vec3(.22,.65,.40)+vFTRegion.w*vec3(.68,.40,.85)+csLip*vec3(.90,.25,.25)+vFTExtra.y*vec3(.35,.75,.75),ftHead);
   if(ftMode>2.5&&ftMode<3.5)gl_FragColor.rgb=normal*.5+.5;
   if(ftMode>3.5&&ftMode<4.5)gl_FragColor.rgb=vec3(roughnessFactor);
   if(ftMode>4.5){vec2 uv=vFTCoord.xy*1000.;vec2 d=abs(fract(uv-.5)-.5)/max(fwidth(uv),vec2(.001));float line=1.-min(min(d.x,d.y),1.);gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.38)*(1.-line*.7),ftHead);}
  `);
 };
 mat.customProgramCacheKey=()=>key()+'/ET12-face-bands-v1';mat.needsUpdate=true;
 skin.update=()=>{oldUpdate();sync();};sync();r.promise.then(()=>{if(!disposed){sync();redraw();}});
 return {sync,ready:r.promise,report:()=>({version:'ET12-face-material/1',ready:r.ready,error:r.error,shaderCompiles:compiled,donorPNGBytes:DONOR_TILES.provenance.pngBytes,donorPNGHash:DONOR_TILES.provenance.pngSHA256,regions:5,source:'same licensed scan frequency bands + existing native skin controls',originalSkinUniformsRetained:true,oneMaskForColorNormalRoughness:true,identityAlbedoCopied:false,trueSSS:false,wrappedDiffuse:'Emily-inspired RGB wrap; not energy-calibrated volumetric transport',settings:{...face.settings},coordinateHash:hashArray(f.coords)}),dispose(){if(disposed)return;disposed=true;r.users--;skin.update=oldUpdate;mat.onBeforeCompile=prior;mat.customProgramCacheKey=key;mat.needsUpdate=true;for(const n of['ftRegion','ftExtra','ftCoord'])geometry.deleteAttribute(n);}};
}
