from pathlib import Path
import hashlib
R=Path(__file__).resolve().parent.parent
s=(R/'catalogue/r06-worker.bundle.mjs').read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='0af2829c81645529df5e7aa1d3457c690f334867cfe1670e12b6b33a2da34406'
def p(old,new):
 global s
 assert s.count(old)==1,(s.count(old),old[:120])
 s=s.replace(old,new)
p('sdf: take(sdf2.a.length, 2) }','sdf: take(sdf2.a.length, 2), rhs:take(n*3),sol:take(n*3),res:take(n*3),dir:take(n*3),ap:take(n*3),z:take(n*4),diag:take(n) }')
p('this.packGroups();\n    this.wrapRebuild();','this.kernel.configureGlobal(p.rhs,p.sol,p.res,p.dir,p.ap,p.z,p.diag);\n    this.packGroups();\n    this.wrapRebuild();')
p('this.elapsed / 4','this.elapsed / .75')
p('this.bodyContacts += k.contacts.value;','const extraStart=performance.now();for(let extra=0;extra<3;extra++){k.strains();k.vertices(this.clearance);}P.extraProjectionMs=(P.extraProjectionMs||0)+performance.now()-extraStart;\n      this.bodyContacts += k.getContacts();')
p('backend: "original-f64-wasm-kernels", reducedIterations: false, reducedSubsteps: false, originalConstraintOrder: true','backend: "R07-f64-algebraic-XPBD-plus-local-global", reducedIterations: true, reducedSubsteps: false, originalConstraintOrder: false, initialSubsteps:12, initialDistanceIterations:1, additionalStrainContactPasses:3, shortenedSewingStages:true, coupledRefinementIterations:1600, referenceEquivalent:false')
start=s.index('    if (numericalStitchSpacingMm !== null && Math.abs(s.lengthAMm')
end=s.index('    counts.set(ka, count);',start)
s=s[:start]+'''    if (numericalStitchSpacingMm !== null && Math.abs(s.lengthAMm-s.lengthBMm)/Math.min(s.lengthAMm,s.lengthBMm)>0.15) {
      const intervals=Math.max(1,Math.ceil(Math.min(s.lengthAMm,s.lengthBMm)/numericalStitchSpacingMm));
      const subA=Math.max(s.lengthAMm>s.lengthBMm?3:1,Math.ceil(counts.get(ka)/intervals));
      const subB=Math.max(s.lengthBMm>s.lengthAMm?3:1,Math.ceil(counts.get(kb)/intervals));
      counts.set(ka,intervals*subA);counts.set(kb,intervals*subB);
      needleIntervals.set(s.id,{intervals,subdivisions:Math.max(subA,subB),subA,subB});continue;
    }
'''+s[end:]
p('if (a.ids.length !== b.ids.length) fail2(', 'if (!sparse && a.ids.length !== b.ids.length) fail2(')
p('stitchVertexPairs = samples.map((i) => [aa[i], bb[i]])','stitchVertexPairs = needle ? Array.from({length:needle.intervals+1},(_,i)=>[aa[i*needle.subA],bb[i*needle.subB]]) : samples.map((i) => [aa[i], bb[i]])')
p('return a.ids.map((id, i) => distance2(this.positions[this.offsets.get(a.panel.id) + id], this.positions[this.offsets.get(b.panel.id) + b.ids[i]]) * 1e3);','const pairs=this.spec.source?.experimentalSparseSewing?seam.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);return pairs.map(([id,other])=>distance2(this.positions[this.offsets.get(a.panel.id)+id],this.positions[this.offsets.get(b.panel.id)+other])*1e3);')
p('configureWasm(await bytes("unified/physics/kernel.wasm"))','configureWasm(await bytes("r07/global.wasm"))')
p('if(config.kind!=="legacy") prepareShoulderFixtures(spec,sdf);','if(config.kind==="legacy")throw Error("基础款须使用保留的 R06 原始计算线程");\n  prepareAssembly(spec,body);prepareShoulderFixtures(spec,sdf);')
p('lab = new GarmentLab2(spec, sdf, { substeps: 12, iterations: 6 });','lab = new GarmentLab2(spec, sdf, { substeps: 12, iterations: 1, sewingDuration:.75 });')
p('stages = [...spec.source.assemblyExperiment, "release"];\n  totalFrames = (stages.length - 1) * 360 + 480;','stages = [...spec.source.assemblyExperiment, "release", "refine"];\n  totalFrames = (stages.length - 2) * 90 + 120 + 1600;\n  refinementSteps=0;layerGuide=null;')
p('var pendingPause = false;', 'var pendingPause = false;\nvar refinementSteps=0,layerGuide=null;')
p('progress: lab.frameCount / totalFrames','progress: (lab.frameCount+refinementSteps) / totalFrames')
p('} else lab.activate(stages[stageIndex]);','} else if(stages[stageIndex]==="refine"){lab.kernel.prepare(1/720,lab.elapsed);layerGuide=createSeamLayerGuide(lab);for(const v of lab.velocity)v.fill(0);}\n        else {lab.activate(stages[stageIndex]);if(stages[stageIndex]==="sides")lab.releasePins();}')
p('      lab.step();','''      if(stages[stageIndex]==="refine"){
        lab.kernel.globalProject(lab.constraints.length,30,.002,100,50);lab.kernel.vertices(.0035);lab.kernel.surfaces();
        if(stageFrame>=400&&stageFrame<1400)layerGuide.project();
        refinementSteps++;
      }else lab.step();''')
p('const frames = stages[stageIndex] === "release" ? 480 : 360;','const frames = stages[stageIndex]==="refine"?1600:stages[stageIndex]==="release"?120:90;')
p('packet("stage", { completedStage: stages[stageIndex] });','const check=lab.metrics();if(!check.finite||check.maxPrincipalStrain>5)throw Error("当前参数出现严重变形，快速试算已中止，未生成合格成衣。请导出问题快照检查该工序。");\n        packet("stage", { completedStage: stages[stageIndex] });')
p('    const start = performance.now();\n    let n = 0;', '    const start = performance.now();\n    if(wallMs+start-runStarted>90000)throw Error("快速试算达到 90 秒计算预算，已中止；没有把未完成结果标为成衣。");\n    let n = 0;')
p('record.trial={version:"R06.2",style:config.recipe.design.style,sourceRecipeHash:spec.source.recipeHash,physicalFitAccepted:false,solver:"existing small-step XPBD / f64 WASM; full original-body SDF; sparse numerical stitching",runtimeSelfContact:false,continuousCollision:false,materialCalibrated:false,seamAllowanceAndThickness:false};','record.trial={version:"R07.0",style:config.recipe.design.style,sourceRecipeHash:spec.source.recipeHash,physicalFitAccepted:false,solver:"shortened XPBD sewing and gravity settling, then 1600 coupled geometric relaxation sweeps",referenceEquivalent:false,runtimeSelfContact:false,temporarySeamSideGuides:layerGuide?.count||0,guideFreeFinalSweeps:200,continuousCollision:false,materialCalibrated:false,seamAllowanceAndThickness:false,physicalFrameCount:lab.frameCount,refinementSteps};')
p('fullMaterialEdgeSampleCount: aa.length, intermediateMaterialVerticesPerInterval: needle.subdivisions - 1','fullMaterialEdgeSampleCount: aa.length, materialEdgeSampleCountA:aa.length,materialEdgeSampleCountB:bb.length, intermediateMaterialVerticesPerIntervalA:needle.subA-1,intermediateMaterialVerticesPerIntervalB:needle.subB-1')
s="import {prepareAssembly,createSeamLayerGuide} from '../r07/assembly.mjs';\n"+s
(R/'catalogue/r07-worker.bundle.mjs').write_text(s)
(R/'r07/node-module.mjs').write_text('globalThis.self={};\n'+s.replace("'../r07/assembly.mjs'","'./assembly.mjs'")+ '\nexport {GarmentLab2,BodySDF,configureWasm,compileAnalytic,prepareShoulderFixtures,regionalStrain,strictIntersectionAudit,prepareBodyAudit};\n')
# Same workbench application; old body, original paper programs and renderer unchanged.
s=(R/'catalogue/r06-workbench-app.mjs').read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='130230e9638850ab02fe89f25f7ed69223986b4f3194d8dc890d75b5bbd3339e'
s=s.replace('R06.2','R07.0').replace('r06-workbench-style.css','r07-workbench-style.css')
p("preferredView='paper';","preferredView='paper',solverMode='fast',workerMode=null;")
p("STAGE_LABELS} from '../unified/cases.mjs';","STAGE_LABELS as BASE_STAGE_LABELS} from '../unified/cases.mjs';\nconst STAGE_LABELS={...BASE_STAGE_LABELS,refine:'接缝与原材料联合整理'};")
p('<small id="view-origin"></small>','<small id="view-origin"></small><small id="composition"></small>')
p('<p id="flow-note">','<div class="solver-switch"><label>计算方式 <select id="solver-mode"><option value="fast">R07 快速试算</option><option value="reference">R06 原参数完整计算（较慢）</option></select></label><small>原纸样与人体不缩放；新旧算法不是逐帧等价。</small></div><p id="flow-note">')
p('<button id="save-recipe">保存配方</button>','<button id="save-recipe">保存配方</button><button id="save-problem">导出问题快照</button>')
p("function bootWorker(){if(worker)return;worker=new Worker(new URL('r06-worker.bundle.mjs',import.meta.url),{type:'module'});", "function bootWorker(){const wanted=current?.kind==='legacy'||solverMode==='reference'?'reference':'fast';if(worker&&workerMode!==wanted)stopWorker();if(worker)return;workerMode=wanted;worker=new Worker(new URL(wanted==='fast'?'r07-worker.bundle.mjs':'r06-worker.bundle.mjs',import.meta.url),{type:'module'});")
p("$('sew').textContent=trial?'③ 一键缝合试穿（试验）':'③ 一键缝合试穿';", "$('sew').textContent=trial&&solverMode==='fast'?'③ 快速缝合试算':'③ 原参数完整计算';$('solver-mode').disabled=busy||state.phase==='paused'||!trial;")
p("function controls(){if(!current)return;", "function controls(){if(!current)return;composition();")
p("function generate(andSew=false)", "function composition(){if(!current)return;const names=current.kind==='analytic'?['upper','wb','bottom'].map(k=>{const v=valueAt(design,'meta.'+k);return v?STYLE_NAMES[v]||v:'无';}):[];$('composition').textContent=names.length?'当前组合：'+names.join(' / '):'保留原基础款';$('current-title').textContent=current.title+(current.family==='composition'&&valueAt(design,'meta.upper')===null?'（当前未选上装）':'');}\nfunction generate(andSew=false)")
p("$('generate').onclick=", "$('solver-mode').onchange=e=>{solverMode=e.target.value;invalidate();stopWorker();status('计算方式已切换；当前参数不变，点击计算重新生成本轮材料');updateButtons();};$('save-problem').onclick=()=>download('kaopu-R07-problem.json',{schema:'kaopu-tailor-reproduction@1',version:'R07.0',caseId:current?.id,solverMode,bodyId:'anny-adult-neutral-r01',bodyCm,design,legacyControls,state:window.__TAILOR_CATALOGUE_QA__.getState(),analytic:state.analytic,spec:state.spec,record:state.record});$('generate').onclick=")
p("getState:()=>({version:'R07.0',", "getState:()=>({version:'R07.0',solverMode,workerMode,")
p("getDesign:()=>structuredClone(design),", "getDesign:()=>structuredClone(design),setMode:mode=>{if(!['fast','reference'].includes(mode))throw Error('unknown mode');$('solver-mode').value=mode;$('solver-mode').dispatchEvent(new Event('change'));},")
p("原 f64 求解核；子步和迭代保留 · 材料更新", "${workerMode==='fast'?'R07 缩短工序 + 联合整理':'R06 原子步与迭代'} · 材料更新")
p("const failed=i.bodyIntersectingFaceCount>0||i.selfStrictTriangleIntersectionCount>0||d.regions.all.maximumPercent>15;", "const failed=i.bodyIntersectingFaceCount>0||i.selfStrictTriangleIntersectionCount>0||d.regions.all.maximumPercent>15||d.record.metrics.activeMaxGapMm>2;")
p("本轮实际计算 ${format(d.activeWallMs/1000,1)} 秒；结果来自本轮材料", "本轮实际计算 ${format(d.activeWallMs/1000,1)} 秒 · 最大针位缝距 ${format(d.record.metrics.activeMaxGapMm,2)} mm · ${workerMode==='fast'?'快速试算，非原算法逐帧等价':'R06 原参数'}")
p("布料交叉 ${i.selfStrictTriangleIntersectionCount}，最大原材料应变", "布料交叉 ${i.selfStrictTriangleIntersectionCount}，针位缝距 ${format(d.record.metrics.activeMaxGapMm,2)} mm，最大原材料应变")
(R/'catalogue/r07-workbench-app.mjs').write_text('// R07 additive fast trial and original reference switch.\n'+s)
(R/'catalogue/r07-workbench-style.css').write_text("@import url('./r06-workbench-style.css');\n.solver-switch{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:6px}.solver-switch label{display:flex;gap:8px;align-items:center}.solver-switch small,#composition{font-size:12px!important;color:var(--wb-muted)}.solver-switch select{min-height:36px!important;padding:5px}.catalogue-toolbar>div:first-child{min-width:0}#composition{display:block}#save-problem{border-color:var(--wb-accent)}@media(max-width:959px){.solver-switch{margin-top:4px}.solver-switch small{display:none}.solver-switch select{font-size:12px!important;min-height:32px!important}.solver-switch label{font-size:12px!important}#composition{font-size:11px!important;max-height:30px;overflow:auto}}\n")
(R/'r07/index.html').write_text('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="../"><title>裁缝工作台 R07 · 快速缝合试算</title><link rel="stylesheet" href="catalogue/r07-workbench-style.css"><script type="importmap">{"imports":{"three":"./garments-r04/vendor/three.module.js"}}</script></head><body data-wb-ui="tailor"><p>正在打开 R07…</p><script type="module" src="catalogue/r07-workbench-app.mjs"></script></body></html>')
print('Built additive R07 worker, UI and reproducible Node adapter. Original files unchanged.')
