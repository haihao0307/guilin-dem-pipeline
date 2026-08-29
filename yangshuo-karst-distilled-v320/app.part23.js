/* v3.4.4 crown, paddy parcel and close-review refinement. */
state.tone=true;
$('toneToggle').classList.add('active');
$('toneToggle').textContent='桂林地貌色彩';

RICH_PALETTE_V330.karstDark.set(0x263a34);
RICH_PALETTE_V330.karstMid.set(0x435548);
RICH_PALETTE_V330.moss.set(0x566747);
RICH_PALETTE_V330.limestone.set(0x7d8279);
RICH_PALETTE_V330.limestoneLight.set(0x999a8f);
RICH_PALETTE_V330.talus.set(0x746a54);
RICH_PALETTE_V330.soil.set(0x635841);
RICH_PALETTE_V330.fieldDark.set(0x52633a);
RICH_PALETTE_V330.fieldGreen.set(0x6d7e3e);
RICH_PALETTE_V330.fieldBright.set(0x829046);
RICH_PALETTE_V330.fieldGold.set(0x908247);
RICH_PALETTE_V330.bund.set(0x574d37);
RICH_PALETTE_V330.channel.set(0x4f6d65);
RICH_PALETTE_V330.wet.set(0x5f8178);
RICH_PALETTE_V330.bank.set(0x70664e);
RICH_PALETTE_V330.sand.set(0x887f60);
RICH_PALETTE_V330.waterDeep.set(0x32686b);
RICH_PALETTE_V330.waterMid.set(0x4d817e);
RICH_PALETTE_V330.waterEdge.set(0x80a093);

const detectPeaksV344Base=detectPeaksRichV330;
detectPeaksRichV330=function(analysis,maxPeaks=46){
  const peaks=detectPeaksV344Base(analysis,maxPeaks);
  for(let i=0;i<peaks.length;i++){
    const peak=peaks[i],major=i<18,a=hash21(peak.seed,.217,4109),b=hash21(peak.seed,.613,4127);
    const spread=(major?1.10:1.06)*(.97+a*.06);
    peak.radiusX*=spread;peak.radiusY*=spread;
    peak.targetHeight*=major?.98:.96;
    peak.wallStart=.62+a*.12;
    peak.crownDrop=.27+b*.25;
    peak.crownPower=1.08+hash21(peak.seed,.811,4153)*1.10;
    peak.superPower=1.82+hash21(peak.seed,.927,4177)*.72;
    peak.crownShiftX=(hash21(peak.seed,.331,4201)-.5)*.16;
    peak.crownShiftY=(hash21(peak.seed,.557,4219)-.5)*.16;
    peak.faceSeed=Math.floor(hash21(peak.seed,.773,4241)*100000);
  }
  return peaks;
};
detectPeaks=detectPeaksRichV330;

peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let best=-Infinity,second=-Infinity,bestRatio=0,bestInfluence=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    if(Math.abs(qx)>1.48||Math.abs(qy)>1.48)continue;
    const broad=fbm(worldX*.00155,worldY*.00155,peak.faceSeed+7,4),mid=fbm(worldX*.0042+5.7,worldY*.0042-4.6,peak.faceSeed+29,3);
    qx+=broad*.050+mid*.017;qy+=fbm(worldX*.00155+6.4,worldY*.00155-3.1,peak.faceSeed+17,4)*.050-mid*.013;
    const azimuth=Math.atan2(qy,qx),lobe=1+.048*Math.cos(azimuth*3+peak.angle)+.022*Math.cos(azimuth*5+peak.crownShiftX*13);
    qx/=lobe;qy/=lobe;
    const shiftedX=qx-peak.crownShiftX*(1-clamp(Math.hypot(qx,qy),0,1));
    const shiftedY=qy-peak.crownShiftY*(1-clamp(Math.hypot(qx,qy),0,1));
    const r=superellipseRadiusV340(shiftedX,shiftedY,peak.superPower);if(r>1.20)continue;
    const support=1-smoothstep(.98,1.20,r);if(support<=0)continue;
    let profile;
    if(r<=peak.wallStart){
      const t=clamp(r/peak.wallStart,0,1);
      profile=1-peak.crownDrop*Math.pow(t,peak.crownPower);
    }else{
      const wall=1-smoothstep(peak.wallStart,1.02,r);
      profile=(1-peak.crownDrop)*wall;
    }
    const inherited=clamp((zBase-peak.floor)/Math.max(28,peak.prominence),0,1.1);
    profile=clamp(profile*.83+Math.pow(inherited,1.35)*.17+(ridged(worldX*.0038,worldY*.0038,peak.faceSeed+53,3)-.56)*.028,0,1.08);
    const target=peak.floor+peak.targetHeight*profile+fineResidual*.050;
    const surface=lerp(zBase,target,support);
    if(surface>best){second=best;best=surface;bestRatio=peak.ratio;bestInfluence=support}else if(surface>second)second=surface;
  }
  if(!Number.isFinite(best))return{delta:0,influence:0,ratio:0};
  const surface=Number.isFinite(second)?smoothMaximumV340(best,second,10):best;
  return{delta:clamp(surface-zBase,-52,218),influence:bestInfluence,ratio:bestRatio};
};

parcelGrammarV330=function(worldX,worldY,seed=0){
  const warpX=fbm(worldX*.0017,worldY*.0017,seed+11,4)*54+fbm(worldX*.0075,worldY*.0075,seed+29,3)*9;
  const warpY=fbm(worldX*.0017+7.1,worldY*.0017-4.4,seed+41,4)*54+fbm(worldX*.0075-4.8,worldY*.0075+8.6,seed+57,3)*9;
  const coarse=worley((worldX+warpX)*.0088,(worldY+warpY)*.0072,seed+73);
  const fine=worley((worldX+warpX*.45)*.0195,(worldY+warpY*.45)*.0158,seed+97);
  const coarseBoundary=smoothstep(.066,.011,coarse.f2-coarse.f1);
  const fineBoundary=smoothstep(.052,.008,fine.f2-fine.f1);
  const parentSeed=hash21(coarse.cellX,coarse.cellZ,seed+127),childSeed=hash21(fine.cellX,fine.cellZ,seed+149);
  const splitGate=smoothstep(.22,.72,parentSeed),boundary=Math.max(coarseBoundary,fineBoundary*(.38+.48*splitGate));
  const angle=(parentSeed-.5)*.78,ca=Math.cos(angle),sa=Math.sin(angle),u=(worldX+warpX*.18)*ca+(worldY+warpY*.18)*sa,v=-(worldX+warpX*.18)*sa+(worldY+warpY*.18)*ca;
  const contour=Math.abs(Math.sin(u*(.0105+parentSeed*.0035)+fbm(worldX*.0025,worldY*.0025,seed+173,3)*2.1));
  const cross=Math.abs(Math.sin(v*(.0120+(1-parentSeed)*.0038)+fbm(worldX*.0030,worldY*.0030,seed+191,3)*1.7));
  const internal=Math.max(smoothstep(.040,.007,contour)*splitGate,smoothstep(.037,.006,cross)*(1-splitGate)*.72);
  const drainageA=Math.abs(Math.sin(worldX*.0044+worldY*.0019+fbm(worldX*.0015,worldY*.0015,seed+211,4)*3.0));
  const drainageB=Math.abs(Math.sin(worldX*-.0018+worldY*.0052+fbm(worldX*.0020,worldY*.0020,seed+229,3)*2.5));
  const irrigation=Math.max(smoothstep(.032,.005,drainageA),smoothstep(.030,.005,drainageB)*.70)*smoothstep(.055,.36,coarse.f1);
  const fieldSeed=clamp(parentSeed*.45+childSeed*.55,0,1),wetness=clamp((fieldSeed-.46)*2.05,0,1)*(.58+.42*fbm(worldX*.0030,worldY*.0030,seed+251,3));
  return{cell:fine,coarse,boundary:Math.max(boundary,internal*.42),irrigation,fieldSeed,wetness,split:internal};
};

paddyDetail=function(worldX,worldY,truth,base,valleyMask,slopeDeg,seed=0){
  const parent=valleyMask*smoothstep(12.0,2.2,slopeDeg);if(parent<.001)return{delta:0,bund:0,channel:0,mask:0};
  const grammar=parcelGrammarV330(worldX,worldY,seed),step=.22+grammar.fieldSeed*.16,offset=(grammar.fieldSeed-.5)*.12;
  const terrace=Math.round((base+offset)/step)*step-offset,flatten=clamp((terrace-base)*.52,-.24,.24);
  const bund=grammar.boundary*(.085+grammar.fieldSeed*.115),channel=grammar.irrigation*(.075+.075*(1-grammar.fieldSeed));
  const micro=fbm(worldX*.082,worldY*.082,seed+277,2)*.014*(1-grammar.boundary);
  const delta=clamp((flatten+bund-channel+micro)*parent,-.31,.29);
  return{delta,bund:bund*parent,channel:channel*parent,mask:parent,fieldSeed:grammar.fieldSeed,wetness:grammar.wetness};
};

fieldColourV330=function(worldX,worldY,mask,layer){
  const grammar=parcelGrammarV330(worldX,worldY,601),seed=grammar.fieldSeed;
  let colour=seed<.20?RICH_PALETTE_V330.fieldDark.clone():seed<.53?RICH_PALETTE_V330.fieldGreen.clone():seed<.84?RICH_PALETTE_V330.fieldBright.clone():RICH_PALETTE_V330.fieldGold.clone();
  const broad=fbm(worldX*.00145,worldY*.00145,4319,4),fine=fbm(worldX*.013,worldY*.013,4337,3);
  colour.offsetHSL(broad*.005,fine*.008,fine*.008);
  colour.lerp(RICH_PALETTE_V330.bund,clamp(grammar.boundary*.23*mask,0,.23));
  colour.lerp(RICH_PALETTE_V330.channel,clamp(grammar.irrigation*.56*mask,0,.56));
  colour.lerp(RICH_PALETTE_V330.wet,clamp(grammar.wetness*.15*mask,0,.15));
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.085);return colour;
};

const makeTerrainMaterialV344Base=makeTerrainMaterialRichV330;
makeTerrainMaterialRichV330=function(layer){
  const material=makeTerrainMaterialV344Base(layer);
  material.metalness=0;material.dithering=true;
  if(layer==='local'&&state.preset.id==='cliff'){
    material.roughnessMap=null;material.bumpMap=rockTextureV330;material.bumpScale=.19;material.roughness=.98;material.needsUpdate=true;
  }else if(layer==='local'&&state.preset.id==='paddy'){
    material.roughnessMap=null;material.bumpMap=soilTextureV330;material.bumpScale=.045;material.roughness=.97;material.needsUpdate=true;
  }
  return material;
};

createPaddyWaterV330=function(build){
  if(!['atlas','paddy'].includes(state.preset.id)||state.enhanceMix===0)return null;
  const field=build.local,{n,spacing,worldX,worldY,final}=field,step=isMobile?18:15,positions=[],colours=[],indices=[];
  const add=(x,h,y,c)=>{positions.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return positions.length/3-1};
  for(let z=step;z<n-step;z+=step)for(let x=step;x<n-step;x+=step){
    const i=z*n+x,mask=field.paddyMask?.[i]||0;if(mask<.52)continue;const grammar=parcelGrammarV330(worldX[x],worldY[z],601),chance=hash21(Math.floor(worldX[x]/17),Math.floor(worldY[z]/17),4391);if(grammar.wetness<.58||grammar.boundary>.34||chance<.58)continue;
    const half=step*spacing*(.14+.045*chance),angle=(grammar.fieldSeed-.5)*.72,ca=Math.cos(angle),sa=Math.sin(angle),corners=[[-half,-half],[half,-half],[-half,half],[half,half]],ids=[],colour=RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.waterEdge,.12+.10*grammar.wetness),h=final[i]+.024;
    for(const [px,py] of corners)ids.push(add(worldX[x]+px*ca-py*sa,h,worldY[z]+px*sa+py*ca,colour));indices.push(ids[0],ids[2],ids[1],ids[1],ids[2],ids[3]);
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.38,transparent:true,opacity:.38,depthWrite:false,clearcoat:.20,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.name='paddy-shallow-water';mesh.renderOrder=6;return mesh;
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=38;camera.position.set(3160,1580,4380);controls.target.set(20,235,-340)}
  else if(id==='paddy'){camera.fov=34;camera.position.set(offset.x+90,targetHeight+980,offset.z+165);controls.target.set(offset.x-10,targetHeight+6,offset.z-35)}
  else if(id==='river'){camera.fov=39;camera.position.set(offset.x+1120,targetHeight+640,offset.z+1500);controls.target.set(offset.x-35,targetHeight+10,offset.z-175)}
  else{camera.fov=43;camera.position.set(offset.x+165,targetHeight+430,offset.z+205);controls.target.set(offset.x-12,targetHeight+150,offset.z-22)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV344Base=makeQA;
makeQA=function(build){const qa=makeQAV344Base(build);qa.richTerrainPass='v3.4.4';qa.karstCrownGrammar='broad-crown+steep-wall+asymmetric-lobes';qa.paddyParcelGrammar='coarse-cell+fine-cell+contour-split+irrigation';qa.cliffMaterial='high-roughness-low-bump';qa.paddyReviewCamera='inside-local-high-oblique';return qa};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.4';
const brandSmallV344=document.querySelector('.brand small');if(brandSmallV344)brandSmallV344.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.4';
