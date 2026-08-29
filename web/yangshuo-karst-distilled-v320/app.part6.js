    targetContracts:{visiblePeakMinimum:18,valleyProtectionMinimum:.12,valleyMacroMaximum:.12,paddyMaskMinimum:state.preset.detailMode==='paddy'?500:0,riverVertexMinimum:state.preset.detailMode==='river'?250:0},
    visualAcceptance:false,productionReady:false
  };
}

async function buildPreset(id,{keepView=false}={}){
  const token=++state.buildToken;state.preset=PRESETS[id]||PRESETS.atlas;updatePresetButtons();setBusy(true);showLoading('构建桂林多场协作地貌',`${state.preset.title}。`);progress(2,'准备');setStatus('正在构建多尺度地貌图谱',state.preset.title);ui.title.textContent=state.preset.title;
  try{
    await ensureSourceIndex();const projectedLines=await ensureRiverData();const {candidate,data}=await readCandidate(state.preset.candidate);if(token!==state.buildToken)return;
    progress(24,'选择真实校准窗口','依据真实 DEM 搜索峰林、谷地、峰壁与河谷焦点。');const atlasFocus=pickFocus(data,candidate,state.preset.focusMode==='river'?'atlas':state.preset.focusMode),paddyFocus=pickFocus(data,candidate,'paddy'),riverModel=selectRiverModel(candidate,data,projectedLines);let origin=atlasFocus;if(state.preset.focusMode==='river'&&riverModel)origin={x:riverModel.focus.x,y:riverModel.focus.y};
    progress(31,'区域层','生成 20.48 km 真实上下文，保留远景峰群与谷地层次。');const regionalAnalysis=analyzeGrid(sampleTruthGrid(data,candidate,origin,REGIONAL_EXTENT,REGIONAL_GRID)),regional=buildRegionalFields(regionalAnalysis);if(token!==state.buildToken)return;
    progress(45,'地貌层','识别塔峰、峰链、鞍部、谷地和短促峰脚。');const contextAnalysis=analyzeGrid(sampleTruthGrid(data,candidate,origin,CONTEXT_EXTENT,CONTEXT_GRID)),peaks=detectPeaks(contextAnalysis,isMobile?34:62),context=buildContextFields(contextAnalysis,peaks,state.preset.id);if(token!==state.buildToken)return;
    let localCenter=chooseLocalCenter(state.preset,origin,paddyFocus,riverModel);localCenter=clampLocalCenter(localCenter,origin);const riverSections=state.preset.detailMode==='river'?prepareRiverSections(riverModel,localCenter,DETAIL_EXTENT,data,candidate):null;
    progress(67,'局部层',`生成 ${DETAIL_EXTENT} m 局部 ${DETAIL_SPACING.toFixed(2)} m 网格，并进入批准父级掩膜。`);const local=buildLocalFields(context,localCenter,state.preset.detailMode,data,candidate,riverSections);if(token!==state.buildToken)return;
    progress(82,'编译三维网格','组合区域、地貌、局部和水体层。');disposeTerrain();const datum=Math.min(regional.min,context.min)-8,regionalMesh=createTerrainMesh(regional,origin,datum,'regional',-.55),contextMesh=createTerrainMesh(context,origin,datum,'context',-.15),localMesh=createTerrainMesh(local,origin,datum,'local',.035);terrainGroup.add(regionalMesh,contextMesh,localMesh);const water=createWaterMesh(riverSections,origin,datum);if(water)terrainGroup.add(water);applyWire();
    const localOffset={x:localCenter.x-origin.x,z:localCenter.y-origin.y},localTargetHeight=sampleSource(data,candidate,localCenter.x,localCenter.y)-datum;state.currentBuild={candidate,origin,datum,regional,context,local,riverSections,localOffset,localTargetHeight};
    updateMetric('regionalGrid',`${REGIONAL_GRID} × ${REGIONAL_GRID}`);updateMetric('contextGrid',`${CONTEXT_GRID} × ${CONTEXT_GRID}`);updateMetric('detailGrid',`${DETAIL_GRID} × ${DETAIL_GRID}`);updateMetric('detailSpacing',`${DETAIL_SPACING.toFixed(2)} m`);updateMetric('peakCount',`${peaks.length} 座`);updateMetric('ratioRange',`${context.stats.ratioMin.toFixed(2)}–${context.stats.ratioMax.toFixed(2)}`);updateMetric('valleyProtection',`${(context.valleyFraction*100).toFixed(1)}%`);updateMetric('riverSections',riverSections?`${riverSections.length} × 11`:'当前镜头无主河');
    setCheck('lodCheck',true);setCheck('valleyCheck',context.stats.valleyMeanMacroAbs<=.12);if(state.preset.detailMode==='river')setCheck('riverCheck',local.stats.penetration<=.01&&local.stats.minClear>=.25);else $('riverCheck').className='dot';
    window.__terrainV320QA=makeQA(state.currentBuild);progress(100,'完成');setStatus('多场协作地貌已加载',`${candidate.name} · ${peaks.length} 座塔峰候选 · 真值修改 0`);if(!keepView)configureCamera(state.preset.view,state.currentBuild);hideLoading();setBusy(false);const url=new URL(location.href);url.searchParams.set('preset',state.preset.id);history.replaceState(null,'',url);
  }catch(error){if(token===state.buildToken)showError(error)}
}

function scheduleRebuild(){clearTimeout(state.rebuildTimer);state.rebuildTimer=setTimeout(()=>buildPreset(state.preset.id,{keepView:true}),180)}
function bindRange(id,key,out,digits=2){$(id).addEventListener('input',e=>{state[key]=Number(e.target.value);$(out).textContent=state[key].toFixed(digits)+'×';scheduleRebuild()})}

function bindUI(){
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>buildPreset(b.dataset.preset)));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));configureCamera(b.dataset.view)}));
  bindRange('macro','macro','macroValue');bindRange('process','process','processValue');bindRange('bund','bund','bundValue');bindRange('river','river','riverValue');
  $('truthToggle').addEventListener('click',()=>{state.enhanceMix=state.enhanceMix?0:1;$('truthToggle').classList.toggle('active',state.enhanceMix===0);$('truthToggle').textContent=state.enhanceMix===0?'恢复图谱':'只看真值';scheduleRebuild()});
  $('wireToggle').addEventListener('click',()=>{state.wire=!state.wire;$('wireToggle').classList.toggle('active',state.wire);applyWire()});
  $('toneToggle').addEventListener('click',()=>{state.tone=!state.tone;$('toneToggle').classList.toggle('active',state.tone);$('toneToggle').textContent=state.tone?'地貌分区':'纯灰模';scheduleRebuild()});
  ui.retry.addEventListener('click',()=>location.reload());addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
}

proj4.defs('EPSG:32649','+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs +type=crs');
await initRenderer();bindUI();const requested=params.get('preset');await buildPreset(PRESETS[requested]?requested:'atlas');
