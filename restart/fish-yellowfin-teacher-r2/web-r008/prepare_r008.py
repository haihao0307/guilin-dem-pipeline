"""Append source-surface features, preserving repaired boot and immutable material defaults."""
from pathlib import Path
import subprocess,sys
r=Path(__file__).parent;old=r.parent/'web-r007'
subprocess.run([sys.executable,str(old/'prepare_r007.py')],check=True)
s=(old/'main.mjs').read_text();s="import {installFeatureStudy} from './features.mjs';\n"+s
s=s.replace("from './head.mjs'","from '../web-r007/head.mjs'")
a='let regionTool=null,boundaryTool=null,headTool=null;';assert a in s;s=s.replace(a,a[:-1]+',featureTool=null;')
s=s.replace('headTool?.update();','headTool?.update();featureTool?.update();')
a='window.FISH_STRUCTURAL={';assert a in s
s=s.replace(a,"""let featureClock=null;
featureTool=installFeatureStudy({state,qa,scenes,cam,controls,getSurfaces:()=>surfaces,readSurface,preset,
 clearOther(){headTool.clear();boundaryTool.clear();regionTool.restore();},
 beginExact(){featureClock={time:state.time,rest:state.rest,play:state.play,modes:actions.map(a=>({loop:a.loop,repetitions:a.repetitions,clamp:a.clampWhenFinished}))};state.play=false;},
 seekExact(t,rest){actions.forEach(a=>{a.reset();a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;});at(t,rest);},
 endExact(){actions.forEach((a,i)=>{a.reset();a.setLoop(featureClock.modes[i].loop,featureClock.modes[i].repetitions);a.clampWhenFinished=featureClock.modes[i].clamp;});at(featureClock.time,featureClock.rest);state.play=featureClock.play;featureClock=null;}
});
"""+a)
s=s.replace('FISH_HEAD_R007','FISH_FEATURES_R008').replace('R007</span>','R008</span>');(r/'main.mjs').write_text(s)
b=(old/'build.py').read_text().replace('FISH_HEAD_R007','FISH_FEATURES_R008').replace('R007','R008')
a="('headEvidence','head-r007/head-evidence.json')";assert a in b;b=b.replace(a,a+",('featureEvidence','feature-r008/feature-evidence.json')");(r/'build.py').write_text(b)
(r/'boot.html').write_text((old/'boot.html').read_text().replace('FISH_HEAD_R007','FISH_FEATURES_R008').replace('R007','R008'))
q=(old/'qa_regression.mjs').read_text().replace('FISH_HEAD_R007','FISH_FEATURES_R008');a=' result.initial=initial;';assert a in q
q=q.replace(a,""" result.featureStudy=await page.evaluate(()=>window.FISHQA.featureStudy);assert(result.featureStudy.anchors===6&&result.featureStudy.measurements===3,'source features missing');
 result.featureAudit=await page.evaluate(()=>window.FISH_FEATURES.audit());console.log('FEATURE_AUDIT',JSON.stringify(result.featureAudit));assert(result.featureAudit.passed&&result.featureAudit.clampedNonLoopSamples===209,'source-surface feature audit failed');
 result.featureSelections=[];for(const id of ['mouth_span','eye_l_link','eye_r_link']){await page.selectOption('#featureSelect',id);assert(await page.evaluate(id=>window.FISHQA.featureCurrent.id===id,id),'feature selection failed');await page.locator('#featureMin').click();const lo=await page.evaluate(()=>({...window.FISHQA.featureCurrent,peak:window.FISHQA.featurePeak}));await page.locator('#featureMax').click();const hi=await page.evaluate(()=>({...window.FISHQA.featureCurrent,peak:window.FISHQA.featurePeak}));assert(lo.distances[id]<=hi.distances[id]+1e-6,'source extrema reversed');result.featureSelections.push({id,min:lo.distances[id],max:hi.distances[id]});await page.locator('#featureTrail').click();await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r008-'+id+'.png')});await page.locator('#featureTrail').click();await page.locator('#featureClear').click();}
 assert(await page.evaluate(()=>window.FISH_FEATURES.selection.id==='none'&&window.FISH.meshes[1].every((m,i)=>m.material.opacity===window.FISH.meshes[0][i].material.opacity)),'feature clear did not restore original material');
"""+a)
a="await page.locator('#toolsBtn').click();";assert a in q;q=q.replace(a,a+"await page.selectOption('#featureSelect','mouth_span');await page.locator('#featureMax').click();assert(await page.evaluate(()=>window.FISHQA.featureCurrent.id==='mouth_span'),'mobile feature controls failed');await page.locator('#featureClear').click();")
(r/'qa_regression.mjs').write_text(q);(r/'qa_openfix.mjs').write_text((old/'qa_openfix.mjs').read_text().replace('FISH_HEAD_R007','FISH_FEATURES_R008'))
print('R008_READY: surface correspondence appended, original boot/display and regressions retained')
