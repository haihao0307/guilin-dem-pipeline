"""Patch only the approved R004 runtime; immutable dependencies remain intact."""
from pathlib import Path
import subprocess,sys
root=Path(__file__).parent;old=root.parent/'web-r004'
subprocess.run([sys.executable,str(old/'prepare.py')],check=True)
s=(old/'main.mjs').read_text();s="import {installSurfaceRegions} from './regions.mjs';\n"+s
s=s.replace("from './canonical.mjs'","from '../web-r004/canonical.mjs'")
def sub(a,b):
 global s
 assert a in s,'Patch anchor missing: '+a[:80];s=s.replace(a,b)
sub('function at(t,isRest=false){','let regionTool=null;\nfunction at(t,isRest=false){')
sub('updateWorld();surfaces=readSurface();updateOverlays();}','updateWorld();surfaces=readSurface();updateOverlays();regionTool?.update();}')
sub('function intersect(x){let out=[];surfaces.forEach(({p,idx})=>{for(let i=0;i<idx.length;i+=3){','function intersect(x){let out=[];surfaces.forEach(({p,idx},mi)=>{for(let i=0;i<idx.length;i+=3){if(regionTool&&!regionTool.acceptSectionFace(mi,i/3))continue;')
sub('manyLines.visible=state.allSections;updateOverlays();}','manyLines.visible=state.allSections;updateOverlays();regionTool?.apply();regionTool?.update();}')
sub('installPartExplorer({compiled,meshes,state,applyDisplay,qa,renderer,cam,readSurface,verify});','''installPartExplorer({compiled,meshes,state,applyDisplay,qa,renderer,cam,readSurface,verify});
regionTool=installSurfaceRegions({compiled,meshes,state,qa,applyDisplay,scenes,cam,controls,preset,originals,getSurfaces:()=>surfaces,refreshSections:()=>{if(state.allSections){at(0,true);let a=[];for(let i=0;i<200;i++)a.push(...intersect(-.5+(i+.5)/200));setLines(manyLines,a);qa.sectionSegments=a.length/6;}updateOverlays();}});
''')
s=s.replace('FISH_CANONICAL_R004','FISH_PARTS_R005').replace('R004</span>','R005</span>');(root/'main.mjs').write_text(s)
b=(old/'build.py').read_text().replace('FISH_CANONICAL_R004','FISH_PARTS_R005').replace(' R004',' R005');anchor='html=head+extra+';assert anchor in b
b=b.replace(anchor,"extra+='<script id=\"surfaceRegions\" type=\"application/json\">'+(out/'parts-r005/parts.json').read_text().replace('<','\\\\u003c')+'</script>'\n"+anchor)
(root/'build.py').write_text(b)
q=(old/'qa.mjs').read_text().replace('FISH_CANONICAL_R004','FISH_PARTS_R005')
anchor=' result.initial=initial;';assert anchor in q
q=q.replace(anchor,''' result.regions=await page.evaluate(()=>window.FISHQA.regions);assert(result.regions.parts===17,'source region inventory incorrect');
 result.regionChecks=[];
 for(const id of ['head','mouth_inner','trunk','dorsal_front','dorsal_rear','pectoral_l','pectoral_r','pelvic_l','pelvic_r','anal','finlets_d','finlets_v','tail','eye_l','eye_r','cornea_l','cornea_r']){
  await page.selectOption('#regionSelect',id);await page.locator('#regionIsolate').click();
  const check=await page.evaluate(()=>{const api=window.FISH_REGIONS,helper=api.helpers()[0],mi=helper.userData.sourceMesh,source=window.FISH.meshes[1][mi],p=api.data.parts.find(p=>p.id===api.selection.id),tmp=new helper.position.constructor();let max=0;for(const v of p.sourceVertices){helper.getVertexPosition(v,tmp);helper.localToWorld(tmp);const a=tmp.clone();source.getVertexPosition(v,tmp);source.localToWorld(tmp);max=Math.max(max,a.distanceTo(tmp));}return {part:p.id,triangles:helper.geometry.index.count/3,expected:p.sourceTriangles.length,maxError:max,isolated:window.FISHQA.regionIsolated};});
  assert(check.isolated&&check.triangles===check.expected&&check.maxError<1e-6,'isolated source geometry mismatch: '+JSON.stringify(check));result.regionChecks.push(check);
  if(['trunk','dorsal_front','dorsal_rear','head'].includes(id)){await page.locator('#regionFocus').click();await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r005-'+id+'.png')});}
  await page.locator('#regionClear').click();
 }
 await page.locator('#regionSeams').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(dir,'r005-seams.png')});result.seams=await page.evaluate(()=>({edges:window.FISHQA.regions.exactSourceSeamEdges,maxObserved:window.FISHQA.seamMaxObserved}));assert(result.seams.edges===216,'lost source seams');await page.locator('#regionSeams').click();
 await page.selectOption('#sectionScope','axial');await page.locator('[data-toggle="allSections"]').click();result.axialSections=await page.evaluate(()=>({stations:window.FISHQA.sectionStations,segments:window.FISHQA.sectionSegments}));assert(result.axialSections.stations===200&&result.axialSections.segments===8784,'body-section isolation mismatch');await page.screenshot({path:path.join(dir,'r005-axial-sections.png')});await page.locator('[data-toggle="allSections"]').click();await page.selectOption('#sectionScope','all');await page.locator('[data-toggle="sections"]').click();
 result.initial=initial;''')
anchor="await page.locator('#toolsBtn').click();"
q=q.replace(anchor,anchor+"await page.selectOption('#regionSelect','head');await page.locator('#regionIsolate').click();assert(await page.evaluate(()=>window.FISHQA.regionIsolated),'mobile isolation failed');await page.locator('#regionClear').click();")
(root/'qa.mjs').write_text(q)
print('R005_READY: original runtime and favicon retained, source patches/seams and axial sections added')
