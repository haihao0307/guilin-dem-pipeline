"""Actual Chromium/WebGL r05 candidate/public QA; not a physical GPU benchmark."""
import argparse,json,pathlib,traceback,hashlib
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/r05.html');p.add_argument('--output',default='evidence/r05-browser');a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'url':a.url,'status':'running','checks':[],'errors':[],'screenshots':[],'rendererKind':'Software ANGLE/SwiftShader, not physical-device performance'}
def shot(page,name):
 page.screenshot(path=str(out/name));report['screenshots'].append(name)
def state(page):return page.evaluate('window.__BUILDING_MOTHER__.snapshot()')
def call(page,source):return page.evaluate('window.__BUILDING_MOTHER__.'+source)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.on('pageerror',lambda e:report['errors'].append(str(e)))
 try:
  page.goto(a.url,wait_until='networkidle');page.wait_for_function('window.__BUILDING_MOTHER__?.ready')
  report['build']=page.locator('meta[name="kaopu-build"]').get_attribute('content');assert report['build']=='2026-10-20-door-guard-three-floor-r05'
  report['productionAssetSha256']={}
  for asset in ['r05.html','r05/app.mjs','r05/style.css','r05/interior.mjs','r05/circulation.mjs','r05/door.mjs','r05/guards.mjs','r04/stairs.mjs','r04/floors.mjs','r03/style.css','r03/assembly.mjs','r03/window.mjs','r03/services.mjs']:
   response=page.request.get(urljoin(a.url,asset));assert response.status==200
   actual=hashlib.sha256(response.body()).hexdigest();expected=hashlib.sha256((pathlib.Path(__file__).resolve().parents[1]/asset).read_bytes()).hexdigest();assert actual==expected,asset;report['productionAssetSha256'][asset]=actual
  s=state(page);assert not s['circulation']['effectiveEnabled'] and not s['door']['effectiveEnabled'] and not s['floors']['enabled']
  call(page,'setFloors({slabThickness:.08})');assert not state(page)['circulation']['validation']['activationReady'];call(page,'setFloors({slabThickness:.2})')
  call(page,'select(1)');original=page.evaluate('window.__BUILDING_MOTHER__.roots[1].children.filter(o=>o.userData.patchId).map(o=>({id:o.userData.patchId,p:Array.from(o.geometry.attributes.position.array),n:Array.from(o.geometry.attributes.normal.array)}))')
  page.locator('#interiorFocus').click();s=state(page);assert s['circulation']['effectiveEnabled'] and s['door']['effectiveEnabled'] and s['guards']['effectiveEnabled'];assert len(s['circulation']['pairs'])==2;assert len(s['circulation']['sharedLandings'])==1;assert s['interior']['sweep']['clear'] and s['interior']['sweep']['sampleCount']==101;assert s['interior']['fixedHostAudit']['clear'];assert s['door']['threshold']['elevationM']==s['floors']['floors'][1]['fflM'];assert len([x for x in s['floors']['openings'] if x.get('purpose')=='stair'])==2;assert s['circulation']['geometryAudit']['minimumClearanceM']>2.83
  shot(page,'three-floor-shared-landing.png');report['checks'].append({'combined_default_actual_geometry':s['interior']})
  page.locator('#doorFocus').click();shot(page,'door-closed-host.png')
  fixed=page.evaluate('window.__BUILDING_MOTHER__.roots[1].userData.interior.userData.refs.door.getObjectByName(window.__BUILDING_MOTHER__.roots[1].userData.interior.userData.refs.door.userData.frameName).matrixWorld.elements')
  call(page,'setDoor({angleDeg:45})');call(page,'frameInterior("door")');shot(page,'door-open-45.png')
  after=page.evaluate('window.__BUILDING_MOTHER__.roots[1].userData.interior.userData.refs.door.getObjectByName(window.__BUILDING_MOTHER__.roots[1].userData.interior.userData.refs.door.userData.frameName).matrixWorld.elements');assert fixed==after
  call(page,'setDoor({angleDeg:100,swing:"right"})');call(page,'frameInterior("door")');shot(page,'door-open-right-100.png');assert state(page)['interior']['sweep']['clear']
  call(page,'setDoor({angleDeg:45,swing:"left",role:"service"})');assert state(page)['door']['config']['width']==.9 and state(page)['door']['actualBuildingUse']=='unknown'
  page.locator('#stairOpening').click();assert not state(page)['floorGhost'];shot(page,'opaque-three-floor-openings.png')
  page.locator('#threeFloorView').click();shot(page,'three-floor-overview.png')
  call(page,'setFloors({floorToFloor:3.4,slabThickness:.24})');call(page,'setDoor({width:1,height:2.2})');call(page,'setGuards({height:1.1})');s=state(page);assert s['door']['threshold']['elevationM']==s['circulation']['pairs'][1]['lowerFFLM'];assert s['circulation']['pairs'][0]['dimensions']['totalRisers']==22;assert s['interior']['sweep']['clear'];call(page,'frameInterior("shared")');shot(page,'edited-ffl-door-guards.png');report['checks'].append({'linked_ffl_width_guard_parameters':s['interior']})
  prior=page.evaluate('JSON.stringify(window.__BUILDING_MOTHER__.snapshot().interior.config)');uuid=page.evaluate('window.__BUILDING_MOTHER__.roots[1].uuid')
  for expression in ['setCirculation({stair:{flightWidth:2.5}})','setDoor({height:2.6})','setFloors({floorToFloor:2.6})']:
   err=page.evaluate('() => {try {window.__BUILDING_MOTHER__.'+expression+';return null;}catch(e){return e.message;}}');assert err,expression;assert page.evaluate('JSON.stringify(window.__BUILDING_MOTHER__.snapshot().interior.config)')==prior;assert page.evaluate('window.__BUILDING_MOTHER__.roots[1].uuid')==uuid
  page.locator('#stair-landingDepth').evaluate("el=>{el.value='0.8';el.dispatchEvent(new Event('input',{bubbles:true}))}");assert '拒绝' in page.locator('#interiorAudit').inner_text();assert page.evaluate('JSON.stringify(window.__BUILDING_MOTHER__.snapshot().interior.config)')==prior
  report['checks'].append({'invalid_fit_door_lintel_overhead_and_ui_reject_before_commit':'passed'})
  call(page,'setGuards({visible:false})');s=state(page);assert s['guards']['effectiveEnabled'] and not s['guards']['effectiveVisible'];assert s['interior']['sweep']['clear'];call(page,'setGuards({visible:true})')
  call(page,'setFloors({floorStates:{"slab-002":{enabled:false}}})');s=state(page);assert not s['door']['effectiveEnabled'] and not s['circulation']['effectiveEnabled'];call(page,'setFloors({floorStates:{}})')
  page.locator('#shellEnabled').uncheck();s=state(page);assert not s['door']['effectiveEnabled'] and not s['guards']['effectiveEnabled'] and not s['circulation']['effectiveEnabled'];page.locator('#shellEnabled').check()
  call(page,'setCirculation({enabled:false})');s=state(page);assert len([x for x in s['floors']['openings'] if x.get('purpose')=='stair'])==0
  report['checks'].append({'assembly_suppression_display_only_and_reversible_holes':'passed'})
  page.locator('#reset').click();reset=page.evaluate('window.__BUILDING_MOTHER__.roots[1].children.filter(o=>o.userData.patchId).map(o=>({id:o.userData.patchId,p:Array.from(o.geometry.attributes.position.array),n:Array.from(o.geometry.attributes.normal.array)}))');assert reset==original
  page.locator('#windowFocus').click();call(page,'setWindow({angleDegrees:80})');assert abs(state(page)['windowInspection']['scene']['displayedAngleDegrees']-80)<1e-8;page.locator('#reset').click()
  page.locator('#interiorFocus').click();page.set_viewport_size({'width':390,'height':844});shot(page,'r05-mobile.png')
  assert page.locator('#failure').is_hidden();assert not report['errors'];assert not state(page)['errors'];assert state(page)['renderer']['triangles']>1000
  report['checks'].append({'exact_source_reset_window_regression_mobile_actual_webgl':'passed'});report['status']='passed'
 except Exception:
  report['status']='failed';report['failure']=traceback.format_exc()
  try:shot(page,'failure.png')
  except Exception:pass
  raise
 finally:
  (out/'results.json').write_text(json.dumps(report,indent=2));browser.close()
