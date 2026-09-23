"""Preserve R005 and append the next source-evidence task; no morphology change."""
from pathlib import Path
import subprocess,sys
r=Path(__file__).parent;old=r.parent/'web-r005'
subprocess.run([sys.executable,str(old/'prepare_r005.py')],check=True)
s=(old/'main.mjs').read_text();s="import {installBoundaryEvidence} from './boundary.mjs';\n"+s
s=s.replace("from './regions.mjs'","from '../web-r005/regions.mjs'")
assert 'let regionTool=null;' in s and 'window.FISH_STRUCTURAL={' in s
s=s.replace('let regionTool=null;','let regionTool=null,boundaryTool=null;')
s=s.replace('regionTool?.update();','regionTool?.update();boundaryTool?.update();')
s=s.replace('window.FISH_STRUCTURAL={',"boundaryTool=installBoundaryEvidence({state,qa,scenes,cam,controls,regionTool,compiled,getSurfaces:()=>surfaces,setRest:()=>document.querySelector('#rest').click(),setTime:t=>{state.play=false;at(t);},preset});\nwindow.FISH_STRUCTURAL={")
s=s.replace('FISH_PARTS_R005','FISH_BOUNDARY_R006').replace('R005</span>','R006</span>');(r/'main.mjs').write_text(s)
b=(old/'build.py').read_text().replace('FISH_PARTS_R005','FISH_BOUNDARY_R006').replace(' R005',' R006')
a='html=head+extra+';assert a in b
insertion="extra+='<script id=\"boundaryEvidence\" type=\"application/json\">'+(out/'boundary-r006/boundary-evidence.json').read_text().replace('<','\\\\u003c')+'</script>'\n"
b=b.replace(a,insertion+a);(r/'build.py').write_text(b)
q=(old/'qa.mjs').read_text().replace('FISH_PARTS_R005','FISH_BOUNDARY_R006')
a=' result.initial=initial;';assert a in q
q=q.replace(a,''' result.boundary=await page.evaluate(()=>window.FISHQA.boundary);assert(result.boundary.openEndpointEvents===502&&result.boundary.endpointReasonCounts.EXCLUDED_BY_AXIAL_SCOPE===502&&result.boundary.capsCreated===0,'open endpoint evidence changed');
 result.boundaryAudit=await page.evaluate(()=>window.FISH_BOUNDARY.audit());assert(result.boundaryAudit.samples===209&&result.boundaryAudit.sourceSeamEdges===216&&result.boundaryAudit.maxGap<1e-6&&result.boundaryAudit.maxRuntimeEndpointTraceError<1e-6,'boundary/endpoint source trace regression');
 result.interfaceChecks=[];for(let i=0;i<14;i++){await page.selectOption('#interfaceSelect',String(i));const v=await page.evaluate(()=>window.FISHQA.interfaceCheck);assert(v.pair===i&&v.edges>0&&v.maxGap<1e-6,'interface selection failed');result.interfaceChecks.push(v);}
 await page.selectOption('#interfaceSelect','8');await page.locator('#interfaceFocus').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(dir,'r006-head-trunk-interface.png')});await page.locator('#boundaryClear').click();
 result.stationChecks=[];for(const i of [1,14,49,108,166,199]){await page.locator('#diagnosticStation').fill(String(i));await page.locator('#diagnosticStation').dispatchEvent('input');const v=await page.evaluate(()=>window.FISHQA.boundaryStation);assert(v.station===i,'station UI not synchronized');result.stationChecks.push(v);}
 await page.locator('#diagnosticStation').fill('49');await page.locator('#diagnosticStation').dispatchEvent('input');await page.selectOption('#endpointSelect','0');assert(await page.evaluate(()=>window.FISHQA.endpointEvidence.excludedNeighbors[0].part==='dorsal_front'),'endpoint mapped to wrong original neighbor');
 await page.locator('[data-toggle="ghost"]').click();await page.waitForTimeout(300);await page.screenshot({path:path.join(dir,'r006-open-endpoint.png')});await page.locator('[data-toggle="ghost"]').click();
 await page.evaluate(()=>window.FISH.setTime(0.5));assert(await page.evaluate(()=>!window.FISHQA.diagnosticStaticOverlayVisible),'static section misleadingly shown during animation');await page.locator('#rest').click();assert(await page.evaluate(()=>window.FISHQA.diagnosticStaticOverlayVisible),'static diagnostic not restored');await page.locator('#nextOpen').click();await page.locator('#previousOpen').click();await page.locator('#boundaryClear').click();
 result.initial=initial;''')
a="await page.locator('#toolsBtn').click();";assert a in q
q=q.replace(a,a+"await page.selectOption('#interfaceSelect','7');assert(await page.evaluate(()=>window.FISHQA.interfaceCheck.edges===24),'mobile head-mouth interface failed');await page.locator('#boundaryClear').click();")
(r/'qa.mjs').write_text(q)
print('R006_PATCH_READY: R005 preserved; open source endpoint and interface trace tests appended')
