/* v3.6.7 visual safety pass: restore the stable atlas palette and feather fine paddy lines into the contextual field. */

const PADDY_STAGE_V367=[new THREE.Color(0x506b30),new THREE.Color(0x638035),new THREE.Color(0x79913a),new THREE.Color(0x8f7d3d)],PADDY_BASE_V367=new THREE.Color(0x52603d),PADDY_SOIL_V367=new THREE.Color(0x64553c),PADDY_BUND_V367=new THREE.Color(0x4b402f),PADDY_CHANNEL_V367=new THREE.Color(0x34574f),PADDY_WET_V367=new THREE.Color(0x4a6d62),PADDY_STAGE_SCRATCH_V367=new THREE.Color(),PADDY_COLOUR_SCRATCH_V367=new THREE.Color();
function paddyColourV367(field,index,worldX,worldY,layer,slopeDeg){
  const semanticRaw=field.valley?.[index]??field.paddy?.[index]??field.paddySmoothV360?.[index]??field.paddyMask?.[index]??0,semantic=Number.isFinite(semanticRaw)?clamp(semanticRaw,0,1):0,slope=Number.isFinite(slopeDeg)?slopeDeg:0,mask=semantic*smoothstep(13.5,2.0,slope),grammar=paddyGrammarV366(worldX,worldY,601),stage=PADDY_STAGE_SCRATCH_V367.copy(PADDY_STAGE_V367[Math.min(3,Math.floor(clamp(grammar.fieldSeed,0,.999999)*4))]),broad=fbm((worldX-450000)*.00072,(worldY-2750000)*.00072,8501,4),edgeRaw=layer==='local'?(field.visualEdgeV347?.[index]??field.localEdge?.[index]??1):1,edge=clamp(Number.isFinite(edgeRaw)?edgeRaw:1,0,1),lineStrength=layer==='local'?(.18+.82*edge):1;
  stage.offsetHSL(0,broad*.002,broad*.009);stage.lerp(PADDY_WET_V367,clamp(grammar.wetness*.12*mask,0,.12));stage.lerp(PADDY_BUND_V367,clamp(grammar.boundary*.40*mask*lineStrength,0,.40));stage.lerp(PADDY_CHANNEL_V367,clamp(grammar.irrigation*.48*mask*lineStrength,0,.48));
  const colour=PADDY_COLOUR_SCRATCH_V367.copy(PADDY_BASE_V367).lerp(PADDY_SOIL_V367,smoothstep(6,18,slope)*.32).lerp(stage,mask*.97);if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.10);else if(layer==='context')colour.offsetHSL(0,0,.006);if(!Number.isFinite(colour.r+colour.g+colour.b))colour.set(0x607345);return colour;
}
paddyColourV366=paddyColourV367;
paddyParcelColourV351=paddyColourV367;

const terrainColourV367Current=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  if(state.preset.id==='atlas'){
    const colour=terrainColourV366Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);if(!Number.isFinite(colour.r+colour.g+colour.b))colour.set(0x566447);return colour;
  }
  if(state.preset.id==='paddy')return paddyColourV367(field,index,worldX,worldY,layer,slopeDeg);
  const colour=terrainColourV367Current(field,index,heightNorm,worldX,worldY,layer,slopeDeg);if(!Number.isFinite(colour.r+colour.g+colour.b))colour.set(0x566447);return colour;
};

const makeQAV367Base=makeQA;
makeQA=function(build){const qa=makeQAV367Base(build);qa.richTerrainPass='v3.6.7';qa.atlasColourSafety='stable-pre-v366-palette';qa.paddyFineLineFeather='local-edge-aware';qa.nonFiniteColourFallback=true;qa.visualAcceptance=false;qa.productionReady=false;return qa};

const buildPresetV367Base=buildPreset;
buildPreset=async function(id,options={}){const result=await buildPresetV367Base(id,options);if(window.__terrainV320QA?.ready)window.__terrainV320QA.richTerrainPass='v3.6.7';setStatus('桂林多场地貌 v3.6.7 已加载',`${state.currentBuild.candidate.name} · 全景综合色彩、田块边缘渐隐和连续峰体协作`);return result};

document.title='小王 · 桂林多场地貌蒸馏实验室 v3.6.7';
const brandSmallV367=document.querySelector('.brand small');if(brandSmallV367)brandSmallV367.textContent='XIAOWANG · GUILIN MULTI-FIELD TERRAIN DISTILLATION v3.6.7';
