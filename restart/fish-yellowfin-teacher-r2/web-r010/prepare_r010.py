"""Add source-tail study to R009; preserve both merged head studies and all gates."""
from pathlib import Path
import subprocess,sys
r=Path(__file__).parent;old=r.parent/'web-r009'
subprocess.run([sys.executable,str(old/'prepare_r009.py')],check=True)
s=(old/'main.mjs').read_text();s="import {installTailStudy} from './tail.mjs';\n"+s
s=s.replace("from './oral_merged.mjs'","from '../web-r009/oral_merged.mjs'")
a='let regionTool=null,boundaryTool=null,headTool=null,featureTool=null,oralTool=null;';assert a in s
s=s.replace(a,a[:-1]+',tailTool=null;').replace('oralTool?.update();','oralTool?.update();tailTool?.update();')
a='window.FISH_STRUCTURAL={';assert a in s
s=s.replace(a,"""let tailClock=null;
tailTool=installTailStudy({compiled,meshes,state,qa,scenes,cam,controls,preset,regionTool,getSurfaces:()=>surfaces,readSurface,
 clearOther(){oralTool.clear(false);featureTool.hide();headTool.clear();boundaryTool.clear();regionTool.restore();},
 beginExact(){tailClock={time:state.time,rest:state.rest,play:state.play,modes:oralModes()};state.play=false;},
 seekExact:oralSeek,
 endExact(){actions.forEach(a=>a.reset());oralRestoreModes(tailClock.modes);at(tailClock.time,tailClock.rest);state.play=tailClock.play;tailClock=null;},
 jumpExact(t){const modes=oralModes();oralSeek(t,false);oralRestoreModes(modes);}
});
"""+a)
s=s.replace('FISH_ORAL_MERGE_R009','FISH_TAIL_R010').replace('R009</span>','R010</span>');(r/'main.mjs').write_text(s)
b=(old/'build.py').read_text().replace('FISH_ORAL_MERGE_R009','FISH_TAIL_R010').replace('R009','R010')
a="('oralEvidence','oral-r009/oral-evidence.json')";assert a in b;b=b.replace(a,a+",('tailEvidence','tail-r010/tail-evidence.json')");(r/'build.py').write_text(b)
(r/'boot.html').write_text((old/'boot.html').read_text().replace('FISH_ORAL_MERGE_R009','FISH_TAIL_R010').replace('R009','R010'))
q=(old/'qa_regression.mjs').read_text().replace('FISH_ORAL_MERGE_R009','FISH_TAIL_R010');a=' result.initial=initial;';assert a in q
q=q.replace(a,""" result.tailStudy=await page.evaluate(()=>window.FISHQA.tailStudy);assert(result.tailStudy.tailTriangles===750&&result.tailStudy.controls===12&&result.tailStudy.sourceTracks===36,'source tail fields missing');
 result.tailAudit=await page.evaluate(()=>window.FISH_TAIL.audit());console.log('TAIL_AUDIT',JSON.stringify(result.tailAudit));assert(result.tailAudit.passed&&result.tailAudit.clampedTimes===209&&result.tailAudit.restSamples===1&&result.tailAudit.comparedRuntimes===2,'tail source/teacher/candidate parity failed');
 result.tailSelections=[];for(const id of ['upper','lower','aft']){await page.selectOption('#tailSelect',id);assert(await page.evaluate(id=>window.FISHQA.tailCurrent.id===id,id),'tail selection failed');result.tailSelections.push(await page.evaluate(()=>window.FISHQA.tailCurrent.sourceVertex));}
 await page.selectOption('#tailSelect','upper');await page.locator('#tailFocus').click();await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r010-tail-full.png')});
 for(const kind of ['min','max']){await page.locator(kind==='min'?'#tailMin':'#tailMax').click();const row=await page.evaluate(()=>({selected:window.FISHQA.tailSelectedSample,current:window.FISHQA.tailCurrent,expected:window.FISH_TAIL.data.samples[window.FISHQA.tailSelectedSample.index]}));assert(row.selected.kind===kind&&Math.abs(row.current.metrics[row.selected.key]-row.expected.metrics[row.selected.key])<1e-6,'tail peak did not use exact original sample');}
 await page.locator('#tailTrail').click();await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r010-tail-trail.png')});
 await page.locator('#tailIsolate').click();assert(await page.evaluate(()=>window.FISHQA.regionRenderedTriangles===750&&window.FISHQA.tailCurrent.isolated),'tail source patch isolate failed');await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r010-tail-isolated.png')});
 await page.locator('#tailIsolate').click();assert(await page.evaluate(()=>window.FISH.meshes[1][0].visible&&!window.FISHQA.tailCurrent.isolated),'tail full surface not restored');
 await page.locator('#oralShow').click();assert(await page.evaluate(()=>!window.FISHQA.tailEnabled&&window.FISHQA.oralEnabled),'tail/oral controls compete');await page.locator('#oralClear').click();await page.selectOption('#tailSelect','lower');await page.selectOption('#featureSelect','eye_l_link');assert(await page.evaluate(()=>!window.FISHQA.tailEnabled&&window.FISH_FEATURES.selection.id==='eye_l_link'),'tail/feature controls compete');await page.locator('#featureClear').click();
 await page.selectOption('#tailSelect','upper');await page.evaluate(()=>window.FISH.setTime(.75));assert(await page.evaluate(()=>Math.abs(window.FISHQA.tailCurrent.time-.75)<1e-6),'tail did not follow source Swim');await page.locator('#tailClear').click();assert(await page.evaluate(()=>!window.FISHQA.tailEnabled&&window.FISH.meshes[1].every((m,i)=>m.material.opacity===window.FISH.meshes[0][i].material.opacity)),'tail clear changed original opacity');result.tailAdditivePass=true;
"""+a)
a="await page.locator('#toolsBtn').click();";assert a in q
q=q.replace(a,a+"await page.selectOption('#tailSelect','upper');await page.locator('#tailMax').click();assert(await page.evaluate(()=>window.FISHQA.tailEnabled&&window.FISHQA.tailCurrent.id==='upper'),'mobile tail controls failed');await page.locator('#tailClear').click();")
(r/'qa_regression.mjs').write_text(q);(r/'qa_openfix.mjs').write_text((old/'qa_openfix.mjs').read_text().replace('FISH_ORAL_MERGE_R009','FISH_TAIL_R010'))
# Reuse the previous single-publisher guard with an exact R009 predecessor.
d=(old/'delivery.py').read_text();d=d.replace("VERSION='FISH_ORAL_MERGE_R009'","VERSION='FISH_TAIL_R010'").replace("PREVIOUS='60e2c6d054f2a74a33aa8bd530e365c021b24927'","PREVIOUS='e52fd8cf1313f80d84197333a63931ce2f0d44da'").replace("'FISH_FEATURES_R008'","'FISH_ORAL_MERGE_R009'").replace("PUB/'r008'","PUB/'r009'").replace('?v=r009','?v=r010')
d=d.replace("['r009-oral-min','r009-oral-max','r009-oral-front']","['r010-tail-full','r010-tail-isolated','r010-tail-trail']").replace('ORAL_MERGE_INSPECTION.json','TAIL_INSPECTION.json')
d=d.replace("['allPoseChecks','headAudit','featureAudit','oralAudit']","['allPoseChecks','headAudit','featureAudit','oralAudit','tailAudit']")
d=d.replace("assert q['additiveMergePass'] and q['errors']==[]","assert q['additiveMergePass'] and q['tailAdditivePass'] and q['errors']==[]")
d=d.replace("'materialRestoration','additiveMergePass']","'materialRestoration','additiveMergePass','tailStudy','tailAudit','tailSelections','tailAdditivePass']")
d=d.replace("push('Fish R009 additive oral+surface-feature merge; preserve R008 and other Mothers')","push('Fish R010 source-tail study; preserve merged R009 and other Mothers')").replace("push('Fish R009 exact-public additive-merge and source oral verification receipt')","push('Fish R010 exact-public source-tail and inherited regression receipt')").replace('R009_PUBLIC_VERIFIED','R010_PUBLIC_VERIFIED').replace('Await exact public R009 verification','Await exact public R010 verification')
(r/'delivery.py').write_text(d)
print('R010_READY: source-tail module, 209 clamped source samples, all old work and single-publisher guard retained')
