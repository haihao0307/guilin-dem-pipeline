import {installReferenceProceduralSurface} from './ReferenceProceduralSurface.mjs';
window.platformInstallReferenceSurface=installReferenceProceduralSurface;
import {createPackedEyeColors} from './PackedEyeColors.mjs';
import {installSkinMaterial} from './SkinMaterial.mjs';
import {initialRecord,PRESETS,validateRecord} from './SkinProfile.mjs';
import LUT from './BioSkinLUT.json';
import {installStudio} from './Studio.mjs';
import {attachNativeBrows} from './brows/BrowAdapter.mjs';
import {installDermalOptics} from './DermalOptics.mjs';
import {installLayeredSkin} from './LayeredSkin.mjs';
import {appendSpectralTable} from './SpectralTable.mjs';
window.platformInstallDermal=installDermalOptics;
window.platformInstallLayered=installLayeredSkin;
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Integration anchor changed: '+a);return s.replace(a,()=>b);};
window.platformPackEyes=async(skin,U)=>{
 const packed=await createPackedEyeColors(['neOriginal0','neOriginal1','neClean'].map(k=>U[k].value));
 const before=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material);
 skin.material.onBeforeCompile=s=>{before(s);s.fragmentShader=once(s.fragmentShader,'uniform sampler2D neOriginal0,neOriginal1,neClean,neVessels;','uniform highp sampler2DArray neColorLayers;\nuniform sampler2D neVessels;');for(const[a,b]of [['texture2D(neOriginal0,uv).rgb','texture(neColorLayers,vec3(uv,0.)).rgb'],['texture2D(neOriginal1,uv).rgb','texture(neColorLayers,vec3(uv,1.)).rgb'],['texture2D(neClean,suv).rgb','texture(neColorLayers,vec3(suv,2.)).rgb']])s.fragmentShader=once(s.fragmentShader,a,b);s.uniforms.neColorLayers={value:packed.texture};for(const k of ['neOriginal0','neOriginal1','neClean'])delete s.uniforms[k];};
 skin.material.customProgramCacheKey=()=>key()+'/platform-r021-exact-eye-array';skin.material.needsUpdate=true;skin.eyeColorPacking=packed;skin.naturalEyeExtension.samplerPacking=packed.report;
};
window.platformInstallSkin=({model,viewer,controller})=>{
 if(window.platformSkin)return window.platformSkin;
 const regional=viewer.regionalSkin,field=regional.field.bind(regional);let material,record=initialRecord();
 function pack(f){const t=f.poreTexture;if(!t.userData.platformBioSkin){const data=t.image.data,row=data.length/2048,packed=new Float32Array(data.length+17*2048);packed.set(data);for(let y=0;y<17;y++)for(let x=0;x<33;x++){const k=(row+y)*2048+x*4,i=(y*33+x)*3;packed.set(LUT.data.slice(i,i+3),k);packed[k+3]=1;}t.image={data:packed,width:512,height:packed.length/2048};t.needsUpdate=true;t.userData.platformBioSkin={row,originalBytes:data.byteLength};}appendSpectralTable(t);if(window.layeredSkin)window.layeredSkin.bindTable(t);if(window.referenceSurface)window.referenceSurface.bindTable(t);field(f);if(material)material.U.uSDBioRow.value=t.userData.platformBioSkin.row;}
 regional.field=pack;pack(viewer.currentFacePores);
 material=installSkinMaterial(viewer);material.U.uSDBioRow={value:viewer.currentFacePores.poreTexture.userData.platformBioSkin.row};
 const archive=model.archive.bind(model),restore=model.restore.bind(model);
 model.archive=()=>({...archive(),skinDNA:structuredClone(record)});
 model.restore=o=>{const next=o.skinDNA?validateRecord(o.skinDNA):initialRecord(),old=record;record=next;try{const result=restore(o);apply();return result;}catch(e){record=old;apply();throw e;}};
 function apply(){material.update(record);viewer.render();}
 const api={version:'PLATFORM-SKIN-R02.1',presets:PRESETS.map(({id,name,note})=>({id,name,note})),select(id){if(!PRESETS.some(p=>p.id===id))throw Error('Unknown skin preset');record=initialRecord(id);apply();return this.archive();},archive:()=>structuredClone(record),restore(o){record=validateRecord(o);apply();},compare(){record={...record,enabled:!record.enabled};apply();},report:()=>({version:'SKIN-DNA-R02.1+R06',recipe:structuredClone(record),material:material.report,eyePacking:viewer.skin.eyeColorPacking.report,sourceGeometryChanged:false}),checkSampling:()=>viewer.skin.eyeColorPacking.checkSampling(viewer.renderer)};
 window.platformSkin=api;apply();return api;
};
window.platformInstallStudio=({model,viewer})=>{model.localFeatures={settings:{lighting:true,exposure:1,environment:.8,key:3,fill:.15,rim:3.5,azimuth:45,elevation:42,shadowFilter:5}};const studio=installStudio(viewer);studio.apply();return{preset(id){const choices={studio:{exposure:1,environment:.8,key:3,fill:.15,rim:3.5,azimuth:45,elevation:42},soft:{exposure:1.04,environment:.48,key:2.2,fill:.85,rim:.25,azimuth:-24,elevation:28},rake:{exposure:1.04,environment:.25,key:3,fill:.35,rim:.42,azimuth:68,elevation:22}};if(!choices[id])throw Error('Unknown studio preset');Object.assign(model.localFeatures.settings,choices[id]);studio.apply();viewer.render();},report:studio.report};};
window.platformInstallBrows=({controller})=>{let current,id='natural',binding=false;const choices={natural:{options:{browsDensity:86,browsLength:96,browsLift:5},color:'#393029'},soft:{options:{browsDensity:70,browsLength:92,browsLift:4},color:'#534236'},defined:{options:{browsDensity:96,browsLength:100,browsLift:5},color:'#27211d'}};function bind(){if(binding)return;binding=true;try{current?.dispose();current=attachNativeBrows(window.fullCommonWorkbench,choices[id]);}finally{binding=false;}}bind();controller.addEventListener('change',bind);const api={select(value){if(!choices[value])throw Error('Unknown brow preset');id=value;bind();},report:()=>({preset:id,...current.report()})};window.platformBrows=api;return api;};
