/* v3.3.3 visual morphology pass: remove periodic banding, tighten tower footprints and expose the valley system. */
const detectPeaksRichV333Base=detectPeaksRichV330;
detectPeaksRichV330=function(analysis,maxPeaks=52){
  const peaks=detectPeaksRichV333Base(analysis,maxPeaks);
  for(const peak of peaks){
    const contraction=.78+hash21(peak.seed,.17,1301)*.10;
    peak.radiusX*=contraction;peak.radiusY*=contraction;
    peak.wallPower*=1.08;peak.crownPower=clamp(peak.crownPower*.92,.28,.50);
  }
  return peaks;
};
detectPeaks=detectPeaksRichV330;
towerFootContractionV331=function(){return 0};

processMicro=function(worldX,worldY,gx,gy,karstMask,seed=0){
  if(karstMask<.001)return 0;
  const magnitude=Math.hypot(gx,gy)||1,ux=gx/magnitude,uy=gy/magnitude;
  const warpA=fbm(worldX*.0019,worldY*.0019,seed+17,4),warpB=fbm(worldX*.0043+8.7,worldY*.0043-3.1,seed+31,3);
  const px=(worldX+ux*(warpA*72+warpB*18))*.0051,py=(worldY+uy*(warpA*72+warpB*18))*.0051;
  const dissolved=(ridged(px,py,seed+53,5)-.57)*.88;
  const flowCarrier=ridged((worldX*ux+worldY*uy+warpA*95)*.0092,(worldX*-uy+worldY*ux+warpB*42)*.0029,seed+71,4);
  const grooves=-Math.pow(smoothstep(.70,.96,flowCarrier),2.4)*1.18;
  const pocketCell=worley(worldX*.017+warpA*.6,worldY*.017+warpB*.6,seed+97),pockets=-smoothstep(.28,.055,pocketCell.f1)*.55;
  const crackA=worley(worldX*.0083+warpB*.3,worldY*.0083-warpA*.3,seed+127),crackB=worley(worldX*.023,worldY*.023,seed+149);
  const cracks=-smoothstep(.080,.010,crackA.f2-crackA.f1)*.42-smoothstep(.052,.008,crackB.f2-crackB.f1)*.20;
  const crumble=(turbulenceV330(worldX*.012,worldY*.012,seed+181,4)-.49)*.22;
  return clamp((dissolved+grooves+pockets+cracks+crumble)*karstMask,-2.8,1.55);
};

terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const valley=field.valley?.[index]??0,karst=field.karst?.[index]??smoothstep(12,38,slopeDeg),paddy=field.paddyMask?.[index]??field.paddy?.[index]??0;
  const exposure=field.exposure?.[index]??smoothstep(28,58,slopeDeg),sediment=field.sediment?.[index]??valley,wetness=field.wetness?.[index]??valley*.45;
  const rugged=field.ruggedness?.[index]??0,curvature=field.curvature?.[index]??0,riverQ=field.riverQ?.[index]??99;
  const broad=fbm(worldX*.00062,worldY*.00062,1409,4),mid=fbm(worldX*.0031+4.8,worldY*.0031-6.2,1423,4),fine=fbm(worldX*.011,worldY*.011,1451,3);
  const cell=worley(worldX*.0028+broad*.7,worldY*.0028-mid*.4,1471),rockPatch=clamp((cell.f2-cell.f1)*1.7+ridged(worldX*.0023,worldY*.0023,1487,3)*.45,0,1);
  let colour=RICH_PALETTE_V330.karstDark.clone().lerp(RICH_PALETTE_V330.karstMid,.48+.16*broad+.10*heightNorm);
  const rockBreak=clamp(exposure*(.42+.34*rockPatch)+rugged*.22+Math.max(0,curvature)*.10,0,.86);
  colour.lerp(RICH_PALETTE_V330.limestone.clone().lerp(RICH_PALETTE_V330.limestoneLight,.26+.22*fine),rockBreak);
  colour.lerp(RICH_PALETTE_V330.moss,clamp((1-exposure)*(.24+.34*karst)+wetness*.14,0,.56));
  colour.lerp(RICH_PALETTE_V330.talus,clamp(sediment*smoothstep(11,35,slopeDeg)*(1-smoothstep(39,56,slopeDeg))*.40,0,.40));
  const fieldMask=clamp(Math.max(paddy,valley*.78)*smoothstep(16,2.8,slopeDeg),0,1);
  if(fieldMask>.01){
    const fieldColour=fieldColourV330(worldX,worldY,fieldMask,layer),soilMix=clamp((1-fieldMask)*.24+Math.abs(curvature)*.08+(1-wetness)*.05,0,.30);
    fieldColour.lerp(RICH_PALETTE_V330.soil,soilMix);colour.lerp(fieldColour,fieldMask*.90);
  }
  if(riverQ<1.72){const bank=1-smoothstep(1.0,1.72,riverQ),sand=(1-smoothstep(.78,1.18,riverQ))*.17;colour.lerp(RICH_PALETTE_V330.bank,bank*.64);colour.lerp(RICH_PALETTE_V330.sand,sand)}
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.10+.07*heightNorm);
  colour.offsetHSL(broad*.010,mid*.012,fine*.012);return colour;
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=37;camera.position.set(3200,1480,4200);controls.target.set(40,218,-300)}
  else if(id==='paddy'){camera.fov=43;camera.position.set(offset.x+430,targetHeight+535,offset.z+1120);controls.target.set(offset.x-40,targetHeight+2,offset.z-150)}
  else if(id==='river'){camera.fov=40;camera.position.set(offset.x+1090,targetHeight+510,offset.z+1450);controls.target.set(offset.x-40,targetHeight+8,offset.z-160)}
  else{camera.fov=41;camera.position.set(offset.x+600,targetHeight+360,offset.z+770);controls.target.set(offset.x-25,targetHeight+112,offset.z-70)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV333Base=makeQA;
makeQA=function(build){const qa=makeQAV333Base(build);qa.richTerrainPass='v3.3.3';qa.periodicBandingSuppressed=true;qa.towerFootMethod='contracted-positive-profile';return qa};

document.title='小王 · 桂林丰富地形蒸馏实验室 v3.3.3';
const brandSmallV333=document.querySelector('.brand small');if(brandSmallV333)brandSmallV333.textContent='XIAOWANG · GUILIN RICH TERRAIN DISTILLATION v3.3.3';
