import {EAR_VERSION} from './EarParameters.mjs';
/** Continuous opaque ear skin. Millimetre rest-space pores, sparse bounded
 * creases, region roughness and restrained thin-sheet backlighting.
 * This is an authored realtime approximation, not measured tissue transport. */
export function attachEarMaterial(skin,api){
 if(skin.earExtension)return;
 const prior=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material);
 const U={uEEnabled:{value:1},uELeft:{value:[.30,.55,.61,.22]},uERight:{value:[.30,.55,.61,.22]},uEDetailLeft:{value:[.28,.35,.25,0]},uEDetailRight:{value:[.28,.35,.25,0]},uEAudit:{value:0}};
 const declarations=`uniform float uEEnabled,uEAudit;uniform vec4 uELeft,uERight,uEDetailLeft,uEDetailRight;
 float eaMask(vec3 p){float x=abs(p.x);return smoothstep(.063,.076,x)*smoothstep(.232,.245,p.y)*(1.-smoothstep(.301,.314,p.y))*smoothstep(-.009,.001,p.z)*(1.-smoothstep(.040,.053,p.z))*uEEnabled;}
 vec4 eaSetting(vec3 p){return p.x>0.?uELeft:uERight;}
 vec4 eaDetail(vec3 p){return p.x>0.?uEDetailLeft:uEDetailRight;}
 float eaG(vec2 p,vec2 c,vec2 s){vec2 q=(p-c)/s;return exp(-dot(q,q));}
 float eaThin(vec3 p){return clamp(.12+.58*eaG(p.zy,vec2(.009,.284),vec2(.006,.022))+.33*eaG(p.zy,vec2(.026,.249),vec2(.010,.006)),0.,1.);}
 float eaCreases(vec2 mm,float footprint){float h=0.;
  for(int j=0;j<5;j++){float i=float(j);vec2 r=fHash(vec2(i+32.,i*17.));
   float z=(mm.x-24.)/(6.+r.y*8.),center=246.5+r.x*10.8+.65*sin(mm.x*(.08+r.y*.045)+r.x*5.);
   float d=mm.y-center,w=.043+.041*r.y,aa=w*w+footprint*footprint*.75;
   h-=exp(-d*d/max(aa,.001))*exp(-z*z*z*z)*(.35+.5*r.y);
  }return h;
 }
 `;
 const patch=(s,a,b)=>{if(!s.includes(a))throw Error('Ear shader anchor changed: '+a);return s.replace(a,()=>b);};
 skin.material.onBeforeCompile=shader=>{
  prior(shader);Object.assign(shader.uniforms,U);skin.earExtension.shaderCompiles++;
  shader.fragmentShader=patch(shader.fragmentShader,'void main() {',declarations+'\nvoid main() {');
  shader.fragmentShader=patch(shader.fragmentShader,'vec3 csPaint=mix(csOther,csBase,csCover);',`vec3 csPaint=mix(csOther,csBase,csCover);
   float eaM=eaMask(vFRest)*csCover;vec4 eaS=eaSetting(vFRest),eaD=eaDetail(vFRest);
   float eaBowl=eaG(vFRest.zy,vec2(.027,.275),vec2(.007,.010));
   float eaLobe=eaG(vFRest.zy,vec2(.025,.249),vec2(.011,.007));
   float eaRim=eaG(vFRest.zy,vec2(.008,.284),vec2(.006,.019));
   float eaVariation=csNoise(vFRest*vec3(51.,146.,191.))-.5;
   float eaMottle=csNoise(vFRest*vec3(127.,541.,613.))-.5;
   float eaBlood=(.30+eaRim*.40+eaLobe*.28+eaBowl*.10+eaVariation*.24)*eaS.x;
   vec3 eaColour=csPaint*vec3(1.+eaBlood*.105,1.-eaBlood*.17,1.-eaBlood*.13);
   eaColour*=1.+eaVariation*.035+eaMottle*.018;
   csPaint=mix(csPaint,eaColour,eaM);
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'csPaint=mix(csPaint,paint,fMask*(1.-lpMask));','csPaint=mix(csPaint,paint,fMask*(1.-lpMask)*(1.-eaM));');
  shader.fragmentShader=patch(shader.fragmentShader,'h*=fMask*fHostDetail*(1.-lpMask);','h*=fMask*fHostDetail*(1.-lpMask)*(1.-eaM);');
  shader.fragmentShader=patch(shader.fragmentShader,'*csCover*uIEnabled*iInside*(1.-lpMask);','*csCover*uIEnabled*iInside*(1.-lpMask)*(1.-eaM);');
  shader.fragmentShader=patch(shader.fragmentShader,'float csHeight=csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65);','float csHeight=csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65)*(1.-eaM);');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   vec2 eaMM=vFRest.zy*1000.;float eaFoot=max(length(dFdx(eaMM)),length(dFdy(eaMM)));
   float eaCell=max(eaD.x,.16),eaVisible=1.-smoothstep(eaCell*.28,eaCell*.90,eaFoot);
   float eaPore=fPores(eaMM*(.38/eaCell));
   float eaFine=csNoise(vec3(eaMM*vec2(13.1,17.7),48.))-.5;
   float eaFineVisible=1.-smoothstep(.045,.15,eaFoot);
   float eaCrease=eaCreases(eaMM,eaFoot);
   float eaHeight=(eaPore*.000025*eaS.y*eaVisible*(.70+eaBowl*.34)+eaFine*.0000035*eaS.y*eaFineVisible+eaCrease*.000022*eaD.y*(1.-smoothstep(.16,.55,eaFoot)))*eaM*clamp(csDetail/.72,0.,2.1);
   vec3 eaDX=dFdx(-vViewPosition),eaDY=dFdy(-vViewPosition),eaR1=cross(eaDY,normal),eaR2=cross(normal,eaDX);float eaDet=dot(eaDX,eaR1);
   if(abs(eaDet)>1e-14)normal=normalize(abs(eaDet)*normal-sign(eaDet)*(dFdx(eaHeight)*eaR1+dFdy(eaHeight)*eaR2));
   float eaMicroRough=eaS.y*(.027*(1.-eaVisible)+.040*eaPore*eaVisible);
   float eaOil=eaD.z*(.30+.70*eaBowl);
   roughnessFactor=mix(roughnessFactor,clamp(eaS.z+(csRoughness-.62)*.15+eaLobe*.023-eaRim*.022+eaMottle*.044+eaMicroRough-eaOil*.055,.32,.89),eaM);
   #include <clearcoat_normal_fragment_maps>
  `);
  const coat='material.clearcoatRoughness=clamp(material.clearcoatRoughness-(.045*vFA.y+.015*vFA.w)*fMask,.23,.55);';
  shader.fragmentShader=patch(shader.fragmentShader,coat,coat+`material.clearcoat=mix(material.clearcoat,.012+eaOil*.15,eaM);material.clearcoatRoughness=mix(material.clearcoatRoughness,.46-eaOil*.17,eaM);`);
  shader.fragmentShader=patch(shader.fragmentShader,'struct PhysicalMaterial {','float eaMask(vec3 p);vec4 eaSetting(vec3 p);float eaThin(vec3 p);\nstruct PhysicalMaterial {');
  const anchor='reflectedLight.directDiffuse+=mix(vec3(dotNL),wrapRGB,vFA.x*uFEnabled)*directLight.color*BRDF_Lambert(material.diffuseColor);';
  shader.fragmentShader=patch(shader.fragmentShader,anchor,anchor+`float eaBack=pow(max(-fNL,0.),1.8)*eaMask(vFRest)*eaThin(vFRest)*eaSetting(vFRest).w;reflectedLight.directDiffuse+=eaBack*directLight.color*BRDF_Lambert(material.diffuseColor)*vec3(.46,.115,.052);`);
  shader.fragmentShader=patch(shader.fragmentShader,'vec4(fDiffuse,fMask*(1.-lpMask*.65))','vec4(fDiffuse,fMask*(1.-lpMask*.65)*(1.-eaM*.86))');
  shader.fragmentShader=patch(shader.fragmentShader,'vec4(diffuseColor.rgb,fMask*(1.-lpMask*.65))','vec4(diffuseColor.rgb,fMask*(1.-lpMask*.65)*(1.-eaM*.86))');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <opaque_fragment>',`if(uEAudit>.5&&uEAudit<1.5)outgoingLight=diffuseColor.rgb;if(uEAudit>1.5&&uEAudit<2.5)outgoingLight=normal*.5+.5;if(uEAudit>2.5)outgoingLight=vec3(roughnessFactor);\n#include <opaque_fragment>`);
 };
 skin.material.customProgramCacheKey=()=>key()+'/EAR-R03-region-skin-filtered-relief-v1';
 skin.earExtension={version:EAR_VERSION,shaderCompiles:0,measuredScattering:false,earChart:'template ZY millimetres',faceAtlasExcluded:true,opaque:true,materialControls:7,subpixelPolicy:'microheight fades to roughness',localDiffusionWeight:.14};api.skins.add(skin);
 const old=skin.updateFace?.bind(skin),dispose=skin.dispose.bind(skin);
 skin.updateEars=()=>{U.uEEnabled.value=api.settings.enabled?1:0;for(const [side,n,d]of[['left','uELeft','uEDetailLeft'],['right','uERight','uEDetailRight']]){const s=api.settings[side];U[n].value=[s.redness,s.pores,s.roughness,s.transmission];U[d].value=[s.poreSize,s.creaseRelief,s.oil,0];}};
 skin.earAudit=n=>{U.uEAudit.value=n;skin.viewer.render();};
 skin.updateFace=()=>{old?.();skin.updateEars();};skin.dispose=()=>{api.skins.delete(skin);dispose();};skin.updateEars();skin.material.needsUpdate=true;
}
