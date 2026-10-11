/** Composes with the retained skin/eye shader; only the lip and facial-detail
 * bands change. RGB pigment controls are bounded artist models, NOT spectral
 * blood-oxygenation measurement, measured BSSRDF, or a saliva fluid solver. */
export function attachLipOptics(skin,api){
 if(skin.lipMotherOptics)return;const mat=skin.material,prior=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat);
 const U={uL19Mel:{value:[.16,.26]},uL19Blood:{value:[.54,.48]},uL19Rough:{value:[.49,.54]},uL19Wet:{value:[.45,.35]},uL19Oxygen:{value:.72},uL19Geometry:{value:1},uL19Skin:{value:.65}};
 const replace=(s,a,b)=>{if(!s.includes(a))throw Error('ET19 optical anchor missing: '+a);return s.replace(a,()=>b);};
 mat.defaultAttributeValues={...mat.defaultAttributeValues,l19State:[0,1,0,0],l19Detail:[1,0,0,0]};
 mat.onBeforeCompile=shader=>{prior(shader);Object.assign(shader.uniforms,U);
  shader.vertexShader='attribute vec4 l19State,l19Detail;varying vec4 vL19State,vL19Detail;\n'+shader.vertexShader;
  shader.vertexShader=replace(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvL19State=l19State;vL19Detail=l19Detail;');
  let s=shader.fragmentShader;s='varying vec4 vL19State,vL19Detail;uniform vec2 uL19Mel,uL19Blood,uL19Rough,uL19Wet;uniform float uL19Oxygen,uL19Geometry,uL19Skin;\n'+s;
  s=replace(s,'csLip=mix(csLip,lpMask,uLEnabled);','float lpMucosa=clamp(vL19State.x,0.,1.)*csCover*uLEnabled;lpMask=max(lpMask,lpMucosa);csLip=mix(csLip,lpMask,uLEnabled);');
  s=replace(s,'float lpMoist=(1.-smoothstep(.015,.30,lpV))*lpMask*clamp(.78+lpMottle*.55+lpBroad*.28,.35,1.);','float lpMoist=max((1.-smoothstep(.015,.23,lpV))*lpMask*clamp(.78+lpMottle*.55+lpBroad*.28,.35,1.),lpMucosa);float lpWetGain=clamp(uLWet/.35*mix(uL19Wet.x,uL19Wet.y,lpUpper),0.,1.);');
  s=replace(s,'vec3 lpColor=mix(csBase,csLipColor,clamp(csLipMix*(.94+uLPigment*.38),0.,1.));',`float lpMel=mix(uL19Mel.x,uL19Mel.y,lpUpper),lpBlood=mix(uL19Blood.x,uL19Blood.y,lpUpper);
   vec3 lpColor=mix(csBase,csLipColor,clamp(csLipMix*(.43+uLPigment*.30+lpBlood*.25),0.,.94));
   lpColor*=exp(-lpMel*vec3(.20,.31,.42));
   lpColor*=vec3(1.+lpBlood*.10,1.-lpBlood*.10,1.-lpBlood*(.035+.06*uL19Oxygen));
  `);
  s=replace(s,'lpColor*=1.+lpBroad*.10*uLVariation;','lpColor*=1.+lpBroad*.10*uLVariation;lpColor=mix(lpColor,lpColor*vec3(.83,.67,.68),lpMucosa*.72);lpColor=mix(lpColor,csBase*1.04,clamp(vL19State.w*.25,0.,.3));');
  s=replace(s,'lpHeightBands.x*.00025*uLFurrows*lpVisible+lpHeightBands.y*.00010*uLMicro*lpMicroVisible','lpHeightBands.x*.00025*uLFurrows*lpVisible*(1.-clamp(uL19Geometry,0.,1.))+lpHeightBands.y*.00010*uLMicro*lpMicroVisible*clamp(vL19Detail.x,.40,2.1)');
  s=replace(s,'(1.-lpMoist*uLWet*.28)','(1.-lpMoist*lpWetGain*.28)');
  s=replace(s,'uLRough+(csRoughness-.62)*.30-lpMoist*uLWet*.21','mix(uL19Rough.x,uL19Rough.y,lpUpper)+(uLRough-.53)*.65+(csRoughness-.62)*.30-lpMoist*lpWetGain*.21');
  s=replace(s,'.010+csOil*.025+lpMoist*uLWet*.38','.010+csOil*.025+lpMoist*lpWetGain*.32');
  s=replace(s,'.43-lpMoist*uLWet*.20','.43-lpMoist*lpWetGain*.24');
  // Suppress the inherited over-sharp meso map, not the whole skin detail.
  // Existing irregular pores remain in reference mm coordinates and filtered.
  s=replace(s,'h*=fMask*fHostDetail*(1.-lpMask);','h=h*(1.-uL19Skin*uLEnabled*.78)+fPores(fMM)*.000014*uL19Skin*uLEnabled*visibility*ageGain*(1.-vFA.y)*(1.-vFA.z*.85);h*=fMask*fHostDetail*(1.-lpMask);');
  s=replace(s,'if(uLDebug>3.5)outgoingLight=vec3(roughnessFactor);',`if(uLDebug>3.5&&uLDebug<4.5)outgoingLight=vec3(roughnessFactor);
   if(uLDebug>4.5&&uLDebug<5.5)outgoingLight=mix(mix(vec3(.35,.40,.45),vec3(.65,.14,.09),lpMask),vec3(.22,.08,.46),lpMucosa);
   if(uLDebug>5.5&&uLDebug<6.5){float e=clamp((vL19State.y-1.)*3.,-1.,1.);outgoingLight=mix(vec3(.25,.28,.25),e>0.?vec3(.15,.65,.90):vec3(.92,.32,.08),abs(e))*max(lpMask,.15);}
   if(uLDebug>6.5)outgoingLight=vec3(lpMoist*lpWetGain);
  `);
  shader.fragmentShader=s;skin.lipMotherOptics.compiles++;
 };
 mat.customProgramCacheKey=()=>key()+'/ET19-geometry-regional-optics-v1';skin.lipMotherOptics={version:'ET19-L3',compiles:0,measuredOptics:false,independentUpperLower:true,wetness:'continuous original surface, not a transparent extra sheet',SSS:'retained host diffusion approximation; no measured volumetric scattering'};
 const update=skin.updateLips.bind(skin);skin.updateLips=()=>{update();const d=api.anatomy.settings;U.uL19Mel.value=[d.lowerMelanin,d.upperMelanin];U.uL19Blood.value=[d.lowerBlood,d.upperBlood];U.uL19Rough.value=[d.lowerRoughness,d.upperRoughness];U.uL19Wet.value=[d.lowerWetness,d.upperWetness];U.uL19Oxygen.value=d.oxygenation;U.uL19Geometry.value=d.microGeometry;U.uL19Skin.value=d.skinRefinement;};skin.updateLips();mat.needsUpdate=true;
}
