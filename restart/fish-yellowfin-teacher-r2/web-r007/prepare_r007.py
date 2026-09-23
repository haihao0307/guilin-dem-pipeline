"""Append source head study to the exact white-screen repair; do not regress boot ordering."""
from pathlib import Path
import subprocess,sys
r=Path(__file__).parent;old=r.parent/'openfix-r006-1'
subprocess.run([sys.executable,str(old/'build_openfix.py'),'prepare'],check=True)
s=(old/'main.mjs').read_text();s="import {installHeadStudy} from './head.mjs';\n"+s
assert 'let regionTool=null,boundaryTool=null;'in s
s=s.replace('let regionTool=null,boundaryTool=null;','let regionTool=null,boundaryTool=null,headTool=null;')
s=s.replace('boundaryTool?.update();','boundaryTool?.update();headTool?.update();')
# Captured browser pixels exposed an inherited display-state leak: ghost mode mutated
# the defaults later used by ghost-off. Snapshot the original flags once; never alter source.
a='const grey=meshes[1].map';assert a in s
s=s.replace(a,'const materialDefaults=Object.freeze(originals.map(m=>Object.freeze({transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite})));\n'+a)
for prop in ['transparent','opacity','depthWrite']:
 assert 'originals[i].'+prop in s;s=s.replace('originals[i].'+prop,'materialDefaults[i].'+prop)
a='window.FISH_STRUCTURAL={';assert a in s
s=s.replace(a,"""let headClock=null;
headTool=installHeadStudy({compiled,meshes,state,qa,scenes,cam,controls,regionTool,preset,getSurfaces:()=>surfaces,readSurface,
 beginExact(){headClock={time:state.time,rest:state.rest,play:state.play,modes:actions.map(a=>({loop:a.loop,repetitions:a.repetitions,clamp:a.clampWhenFinished}))};state.play=false;},
 seekExact(t,rest){actions.forEach(a=>{a.reset();a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;});at(t,rest);},
 endExact(){actions.forEach((a,i)=>{a.reset();a.setLoop(headClock.modes[i].loop,headClock.modes[i].repetitions);a.clampWhenFinished=headClock.modes[i].clamp;});at(headClock.time,headClock.rest);state.play=headClock.play;headClock=null;}
});
"""+a)
s=s.replace('FISH_OPEN_R006_1','FISH_HEAD_R007').replace('R006.1</span>','R007</span>');(r/'main.mjs').write_text(s)
b=(old/'build_openfix.py').read_text().replace('FISH_OPEN_R006_1','FISH_HEAD_R007').replace('R006.1','R007')
a="('boundaryEvidence','boundary-r006/boundary-evidence.json')";assert a in b
b=b.replace(a,a+",('headEvidence','head-r007/head-evidence.json')");(r/'build.py').write_text(b)
(r/'boot.html').write_text((old/'boot.html').read_text().replace('FISH_OPEN_R006_1','FISH_HEAD_R007').replace('R006.1','R007'))
q=(old/'qa_regression.mjs').read_text().replace('FISH_OPEN_R006_1','FISH_HEAD_R007')
a=' result.initial=initial;';assert a in q
q=q.replace(a,""" result.headStudy=await page.evaluate(()=>window.FISHQA.headStudy);assert(result.headStudy.headControls===7&&result.headStudy.surfaceProbes===4,'head evidence missing');
 result.headAudit=await page.evaluate(()=>window.FISH_HEAD.audit());console.log('HEAD_AUDIT',JSON.stringify(result.headAudit));assert(result.headAudit.passed&&result.headAudit.clampedNonLoopSamples===209&&result.headAudit.restSamples===1,'head source/clamped-endpoint parity failed');
 result.headSelections=[];for(let i=0;i<7;i++){await page.selectOption('#headSelect',String(i));const row=await page.evaluate(()=>window.FISHQA.headCurrent);assert(row&&row.sourceName&&row.localTRS.rotation.length===4,'head selection failed');result.headSelections.push(row.sourceName);}
 await page.selectOption('#headSelect','2');await page.locator('#headPeak').click();await page.locator('#headTrail').click();await page.waitForTimeout(180);await page.screenshot({path:path.join(dir,'r007-jaw-weight-and-trajectory.png')});
 await page.locator('#headMaterial').click();await page.waitForTimeout(180);await page.screenshot({path:path.join(dir,'r007-head-original-material.png')});
 result.materialRestoration=await page.evaluate(()=>({ghost:window.FISH.state.ghost,parts:window.FISH.meshes[1].map((m,i)=>({opacity:m.material.opacity,transparent:m.material.transparent,depthWrite:m.material.depthWrite,sourceOpacity:window.FISH.meshes[0][i].material.opacity,sourceTransparent:window.FISH.meshes[0][i].material.transparent,sourceDepthWrite:window.FISH.meshes[0][i].material.depthWrite}))}));assert(!result.materialRestoration.ghost&&result.materialRestoration.parts.every(p=>p.opacity===p.sourceOpacity&&p.transparent===p.sourceTransparent&&p.depthWrite===p.sourceDepthWrite),'ghost-off failed to restore original material state');
 await page.locator('[data-toggle="ghost"]').click();await page.locator('[data-toggle="ghost"]').click();assert(await page.evaluate(()=>window.FISH.meshes[1].every((m,i)=>m.material.opacity===window.FISH.meshes[0][i].material.opacity&&!window.FISH.state.ghost)),'repeat ghost cycle corrupted original material defaults');
 await page.selectOption('#headSelect','3');assert(await page.evaluate(()=>window.FISH_HEAD.data.controls[3].quaternionSignCrossings===2),'original eye quaternion sign events lost');await page.waitForTimeout(120);await page.screenshot({path:path.join(dir,'r007-eye-source-probes.png')});await page.locator('#headClear').click();
"""+a)
a="await page.locator('#toolsBtn').click();";assert a in q
q=q.replace(a,a+"await page.selectOption('#headSelect','2');assert(await page.evaluate(()=>window.FISHQA.headCurrent.sourceName==='LoweJaw_09'),'mobile head control failed');await page.locator('#headClear').click();")
(r/'qa_regression.mjs').write_text(q)
(r/'qa_openfix.mjs').write_text((old/'qa_openfix.mjs').read_text().replace('FISH_OPEN_R006_1','FISH_HEAD_R007'))
print('R007_READY: source head/eye evidence appended; visible-first 75 chunks and every previous regression retained; display material defaults immutable')
