/** Material adaptation of documented lookdev principles, not a RenderMan/MaterialX port.
 * Retains existing complexion, identities, maps, lips, eyes and host master controls.
 * Broad/narrow GGX lobes have weights summing to one; diffusion remains separate.
 */
const declarations=`
uniform float uCSkin,uCPores,uCMeso,uCSpecular,uCLobe,uCRough,uCFuzz,uCInspect;
uniform sampler2D uCShadowMap;uniform mat4 uCShadowMatrix;
uniform float uCShadowEnable,uCShadowSoftness,uCReceiverNormalBias;uniform vec3 uCKeyView,uCKeyPosition;
varying vec3 vCWorld,vCShadowNormal;
float cSkinMask=0.;float cLobeWeight=0.;vec3 cDiffuseN=vec3(0.,0.,1.);
float cCompareShadow(vec2 uv,vec3 receiver,vec2 slope,float bias){
 float depth=receiver.z+dot(slope,uv-receiver.xy)-bias;
 return step(depth,texture2D(uCShadowMap,uv).r);
}
float cBilinearShadow(vec2 uv,vec3 receiver,vec2 slope,float bias){
 vec2 texel=uv*1024.-.5,base=floor(texel),f=fract(texel);
 vec2 q=(base+.5)/1024.;
 float a=cCompareShadow(q,receiver,slope,bias);
 float b=cCompareShadow(q+vec2(1./1024.,0.),receiver,slope,bias);
 float c=cCompareShadow(q+vec2(0.,1./1024.),receiver,slope,bias);
 float d=cCompareShadow(q+vec2(1./1024.),receiver,slope,bias);
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float cShadow(){
 // Curved receivers: preserve geometry, offset only the shadow lookup.
 // Bounded outward normal tolerance is largest near grazing incidence.
 vec3 receiverNormal=normalize(vCShadowNormal);
 vec3 receiverLight=normalize(uCKeyPosition-vCWorld);
 float grazing=1.-abs(dot(receiverNormal,receiverLight));
 vec3 receiverWorld=vCWorld+receiverNormal*(uCReceiverNormalBias*grazing);
 vec4 q=uCShadowMatrix*vec4(receiverWorld,1.);vec3 p=q.xyz/q.w;
 // Derivatives are taken before any divergent bounds branch.
 vec3 dx=dFdx(p),dy=dFdy(p);float det=dx.x*dy.y-dx.y*dy.x;
 vec2 slope=abs(det)>1e-12?vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/det:vec2(0.);
 slope=clamp(slope,vec2(-8.),vec2(8.));
 if(uCShadowEnable<.5||q.w<=0.)return 1.;
 if(p.x<=0.||p.x>=1.||p.y<=0.||p.y>=1.||p.z<=0.||p.z>=1.)return 1.;
 // Bounded 0.6 mm receiver bias; avoids interpreting raster mismatch as pores.
 // This is shadow comparison tolerance, not a displacement of the skin mesh.
 vec3 towardLight=normalize(uCKeyPosition-vCWorld);
 vec4 biased=uCShadowMatrix*vec4(receiverWorld+towardLight*.0006,1.);
 float bias=max(.000015,p.z-biased.z/biased.w);
 // Filter comparison coverage, not raw depth or the skin image.
 // 3x3 tent with four bilinear texel comparisons per tap: 36 reads total.
 float total=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  float weight=(x==0?2.:1.)*(y==0?2.:1.);
  vec2 offset=vec2(float(x),float(y))*uCShadowSoftness/1024.;
  total+=weight*cBilinearShadow(p.xy+offset,p,slope,bias);
 }return total/16.;
}
// Jittered, elliptical pores in millimetres. Vary size/depth; no frame-time noise.
float cPores(vec2 mm){vec2 p=mm/.42,cell=floor(p),f=fract(p);float h=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
 vec2 c=vec2(float(x),float(y)),r=fHash(cell+c+vec2(13.1,71.3)),d=c+.16+.68*r-f;
 float angle=6.283*r.x;d=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;
 d*=vec2(1.0+.75*r.y,.7+.35*r.x);float rr=dot(d,d),scale=55.+75.*r.y;
 float keep=smoothstep(.08,.26,r.x);h+=(-exp(-rr*scale)+.15*exp(-rr*scale*.26))*(.40+.85*r.y)*keep;
 }return h;}
`;
export function installCineSkin(viewer){
 const mat=viewer.skin.material,previous=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat),rig=viewer.cineRig;
 const U={...rig.U,uCReceiverNormalBias:{value:0.001500},uCSkin:{value:1},uCPores:{value:1.05},uCMeso:{value:.75},uCSpecular:{value:.75},uCLobe:{value:.3},uCRough:{value:.035},uCFuzz:{value:.07},uCInspect:{value:0}};
 const report={compiled:0,method:'weighted dual GGX + specular microdetail + bounded sheen, existing RGB diffusion',newSkinTextures:0,cinemaRendererPort:false};
 const patch=(text,a,b)=>{if(text.split(a).length!==2)throw Error('ET20 shader anchor changed: '+a.slice(0,100));return text.replace(a,()=>b);};
 mat.sheen=1;mat.sheenColor.setRGB(1,1,1);mat.sheenRoughness=.8;
 mat.customProgramCacheKey=()=>key()+'/ET20-dualGGX-shadow-curved-receiver-v4';
 mat.onBeforeCompile=shader=>{
  previous(shader);Object.assign(shader.uniforms,U);report.compiled++;
  shader.vertexShader='varying vec3 vCWorld,vCShadowNormal;\n'+shader.vertexShader;
  shader.vertexShader=patch(shader.vertexShader,'#include <project_vertex>','#include <project_vertex>\nvCWorld=(modelMatrix*vec4(transformed,1.)).xyz;vCShadowNormal=inverseTransformDirection(transformedNormal,viewMatrix);');
  // fHash is declared by inherited face code; place helpers after that declaration.
  shader.fragmentShader=patch(shader.fragmentShader,'vec3 fEyeColor(){',declarations+'\nvec3 fEyeColor(){');
  shader.fragmentShader=patch(shader.fragmentShader,'(fData.r-.5)*.000032*uFDetail','(fData.r-.5)*.000032*uFDetail*mix(1.,uCPores,uCSkin)');
  shader.fragmentShader=patch(shader.fragmentShader,'(fData.g-.5)*.000090*uFMeso','(fData.g-.5)*.000090*uFMeso*mix(1.,uCMeso,uCSkin)');
  shader.fragmentShader=patch(shader.fragmentShader,'fPores(fMM)*.000006*uFDetail','mix(fPores(fMM),cPores(fMM)*uCPores*1.5,uCSkin)*.000006*uFDetail');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   cSkinMask=clamp(uCSkin*fMask*(1.-lpMask),0.,1.);cLobeWeight=cSkinMask*uCLobe*(.6+.4*csT);cDiffuseN=nonPerturbedNormal;
   roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor+uCRough,.32,.85),cSkinMask);
   #include <clearcoat_normal_fragment_maps>`);
  const end='material.clearcoatRoughness=mix(material.clearcoatRoughness,clamp(material.clearcoatRoughness+.065,.20,.65),uIdleSurface*idleDrySkin);';
  shader.fragmentShader=patch(shader.fragmentShader,end,end+`
   material.specularColor=mix(material.specularColor,vec3(.030*uCSpecular),cSkinMask);
   material.clearcoat*=1.-cSkinMask*.92;
   #ifdef USE_SHEEN
   material.sheenColor=vec3(.8,.76,.70)*uCFuzz*cSkinMask*(1.-csT*.72)*(.55+.45*csNoise(vCSRest*1900.));material.sheenRoughness=.8;
   #endif
  `);
  // Area lighting: retain analytic rectangular highlights, add narrower second lobe.
  const area='reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );';
  shader.fragmentShader=patch(shader.fragmentShader,area,`
   float cVis=distance(lightPos,uCKeyView)<.0001?cShadow():1.;
   vec2 cUV=LTC_Uv(normal,viewDir,max(.25,roughness*.62));vec4 c1=texture2D(ltc_1,cUV),c2=texture2D(ltc_2,cUV);
   mat3 cInv=mat3(vec3(c1.x,0.,c1.y),vec3(0.,1.,0.),vec3(c1.z,0.,c1.w));
   vec3 cF=material.specularColor*c2.x+(vec3(1.)-material.specularColor)*c2.y;
   reflectedLight.directSpecular+=cVis*lightColor*mix(fresnel*LTC_Evaluate(normal,viewDir,position,mInv,rectCoords),cF*LTC_Evaluate(normal,viewDir,position,cInv,rectCoords),cLobeWeight);
   #ifdef USE_SHEEN
   vec3 cDir=normalize(lightPos-position);sheenSpecularDirect+=cVis*lightColor*LTC_Evaluate(normal,viewDir,position,mat3(1.),rectCoords)*BRDF_Sheen(cDir,viewDir,normal,material.sheenColor,material.sheenRoughness);
   #endif
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );','reflectedLight.directDiffuse += cVis*lightColor*material.diffuseColor*LTC_Evaluate(normalize(mix(normal,cDiffuseN,cSkinMask*.70)),viewDir,position,mat3(1.),rectCoords);');
  const direct='reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';
  shader.fragmentShader=patch(shader.fragmentShader,direct,`PhysicalMaterial cNarrow=material;cNarrow.roughness=max(.25,material.roughness*.62);reflectedLight.directSpecular+=irradiance*mix(BRDF_GGX(directLight.direction,geometryViewDir,geometryNormal,material),BRDF_GGX(directLight.direction,geometryViewDir,geometryNormal,cNarrow),cLobeWeight);`);
  // Inspection separates the inherited actual contributions; not synthetic texture pictures.
  shader.fragmentShader=patch(shader.fragmentShader,'#include <opaque_fragment>',`
   if(uCInspect>.5&&uCInspect<1.5)outgoingLight=totalDiffuse;
   if(uCInspect>1.5&&uCInspect<2.5){outgoingLight=totalSpecular;
     #ifdef USE_CLEARCOAT
     outgoingLight+=material.clearcoat*(clearcoatSpecularDirect+clearcoatSpecularIndirect);
     #endif
     #ifdef USE_SHEEN
     outgoingLight+=sheenSpecularDirect+sheenSpecularIndirect;
     #endif
   }
   if(uCInspect>2.5&&uCInspect<3.5)outgoingLight=normal*.5+.5;
   if(uCInspect>3.5&&uCInspect<4.5)outgoingLight=diffuseColor.rgb;
   if(uCInspect>4.5&&uCInspect<5.5)outgoingLight=vec3(roughnessFactor);
   if(uCInspect>5.5)outgoingLight=vec3(cShadow());
   #include <opaque_fragment>`);
 };
 mat.needsUpdate=true;
 return{U,report,update(settings,skinBefore=false,inspect=0){U.uCSkin.value=settings.skin&&!skinBefore?1:0;for(const[k,n]of Object.entries({poreGain:'uCPores',mesoGain:'uCMeso',specular:'uCSpecular',lobeMix:'uCLobe',roughnessOffset:'uCRough',fuzz:'uCFuzz'}))U[n].value=settings[k];U.uCInspect.value=inspect;},dispose(){mat.onBeforeCompile=previous;mat.customProgramCacheKey=key;mat.sheen=0;mat.needsUpdate=true;}};
}
