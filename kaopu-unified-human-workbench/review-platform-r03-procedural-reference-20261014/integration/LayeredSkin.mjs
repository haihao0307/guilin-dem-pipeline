import {COEFFICIENT_GLSL,BAND_COEFFICIENTS,TISSUE_DATA} from './TissueTransport.mjs';
import {SPECTRAL_GLSL,SPECTRAL_LUT} from './SpectralTable.mjs';
const glsl=`
uniform sampler2D uRFPores;
uniform float uLSOn,uLSEpi,uLSBlood,uLSScatter,uLSFilm,uLSHydration,uLSVeins;
float lsCoverage=0.,lsLipCoverage=0.;vec3 lsWrapWidth=vec3(.2,.1,.05);
${COEFFICIENT_GLSL}
${SPECTRAL_GLSL}
vec3 lsTransport(float mel,float blood,float thickness,float lip,float vessel){return lsLookup(mel,blood,thickness,vessel,int(lip+.5),uLSPreset);}

`;
export function installLayeredSkin({model,viewer}){
 if(window.layeredSkin)return window.layeredSkin;
 const material=viewer.skin.material,prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 const choices=SPECTRAL_LUT.presets;
 const U={uLSRow:{value:viewer.currentFacePores.poreTexture.userData.layeredSpectral.row},uLSPreset:{value:1},uLSOn:{value:1},uLSEpi:{value:1},uLSBlood:{value:1},uLSScatter:{value:1.03},uLSFilm:{value:1},uLSHydration:{value:.68},uLSVeins:{value:.65}};let selected='luminous',enabled=true,compiles=0;
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Layered skin anchor changed: '+a.slice(0,90));return s.replace(a,()=>b);};
 material.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);let f=glsl+'\n'+s.fragmentShader;
 f=once(f,'uniform sampler2D uRFPores;uniform int uSDBioRow;','uniform int uSDBioRow;');
 // R01 remains available exactly by uLSOn=0. Old painted vascular colour and
 // the new depth-transport vascular field must never accumulate.
 f=once(f,'float dtV=dtVessel(dtMM,sign(vFRest.x))*uDTVeins*exp(-1.1-uSDMel*3.8)*sdSkin;','float dtV=dtVessel(dtMM,sign(vFRest.x))*uDTVeins*exp(-1.1-uSDMel*3.8)*sdSkin*(1.-uLSOn);');
 f=once(f,'float dtFlush=(.012*rfCheek+.010*rfThin)*uDTScatter*(1.-uSDMel*.65);','float dtFlush=(.012*rfCheek+.010*rfThin)*uDTScatter*(1.-uSDMel*.65)*(1.-uLSOn);');
 const colour='diffuseColor.rgb=mix(diffuseColor.rgb,sdAlbedo,sdCover*(1.-clamp(lpMask,0.,1.)));';
 f=once(f,colour,`
 // Ear cartilage/lobe transport remains owned by native ET/R06, with its
 // existing thickness field; a facial fat backing is not applied to cartilage.
 lsCoverage=sdCover*(1.-clamp(lpMask,0.,1.))*(1.-clamp(eaM,0.,1.));lsLipCoverage=sdCover*clamp(lpMask,0.,1.);
 float lsThin=clamp(rfThin*.80+rfTemple*.32,0.,1.);
 float lsThickness=clamp(1.+rfNose*.38+rfForehead*.12-lsThin*.55, .42,1.55);
 float lsMelanin=mix(.012,.30,pow(clamp(sdPigment,0.,1.),1.5));
 lsMelanin*=1.+uSDVariation*((sdNoise(vFRest*700.+uSDOffset)-.5)*.11+(sdNoise(vFRest*160.+uSDOffset)-.5)*.06);
 float lsPerfusion=(.018+.024*uSDBlood)*(1.+.42*rfCheek+.27*rfNose-.08*rfForehead)*uLSBlood;
 // Low-amplitude correlated perfusion, on millimetre scales, not colour spots.
 float lsVary=(sdNoise(vFRest*vec3(270.,240.,240.)+uSDOffset)-.5)*.32*uSDVariation;
 lsPerfusion*=1.+lsVary+uSDFlush*(.45+.55*rfCheek);
 float lsVascularField=dtVessel(dtMM,sign(vFRest.x))*.007*uLSVeins*(1.-clamp(lpMask,0.,1.));
 // Preserve the curated BioSkin identity. The research model supplies layer
 // response relative to a neutral facial site; it is not an individual color
 // measurement or an absolute radiometric prediction of this character.
 float lsReferenceMel=mix(.012,.30,pow(clamp(uSDMel,0.,1.),1.5));
 float lsReferenceBlood=.018+.024*uSDBlood;
 vec3 lsCalibration=vec3(1.);
 if(sdCover>.001&&uLSOn>.5)lsCalibration=sdBio(vec2(uSDMel,uSDBlood))/max(lsLookup(lsReferenceMel,lsReferenceBlood,1.,0.,0,0),vec3(.015));
 vec3 lsAlbedo=sdAlbedo;if(lsCoverage>.001&&uLSOn>.5)lsAlbedo=lsTransport(lsMelanin,lsPerfusion,lsThickness,0.,lsVascularField)*lsCalibration;
 sdAlbedo=mix(sdAlbedo,lsAlbedo,uLSOn);
 ${colour}
 // Vermilion uses its own epithelium, capillary-rich connective layers and
 // muscle-rich backing. It never receives facial pores or T-zone sebum.
 float lsLipMel=lsMelanin*(.38+.40*uLPigment)*(1.+smoothstep(.55,1.,lpV)*.25);
 float lsLipBlood=(.045+.028*uLPigment)*(1.+lpMucosa*.35)*uLSBlood;
 lsLipBlood*=mix(1.13,.87,smoothstep(.12,.95,lpV))*(1.+lpBroad*.075*uLVariation);
 float lsLipThickness=clamp(.84+.14*lpUpper+.16*clamp(lpV,0.,1.),.7,1.2);
 vec3 lsLip=diffuseColor.rgb;if(lsLipCoverage>.001&&uLSOn>.5)lsLip=lsTransport(lsLipMel,lsLipBlood,lsLipThickness,1.,0.)*lsCalibration;
 lsLip*=1.+lpFine*.020*uLFurrows*lpVisible+lpBroad*.025*uLVariation;
 lsLip*=mix(1.,.82,lpMucosa*.65);
 lsLip=mix(lsLip,lsLip*1.04,lpDryPatch*.25);
 // Observed teacher principle: a restrained soft vermilion transition and a
 // drier exterior, rather than a uniformly lacquered lip silhouette.
 float lsLipEdge=clamp(lpOuterFade+smoothstep(.76,1.,lpV)*mix(.32,.48,lpUpper)+smoothstep(.60,1.,abs(lpU))*.045,0.,.62);
 lsLip=mix(lsLip,sdAlbedo,lsLipEdge);
 diffuseColor.rgb=mix(diffuseColor.rgb,lsLip,lsLipCoverage*uLSOn);
 vec3 lsLength=inversesqrt(max(3.*(lsBase+lsPerfusion*mix(lsDeoxy,lsOxy,.76))*(lsBase+lsPerfusion*mix(lsDeoxy,lsOxy,.76)+lsScattering),vec3(.01)));
 lsWrapWidth=clamp(vec3(.035)+lsLength*.072,vec3(.07),vec3(.34,.20,.14));
 lsWrapWidth*=mix(1.,.72,clamp(uSDMel,0.,1.));
 lsWrapWidth=mix(lsWrapWidth,vec3(.28,.14,.09),clamp(lpMask,0.,1.));
 `);
 const lipPigment='diffuseColor.rgb*=mix(vec3(1.),exp(-uSDMel*vec3(.62,.74,.86)),sdCover*clamp(lpMask,0.,1.)*.72);';
 f=once(f,lipPigment,'diffuseColor.rgb*=mix(vec3(1.),exp(-uSDMel*vec3(.62,.74,.86)),sdCover*clamp(lpMask,0.,1.)*.72*(1.-uLSOn));');
 f=once(f,'vec3 rfAngular=max((vec3(fNL)+rfW)/(1.+rfW),vec3(0.))/(1.+rfW);','rfW=mix(rfW,lsWrapWidth,uLSOn*uSDOn);vec3 rfAngular=max((vec3(fNL)+rfW)/(1.+rfW),vec3(0.))/(1.+rfW);');
 f=once(f,'rfAngular,rfArea)*directLight.color*BRDF_Lambert(material.diffuseColor);','rfAngular,max(rfArea,lsLipCoverage*uLSOn))*directLight.color*BRDF_Lambert(material.diffuseColor);');
 const rough='cLobeWeight=mix(cLobeWeight,.06+sdOil*.25,sdSkin);';
 f=once(f,rough,rough+`
 float lsOil=clamp(uSDOil*(.18+.82*csT)*uLSFilm+uSDSweat*.35,0.,1.);
 float lsDry=clamp((1.-uSDHydration)*.45+uSDDry*.45,0.,1.);
 float lsSurfaceRough=clamp(.47+lsDry*.16-lsOil*.17+rfThin*.025+(sdNoise(vFRest*1300.)-.5)*.028,.28,.68);
 roughnessFactor=mix(roughnessFactor,lsSurfaceRough,sdSkin*uLSOn);
 float lsLipHydration=clamp(.55*uLSHydration+.45*uLWet,0.,1.);
 float lsLipRough=clamp(.48-.16*lsLipHydration-lpMoist*lpWetGain*.11+lpDryPatch*.09+smoothstep(.58,.98,lpV)*.085+lpUpper*.022,.25,.64);
 roughnessFactor=mix(roughnessFactor,lsLipRough,lsLipCoverage*uLSOn);
 cLobeWeight=mix(cLobeWeight,.045+lsOil*.12,sdSkin*uLSOn);
 // Original labial micro-striae: a bounded rest-space relief, never painted
 // dark stripes. Native ET19 volume/furrows remain the structural owner.
 float lsLipAA=1.-smoothstep(.055,.15,lpFoot);
 if(uLSOn>.5){
  float lsPhase=lpMM.x*15.7+1.5*sin(lpMM.x*1.9+lpV*4.1)+.55*sin(lpMM.y*8.7+lpMM.x*.8);
  float lsGroove=pow(.5+.5*cos(lsPhase),8.);
  float lsHeight=-.0000045*lsGroove*(.65+.35*sdNoise(vec3(lpMM*.9,13.)))*lsLipAA*lsLipCoverage*(1.-lpMoist*.6)*sin(clamp(lpV,0.,1.)*3.14159265);
  vec3 lsDX=dFdx(-vViewPosition),lsDY=dFdy(-vViewPosition),lsR1=cross(lsDY,normal),lsR2=cross(normal,lsDX);float lsDet=dot(lsDX,lsR1);
  if(abs(lsDet)>1e-14){vec3 lsSlope=sign(lsDet)*(dFdx(lsHeight)*lsR1+dFdy(lsHeight)*lsR2)/abs(lsDet);lsSlope*=min(1.,.12/max(length(lsSlope),.00001));normal=normalize(normal-lsSlope);}
 }
 `);
 const coat='material.clearcoatRoughness=mix(material.clearcoatRoughness,.32,sdSkin);';
 f=once(f,coat,coat+`
 material.clearcoat=mix(material.clearcoat,.035+lsOil*.25,sdSkin*uLSOn);
 material.clearcoatRoughness=mix(material.clearcoatRoughness,clamp(.38-lsOil*.16,.20,.38),sdSkin*uLSOn);
 material.clearcoat=mix(material.clearcoat,.025+lpMoist*lpWetGain*(.14+.18*uLSHydration),lsLipCoverage*uLSOn);
 material.clearcoatRoughness=mix(material.clearcoatRoughness,.30-lpMoist*lpWetGain*.13,lsLipCoverage*uLSOn);
 material.clearcoatF0=mix(material.clearcoatF0,vec3(${((1.46-1)/(1.46+1))**2}),sdSkin*uLSOn);
 material.clearcoatF0=mix(material.clearcoatF0,vec3(${((1.333-1)/(1.333+1))**2}),lsLipCoverage*uLSOn);
 `);
 s.fragmentShader=f;compiles++;};
 material.customProgramCacheKey=()=>key()+'/layered-tissue-r02-spectral81';material.needsUpdate=true;
 function select(id){const p=choices[id];if(!p)throw Error('Unknown layered tissue preset');selected=id;U.uLSPreset.value=SPECTRAL_LUT.presetOrder.indexOf(id);for(const[k,v]of Object.entries(p))U['uLS'+({epi:'Epi',blood:'Blood',scatter:'Scatter',film:'Film',hydration:'Hydration',veins:'Veins'}[k])].value=v;viewer.render();}
 const dtSelect=window.dermalOptics.select.bind(window.dermalOptics);window.dermalOptics.select=id=>{select(id);dtSelect(id);};
 const dtRefresh=window.dermalOptics.refresh.bind(window.dermalOptics);window.dermalOptics.refresh=()=>{select(selected);dtRefresh();};
 const api={select,bindTable(t){if(!t.userData.layeredSpectral)throw Error('Missing spectral table');U.uLSRow.value=t.userData.layeredSpectral.row;},setEnabled(value){enabled=!!value;U.uLSOn.value=enabled?1:0;viewer.render();return enabled;},compare(){return this.setEnabled(!enabled);},archive:()=>({schema:'kaopu.layered-tissue/1',preset:selected,enabled}),restore(o){if(!o||o.schema!=='kaopu.layered-tissue/1'||!choices[o.preset]||typeof o.enabled!=='boolean')throw Error('Invalid layered tissue archive');select(o.preset);this.setEnabled(o.enabled);},report:()=>({version:'LAYERED-TISSUE-R02',selected,enabled,layers:TISSUE_DATA.layers.map(l=>l.id),surfaceFilmSeparate:true,vermilionSeparate:true,epidermalBloodFraction:0,extraSamplers:0,geometryChanged:false,transparentMeshes:0,medicalSimulation:false,model:SPECTRAL_LUT.method,spectralSamples:81,tableHash:SPECTRAL_LUT.payloadSHA256,tableDimensions:SPECTRAL_LUT.dimensions,coefficients:BAND_COEFFICIENTS,compiles})};
 window.layeredSkin=api;return api;
}
