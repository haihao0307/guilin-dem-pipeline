/* v3.3.1 visual refinement: contracted tower feet, broad river banks and alias-safe material detail. */
RICH_PALETTE_V330.karstDark.set(0x34463d);
RICH_PALETTE_V330.karstMid.set(0x526052);
RICH_PALETTE_V330.moss.set(0x61704e);
RICH_PALETTE_V330.limestone.set(0x92958b);
RICH_PALETTE_V330.limestoneLight.set(0xb0ad9e);
RICH_PALETTE_V330.talus.set(0x87785e);
RICH_PALETTE_V330.fieldGreen.set(0x718247);
RICH_PALETTE_V330.fieldBright.set(0x8c9949);
RICH_PALETTE_V330.fieldGold.set(0x9d8c4a);
RICH_PALETTE_V330.fieldDark.set(0x52643b);
RICH_PALETTE_V330.bund.set(0x5e5137);
RICH_PALETTE_V330.channel.set(0x617a71);
RICH_PALETTE_V330.wet.set(0x708b80);
RICH_PALETTE_V330.bank.set(0x8e7e5c);
RICH_PALETTE_V330.sand.set(0xb2a277);

parcelGrammarV330=function(worldX,worldY,seed=0){
  const warpX=fbm(worldX*.00175,worldY*.00175,seed+11,4)*62+fbm(worldX*.0072,worldY*.0072,seed+29,3)*11;
  const warpY=fbm(worldX*.00175+7.7,worldY*.00175-4.2,seed+41,4)*62+fbm(worldX*.0072-5.3,worldY*.0072+9.1,seed+57,3)*11;
  const cell=worley((worldX+warpX)*.0084,(worldY+warpY)*.0068,seed+73),edgeGap=cell.f2-cell.f1;
  const boundary=smoothstep(.082,.012,edgeGap);
  const longA=Math.abs(Math.sin(worldX*.0052+worldY*.0024+fbm(worldX*.0018,worldY*.0018,seed+97,3)*3.1));
  const longB=Math.abs(Math.sin(worldX*-.0021+worldY*.0061+fbm(worldX*.0024,worldY*.0024,seed+121,3)*2.3));
  const irrigation=Math.max(smoothstep(.055,.009,longA),smoothstep(.052,.008,longB)*.72)*smoothstep(.08,.38,cell.f1);
  const fieldSeed=hash21(cell.cellX,cell.cellZ,seed+149),subdivide=fieldSeed>.72?smoothstep(.058,.011,Math.abs(Math.sin(worldX*.014+worldY*.005+fieldSeed*7.3))):0;
  const wetness=clamp((fieldSeed-.48)*2.35,0,1)*(.58+.42*fbm(worldX*.0032,worldY*.0032,seed+163,3));
  return{cell,boundary:Math.max(boundary,subdivide*.42),irrigation,fieldSeed,wetness};
};

function towerFootContractionV331(worldX,worldY,peaks,valleyMask=0){
  if(valleyMask>.62)return 0;let cut=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y,qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY,r=Math.hypot(qx,qy);
    if(r<.70||r>1.58)continue;
    const inner=smoothstep(.70,.94,r),outer=1-smoothstep(1.02,1.58,r),asym=.76+.24*fbm(worldX*.0025,worldY*.0025,peak.seed+503,3),local=clamp(peak.targetHeight*.105*inner*outer*asym,0,31);
    cut=Math.max(cut,local);
  }
  return-cut*(1-valleyMask*.78);
}

const buildContextFieldsV331Base=buildContextFields;
buildContextFields=function(analysis,peaks,mode){
  const field=buildContextFieldsV331Base(analysis,peaks,mode);let min=Infinity,max=-Infinity;
  for(let z=0;z<field.n;z++)for(let x=0;x<field.n;x++){
    const i=z*field.n+x,cut=towerFootContractionV331(field.worldX[x],field.worldY[z],peaks,field.valley[i]);
    field.macro[i]+=cut;field.final[i]+=state.enhanceMix*cut*state.macro;min=Math.min(min,field.macro[i]);max=Math.max(max,field.macro[i]);
  }
  field.stats.macroMin=min;field.stats.macroMax=max;return field;
};
const buildRegionalFieldsV331Base=buildRegionalFieldsV330;
buildRegionalFields=function(analysis){
  const field=buildRegionalFieldsV331Base(analysis),peaks=field.peaks;let min=Infinity,max=-Infinity;
  for(let z=0;z<field.n;z++)for(let x=0;x<field.n;x++){
    const i=z*field.n+x,cut=towerFootContractionV331(field.worldX[x],field.worldY[z],peaks,field.valley[i])*.44;
    field.macro[i]+=cut;field.final[i]+=state.enhanceMix*cut*state.macro;min=Math.min(min,field.macro[i]);max=Math.max(max,field.macro[i]);
  }
  field.stats.macroMin=min;field.stats.macroMax=max;return field;
};

const prepareRiverSectionsV331Base=prepareRiverSections;
prepareRiverSections=function(riverModel,localCenter,extent,data,candidate){
  const sections=prepareRiverSectionsV331Base(riverModel,localCenter,extent,data,candidate);if(!sections?.length)return sections;
  for(let i=0;i<sections.length;i++){
    const s=sections[i],broad=.92+.22*fbm(s.x*.00075,s.y*.00075,1171,3),bend=1+Math.min(.32,Math.abs(s.curvature||0)*12);
    s.width=clamp(s.width*1.34*broad*bend,88,214);
  }
  return sections;
};

carveRiverSampleV322=function(base,nearest,edge=1){
  if(!nearest)return{height:base,q:Infinity,clearance:0};
  const section=nearest.section,q=nearest.distance/(section.width*.5),channel=clamp(1-q,0,1),clearance=.42+3.18*Math.pow(channel,1.32);
  if(q<=1){
    const target=section.water-clearance,strength=state.enhanceMix*state.river*edge;
    return{height:state.enhanceMix>0?lerp(base,Math.min(base,target),strength):base,q,clearance};
  }
  const bankBlend=1-smoothstep(1.0,2.18,q);if(bankBlend<=0)return{height:base,q,clearance:0};
  const bankRise=1.0+smoothstep(1.0,2.18,q)*(7.5+2.2*Math.abs(section.curvature||0)*40),target=section.water+bankRise;
  const strength=state.enhanceMix*state.river*bankBlend*.92*edge;
  return{height:lerp(base,Math.min(base,target),strength),q,clearance:0};
};

rockTextureV330.anisotropy=8;soilTextureV330.anisotropy=8;rockTextureV330.needsUpdate=true;soilTextureV330.needsUpdate=true;
makeTerrainMaterialRichV330=function(layer){
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:layer==='local'?.88:.94,metalness:0,side:THREE.DoubleSide});
  if(layer==='local'){
    material.bumpMap=state.preset.id==='paddy'?soilTextureV330:rockTextureV330;
    material.bumpScale=state.preset.id==='cliff'?.28:state.preset.id==='paddy'?.10:.16;
    material.roughnessMap=state.preset.id==='paddy'?soilTextureV330:rockTextureV330;
  }
  material.polygonOffset=layer!=='regional';material.polygonOffsetFactor=layer==='local'?-2:-1;material.polygonOffsetUnits=layer==='local'?-2:-1;material.wireframe=state.wire;return material;
};

const terrainColourRichV331Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourRichV331Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg),valley=field.valley?.[index]??0,exposure=field.exposure?.[index]??0,wet=field.wetness?.[index]??0;
  if(exposure>.5)colour.lerp(RICH_PALETTE_V330.limestoneLight,(exposure-.5)*.22);
  if(valley>.42)colour.lerp(RICH_PALETTE_V330.soil,(valley-.42)*.12*(1-wet));
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.06);
  return colour;
};

const createPaddyWaterV331Base=createPaddyWaterV330;
createPaddyWaterV330=function(build){
  const mesh=createPaddyWaterV331Base(build);if(mesh){mesh.material.opacity=.52;mesh.material.roughness=.28;mesh.material.clearcoat=.42}return mesh;
};

const initRendererV331Base=initRenderer;
initRenderer=async function(){
  await initRendererV331Base();renderer.toneMappingExposure=1.20;scene.fog.near=6100;scene.fog.far=22500;sun.intensity=3.15;
  scene.traverse(object=>{if(object.isHemisphereLight)object.intensity=1.34;if(object.name==='cool-fill')object.intensity=.36});
};

document.title='小王 · 桂林丰富地形蒸馏实验室 v3.3.1';
const brandSmallV331=document.querySelector('.brand small');if(brandSmallV331)brandSmallV331.textContent='XIAOWANG · GUILIN RICH TERRAIN DISTILLATION v3.3.1';
