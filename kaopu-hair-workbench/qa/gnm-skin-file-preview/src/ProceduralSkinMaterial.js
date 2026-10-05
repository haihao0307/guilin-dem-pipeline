/** Independent GNM skin-material study. No scanned skin/face texture is bundled.
 * Official material IDs protect eyes, teeth, gums and tongue from skin maps.
 * Rest-space microdetail and landmark-derived tissue zones follow the original
 * model through uvSource; they do not change positions, head normals or hair.
 * The cheap wrapped diffuse is explicitly an approximation, not spectral SSS.
 */
import * as THREE from 'three';
import {makeGnmMaterialColors} from './GnmMaterialRegions.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const xyz=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
const gauss=(p,c,s)=>Math.exp(-p.reduce((v,x,i)=>v+((x-c[i])/s[i])**2,0));
const blend=(a,b,t)=>a.map((x,i)=>x*(1-t)+b[i]*t);
function polygonDistance(x,y,poly){let inside=false,d=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[j],b=poly[i];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
 const dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);d=Math.min(d,Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy));
 }return inside?d:-d;}
const VERTEX_DECL=`
attribute vec3 gnmRestPosition;
attribute vec3 gnmRestNormal;
attribute vec4 gnmSkinZones;
attribute float gnmMaterialId;
varying vec3 vGnmRest;
varying vec3 vGnmRestNormal;
varying vec4 vGnmZones;
varying float vGnmMaterial;
varying vec2 vGnmUv;
`;
const FRAGMENT_DECL=`
varying vec3 vGnmRest;
varying vec3 vGnmRestNormal;
varying vec4 vGnmZones;
varying float vGnmMaterial;
varying vec2 vGnmUv;
uniform vec3 gnmSkinTone;
uniform float gnmSkinRoughness,gnmSkinDetail,gnmSkinFlush,gnmSkinSoftness,gnmMapColor,gnmMapNormal,gnmMapRoughness,gnmNormalStrength,gnmUvDebug;
uniform sampler2D gnmColorMap,gnmNormalMap,gnmRoughnessMap;
float gnmHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float gnmNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(gnmHash(i),gnmHash(i+vec3(1,0,0)),f.x),mix(gnmHash(i+vec3(0,1,0)),gnmHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(gnmHash(i+vec3(0,0,1)),gnmHash(i+vec3(1,0,1)),f.x),mix(gnmHash(i+vec3(0,1,1)),gnmHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
mat3 gnmTangentFrame(vec3 p,vec3 n,vec2 uv){vec3 q0=dFdx(p),q1=dFdy(p);vec2 st0=dFdx(uv),st1=dFdy(uv);vec3 a=cross(q1,n),b=cross(n,q0),T=a*st0.x+b*st1.x,B=a*st0.y+b*st1.y;float k=max(dot(T,T),dot(B,B));return mat3(T,B,n)*mat3(inversesqrt(max(k,1.e-12)),0.,0.,0.,inversesqrt(max(k,1.e-12)),0.,0.,0.,1.);}
vec2 gnmPoreCell(vec2 p){
 vec2 i=floor(p),f=fract(p);vec2 center=.24+.52*vec2(gnmHash(vec3(i,13.7)),gnmHash(vec3(i,71.3)));
 vec2 q=f-center;float radius=.13+.07*gnmHash(vec3(i,23.1));
 float footprint=max(length(dFdx(p)),length(dFdy(p))),r2=radius*radius,filtered=r2+footprint*footprint*.12;
 float d2=dot(q,q),depression=exp(-d2/(2.*filtered))*r2/filtered;
 float rim=exp(-d2/(2.*filtered*2.2))*.18-depression;
 float edge=min(min(f.x,1.-f.x),min(f.y,1.-f.y)),border=smoothstep(0.,.15,edge);
 return vec2(rim,depression)*border;
}
vec2 gnmSurfaceField(){
 vec3 w=pow(abs(normalize(vGnmRestNormal)),vec3(4.));w/=max(dot(w,vec3(1.)),.00001);
 vec3 p=vGnmRest*1650.;
 vec2 pore=gnmPoreCell(p.yz+vec2(17.1,3.7))*w.x+gnmPoreCell(p.zx+vec2(8.4,21.3))*w.y+gnmPoreCell(p.xy)*w.z;
 float meso=(gnmNoise(vGnmRest*310.+vec3(11.,7.,3.))-.5)*.000014;
 float fine=(gnmNoise(vGnmRest*3700.+vec3(7.,13.,19.))-.5)*.000005;
 float fineFoot=max(length(dFdx(vGnmRest*3700.)),length(dFdy(vGnmRest*3700.)));fine*=1.-smoothstep(.4,1.8,fineFoot);
 float height=pore.x*.000045*(.85+.35*vGnmZones.w)+meso+fine;
 // Lip furrows run across the actual rest-space lip mask; pores fade out there.
 float lipPhase=vGnmRest.x*3600.+gnmNoise(vGnmRest*220.)*2.5;
 float lipFurrow=pow(.5+.5*sin(lipPhase),7.);
 height=mix(height,-lipFurrow*.000023+meso*.25,vGnmZones.x);
 return vec2(height,pore.y*(1.-vGnmZones.x));
}
vec3 gnmBump(vec3 p,vec3 n,float h){vec3 a=dFdx(p),b=dFdy(p),r1=cross(b,n),r2=cross(n,a);float det=dot(a,r1);vec3 grad=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);if(abs(det)<1.e-14)return n;return normalize(abs(det)*n-grad);}
`;
export function prepareGnmSkinGeometry(model,geometry){
 if(!model.hasUvs||geometry.attributes.position.count!==model.numRenderVertices)throw Error('Skin material requires official UV-expanded GNM geometry');
 const canonicalGeometry=new THREE.BufferGeometry();canonicalGeometry.setAttribute('position',new THREE.BufferAttribute(model.template,3));canonicalGeometry.setIndex(new THREE.BufferAttribute(model.triangles,1));canonicalGeometry.computeVertexNormals();const canonicalNormals=canonicalGeometry.attributes.normal.array;
 const source=model.uvSource,count=source.length,rest=new Float32Array(count*3),restNormals=new Float32Array(count*3),zones=new Float32Array(count*4),ids=new Float32Array(count),colors=makeGnmMaterialColors(model,source),landmarks=new Float32Array(204);model.computeLandmarks(model.template,landmarks);
 const lm=i=>xyz(landmarks,i),lip=Array.from({length:12},(_,i)=>lm(i+48)),nose=lm(30),leftCheek=blend(lm(41),lm(48),.42),rightCheek=blend(lm(46),lm(54),.42);leftCheek[0]-=.006;rightCheek[0]+=.006;
 const stats={vertices:count,skinVertices:0,eyeVertices:0,nonSkinMapProtected:0,sourceMapped:0,finite:true,materialNames:[...model.meta.materialNames]};
 for(let i=0;i<count;i++){
  const s=source[i],p=xyz(model.template,s),id=model.materialId[s],q=i*4;rest.set(p,i*3);restNormals.set(canonicalNormals.subarray(s*3,s*3+3),i*3);ids[i]=id;stats.sourceMapped++;
  if(id===0){colors.set([1,1,1],i*3);stats.skinVertices++;
   const front=smooth(.075,.11,p[2]),lipMask=smooth(-.0014,.0014,polygonDistance(p[0],p[1],lip))*front;
   const cheeks=Math.max(gauss(p,leftCheek,[.021,.022,.035]),gauss(p,rightCheek,[.021,.022,.035]));
   const noseMask=gauss(p,nose,[.019,.018,.020]);
   const ears=smooth(.064,.085,Math.abs(p[0]))*smooth(.234,.258,p[1])*(1-smooth(.300,.319,p[1]))*(1-smooth(.04,.065,p[2]));
   const underEyes=(gauss(p,lm(41),[.017,.010,.016])+gauss(p,lm(46),[.017,.010,.016]))*.3;
   const oil=Math.max(gauss(p,lm(28),[.014,.025,.018]),gauss(p,[0,.33,.11],[.025,.025,.04])*.5);
   zones.set([lipMask,clamp(cheeks*.4+noseMask*.2+ears*.45+underEyes,0,1),clamp(ears*.9+noseMask*.35+lipMask*.35,0,1),oil],q);
  }else{stats.nonSkinMapProtected++;if(id>=4)stats.eyeVertices++;}
 }
 for(const [name,a,size]of [['gnmRestPosition',rest,3],['gnmRestNormal',restNormals,3],['gnmSkinZones',zones,4],['gnmMaterialId',ids,1],['color',colors,3]])geometry.setAttribute(name,new THREE.BufferAttribute(a,size));
 canonicalGeometry.dispose();stats.finite=[rest,restNormals,zones,ids,colors].every(a=>a.every(Number.isFinite));if(!stats.finite)throw Error('Nonfinite skin attribute');geometry.userData.skinRegions=stats;return stats;
}
export const SKIN_DEFAULTS=Object.freeze({color:'#bea099',roughness:.52,detail:.50,flush:.32,softness:.25,normalStrength:.65});
export function createGnmSkinMaterial({model,geometry,parameters={}}){
 const regions=prepareGnmSkinGeometry(model,geometry),params={...SKIN_DEFAULTS},maps={color:null,normal:null,roughness:null};
 const pixel=(r,g,b,space)=>{const t=new THREE.DataTexture(new Uint8Array([r,g,b,255]),1,1,THREE.RGBAFormat);t.colorSpace=space;t.needsUpdate=true;return t;};
 const fallbackColor=pixel(255,255,255,THREE.SRGBColorSpace),fallbackNormal=pixel(128,128,255,THREE.NoColorSpace),fallbackRough=pixel(255,255,255,THREE.NoColorSpace);
 const uniforms={gnmSkinTone:{value:new THREE.Color(params.color)},gnmSkinRoughness:{value:params.roughness},gnmSkinDetail:{value:params.detail},gnmSkinFlush:{value:params.flush},gnmSkinSoftness:{value:params.softness},gnmNormalStrength:{value:params.normalStrength},gnmUvDebug:{value:0},gnmMapColor:{value:0},gnmMapNormal:{value:0},gnmMapRoughness:{value:0},gnmColorMap:{value:fallbackColor},gnmNormalMap:{value:fallbackNormal},gnmRoughnessMap:{value:fallbackRough}};
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.6,metalness:0,vertexColors:true});material.name='GNM independent procedural skin study';let compiled=0;
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);shader.vertexShader=VERTEX_DECL+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvGnmRest=gnmRestPosition;vGnmRestNormal=gnmRestNormal;vGnmZones=gnmSkinZones;vGnmMaterial=gnmMaterialId;vGnmUv=uv;`);
  shader.fragmentShader=FRAGMENT_DECL+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
  vec2 gnmSurface=vec2(0.);if(vGnmMaterial<.5)gnmSurface=gnmSurfaceField();
  if(vGnmMaterial<.5){
   vec3 skin=gnmSkinTone;
   // Broad anatomical color only. No image, source scan or random spotted pigment.
   vec3 bloodTint=skin*vec3(1.03,.91,.92);
   skin=mix(skin,bloodTint,vGnmZones.y*gnmSkinFlush);
   vec3 lipTint=skin*vec3(.91,.68,.74);
   skin=mix(skin,lipTint,vGnmZones.x*(.65+.35*gnmSkinFlush));
   if(gnmMapColor>.5)skin=texture2D(gnmColorMap,vGnmUv).rgb;
   if(gnmUvDebug>.5){vec2 c=floor(vGnmUv*24.);float chess=mod(c.x+c.y,2.);skin=mix(vec3(vGnmUv.x,vGnmUv.y,.12),vec3(.85),chess*.5);}
   diffuseColor.rgb*=skin*(1.-gnmSkinDetail*.065*gnmSurface.y);
  }
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
  float roughnessFactor=gnmSkinRoughness;
  if(vGnmMaterial<.5){
   float regional=gnmSkinRoughness-vGnmZones.w*.14-vGnmZones.x*.10;
   float mesoRough=(gnmNoise(vGnmRest*210.+vec3(19.,7.,3.))-.5)*.10;
   roughnessFactor=clamp(regional+gnmSkinDetail*(mesoRough+gnmSurface.y*.13),.28,.88);
   if(gnmMapRoughness>.5)roughnessFactor=clamp(texture2D(gnmRoughnessMap,vGnmUv).g,.12,.98);
  }else if(vGnmMaterial>3.5)roughnessFactor=.25;
  else if(vGnmMaterial<1.5)roughnessFactor=.32;
  else roughnessFactor=.48;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
  #include <normal_fragment_maps>
  if(vGnmMaterial<.5){
   if(gnmMapNormal>.5){vec3 mapN=texture2D(gnmNormalMap,vGnmUv).xyz*2.-1.;mapN.xy*=gnmNormalStrength;normal=normalize(gnmTangentFrame(-vViewPosition,normal,vGnmUv)*mapN);}
   normal=gnmBump(-vViewPosition,normal,gnmSurface.x*gnmSkinDetail);
   // Filter specular response with the actual normal variation, preventing
   // unresolved pores from creating glitter. Imported roughness stays a base.
   float surfaceVariance=max(dot(dFdx(normal),dFdx(normal)),dot(dFdy(normal),dFdy(normal)));
   roughnessFactor=min(.94,sqrt(roughnessFactor*roughnessFactor+surfaceVariance*.12));
  }
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
  if(vGnmMaterial<.5){float skinSpec=clamp(.68+vGnmZones.w*.17-gnmSurface.y*gnmSkinDetail*.16,.4,.90);material.specularColor*=skinSpec;}
  `);
  const native=THREE.ShaderChunk.lights_physical_pars_fragment,marker='reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
  if(!native.includes(marker)||!shader.fragmentShader.includes('#include <lights_fragment_begin>'))throw Error('Unexpected Three skin shader hooks');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',native.replace(marker,`
  float gnmWrap=saturate((dot(geometryNormal,directLight.direction)+.28)/1.28);
  float gnmAmount=(vGnmMaterial<.5?gnmSkinSoftness*(.20+.80*vGnmZones.z):0.);
  vec3 gnmIrradiance=mix(irradiance,directLight.color*gnmWrap,gnmAmount);
  reflectedLight.directDiffuse += gnmIrradiance * BRDF_Lambert(material.diffuseColor);
  `));compiled++;
 };
 material.customProgramCacheKey=()=> 'gnm-procedural-skin-r2-pore-fields-roughness';
 function setParameters(patch={}){
  const next={...params};for(const[k,v]of Object.entries(patch)){if(!(k in params))throw Error('Unknown skin parameter '+k);if(k==='color'){if(!/^#[0-9a-f]{6}$/i.test(v))throw Error('Invalid skin color');next.color=v;}else{if(!Number.isFinite(v))throw Error('Invalid skin value');next[k]=clamp(v,0,1);}}
  Object.assign(params,next);uniforms.gnmSkinTone.value.set(params.color);for(const [p,u]of [['roughness','gnmSkinRoughness'],['detail','gnmSkinDetail'],['flush','gnmSkinFlush'],['softness','gnmSkinSoftness'],['normalStrength','gnmNormalStrength']])uniforms[u].value=params[p];return {...params};
 }
 function setMap(kind,texture=null){if(!Object.hasOwn(maps,kind))throw Error('Unknown skin map kind');if(texture&&!texture.isTexture)throw Error('Expected a Three texture');if(texture){texture.colorSpace=kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.needsUpdate=true;}maps[kind]=texture;const K=kind[0].toUpperCase()+kind.slice(1);uniforms['gnmMap'+K].value=texture?1:0;uniforms['gnm'+K+'Map'].value=texture||({color:fallbackColor,normal:fallbackNormal,roughness:fallbackRough}[kind]);return diagnostics();}
 function diagnostics(){return {version:'gnm-procedural-skin-r2',uvDebug:uniforms.gnmUvDebug.value>.5,parameters:{...params},regions:{...regions},compiled,usesOfficialUvs:true,skinMapsOnly:true,changesHeadVertices:false,changesHair:false,surfaceFields:{pores:'filtered jittered pore depressions, three rest-space projections',meso:'independent wider surface relief',lips:'masked fine rest-space furrows',roughness:'regional base plus pore-linked variation and normal-variance filtering',specular:'bounded skin-only dielectric reduction linked to oil/pore mask'},maps:Object.fromEntries(Object.entries(maps).map(([k,t])=>[k,t?{colorSpace:t.colorSpace,width:t.image?.width||t.source?.data?.width,height:t.image?.height||t.source?.data?.height}:null])),limitations:['Independent procedural material study; no scanned skin map reproduction','Wrapped diffuse is a bounded lighting approximation, not multiple-scattering or spectral SSS','No dynamic wrinkles, measured age changes or photoreal visual acceptance']};}
 setParameters(parameters);return {material,setUvDebug(value){uniforms.gnmUvDebug.value=value?1:0;},prepareGeometry:g=>prepareGnmSkinGeometry(model,g),setParameters,setMap,diagnostics,dispose(){material.dispose();fallbackColor.dispose();fallbackNormal.dispose();fallbackRough.dispose();}};
}
