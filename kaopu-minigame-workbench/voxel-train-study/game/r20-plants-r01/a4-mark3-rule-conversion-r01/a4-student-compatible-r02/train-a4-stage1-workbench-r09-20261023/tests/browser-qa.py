"""Existing read-only train workflow runner; serves only candidate directory, never source bytes."""
import asyncio,json,pathlib,time,mimetypes,hashlib,os
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parent
# In the existing workflow this file is placed at the old QA entry point.
CANDIDATE=ROOT/'train-a4-stage1-workbench-r09-20261023'
if not CANDIDATE.exists(): CANDIDATE=ROOT.parent
OUT=ROOT/'evidence';OUT.mkdir(exist_ok=True)
ENTRY='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/train-a4-stage1-workbench-r09-20261023/'
LIVE=(CANDIDATE/'PUBLIC_VERIFY.json').exists()
async def main():
 report={'engine':'Chromium SwiftShader, not the user device','public_without_overrides':LIVE,'candidate_source_hash':hashlib.sha256((CANDIDATE/'workbench.mjs').read_bytes()).hexdigest(),'checks':[],'passed':False}
 def checked(label,value=True):
  assert value,label
  report['checks'].append({'name':label,'passed':True})
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':1440,'height':960},device_scale_factor=1)
  async def serve(route,request):
   rel=request.url.split('?',1)[0].removeprefix(ENTRY) or 'index.html'
   path=(CANDIDATE/rel).resolve()
   if not path.is_relative_to(CANDIDATE.resolve()) or not path.is_file():
    await route.fulfill(status=404,body='Candidate file absent');return
   mime='text/javascript' if path.suffix=='.mjs' else mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
   await route.fulfill(status=200,body=path.read_bytes(),content_type=mime)
  if not LIVE:await context.route(ENTRY+'**',serve)
  page=await context.new_page();errors=[];requests=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.on('request',lambda req:requests.append(req.url))
  started=time.time()
  async def shot(name):
   await page.evaluate('A4_ANATOMY.render()');await page.wait_for_timeout(250)
   await page.screenshot(path=str(OUT/(name+'.png')),full_page=True,timeout=120000)
  try:
   await page.goto(ENTRY+'index.html',wait_until='domcontentloaded',timeout=120000)
   await page.wait_for_function('A4_ANATOMY.ready || A4_ANATOMY.errors.length',timeout=600000)
   state=await page.evaluate('({ready:A4_ANATOMY.ready,errors:A4_ANATOMY.errors,nodes:A4_ANATOMY.allSourceNodes,meshes:A4_ANATOMY.allSourceMeshes,triangles:A4_ANATOMY.sourceTriangles,hash:A4_ANATOMY.sourceHash,referenceMesh:A4_ANATOMY.referenceMesh,native:A4_ANATOMY.nativeFunctionStudent,channels:A4_ANATOMY.source.g.animations[0].channels.length,materials:A4_ANATOMY.source.g.materials.length,images:A4_ANATOMY.source.g.images.length})')
   checked('complete original source and identity',state['ready'] and state['nodes']==331 and state['meshes']==200 and state['triangles']==1004013 and state['channels']==71 and state['materials']==22 and state['images']==2 and state['hash']=='749efd6d1b1a19aa97d9d024baa33f4f5df382eb19a2be88c10ef7ba6e1a5fe4' and state['referenceMesh'] and not state['native'])
   report['source']=state;report['load_seconds']=time.time()-started
   checked('all 200 source primitives visible',await page.evaluate('A4_ANATOMY.visibleCount()===200'))
   await shot('01-complete-original')
   await page.click('[data-camera=side]')
   point=await page.evaluate("""(()=>{const q=A4_ANATOMY,p=q.source.primitives.find(p=>p.sourceNode===31),v=p.object.geometry.boundingBox.getCenter(p.object.position.clone()).applyMatrix4(p.object.matrixWorld).project(q.camera),r=q.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};})()""")
   await page.mouse.click(point['x'],point['y']);await page.wait_for_timeout(100)
   checked('real canvas ray picking',await page.evaluate('A4_ANATOMY.pickCount>0 && A4_ANATOMY.lastHit.triangle>=0'))
   report['picked']=await page.evaluate('({selection:A4_ANATOMY.selection,hit:A4_ANATOMY.lastHit,measurements:A4_ANATOMY.measurements})')
   await shot('02-picked-source-group')
   await page.check('input[name=pickmode][value=object]');await page.mouse.click(point['x'],point['y'])
   checked('source mesh picking',await page.evaluate('A4_ANATOMY.selection.kind==="object" && A4_ANATOMY.selection.node>=0'))
   await page.click('#hide');checked('hide exactly one mesh',await page.evaluate('A4_ANATOMY.visibleCount()===199'))
   await page.click('#reset');checked('reset restores complete source',await page.evaluate('A4_ANATOMY.visibleCount()===200 && A4_ANATOMY.pose==="first"'))
   await page.click('#uncover');checked('main covering hidden but source retained',await page.evaluate('A4_ANATOMY.source.primitives.filter(p=>[31,32,33,34,35,36,192,193,194].includes(p.sourceNode)).every(p=>!p.object.visible) && A4_ANATOMY.visibleCount()>150 && A4_ANATOMY.source.primitives.length===200'))
   await page.click('[data-camera=side]');await shot('03-original-without-main-coverings')
   for button in ['wheels','rods','tender']:
    await page.click('#'+button);checked(button+' subset has original geometry',await page.evaluate('A4_ANATOMY.visibleCount()>0 && A4_ANATOMY.visibleCount()<200'));await shot('04-'+button)
   for system in await page.evaluate('A4_ANATOMY.data.systems.map(s=>s.id)'):
    await page.select_option('#system',system)
    checked('nine systems / '+system,await page.evaluate("""(()=>{const q=A4_ANATOMY,id=document.querySelector('#system').value,s=q.data.systems.find(s=>s.id===id);return q.visibleCount()===q.data.groups.filter(g=>s.source_groups.includes(g.source_group)).reduce((n,g)=>n+g.mesh_nodes.length,0);})()"""))
   await page.click('#reset');await page.evaluate('A4_ANATOMY.select(94)');await page.click('#isolate')
   checked('isolated N94 exact source mesh closure',await page.evaluate('A4_ANATOMY.visibleCount()===A4_ANATOMY.data.groups.find(g=>g.source_group===94).mesh_nodes.length'))
   measurement=await page.evaluate('({actual:A4_ANATOMY.measurements,reference:A4_ANATOMY.data.groups.find(g=>g.source_group===94)})')
   for key,ref in [('local','local_bounds'),('world','first_world_bounds')]:
    expected=[b-a for a,b in zip(*measurement['reference'][ref])]
    checked(key+' measured from source vertices',max(abs(a-b) for a,b in zip(expected,measurement['actual'][key]))<1e-5)
   first=await page.evaluate('A4_ANATOMY.source.nodes.map(n=>n.matrixWorld.elements.slice())')
   await page.locator('#time').evaluate('(e)=>{e.value=1.25;e.dispatchEvent(new Event("input",{bubbles:true}));}')
   changed=await page.evaluate('(first)=>A4_ANATOMY.source.nodes.filter((n,i)=>n.matrixWorld.elements.some((v,j)=>Math.abs(v-first[i][j])>1e-6)).length',first)
   checked('original animation changes real source transforms',changed>0);report['animation_changed_nodes']=changed
   await page.click('#play');await page.wait_for_timeout(500);await page.click('#play');checked('timeline playback advances',await page.evaluate('Math.abs(A4_ANATOMY.time-1.25)>.05'))
   await page.click('#rest');checked('static source pose distinct',await page.evaluate('A4_ANATOMY.pose==="rest"'))
   await page.click('#first');checked('first key restored exactly',await page.evaluate('(first)=>A4_ANATOMY.source.nodes.every((n,i)=>n.matrixWorld.elements.every((v,j)=>Math.abs(v-first[i][j])<1e-7))',first))
   await shot('05-axle-original-animation-inspection')
   await page.click('#reset');await page.evaluate('A4_ANATOMY.loadSections()');checked('all source cross-section evidence loaded',await page.evaluate('A4_ANATOMY.sectionCount===27 && A4_ANATOMY.sectionSegmentCount===10113'))
   section=await page.locator('#section option').nth(5).get_attribute('value');await page.evaluate('(id)=>A4_ANATOMY.showSection(id,true)',section);checked('actual source section line rendering',await page.evaluate('A4_ANATOMY.section.count>0 && A4_ANATOMY.visibleCount()===0'));await shot('06-true-source-cross-section')
   await page.click('#reset');checked('reset also restores from section-only',await page.evaluate('A4_ANATOMY.visibleCount()===200 && A4_ANATOMY.section===null'))
   await page.fill('#search','N191');await page.locator('#search-results button').first.click();checked('source ID search picks tender body',await page.evaluate('A4_ANATOMY.selection.group===191'))
   await page.click('#reset');await page.click('[data-camera=front]');await page.click('[data-camera=top]');await page.click('[data-camera=side]');await shot('07-orthographic-side')
   await page.set_viewport_size({'width':390,'height':844});await page.click('#reset')
   if await page.locator('#inspector-body').is_visible():await page.click('#collapse')
   await shot('08-mobile-complete-original');checked('mobile controls do not cause document overflow',await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   checked('no browser errors',not errors and not await page.evaluate('A4_ANATOMY.errors'))
   checked('no unrelated source or third-party model request',not any('/source-assets/mark3/' in u or 'unpkg.com' in u or 'jsdelivr.net' in u or '/a6-native' in u for u in requests))
   report['renderer']=await page.evaluate('({triangles:A4_ANATOMY.renderer.info.render.triangles,calls:A4_ANATOMY.renderer.info.render.calls,context:A4_ANATOMY.contextDiagnostics})')
   report['passed']=True
  except Exception as e:
   report['error']=str(e);report['errors']=errors
   try:report['browser_state']=await page.evaluate('({ready:window.A4_ANATOMY?.ready,errors:window.A4_ANATOMY?.errors,status:document.querySelector("#load-detail")?.textContent})');await page.screenshot(path=str(OUT/'FAILURE.png'),full_page=True,timeout=120000)
   except Exception as secondary:report['secondary']=str(secondary)
  finally:
   report['seconds']=time.time()-started;report['requests']=requests
   (OUT/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2));await browser.close()
 assert report['passed'],report.get('error')
asyncio.run(main())
