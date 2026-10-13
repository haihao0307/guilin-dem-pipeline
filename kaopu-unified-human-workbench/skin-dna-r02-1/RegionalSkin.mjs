import * as THREE from '../full/source/registration-vendor/three.module.js';
const declaration=`
uniform sampler2D uRFIndex,uRFPores;uniform int uRFHash;
uniform float uRFGain,uRFSize,uRFRegions,uRFOil,uRFScatter,uRFView;
float rfArea=0.;
float rfG(vec3 p,vec3 c,vec3 span){vec3 d=(vec3(abs(p.x),p.y,p.z)-c)/span;return exp(-dot(d,d));}
vec4 rfRecord(int n){return texelFetch(uRFPores,ivec2(n%512,n/512),0);}
float rfPoreHeight(vec3 p,float size,float footprint){
 if(uRFHash==0)return 0.;ivec3 cell=ivec3(floor(p/.50));uint h=(uint(cell.x)*73856093u)^(uint(cell.y)*19349663u)^(uint(cell.z)*83492791u);
 int bucket=int(h&uint(uRFHash-1));vec4 meta=texelFetch(uRFIndex,ivec2(bucket%512,bucket/512),0);float height=0.;
 for(int j=0;j<128;j++){if(j>=int(meta.y))break;int slot=int(meta.x)+j;vec4 ids=texelFetch(uRFIndex,ivec2((slot/4)%512,(slot/4)/512),0);int id=int(ids[slot%4]);vec4 a=rfRecord(id*2),b=rfRecord(id*2+1);vec3 d=p-a.xyz;float d2=dot(d,d);if(d2>.1296)continue;
 float dn=dot(d,b.xyz),rr=max(0.,d2-dn*dn),radius=a.w*size,r2=radius*radius,filtered=r2+footprint*footprint*.22;
 height+=b.w*(-exp(-rr/max(filtered,.0001))+.12*exp(-rr/max(2.7*filtered,.0001)))*(r2/filtered)*exp(-dn*dn/.009)*(1.-smoothstep(.0784,.1296,d2));
 }return height*.001;
}
`;
export function installRegionalSkin(viewer){
 const mat=viewer.skin.material,prior=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat),empty=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);empty.needsUpdate=true;
 const U={uRFIndex:{value:empty},uRFPores:{value:empty},uRFHash:{value:0},uRFGain:{value:.85},uRFSize:{value:1},uRFRegions:{value:1},uRFOil:{value:.28},uRFScatter:{value:.4},uRFView:{value:0}};
 const report={version:'REGIONAL-SKIN-R03',compiles:0,facePoresAreColourDots:false,earShaderPreserved:true,lipShaderPreserved:true,faceMicroNormals:'replace inherited stacked face micro-normal, then apply bounded surface pore derivative',volumeScattering:false};
 const patch=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Regional material integration conflict: '+a.slice(0,95));return s.replace(a,()=>b);};
 mat.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);s.fragmentShader=declaration+'\n'+s.fragmentShader;
 s.fragmentShader=patch(s.fragmentShader,'diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);',`diffuseColor.rgb=mix(csPaint,diffuseColor.rgb,csBandVertex);
  rfArea=clamp(vFA.x,0.,1.)*(1.-clamp(lpMask,0.,1.))*(1.-clamp(eaM,0.,1.))*smoothstep(.203,.218,vFRest.y)*smoothstep(-.015,.025,vFRest.z)*uRFRegions;
  float rfCheek=rfG(vFRest,vec3(.036,.277,.055),vec3(.032,.028,.055));
  float rfNose=clamp(vFA.w,0.,1.),rfForehead=clamp(vFB.x,0.,1.),rfThin=clamp(vFA.z,0.,1.);
  float rfJaw=rfG(vFRest,vec3(.061,.229,.014),vec3(.025,.027,.052)),rfTemple=rfG(vFRest,vec3(.067,.322,.012),vec3(.022,.033,.055));
  float rfChroma=(csNoise(vFRest*117.)-.5)*.020+(csNoise(vFRest*419.)-.5)*.008;
  vec3 rfBlood=vec3(1.+.027*rfCheek+.022*rfNose,1.-.021*rfCheek-.016*rfNose,1.-.017*rfCheek-.012*rfNose);
  diffuseColor.rgb*=mix(vec3(1.),rfBlood*(1.+rfChroma),rfArea);
 `);
 s.fragmentShader=patch(s.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
  normal=normalize(mix(normal,nonPerturbedNormal,rfArea));
  vec3 rfMM=vETPosition*1000.;float rfFoot=max(length(dFdx(rfMM)),length(dFdy(rfMM))),rfVisibility=1.-smoothstep(.11,.34,rfFoot);
  float rfH=0.;if(rfArea>.001&&rfVisibility>.001&&uRFGain>.001)rfH=rfPoreHeight(rfMM,uRFSize,rfFoot)*uRFGain*rfVisibility*rfArea;
  vec3 rfDX=dFdx(-vViewPosition),rfDY=dFdy(-vViewPosition),rfR1=cross(rfDY,normal),rfR2=cross(normal,rfDX);float rfDet=dot(rfDX,rfR1);
  if(abs(rfDet)>1e-14){vec3 slope=sign(rfDet)*(dFdx(rfH)*rfR1+dFdy(rfH)*rfR2)/abs(rfDet);slope*=min(1.,.32/max(length(slope),.0001));normal=normalize(normal-slope);}
  float rfMicroRough=(csNoise(vFRest*1120.)-.5)*.045;
  float rfRough=.60-.064*rfForehead-.105*rfNose+.035*rfCheek+.033*rfTemple+.02*rfJaw+.035*rfThin-.065*uRFOil*(.25+.75*rfNose)+rfMicroRough;
  roughnessFactor=mix(roughnessFactor,clamp(rfRough+(csRoughness-.62)*.5,.38,.80),rfArea);
  cSkinMask*=1.-eaM;cLobeWeight*=1.-rfArea*.82;
  #include <clearcoat_normal_fragment_maps>
 `);
 const anchor='material.specularColor=mix(material.specularColor,vec3(.030*uCSpecular),cSkinMask);';
 s.fragmentShader=patch(s.fragmentShader,anchor,anchor+`material.specularColor=mix(material.specularColor,vec3(.032)*(1.+uRFOil*.10),rfArea);`);
 const coat='material.clearcoat*=1.-cSkinMask*.92;';
 s.fragmentShader=patch(s.fragmentShader,coat,coat+`material.clearcoat=mix(material.clearcoat,.006+.035*uRFOil*rfNose,rfArea);material.clearcoatRoughness=mix(material.clearcoatRoughness,.50,rfArea);`);
 const lit='reflectedLight.directDiffuse+=mix(etOld,etLight,etMask)*directLight.color*BRDF_Lambert(material.diffuseColor);';
 s.fragmentShader=patch(s.fragmentShader,lit,`vec3 rfW=vec3(.28,.14,.075)*uRFScatter;vec3 rfAngular=max((vec3(fNL)+rfW)/(1.+rfW),vec3(0.))/(1.+rfW);
 reflectedLight.directDiffuse+=mix(mix(etOld,etLight,etMask),rfAngular,rfArea)*directLight.color*BRDF_Lambert(material.diffuseColor);`);
 s.fragmentShader=patch(s.fragmentShader,'#include <opaque_fragment>',`
  if(uRFView>.5&&uRFView<1.5){float z=rfG(vFRest,vec3(.049,.292,.047),vec3(.018,.014,.038)),m=rfG(vFRest,vec3(.065,.240,.009),vec3(.018,.031,.032));vec3 c=vec3(.16,.20,.23)+z*vec3(.66,.29,.06)+rfCheek*vec3(.12,.25,.23)+m*vec3(.22,.08,.56)+rfTemple*vec3(.22,.25,.08);outgoingLight=mix(outgoingLight,c,rfArea);}
  if(uRFView>1.5&&uRFView<2.5)outgoingLight=mix(outgoingLight,vec3(clamp(.56+rfH*24000.,.04,.95)),rfArea);
  if(uRFView>2.5&&uRFView<3.5)outgoingLight=diffuseColor.rgb;
  if(uRFView>3.5&&uRFView<4.5)outgoingLight=vec3(roughnessFactor);
  if(uRFView>4.5)outgoingLight=normal*.5+.5;
  #include <opaque_fragment>
 `);report.compiles++;};
 mat.customProgramCacheKey=()=>key()+'/unified-regional-replacement-r03';mat.needsUpdate=true;
 return {U,report,field(f){U.uRFIndex.value=f.indexTexture;U.uRFPores.value=f.poreTexture;U.uRFHash.value=f.hashSize;report.pores=f.report;},update(s){U.uRFGain.value=s.pores;U.uRFSize.value=s.poreScale;U.uRFRegions.value=s.regional;U.uRFOil.value=s.oil;U.uRFScatter.value=s.scatter;U.uRFView.value=s.diagnostic;},dispose(){empty.dispose();mat.onBeforeCompile=prior;mat.customProgramCacheKey=key;}};
}
