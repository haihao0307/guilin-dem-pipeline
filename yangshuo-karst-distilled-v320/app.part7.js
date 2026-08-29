/* v3.2.2 visual repair: tower profiles, continuous scale seams, riverbed and review cameras. */
state.tone=false;
$('toneToggle').classList.remove('active');
$('toneToggle').textContent='纯灰模';

function smoothMaxV322(a,b,k=12){
  if(!Number.isFinite(a))return b;
  const h=clamp(.5+.5*(a-b)/k,0,1);
  return lerp(b,a,h)+k*h*(1-h);
}

detectPeaks=function(analysis,maxPeaks=46){
  const {n,spacing,medium,coarse,worldX,worldY}=analysis,candidates=[];
  const step=Math.max(2,Math.round(62/spacing)),radius=Math.max(2,Math.round(100/spacing));
  for(let z=radius;z<n-radius;z+=step)for(let x=radius;x<n-radius;x+=step){
    const i=z*n+x,prominence=medium[i]-coarse[i];
    if(prominence<16)continue;
    const h=medium[i];let peak=true;
    for(const [dx,dz] of [[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){
      if(medium[(z+dz)*n+x+dx]>h){peak=false;break}
    }
    if(!peak)continue;
    const texture=ridged(worldX[x]*.0016,worldY[z]*.0016,19,3);
    const score=prominence*1.7+analysis.slope[i]*.35+texture*10;
    candidates.push({x:worldX[x],y:worldY[z],gridX:x,gridY:z,prominence,floor:coarse[i],score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const peaks=[];
  for(const candidate of candidates){
    const minimumDistance=clamp(155+candidate.prominence*.62,175,390);
    if(peaks.some(peak=>Math.hypot(peak.x-candidate.x,peak.y-candidate.y)<minimumDistance))continue;
    const rank=peaks.length,major=rank<18;
    const h=hash21(candidate.x*.01,candidate.y*.01,31),h2=hash21(candidate.x*.013,candidate.y*.013,47);
    const targetHeight=major
      ?clamp(candidate.prominence*1.45+96+h*92,140,315)
      :clamp(candidate.prominence*1.12+48+h*62,76,205);
    const ratio=1.28+h2*.88;
    const meanRadius=clamp(targetHeight/(ratio*2),38,148);
    const stretch=.72+hash21(candidate.x*.017,candidate.y*.017,73)*.66;
    candidate.targetHeight=targetHeight;
    candidate.ratio=ratio;
    candidate.radiusX=meanRadius*stretch;
    candidate.radiusY=meanRadius/stretch;
    candidate.angle=hash21(candidate.x*.021,candidate.y*.021,91)*Math.PI;
    candidate.wallPower=3.4+hash21(candidate.x*.027,candidate.y*.027,113)*3.8;
    candidate.crownPower=.38+hash21(candidate.x*.031,candidate.y*.031,127)*.30;
    candidate.seed=Math.floor(hash21(candidate.x,candidate.y,131)*100000);
    peaks.push(candidate);
    if(peaks.length>=maxPeaks)break;
  }
  return peaks;
};

peakEnvelopeAt=function(worldX,worldY,truth,fineResidual,peaks){
  let bestDelta=-Infinity,bestRatio=0,bestInfluence=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    if(Math.abs(qx)>1.42||Math.abs(qy)>1.42)continue;
    qx+=fbm(worldX*.0021,worldY*.0021,peak.seed,3)*.085;
    qy+=fbm(worldX*.0021+7.2,worldY*.0021-3.8,peak.seed+19,3)*.085;
    const radius=Math.hypot(qx,qy);
    if(radius>1.22)continue;
    const radial=clamp(radius/1.04,0,1);
    const wall=Math.pow(clamp(1-Math.pow(radial,peak.wallPower),0,1),.62);
    const crown=Math.pow(clamp(1-radial,0,1),peak.crownPower);
    let profile=wall*.70+crown*.30;
    const azimuth=Math.atan2(qy,qx);
    const asymmetry=1+valueNoise(worldX*.0048,worldY*.0048,peak.seed+7)*.055+Math.cos(azimuth*3+peak.angle)*.026*(1-radial);
    profile*=clamp(asymmetry,.86,1.13);
    const candidate=peak.floor+peak.targetHeight*profile+fineResidual*.12;
    const influence=1-smoothstep(.98,1.20,radius);
    const footRing=smoothstep(.74,.94,radius)*(1-smoothstep(.94,1.18,radius));
    const delta=(candidate-truth)*influence-peak.targetHeight*.075*footRing;
    if(delta>bestDelta){bestDelta=delta;bestRatio=peak.ratio;bestInfluence=influence}
  }
  if(!Number.isFinite(bestDelta))return{delta:0,influence:0,ratio:0};
  return{delta:bestDelta,influence:bestInfluence,ratio:bestRatio};
};

processMicro=function(worldX,worldY,gx,gy,karstMask,seed=0){
  if(karstMask<.001)return 0;
  const angle=Math.atan2(gy,gx),along=worldX*Math.cos(angle)+worldY*Math.sin(angle),across=-worldX*Math.sin(angle)+worldY*Math.cos(angle);
  const [warpX,warpY]=domainWarp(worldX*.0046,worldY*.0046,seed+3);
  const mass=(ridged(warpX*1.7,warpY*1.7,seed+17,4)-.58)*.72;
  const pitCell=worley(worldX*.024+fbm(worldX*.002,worldY*.002,seed+33)*.55,worldY*.024,seed+71);
  const pits=-smoothstep(.31,.075,pitCell.f1)*.52;
  const grooveWarp=fbm(worldX*.006,worldY*.006,seed+91,3)*.75;
  const grooveNoise=ridged(across*.034+grooveWarp,along*.0048,seed+103,4);
  const flow=-smoothstep(.72,.94,grooveNoise)*.82;
  const layering=valueNoise(along*.025,across*.0045,seed+121)*.24;
  const cellLarge=worley(worldX*.012,worldY*.012,seed+151);
  const cellMedium=worley(worldX*.027+fbm(worldX*.003,worldY*.003,seed+163)*.35,worldY*.027,seed+171);
  const cellSmall=worley(worldX*.055,worldY*.055,seed+191);
  const crackLarge=-smoothstep(.105,.018,cellLarge.f2-cellLarge.f1)*.58;
  const crackMedium=-smoothstep(.085,.014,cellMedium.f2-cellMedium.f1)*.38;
  const crackSmall=-smoothstep(.065,.010,cellSmall.f2-cellSmall.f1)*.16;
  return clamp((mass+pits+flow+layering+crackLarge+crackMedium+crackSmall)*karstMask,-2.1,1.25);
};

buildContextFields=function(analysis,peaks,mode){
  const {n,truth,small,worldX,worldY,gradX,gradY,valley,karst,paddy,extent}=analysis;
  const macro=new Float32Array(n*n),micro=new Float32Array(n*n),final=new Float32Array(n*n),tone=new Float32Array(n*n);
  let macroMin=Infinity,macroMax=-Infinity,microMin=Infinity,microMax=-Infinity,ratioMin=Infinity,ratioMax=-Infinity,valleyMacroAbs=0,valleyVertices=0;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,localX=(x/(n-1)-.5)*extent,localY=(z/(n-1)-.5)*extent;
    const edge=edgeFeather(localX,localY,extent,.12),fine=truth[i]-small[i];
    const envelope=peakEnvelopeAt(worldX[x],worldY[z],truth[i],fine,peaks);
    let macroDelta=valley[i]>.52?0:clamp(envelope.delta,-45,180)*(1-valley[i]*.995)*edge;
    if(mode==='paddy')macroDelta*=.82;
    const microDelta=processMicro(worldX[x],worldY[z],gradX[i],gradY[i],karst[i],317)*.16*edge;
    macro[i]=macroDelta;micro[i]=microDelta;
    final[i]=truth[i]+state.enhanceMix*(macroDelta*state.macro+microDelta*state.process);
    tone[i]=clamp(paddy[i]*.85+valley[i]*.18-karst[i]*.08,0,1);
    macroMin=Math.min(macroMin,macroDelta);macroMax=Math.max(macroMax,macroDelta);microMin=Math.min(microMin,microDelta);microMax=Math.max(microMax,microDelta);
    if(envelope.ratio>0){ratioMin=Math.min(ratioMin,envelope.ratio);ratioMax=Math.max(ratioMax,envelope.ratio)}
    if(valley[i]>.6){valleyMacroAbs+=Math.abs(macroDelta);valleyVertices++}
  }
  return{...analysis,peaks,macro,micro,final,tone,stats:{macroMin,macroMax,microMin,microMax,ratioMin:Number.isFinite(ratioMin)?ratioMin:0,ratioMax:Number.isFinite(ratioMax)?ratioMax:0,valleyMeanMacroAbs:valleyVertices?valleyMacroAbs/valleyVertices:0,valleyVertices}};
};

function stitchFieldToParentV322(child,parent,band=.12){
  const {n,extent,worldX,worldY}=child;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,lx=(x/(n-1)-.5)*extent,ly=(z/(n-1)-.5)*extent,blend=edgeFeather(lx,ly,extent,band);
    const parentHeight=sampleField(parent,worldX[x],worldY[z],'final');
    child.final[i]=lerp(parentHeight,child.final[i],blend);
    child.tone[i]=lerp(sampleField(parent,worldX[x],worldY[z],'tone'),child.tone[i],blend);
  }
  return child;
}

function makeRiverIndexV322(sections,cellSize=96){
  if(!sections?.length)return null;
  const cells=new Map();
  for(let i=0;i<sections.length;i++){
    const section=sections[i],cx=Math.floor(section.x/cellSize),cy=Math.floor(section.y/cellSize),key=`${cx},${cy}`;
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
  }
  return{sections,cells,cellSize};
}

function nearestRiverV322(index,x,y){
  if(!index)return null;
  const {sections,cells,cellSize}=index,cx=Math.floor(x/cellSize),cy=Math.floor(y/cellSize);
  let best=null,bestMetric=Infinity;
  for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){
    const ids=cells.get(`${cx+ox},${cy+oy}`);if(!ids)continue;
    for(const id of ids){
      const section=sections[id],dx=x-section.x,dy=y-section.y,distance=Math.abs(dx*section.nx+dy*section.ny),along=Math.abs(dx*section.tx+dy*section.ty);
      if(along>RIVER_SAMPLE_METERS*3.2)continue;
      const metric=distance+along*.18;
      if(metric<bestMetric){bestMetric=metric;best={section,index:id,distance,side:Math.sign(dx*section.nx+dy*section.ny)||1}}
    }
  }
  return best;
}

function carveRiverSampleV322(base,nearest,edge=1){
  if(!nearest)return{height:base,q:Infinity,clearance:0};
  const q=nearest.distance/(nearest.section.width*.5),inside=q<=1,bankBlend=inside?1:1-smoothstep(1,1.24,q);
  if(bankBlend<=0)return{height:base,q,clearance:0};
  const channel=clamp(1-q,0,1),clearance=.38+3.35*Math.pow(channel,1.34),target=nearest.section.water-clearance;
  const strength=state.enhanceMix*state.river*bankBlend*edge;
  return{height:lerp(base,Math.min(base,target),strength),q,clearance};
}

function applyRiverToFieldV322(field,sections){
  const index=makeRiverIndexV322(sections),{n,worldX,worldY,extent}=field;
  if(!index)return field;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,lx=(x/(n-1)-.5)*extent,ly=(z/(n-1)-.5)*extent,edge=edgeFeather(lx,ly,extent,.08);
    const nearest=nearestRiverV322(index,worldX[x],worldY[z]);
    field.final[i]=carveRiverSampleV322(field.final[i],nearest,edge).height;
  }
  return field;
}

buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const n=DETAIL_GRID,extent=DETAIL_EXTENT,spacing=DETAIL_SPACING,half=extent*.5;
  const truth=new Float32Array(n*n),final=new Float32Array(n*n),tone=new Float32Array(n*n),paddyMask=new Float32Array(n*n),macro=new Float32Array(n*n),micro=new Float32Array(n*n),worldX=new Float64Array(n),worldY=new Float64Array(n);
  for(let i=0;i<n;i++){worldX[i]=localCenter.x-half+i*spacing;worldY[i]=localCenter.y-half+i*spacing}
  const riverIndex=makeRiverIndexV322(riverSections);
  let paddyVertices=0,karstVertices=0,riverVertices=0,bundMax=0,minClear=Infinity,maxClear=0,sumClear=0,clearSamples=0,penetration=0,localMicroMin=Infinity,localMicroMax=-Infinity;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,wx=worldX[x],wy=worldY[z],t=sampleSource(data,candidate,wx,wy);
    const contextMacro=sampleField(contextField,wx,wy,'macro'),contextMicro=sampleField(contextField,wx,wy,'micro'),v=sampleField(contextField,wx,wy,'valley'),k=sampleField(contextField,wx,wy,'karst');
    const sourceStep=6.25,gx=(sampleSource(data,candidate,wx+sourceStep,wy)-sampleSource(data,candidate,wx-sourceStep,wy))/(sourceStep*2),gy=(sampleSource(data,candidate,wx,wy+sourceStep)-sampleSource(data,candidate,wx,wy-sourceStep))/(sourceStep*2);
    const slopeDeg=Math.atan(Math.hypot(gx,gy))*180/Math.PI,edge=edgeFeather(wx-localCenter.x,wy-localCenter.y,extent,.10);
    truth[i]=t;let base=sampleField(contextField,wx,wy,'final');macro[i]=contextMacro;
    const localMicro=processMicro(wx,wy,gx,gy,k,503)*.48*edge;micro[i]=contextMicro+localMicro;localMicroMin=Math.min(localMicroMin,localMicro);localMicroMax=Math.max(localMicroMax,localMicro);
    if(mode==='cliff'){base+=state.enhanceMix*localMicro*state.process;if(k>.25)karstVertices++}
    let paddy={delta:0,bund:0,channel:0,mask:0};
    if(mode==='paddy'){
      paddy=paddyDetail(wx,wy,t,base,v,slopeDeg,601);base+=state.enhanceMix*paddy.delta*state.bund*edge;paddyMask[i]=paddy.mask;
      if(paddy.mask>.35)paddyVertices++;bundMax=Math.max(bundMax,paddy.bund);
    }
    if(mode==='river'&&riverIndex){
      const nearest=nearestRiverV322(riverIndex,wx,wy),result=carveRiverSampleV322(base,nearest,edge);base=result.height;
      if(nearest&&result.q<=1){
        riverVertices++;const actualClear=nearest.section.water-base;minClear=Math.min(minClear,actualClear);maxClear=Math.max(maxClear,actualClear);sumClear+=actualClear;clearSamples++;penetration=Math.max(penetration,base-nearest.section.water);
      }
    }
    final[i]=base;tone[i]=clamp((mode==='paddy'?paddy.mask:v*.30)-k*.08,0,1);
  }
  return{truth,final,tone,paddyMask,macro,micro,n,extent,spacing,center:localCenter,worldX,worldY,stats:{paddyVertices,karstVertices,riverVertices,bundMax,minClear:Number.isFinite(minClear)?minClear:0,maxClear,meanClear:clearSamples?sumClear/clearSamples:0,clearSamples,penetration:Math.max(0,penetration),localMicroMin:Number.isFinite(localMicroMin)?localMicroMin:0,localMicroMax:Number.isFinite(localMicroMax)?localMicroMax:0}};
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;
  const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  camera.fov=id==='atlas'?35:id==='cliff'?39:37;camera.updateProjectionMatrix();
  if(id==='atlas'||view==='overview'){
    camera.position.set(4450,2250,5250);controls.target.set(0,285,0);
  }else if(id==='paddy'){
    camera.position.set(offset.x+1080,targetHeight+620,offset.z+1380);controls.target.set(offset.x,targetHeight+30,offset.z);
  }else if(id==='river'){
    camera.position.set(offset.x+1420,targetHeight+570,offset.z+1780);controls.target.set(offset.x,targetHeight+15,offset.z);
  }else{
    camera.position.set(offset.x+520,targetHeight+300,offset.z+670);controls.target.set(offset.x,targetHeight+105,offset.z);
  }
  controls.update();
};

buildPreset=async function(id,{keepView=false}={}){
  const token=++state.buildToken;state.preset=PRESETS[id]||PRESETS.atlas;updatePresetButtons();setBusy(true);showLoading('构建桂林多场协作地貌',`${state.preset.title}。`);progress(2,'准备');setStatus('正在构建多尺度地貌图谱',state.preset.title);ui.title.textContent=state.preset.title;
  try{
    await ensureSourceIndex();const projectedLines=await ensureRiverData();const {candidate,data}=await readCandidate(state.preset.candidate);if(token!==state.buildToken)return;
    progress(24,'选择真实校准窗口','依据真实 DEM 搜索峰林、谷地、峰壁与河谷焦点。');
    const atlasFocus=pickFocus(data,candidate,state.preset.focusMode==='river'?'atlas':state.preset.focusMode),paddyFocus=pickFocus(data,candidate,'paddy'),riverModel=selectRiverModel(candidate,data,projectedLines);
    let origin=atlasFocus;if(state.preset.focusMode==='river'&&riverModel)origin={x:riverModel.focus.x,y:riverModel.focus.y};
    progress(31,'区域层','生成 20.48 km 真实上下文，保留远景峰群与谷地层次。');
    const regionalAnalysis=analyzeGrid(sampleTruthGrid(data,candidate,origin,REGIONAL_EXTENT,REGIONAL_GRID)),regional=buildRegionalFields(regionalAnalysis);if(token!==state.buildToken)return;
    progress(45,'地貌层','识别塔峰、峰链、鞍部、谷地和短促峰脚。');
    const contextAnalysis=analyzeGrid(sampleTruthGrid(data,candidate,origin,CONTEXT_EXTENT,CONTEXT_GRID));
    const peaks=detectPeaks(contextAnalysis,isMobile?28:46);let context=buildContextFields(contextAnalysis,peaks,state.preset.id);context=stitchFieldToParentV322(context,regional,.14);
    let riverSections=null;
    if(state.preset.detailMode==='river'){
      riverSections=prepareRiverSections(riverModel,origin,CONTEXT_EXTENT*.94,data,candidate);context=applyRiverToFieldV322(context,riverSections);
    }
    if(token!==state.buildToken)return;
    let localCenter=chooseLocalCenter(state.preset,origin,paddyFocus,riverModel);localCenter=clampLocalCenter(localCenter,origin);
    const localRiverSections=riverSections?.filter(section=>Math.abs(section.x-localCenter.x)<=DETAIL_EXTENT*.72&&Math.abs(section.y-localCenter.y)<=DETAIL_EXTENT*.72)||null;
    progress(67,'局部层',`生成 ${DETAIL_EXTENT} m 局部 ${DETAIL_SPACING.toFixed(2)} m 网格，并进入批准父级掩膜。`);
    const local=buildLocalFields(context,localCenter,state.preset.detailMode,data,candidate,localRiverSections);if(token!==state.buildToken)return;
    progress(82,'编译三维网格','组合区域、地貌、局部和连续河面层。');
    disposeTerrain();const datum=Math.min(regional.min,context.min)-8;
    const regionalMesh=createTerrainMesh(regional,origin,datum,'regional',0),contextMesh=createTerrainMesh(context,origin,datum,'context',0),localMesh=createTerrainMesh(local,origin,datum,'local',0);
    terrainGroup.add(regionalMesh,contextMesh,localMesh);const water=createWaterMesh(riverSections,origin,datum);if(water)terrainGroup.add(water);applyWire();
    const localOffset={x:localCenter.x-origin.x,z:localCenter.y-origin.y},localTargetHeight=sampleSource(data,candidate,localCenter.x,localCenter.y)-datum;
    state.currentBuild={candidate,origin,datum,regional,context,local,riverSections,localRiverSections,localOffset,localTargetHeight};
    updateMetric('regionalGrid',`${REGIONAL_GRID} × ${REGIONAL_GRID}`);updateMetric('contextGrid',`${CONTEXT_GRID} × ${CONTEXT_GRID}`);updateMetric('detailGrid',`${DETAIL_GRID} × ${DETAIL_GRID}`);updateMetric('detailSpacing',`${DETAIL_SPACING.toFixed(2)} m`);updateMetric('peakCount',`${peaks.length} 座`);updateMetric('ratioRange',`${context.stats.ratioMin.toFixed(2)}–${context.stats.ratioMax.toFixed(2)}`);updateMetric('valleyProtection',`${(context.valleyFraction*100).toFixed(1)}%`);updateMetric('riverSections',riverSections?`${riverSections.length} × 11`:'当前镜头无主河');
    setCheck('lodCheck',true);setCheck('valleyCheck',context.stats.valleyMeanMacroAbs<=.12);if(state.preset.detailMode==='river')setCheck('riverCheck',local.stats.penetration<=.01&&local.stats.minClear>=.25);else $('riverCheck').className='dot';
    window.__terrainV320QA=makeQA(state.currentBuild);progress(100,'完成');setStatus('多场协作地貌已加载',`${candidate.name} · ${peaks.length} 座主塔峰 · 真值修改 0`);if(!keepView)configureCamera(state.preset.view,state.currentBuild);hideLoading();setBusy(false);
    const url=new URL(location.href);url.searchParams.set('preset',state.preset.id);history.replaceState(null,'',url);
  }catch(error){if(token===state.buildToken)showError(error)}
};
