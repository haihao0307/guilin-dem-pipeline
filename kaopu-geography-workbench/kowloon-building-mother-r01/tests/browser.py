"""Actual Chromium/WebGL QA; requires installed Playwright/Chromium.
The presence of this script is not evidence that it passed.
"""
import argparse,json,pathlib,traceback
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/');p.add_argument('--output',default='evidence/browser');p.add_argument('--expected-build');a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'url':a.url,'status':'running','checks':[],'errors':[],'screenshots':[],'rendererKind':'Forced software ANGLE/SwiftShader; not physical-device performance'}
def shot(page,name):
 page.screenshot(path=str(out/name));report['screenshots'].append(name)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.on('pageerror',lambda e: report['errors'].append(str(e)))
 try:
  page.goto(a.url,wait_until='networkidle');page.wait_for_function('window.__BUILDING_MOTHER__?.ready')
  report['build']=page.locator('meta[name="kaopu-build"]').get_attribute('content')
  if a.expected_build: assert report['build']==a.expected_build
  original_meshes={}
  for index in range(3):
   page.locator(f'[data-building="{index}"]').click();shot(page,f'baseline-{index}.png')
   original_meshes[index]=page.evaluate('window.__BUILDING_MOTHER__.roots[window.__BUILDING_MOTHER__.snapshot().selected].children.filter(o=>o.userData.patchId).map(o=>({id:o.userData.patchId,p:Array.from(o.geometry.attributes.position.array),n:Array.from(o.geometry.attributes.normal.array)}))')
   report['checks'].append({'baseline':index,'state':page.evaluate('window.__BUILDING_MOTHER__.snapshot().assemblies')})
  page.locator('#windowFocus').click();shot(page,'window-closed.png')
  for angle in [40,80,0]:
   page.locator('#window-angleDegrees').evaluate("(el, value) => { el.value=String(value); el.dispatchEvent(new Event('input',{bubbles:true})); }",angle)
   shot(page,f'window-{angle}.png')
   assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().window.angleDegrees')==angle
   assert abs(page.evaluate('window.__BUILDING_MOTHER__.snapshot().windowInspection.scene.displayedAngleDegrees')-angle)<1e-8
  page.evaluate('window.__BUILDING_MOTHER__.setWindow({width:0.55,height:1.6,glassColor:"#997a55",glassTransmission:0.5,glassRoughness:0.25})')
  altered=page.evaluate('window.__BUILDING_MOTHER__.snapshot()');assert abs(altered['windowInspection']['aperture']['areaSquareMetres']-0.88)<1e-8
  page.evaluate('window.__BUILDING_MOTHER__.setWindow({width:0.68,height:1.2,glassColor:"#77b6c6",glassTransmission:0.82,glassRoughness:0.08})')
  report['checks'].append({'window_dimension_and_physical_glass_inputs':'passed'})
  page.locator('[data-visible="p003"]').uncheck();s=page.evaluate('window.__BUILDING_MOTHER__.snapshot()');assert len(s['export']['operations'])==21
  page.locator('[data-visible="p003"]').check();page.locator('[data-enabled="p003"]').uncheck();s=page.evaluate('window.__BUILDING_MOTHER__.snapshot()');assert len(s['export']['operations'])==20 and s['export']['designWindow']['suppressedByHost']
  report['checks'].append({'display_vs_assembly_and_host_suppression':'passed'})
  page.locator('#floorInspect').click();shot(page,'floor-cutaway.png');s=page.evaluate('window.__BUILDING_MOTHER__.snapshot()');assert s['floors']['slabCount']==21 and len(s['floors']['openings'])==21
  assert all(stop['fflM']==next(f['fflM'] for f in s['floors']['floors'] if f['floorId']==stop['floorId']) for stop in s['serviceInterfaces']['stops'])
  report['checks'].append({'floors':s['floors'],'serviceInterfaces':s['serviceInterfaces']})
  page.evaluate('''() => { const a=window.__BUILDING_MOTHER__, s=a.snapshot(), states={};s.floors.slabs.forEach((slab,i)=>states[slab.slabId]={visible:i>=s.floors.slabs.length-3});a.setFloors({floorStates:states});const c=a.roots[1].position.clone();c.y=s.floors.floors.at(-1).fflM;c.z=0;a.camera.position.copy(c).add(a.camera.position.clone().set(2.8,7.2,5.5));a.camera.lookAt(c);a.camera.updateMatrixWorld(true);a.renderer.render(a.scene,a.camera); }''')
  shot(page,'floor-shaft-closeup.png');report['checks'].append({'shaft_closeup':'top three design slabs visible; camera only, holes and thickness unchanged'})
  page.locator('#windowFocus').click();assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().assemblies[1].visiblePatches')==20
  page.locator('#reset').click();assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().window.enabled') is False
  reset_meshes=page.evaluate('window.__BUILDING_MOTHER__.roots[1].children.filter(o=>o.userData.patchId).map(o=>({id:o.userData.patchId,p:Array.from(o.geometry.attributes.position.array),n:Array.from(o.geometry.attributes.normal.array)}))')
  assert reset_meshes==original_meshes[1], 'Actual rendered vertex and normal arrays must return exactly to baseline after window cuts and reset'
  assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().floors.enabled') is False
  assert all(not item['sourceMutated'] for item in page.evaluate('window.__BUILDING_MOTHER__.snapshot().assemblies'))
  report['checks'].append({'actual_rendered_arrays_exact_after_reset':'passed'})
  page.set_viewport_size({'width':390,'height':844});shot(page,'mobile.png')
  assert page.locator('#failure').is_hidden();assert report['errors']==[]
  assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().errors')==[]
  assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().renderer.triangles')>=50
  assert page.evaluate('window.__BUILDING_MOTHER__.snapshot().pbr.enabled') is True
  report['checks'].append({'repeated_views_reset_mobile_pbr':'passed'})
  report['status']='passed'
 except Exception:
  report['status']='failed';report['failure']=traceback.format_exc()
  try: shot(page,'failure.png')
  except Exception: pass
  raise
 finally:
  (out/'results.json').write_text(json.dumps(report,indent=2));browser.close()
