"""Append paired pectoral source study to tested R010; retain every previous gate."""
from pathlib import Path
import subprocess,sys
r=Path(__file__).parent;old=r.parent/'web-r010'
subprocess.run([sys.executable,str(old/'prepare_r010.py')],check=True)
s=(old/'main.mjs').read_text();s="import {installPectoralStudy} from './pectoral.mjs';\n"+s
s=s.replace("from './tail.mjs'","from '../web-r010/tail.mjs'")
a='let regionTool=null,boundaryTool=null,headTool=null,featureTool=null,oralTool=null,tailTool=null;';assert a in s
s=s.replace(a,a[:-1]+',pectoralTool=null;').replace('tailTool?.update();','tailTool?.update();pectoralTool?.update();')
a='window.FISH_STRUCTURAL={';assert a in s
s=s.replace(a,"""let pectoralClock=null;
pectoralTool=installPectoralStudy({compiled,meshes,state,qa,scenes,cam,controls,preset,regionTool,getSurfaces:()=>surfaces,readSurface,
 clearOther(){tailTool.hide();oralTool.clear(false);featureTool.hide();headTool.clear();boundaryTool.clear();regionTool.restore();},
 beginExact(){pectoralClock={time:state.time,rest:state.rest,play:state.play,modes:oralModes()};state.play=false;},
 seekExact:oralSeek,
 endExact(){actions.forEach(a=>a.reset());oralRestoreModes(pectoralClock.modes);at(pectoralClock.time,pectoralClock.rest);state.play=pectoralClock.play;pectoralClock=null;},
 jumpExact(t){const modes=oralModes();oralSeek(t,false);oralRestoreModes(modes);}
});
"""+a)
s=s.replace('FISH_TAIL_R010','FISH_PECTORAL_R011').replace('R010</span>','R011</span>');(r/'main.mjs').write_text(s)
b=(old/'build.py').read_text().replace('FISH_TAIL_R010','FISH_PECTORAL_R011').replace('R010','R011')
a="('tailEvidence','tail-r010/tail-evidence.json')";assert a in b;b=b.replace(a,a+",('pectoralEvidence','pectoral-r011/pectoral-evidence.json')");(r/'build.py').write_text(b)
(r/'boot.html').write_text((old/'boot.html').read_text().replace('FISH_TAIL_R010','FISH_PECTORAL_R011').replace('R010','R011'))
q=(old/'qa_regression.mjs').read_text().replace('FISH_TAIL_R010','FISH_PECTORAL_R011');a=' result.initial=initial;';assert a in q
q=q.replace(a,""" result.pectoralStudy=await page.evaluate(()=>window.FISHQA.pectoralStudy);assert(result.pectoralStudy.sourceFinVertexIndices.join(',')==='134,136'&&result.pectoralStudy.controls===12&&result.pectoralStudy.sourceTracks===36&&!result.pectoralStudy.mirroredFinCreated,'original paired fins not preserved');
 result.pectoralAudit=await page.evaluate(()=>window.FISH_PECTORAL.audit());console.log('PECTORAL_AUDIT',JSON.stringify(result.pectoralAudit));assert(result.pectoralAudit.passed&&result.pectoralAudit.clampedTimes===209&&result.pectoralAudit.comparedRuntimes===2,'paired fin source/teacher/candidate parity failed');
 await page.selectOption('#pectoralSelect','both');await page.locator('#pectoralFocus').click();assert(await page.evaluate(()=>window.FISHQA.pectoralCurrent.fins.length===2),'paired fin selection failed');await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r011-pectoral-both.png')});
 result.pectoralSelections=[];
 for(const side of ['pectoral_l','pectoral_r']){await page.selectOption('#pectoralSelect',side);for(const kind of ['min','max']){await page.locator(kind==='min'?'#pectoralMin':'#pectoralMax').click();const row=await page.evaluate(()=>({selected:window.FISHQA.pectoralSelectedSample,current:window.FISHQA.pectoralCurrent.fins[0],sample:window.FISH_PECTORAL.data.samples[window.FISHQA.pectoralSelectedSample.index].fins.find(f=>f.id===window.FISHQA.pectoralCurrent.id)}));assert(row.selected.id===side&&row.selected.kind===kind&&Math.abs(row.current.metrics[row.selected.key]-row.sample.metrics[row.selected.key])<1e-6,'fin source sample not selected');}
 await page.locator('#pectoralIsolate').click();assert(await page.evaluate(side=>window.FISHQA.pectoralCurrent.isolated&&window.FISHQA.regionRenderedTriangles===219&&window.FISHQA.regionSelected===side,side),'fin isolate replaced original source patch');await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r011-'+side+'-isolated.png')});result.pectoralSelections.push(await page.evaluate(()=>window.FISHQA.pectoralCurrent));await page.locator('#pectoralIsolate').click();}
 await page.selectOption('#pectoralSelect','both');await page.locator('#pectoralTrail').click();await page.evaluate(()=>window.FISH.setTime(.75));assert(await page.evaluate(()=>Math.abs(window.FISHQA.pectoralCurrent.time-.75)<1e-6),'fin measures not following original Swim');await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r011-pectoral-trails.png')});
 await page.selectOption('#pectoralSelect','pectoral_r');await page.locator('#pectoralIsolate').click();await page.selectOption('#tailSelect','upper');assert(await page.evaluate(()=>!window.FISHQA.pectoralEnabled&&window.FISHQA.tailEnabled&&window.FISH.meshes[1][0].visible),'fin/tail switch lost whole surface');await page.locator('#tailClear').click();
 await page.selectOption('#pectoralSelect','both');await page.locator('#oralShow').click();assert(await page.evaluate(()=>!window.FISHQA.pectoralEnabled&&window.FISHQA.oralEnabled),'fin/oral overlays conflict');await page.selectOption('#pectoralSelect','both');assert(await page.evaluate(()=>window.FISHQA.pectoralEnabled&&!window.FISHQA.oralEnabled&&!window.FISHQA.tailEnabled),'incoming pectoral display did not clear old overlays');
 await page.selectOption('#featureSelect','eye_l_link');assert(await page.evaluate(()=>!window.FISHQA.pectoralEnabled&&window.FISH_FEATURES.selection.id==='eye_l_link'),'fin/eye overlays conflict');await page.locator('#featureClear').click();await page.selectOption('#pectoralSelect','both');await page.locator('#pectoralClear').click();assert(await page.evaluate(()=>!window.FISHQA.pectoralEnabled&&window.FISH.meshes[1].every((m,i)=>m.material.opacity===window.FISH.meshes[0][i].material.opacity)),'fin restore changed original material');result.pectoralAdditivePass=true;
"""+a)
a="await page.locator('#toolsBtn').click();";assert a in q
q=q.replace(a,a+"await page.selectOption('#pectoralSelect','pectoral_r');await page.locator('#pectoralMax').click();assert(await page.evaluate(()=>window.FISHQA.pectoralEnabled&&window.FISHQA.pectoralCurrent.id==='pectoral_r'),'mobile pectoral controls failed');await page.locator('#pectoralClear').click();")
(r/'qa_regression.mjs').write_text(q);(r/'qa_openfix.mjs').write_text((old/'qa_openfix.mjs').read_text().replace('FISH_TAIL_R010','FISH_PECTORAL_R011'))
d=(old/'delivery.py').read_text().replace("VERSION='FISH_TAIL_R010'","VERSION='FISH_PECTORAL_R011'").replace("PREVIOUS='e52fd8cf1313f80d84197333a63931ce2f0d44da'","PREVIOUS='b8f772de881fa0342d2dd0c243e98617211a63ac'").replace("'FISH_ORAL_MERGE_R009'","'FISH_TAIL_R010'").replace("PUB/'r009'","PUB/'r010'").replace('?v=r010','?v=r011')
d=d.replace("['r010-tail-full','r010-tail-isolated','r010-tail-trail']","['r011-pectoral-both','r011-pectoral_l-isolated','r011-pectoral_r-isolated','r011-pectoral-trails']").replace('TAIL_INSPECTION.json','PECTORAL_INSPECTION.json')
d=d.replace("'oralAudit','tailAudit']","'oralAudit','tailAudit','pectoralAudit']").replace("assert q['additiveMergePass'] and q['tailAdditivePass'] and q['errors']==[]","assert q['additiveMergePass'] and q['tailAdditivePass'] and q['pectoralAdditivePass'] and q['errors']==[]")
d=d.replace("'tailSelections','tailAdditivePass']","'tailSelections','tailAdditivePass','pectoralStudy','pectoralAudit','pectoralSelections','pectoralAdditivePass']")
d=d.replace('Fish R010 source-tail study; preserve merged R009','Fish R011 source-pectoral study; preserve R010').replace('Fish R010 exact-public source-tail and inherited regression receipt','Fish R011 exact-public paired-fin and inherited regression receipt').replace('R010_PUBLIC_VERIFIED','R011_PUBLIC_VERIFIED').replace('Await exact public R010 verification','Await exact public R011 verification')
(r/'delivery.py').write_text(d)
print('R011_READY: both original pectorals, complete curves and source aliases; no gate removed')
