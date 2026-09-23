"""Add the offline-verified oral study to the concurrent R008 feature baseline.
This merge preserves source, repaired boot, all prior tools and both regression suites.
"""
from pathlib import Path
import subprocess,sys
r=Path(__file__).parent;old=r.parent/'web-r008'
subprocess.run([sys.executable,str(old/'prepare_r008.py')],check=True)
s=(old/'main.mjs').read_text();s="import {installOralStudy} from './oral_merged.mjs';\n"+s
s=s.replace("from './features.mjs'","from '../web-r008/features.mjs'")
a='let regionTool=null,boundaryTool=null,headTool=null,featureTool=null;';assert a in s
s=s.replace(a,a[:-1]+',oralTool=null;').replace('featureTool?.update();','featureTool?.update();oralTool?.update();')
a='clearOther(){headTool.clear();';assert a in s;s=s.replace(a,'clearOther(){oralTool?.clear(false);headTool.clear();')
a='window.FISH_STRUCTURAL={';assert a in s
s=s.replace(a,"""let oralClock=null;
const oralModes=()=>actions.map(a=>({loop:a.loop,repetitions:a.repetitions,clamp:a.clampWhenFinished}));
const oralRestoreModes=modes=>actions.forEach((a,i)=>{a.setLoop(modes[i].loop,modes[i].repetitions);a.clampWhenFinished=modes[i].clamp;});
const oralSeek=(t,rest)=>{actions.forEach(a=>{a.reset();a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;});state.play=false;at(t,rest);};
oralTool=installOralStudy({compiled,meshes,state,qa,scenes,cam,controls,preset,regionTool,getSurfaces:()=>surfaces,readSurface,
 beginExact(){oralClock={time:state.time,rest:state.rest,play:state.play,modes:oralModes()};state.play=false;},
 seekExact:oralSeek,
 endExact(){actions.forEach(a=>a.reset());oralRestoreModes(oralClock.modes);at(oralClock.time,oralClock.rest);state.play=oralClock.play;oralClock=null;},
 jumpExact(t){const modes=oralModes();oralSeek(t,false);oralRestoreModes(modes);}
});
"""+a)
s=s.replace('FISH_FEATURES_R008','FISH_ORAL_MERGE_R009').replace('R008</span>','R009</span>');(r/'main.mjs').write_text(s)
ui=(r/'oral.mjs').read_text().replace('01E','01F').replace('R008</h2>','R009</h2>').replace('纵向高度排序','头部随动参考系高度排序')
ui=ui.replace('function show(){','function show(){window.FISH_FEATURES.hide();')
ui=ui.replace("['#headSelect','#regionSelect'","['#featureSelect','#headSelect','#regionSelect'")
(r/'oral_merged.mjs').write_text(ui)
b=(old/'build.py').read_text().replace('FISH_FEATURES_R008','FISH_ORAL_MERGE_R009').replace('R008','R009')
a="('featureEvidence','feature-r008/feature-evidence.json')";assert a in b
b=b.replace(a,a+",('oralEvidence','oral-r009/oral-evidence.json')");(r/'build.py').write_text(b)
(r/'boot.html').write_text((old/'boot.html').read_text().replace('FISH_FEATURES_R008','FISH_ORAL_MERGE_R009').replace('R008','R009'))
q=(old/'qa_regression.mjs').read_text().replace('FISH_FEATURES_R008','FISH_ORAL_MERGE_R009')
a=' result.initial=initial;';assert a in q
q=q.replace(a,""" result.oralStudy=await page.evaluate(()=>window.FISHQA.oralStudy);assert(result.oralStudy.rimEdges===24&&result.oralStudy.sourceHeadVertexIds===25,'source mouth identities lost');
 result.oralAudit=await page.evaluate(()=>window.FISH_ORAL.audit());console.log('ORAL_AUDIT',JSON.stringify(result.oralAudit));assert(result.oralAudit.passed&&result.oralAudit.clampedTimes===209&&result.oralAudit.comparedRuntimes===2,'source oral geometry parity failed');
 result.oralSamples=[];
 for(const which of ['min','max']){await page.locator(which==='min'?'#oralMin':'#oralMax').click();const row=await page.evaluate(()=>({chosen:window.FISHQA.oralSelectedSample,actual:window.FISHQA.oralCurrent.metrics,expected:window.FISH_ORAL.data.samples[window.FISHQA.oralSelectedSample.index].metrics}));assert(row.chosen.kind===which&&Math.abs(row.actual.headFrameVerticalExtent-row.expected.headFrameVerticalExtent)<1e-6,'source geometric peak is not selected sample');result.oralSamples.push(row);await page.waitForTimeout(180);await page.screenshot({path:path.join(dir,'r009-oral-'+which+'.png')});}
 await page.locator('#oralFront').click();await page.waitForTimeout(180);await page.screenshot({path:path.join(dir,'r009-oral-front.png')});
 const aliasIndex=await page.evaluate(()=>window.FISH_ORAL.data.rimVertices.findIndex(v=>v.headSourceAliases.length===2));assert(aliasIndex>=0,'duplicate source identity disappeared');await page.selectOption('#oralVertex',String(aliasIndex));result.oralTrace=await page.evaluate(()=>window.FISHQA.oralVertexTrace);assert(result.oralTrace.sourceAliases.length===2,'source aliases not shown');
 await page.locator('#oralEyes').click();await page.locator('#oralEyes').click();await page.evaluate(()=>window.FISH.setTime(.75));assert(await page.evaluate(()=>Math.abs(window.FISHQA.oralCurrent.time-.75)<1e-6),'oral metrics not following source animation');
 await page.selectOption('#featureSelect','eye_l_link');assert(await page.evaluate(()=>!window.FISHQA.oralEnabled&&window.FISH_FEATURES.selection.id==='eye_l_link'),'merged feature selection did not hide oral overlays');
 await page.locator('#oralShow').click();assert(await page.evaluate(()=>window.FISHQA.oralEnabled&&window.FISH_FEATURES.selection.id==='none'),'merged oral selection did not hide feature overlays');
 await page.locator('#oralClear').click();assert(await page.evaluate(()=>!window.FISHQA.oralEnabled),'oral overlays not cleared');result.additiveMergePass=true;
"""+a)
a="await page.locator('#toolsBtn').click();";assert a in q
q=q.replace(a,a+"await page.locator('#oralShow').click();assert(await page.evaluate(()=>window.FISHQA.oralEnabled&&window.FISHQA.oralCurrent.rimPoints===24),'mobile oral study failed');await page.locator('#oralClear').click();")
(r/'qa_regression.mjs').write_text(q)
(r/'qa_openfix.mjs').write_text((old/'qa_openfix.mjs').read_text().replace('FISH_FEATURES_R008','FISH_ORAL_MERGE_R009'))
print('R009_PREPARED: existing R008 features and verified oral increment preserved; every earlier gate retained')
