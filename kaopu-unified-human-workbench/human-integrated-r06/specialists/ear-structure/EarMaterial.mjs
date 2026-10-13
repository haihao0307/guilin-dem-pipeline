/** Composes with the frozen host skin; ears sample their YZ tangent chart.
 * Diffuse back-wrap is a bounded real-time approximation, not measured SSS. */
export function attachEarMaterial(skin,api){if(skin.earExtension)return;const prior=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material);const U={uEEnabled:{value:1},uELeft:{value:[.30,.45,.64,.22]},uERight:{value:[.30,.45,.64,.22]}};
 const declarations=`uniform float uEEnabled;uniform vec4 uELeft,uERight;
 float eaMask(vec3 p){float x=abs(p.x);return smoothstep(.063,.078,x)*smoothstep(.234,.246,p.y)*(1.-smoothstep(.300,.313,p.y))*smoothstep(-.006,.003,p.z)*(1.-smoothstep(.038,.050,p.z))*uEEnabled;}
 vec4 eaSetting(vec3 p){return p.x>0.?uELeft:uERight;}
 float eaThin(vec3 p){return clamp(.18+.65*exp(-pow((p.z-.009)/.007,2.)-pow((p.y-.284)/.024,2.))+.45*exp(-pow((p.z-.029)/.010,2.)-pow((p.y-.249)/.006,2.)),0.,1.);}
 `;
 const patch=(s,a,b)=>{if(!s.includes(a))throw Error('Ear shader anchor changed: '+a);return s.replace(a,()=>b);};
 skin.material.onBeforeCompile=shader=>{prior(shader);Object.assign(shader.uniforms,U);skin.earExtension.shaderCompiles++;
  shader.fragmentShader=patch(shader.fragmentShader,'void main() {',declarations+'\nvoid main() {');
  shader.fragmentShader=patch(shader.fragmentShader,'vec3 csPaint=mix(csOther,csBase,csCover);',`vec3 csPaint=mix(csOther,csBase,csCover);
   float eaM=eaMask(vFRest)*csCover;vec4 eaS=eaSetting(vFRest);float eaVariation=.45+.20*sin(vFRest.y*244.)+.13*sin(vFRest.z*385.+vFRest.y*159.);
   csPaint*=mix(vec3(1.),vec3(1.+eaS.x*.08*eaVariation,1.-eaS.x*.14*eaVariation,1.-eaS.x*.11*eaVariation),eaM);
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'float thin=1.-vFA.z*.70,lip=', 'float thin=(1.-vFA.z*.70)*(1.-eaM*.70),lip=');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   vec2 eaMM=vFRest.zy*1000.;float eaFoot=max(length(dFdx(eaMM)),length(dFdy(eaMM)));float eaVisible=1.-smoothstep(.16,.6,eaFoot);
   float eaHeight=fPores(eaMM*1.20)*.000004*eaS.y*eaVisible*eaM;
   vec3 eaDX=dFdx(-vViewPosition),eaDY=dFdy(-vViewPosition),eaR1=cross(eaDY,normal),eaR2=cross(normal,eaDX);float eaDet=dot(eaDX,eaR1);
   if(abs(eaDet)>1e-14)normal=normalize(abs(eaDet)*normal-sign(eaDet)*(dFdx(eaHeight)*eaR1+dFdy(eaHeight)*eaR2));
   roughnessFactor=mix(roughnessFactor,clamp(eaS.z+(csRoughness-.62)*.15+eaVariation*.018,.40,.85),eaM);
   #include <clearcoat_normal_fragment_maps>
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'struct PhysicalMaterial {','float eaMask(vec3 p);vec4 eaSetting(vec3 p);float eaThin(vec3 p);\nstruct PhysicalMaterial {');
  const anchor='reflectedLight.directDiffuse+=mix(vec3(dotNL),wrapRGB,vFA.x*uFEnabled)*directLight.color*BRDF_Lambert(material.diffuseColor);';
  shader.fragmentShader=patch(shader.fragmentShader,anchor,anchor+`float eaBack=pow(max(-fNL,0.),1.7)*eaMask(vFRest)*eaThin(vFRest)*eaSetting(vFRest).w;reflectedLight.directDiffuse+=eaBack*directLight.color*BRDF_Lambert(material.diffuseColor)*vec3(.50,.105,.045);`);
 };
 skin.material.customProgramCacheKey=()=>key()+'/ET18-ear-tangent-roughness-backwrap-v1';skin.earExtension={version:'ET18-A1',shaderCompiles:0,measuredScattering:false,earChart:'template ZY',otherSkinPreserved:true};api.skins.add(skin);
 const old=skin.updateFace?.bind(skin),dispose=skin.dispose.bind(skin);skin.updateEars=()=>{U.uEEnabled.value=api.settings.enabled?1:0;for(const[side,n]of[['left','uELeft'],['right','uERight']]){const s=api.settings[side];U[n].value=[s.redness,s.pores,s.roughness,s.transmission];}};skin.updateFace=()=>{old?.();skin.updateEars();};skin.dispose=()=>{api.skins.delete(skin);dispose();};skin.updateEars();skin.material.needsUpdate=true;
}
