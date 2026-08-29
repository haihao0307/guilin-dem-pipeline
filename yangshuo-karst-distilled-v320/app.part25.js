/* v3.4.6 visual continuity pass: exact local-to-context blending, LOD-safe valley colour, peak-centred cliff detail and review framing. */

const detectPeaksRichV346Base=detectPeaksRichV330;
detectPeaksRichV330=function(analysis,maxPeaks=58){
  const peaks=detectPeaksRichV346Base(analysis,maxPeaks);
  for(let i=0;i<peaks.length;i++){
    const peak=peaks[i],major=i<20,shape=hash21(peak.seed,.313,5003);
    peak.targetHeight*=major?1.035:1.015;
    peak.wallStart=.43+hash21(peak.seed,.457,5011)*.105;
    peak.wallEnd=.875+hash21(peak.seed,.683,5021)*.065;
    peak.summitRadius=.075+hash21(peak.seed,.797,5039)*.105;
    peak.crownDrop=.235+hash21(peak.seed,.911,5051)*.145;
    peak.crownPower=1.20+hash21(peak.seed,.229,5077)*.75;
    peak.superPower=2.15+shape*1.10;
    peak.faceSeed=Math.floor(hash21(peak.seed,.541,5099)*100000);
  }
  return peaks;
};
detectPeaks=detectPeaksRichV330;

const detectPeaksV346TrackBase=detectPeaks;
detectPeaks=function(analysis,maxPeaks){
  const peaks=detectPeaksV346TrackBase(analysis,maxPeaks);
  state.contextPeaksV346=peaks;
  return peaks;
};

const chooseLocalCenterV346Base=chooseLocalCenter;
chooseLocalCenter=function(preset,focus,paddyFocus,riverModel){
  if(preset?.detailMode==='cliff'&&state.contextPeaksV346?.length){
    const limit=CONTEXT_EXTENT*.36;
    const candidates=state.contextPeaksV346
      .filter(peak=>Math.hypot(peak.x-focus.x,peak.y-focus.y)<limit)
      .map(peak=>({peak,score:(peak.targetHeight||0)*(1.05+(peak.ratio||1)*.24)+(peak.prominence||0)*.55-Math.hypot(peak.x-focus.x,peak.y-focus.y)*.012}))
      .sort((a,b)=>b.score-a.score);
    if(candidates.length){
      state.selectedCliffPeakV346=candidates[0].peak;
      return{x:candidates[0].peak.x,y:candidates[0].peak.y};
    }
  }
  state.selectedCliffPeakV346=null;
  return chooseLocalCenterV346Base(preset,focus,paddyFocus,riverModel);
};

peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let best=-Infinity,second=-Infinity,bestRatio=0,bestInfluence=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    if(Math.abs(qx)>1.25||Math.abs(qy)>1.25)continue;
    const warpA=fbm(worldX*.00135,worldY*.00135,peak.faceSeed+7,4),warpB=fbm(worldX*.0040+5.7,worldY*.0040-4.1,peak.faceSeed+19,3);
    qx+=warpA*.032+warpB*.010;
    qy+=fbm(worldX*.00135+6.1,worldY*.00135-3.2,peak.faceSeed+13,4)*.032-warpB*.008;
    const azimuth=Math.atan2(qy,qx),lobe=1+.048*Math.cos(azimuth*3+peak.angle)+.021*Math.cos(azimuth*5+peak.crownShiftY*14);
    qx/=lobe;qy/=lobe;
    const r0=superellipseRadiusV340(qx,qy,peak.superPower||2.7);
    const shiftedX=qx-(peak.crownShiftX||0)*(1-clamp(r0,0,1));
    const shiftedY=qy-(peak.crownShiftY||0)*(1-clamp(r0,0,1));
    const r=superellipseRadiusV340(shiftedX,shiftedY,peak.superPower||2.7);
    if(r>1.065)continue;
    const support=1-smoothstep(.975,1.065,r);if(support<=0)continue;
    const summitRadius=peak.summitRadius||.12,wallStart=peak.wallStart||.49,wallEnd=peak.wallEnd||.92,crownDrop=peak.crownDrop||.30;
    let profile;
    if(r<=wallStart){
      const crownT=smoothstep(summitRadius,wallStart,r);
      const crownTilt=(shiftedX*.055-shiftedY*.035)*(hash21(peak.seed,.371,5119)-.5);
      const summitBreak=.018*Math.cos(azimuth*2+peak.angle)+.010*Math.cos(azimuth*4+peak.seed*.001);
      profile=1-crownDrop*Math.pow(crownT,peak.crownPower||1.45)+crownTilt+summitBreak*(1-crownT);
    }else{
      const wallT=smoothstep(wallStart,wallEnd,r);
      profile=(1-crownDrop)*Math.pow(clamp(1-wallT,0,1),.22);
    }
    const middle=smoothstep(.36,.66,r)*(1-smoothstep(.78,.96,r));
    const ribs=Math.pow(Math.max(0,Math.cos(azimuth*(peak.buttressCount||4)+peak.angle)),3.4)*middle*.060;
    const face=ridged(worldX*.0048+warpB*.25,worldY*.0048-warpA*.22,peak.faceSeed+43,4);
    const flute=-smoothstep(.74,.96,face)*middle*.035;
    const inherited=clamp((zBase-peak.floor)/Math.max(28,peak.prominence),0,1.06);
    profile=clamp(profile+ribs+flute+Math.pow(inherited,1.55)*.038*(1-smoothstep(.52,.77,r)),0,1.08);
    const target=peak.floor+peak.targetHeight*profile+fineResidual*.035;
    const surface=lerp(zBase,target,support);
    if(surface>best){second=best;best=surface;bestRatio=peak.ratio;bestInfluence=support}else if(surface>second)second=surface;
  }
  if(!Number.isFinite(best))return{delta:0,influence:0,ratio:0};
  const surface=Number.isFinite(second)?smoothMaximumV340(best,second,4.5):best;
  return{delta:clamp(surface-zBase,-70,235),influence:bestInfluence,ratio:bestRatio};
};

const buildContextFieldsV346Base=buildContextFields;
buildContextFields=function(analysis,peaks,mode){
  const field=buildContextFieldsV346Base(analysis,peaks,mode);
  if(state.enhanceMix===0)field.final.set(field.truth);
  return field;
};
const buildRegionalFieldsV346Base=buildRegionalFields;
buildRegionalFields=function(analysis){
  const field=buildRegionalFieldsV346Base(analysis);
  if(state.enhanceMix===0)field.final.set(field.truth);
  return field;
};

const buildLocalFieldsV346Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV346Base(contextField,localCenter,mode,data,candidate,riverSections),count=field.n*field.n;
  field.contextFinalV346=new Float32Array(count);
  let boundaryMax=0,boundarySum=0,boundaryCount=0;
  for(let z=0;z<field.n;z++)for(let x=0;x<field.n;x++){
    const i=z*field.n+x,wx=field.worldX[x],wy=field.worldY[z];
    const contextHeight=sampleField(contextField,wx,wy,'final');field.contextFinalV346[i]=contextHeight;
    const edge=field.localEdge?.[i]??edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,.20);
    if(state.enhanceMix>0){
      const blend=edge*edge*(3-2*edge);
      field.final[i]=lerp(contextHeight,field.final[i],blend);
    }
    if(edge<.08){const difference=Math.abs(field.final[i]-contextHeight);boundaryMax=Math.max(boundaryMax,difference);boundarySum+=difference;boundaryCount++}
  }
  if(field.stats){
    field.stats.localBoundaryMaxAbs=boundaryMax;
    field.stats.localBoundaryMeanAbs=boundaryCount?boundarySum/boundaryCount:0;
    field.stats.localBoundarySamples=boundaryCount;
  }
  return field;
};

function continuousFieldColourV346(worldX,worldY,mask,layer){
  const broadScale=layer==='regional'?.00022:.00052,mediumScale=layer==='regional'?.00062:.00135;
  const broad=fbm(worldX*broadScale,worldY*broadScale,5209,4),medium=fbm(worldX*mediumScale+5.3,worldY*mediumScale-4.2,5227,4);
  const stage=clamp(.48+broad*.29+medium*.20,0,1);
  let colour=RICH_PALETTE_V330.fieldDark.clone().lerp(RICH_PALETTE_V330.fieldGreen,smoothstep(.08,.48,stage));
  colour.lerp(RICH_PALETTE_V330.fieldBright,smoothstep(.44,.78,stage)*.58);
  colour.lerp(RICH_PALETTE_V330.fieldGold,smoothstep(.76,.96,stage)*.35);
  const drainage=smoothstep(.76,.96,ridged(worldX*(mediumScale*.72),worldY*(mediumScale*.72),5251,3));
  colour.lerp(RICH_PALETTE_V330.channel,drainage*.10*mask);
  colour.lerp(RICH_PALETTE_V330.wet,clamp((.5-broad)*.14*mask,0,.12));
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.11);
  return colour;
}

fieldColourV330=function(worldX,worldY,mask,layer){
  if(layer!=='local')return continuousFieldColourV346(worldX,worldY,mask,layer);
  const grammar=parcelGrammarV330(worldX,worldY,601),seed=grammar.fieldSeed;
  let colour=seed<.22?RICH_PALETTE_V330.fieldDark.clone():seed<.56?RICH_PALETTE_V330.fieldGreen.clone():seed<.84?RICH_PALETTE_V330.fieldBright.clone():RICH_PALETTE_V330.fieldGold.clone();
  const broad=fbm(worldX*.0012,worldY*.0012,5279,4);
  colour.offsetHSL(broad*.003,broad*.004,broad*.004);
  colour.lerp(RICH_PALETTE_V330.bund,clamp(grammar.boundary*.50*mask,0,.50));
  colour.lerp(RICH_PALETTE_V330.channel,clamp(grammar.irrigation*.68*mask,0,.68));
  colour.lerp(RICH_PALETTE_V330.wet,clamp(grammar.wetness*.16*mask,0,.16));
  return colour;
};

const terrainColourV346Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV346Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(layer==='local'){
    const edge=field.localEdge?.[index]??1;
    if(edge<.999){
      const contextColour=terrainColourV346Base(field,index,heightNorm,worldX,worldY,'context',slopeDeg);
      colour.lerp(contextColour,1-edge*edge*(3-2*edge));
    }
  }
  return colour;
};

const createTerrainMeshV346Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const mesh=createTerrainMeshV346Base(field,origin,datum,layer,yOffset);
  if(layer==='context'&&state.pendingLocalCenter&&mesh.geometry?.getAttribute('position')){
    const n=field.n,maxIndices=(n-1)*(n-1)*6,indices=new Uint32Array(maxIndices),half=DETAIL_EXTENT*.405;
    let p=0;
    for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){
      const cx=(field.worldX[x]+field.worldX[x+1])*.5,cy=(field.worldY[z]+field.worldY[z+1])*.5;
      if(Math.abs(cx-state.pendingLocalCenter.x)<half&&Math.abs(cy-state.pendingLocalCenter.y)<half)continue;
      const a=z*n+x,b=a+1,c=a+n,d=c+1;
      if((x+z)&1){indices[p++]=a;indices[p++]=c;indices[p++]=d;indices[p++]=a;indices[p++]=d;indices[p++]=b}
      else{indices[p++]=a;indices[p++]=c;indices[p++]=b;indices[p++]=b;indices[p++]=c;indices[p++]=d}
    }
    mesh.geometry.setIndex(new THREE.BufferAttribute(indices.slice(0,p),1));mesh.geometry.computeBoundingSphere();
    mesh.userData.localContextOverlapMeters=DETAIL_EXTENT*.5-half;
  }
  if(layer==='local'){
    mesh.renderOrder=3;mesh.castShadow=state.preset.id==='cliff';
    if(mesh.material){mesh.material.polygonOffset=true;mesh.material.polygonOffsetFactor=-2.5;mesh.material.polygonOffsetUnits=-2.5;mesh.material.needsUpdate=true}
  }
  return mesh;
};

function localSurfaceFrameV346(build){
  const field=build.local,n=field.n,values=field.final;let maximum=-Infinity,maxIndex=0,edgeSum=0,edgeCount=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,v=values[i];if(v>maximum){maximum=v;maxIndex=i}
    if(x<8||z<8||x>=n-8||z>=n-8){edgeSum+=v;edgeCount++}
  }
  const base=edgeCount?edgeSum/edgeCount:values[Math.floor(values.length/2)],maxX=maxIndex%n,maxZ=Math.floor(maxIndex/n);
  return{base,maximum,height:Math.max(32,maximum-base),x:field.worldX[maxX]-build.origin.x,z:field.worldY[maxZ]-build.origin.y};
}

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){
    camera.fov=39;camera.position.set(3050,1390,4300);controls.target.set(0,225,-285);
  }else if(id==='paddy'){
    camera.fov=41;camera.position.set(offset.x+1320,targetHeight+790,offset.z+1620);controls.target.set(offset.x-60,targetHeight+14,offset.z-95);
  }else if(id==='river'){
    camera.fov=40;camera.position.set(offset.x+1240,targetHeight+560,offset.z+1650);controls.target.set(offset.x-100,targetHeight+12,offset.z-235);
  }else{
    const frame=localSurfaceFrameV346(build),baseY=frame.base-build.datum,distance=clamp(frame.height*3.0,620,980);
    camera.fov=42;camera.position.set(frame.x+distance*.68,baseY+frame.height*.50,frame.z+distance);controls.target.set(frame.x,baseY+frame.height*.54,frame.z);
  }
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV346Base=makeQA;
makeQA=function(build){
  const qa=makeQAV346Base(build),stats=build.local?.stats||{};
  qa.richTerrainPass='v3.4.6';
  qa.localContextBlend='height+semantic+colour-cubic-feather';
  qa.localContextOverlapMeters=Number((DETAIL_EXTENT*(.5-.405)).toFixed(3));
  qa.localBoundaryMaxAbsMeters=Number((stats.localBoundaryMaxAbs||0).toFixed(5));
  qa.localBoundaryMeanAbsMeters=Number((stats.localBoundaryMeanAbs||0).toFixed(5));
  qa.fieldColourLOD='continuous-regional-context+parcel-local';
  qa.cliffFocus='context-peak-centred-local-grid';
  qa.karstTowerProfile='small-summit+rounded-crown+near-vertical-wall';
  qa.truthRollbackExact=state.enhanceMix===0;
  qa.visualAcceptance=false;qa.productionReady=false;
  return qa;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.6';
const brandSmallV346=document.querySelector('.brand small');if(brandSmallV346)brandSmallV346.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.6';
