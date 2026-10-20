"""Real Chromium/WebGL r04 pilot checks. Source presence is not a pass result."""
import argparse,json,pathlib,traceback,hashlib
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/r04.html');p.add_argument('--output',default='evidence/r04-browser');a=p.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
report={'url':a.url,'status':'running','checks':[],'errors':[],'screenshots':[],'rendererKind':'Software ANGLE/SwiftShader, not physical-device performance'}
def shot(page,name):
 page.screenshot(path=str(out/name));report['screenshots'].append(name)
def state(page):return page.evaluate('window.__BUILDING_MOTHER__.snapshot()')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);page.on('pageerror',lambda e:report['errors'].append(str(e)))
 try:
  page.goto(a.url,wait_until='networkidle');page.wait_for_function('window.__BUILDING_MOTHER__?.ready')
  report['build']=page.locator('meta[name="kaopu-build"]').get_attribute('content');assert report['build']=='2026-10-20-two-floor-stair-r04'
  report['productionAssetSha256']={}
  for asset in ['r04.html','r04/app.mjs','r04/style.css','r04/stairs.mjs','r04/floors.mjs','r03/style.css','r03/assembly.mjs','r03/window.mjs','r03/services.mjs']:
   response=page.request.get(urljoin(a.url,asset));assert response.status==200
   actual=hashlib.sha256(response.body()).hexdigest();expected=hashlib.sha256((pathlib.Path(__file__).resolve().parents[1]/asset).read_bytes()).hexdigest();assert actual==expected,asset
   report['productionAssetSha256'][asset]=actual
  assert not state(page)['stair']['enabled'];assert not state(page)['floors']['enabled']
  page.evaluate('window.__BUILDING_MOTHER__.setFloors({slabThickness:0.08})');assert abs(state(page)['floors']['slabs'][0]['thickness']-0.08)<1e-8
  assert state(page)['stair']['available'] is False
  page.evaluate('window.__BUILDING_MOTHER__.setFloors({slabThickness:0.2})');report['checks'].append({'inactive_stair_does_not_block_floor_only_thin_slab':'passed'})
  page.locator('[data-building="1"]').click()
  original=page.evaluate('window.__BUILDING_MOTHER__.roots[1].children.filter(o=>o.userData.patchId).map(o=>({id:o.userData.patchId,p:Array.from(o.geometry.attributes.position.array),n:Array.from(o.geometry.attributes.normal.array)}))')
  page.locator('#stairFocus').click();s=state(page);assert s['stair']['effectiveEnabled'] and s['stair']['openingApplied']
  assert s['stair']['dimensions']['totalRisers']==20 and s['stair']['headroom']['minimumClearanceM']>=2
  assert len(s['stair']['scene']['solids'])==3 and all(m['closedSolid'] and m['solidVolumeCubicMetres']>0 for m in s['stair']['scene']['solids'])
  assert len(s['floors']['openings'])==22;opening=next(o for o in s['floors']['openings'] if o.get('purpose')=='stair');assert opening['hostSlabId']=='slab-002'
  assert s['stair']['lowerFFLM']==s['floors']['floors'][0]['fflM'] and s['stair']['upperFFLM']==s['floors']['floors'][1]['fflM']
  assert not s['stair']['circulationComplete'] and not s['stair']['navigationConnectionEnabled'] and not s['stair']['evacuationPermitted']
  shot(page,'stairs-closeup.png');report['checks'].append({'default_actual_stair_and_hosted_hole':s['stair']})
  page.locator('#stairOpening').click();shot(page,'stairs-opaque-hosts.png');assert not state(page)['floorGhost']
  visible=page.evaluate('''async () => {const T=await import(new URL('../hk-three-buildings-r01/viewer/vendor/three.module.js',location.href));const a=window.__BUILDING_MOTHER__,p=a.snapshot().stair,root=a.roots[1],meshes=[...root.userData.stairs.children,...root.userData.floors.children.filter(o=>['slab-001','slab-002'].includes(o.userData.slabId))];return p.walkingPatches.map(patch=>{const en=[0,1].map(i=>patch.footprintLoop.reduce((s,p)=>s+p[i],0)/patch.footprintLoop.length),target=new T.Vector3(en[0],patch.elevationM,-en[1]).applyMatrix4(root.matrixWorld),d=target.clone().sub(a.camera.position),hit=new T.Raycaster(a.camera.position,d.clone().normalize()).intersectObjects(meshes,false)[0];return {id:patch.id,visible:!!hit&&Math.abs(hit.distance-d.length())<.01};});}''')
  assert len(visible)==21 and all(v['visible'] for v in visible);report['checks'].append({'opaque_view_actual_triangle_visibility_all_18_treads_and_3_landings':visible})
  page.locator('#stairOverview').click();shot(page,'two-floor-overview.png')
  page.evaluate('window.__BUILDING_MOTHER__.setFloors({floorToFloor:3.4,slabThickness:0.24})');s=state(page);assert abs(s['stair']['floorDeltaM']-3.4)<1e-8
  assert s['stair']['dimensions']['totalRisers']==22;assert abs(s['stair']['dimensions']['actualRiser']*22-3.4)<1e-8
  assert s['stair']['upperFFLM']==s['floors']['floors'][1]['fflM'];assert s['stair']['openingApplied']
  page.evaluate('window.__BUILDING_MOTHER__.frameStair()');shot(page,'stairs-edited-levels.png');report['checks'].append({'slab_ffl_stair_risers_and_hole_rederived':s['stair']})
  prior=page.evaluate('JSON.stringify({config:window.__BUILDING_MOTHER__.snapshot().stairConfig,floors:window.__BUILDING_MOTHER__.snapshot().floors,mesh:window.__BUILDING_MOTHER__.roots[1].userData.stairs.children.map(o=>Array.from(o.geometry.attributes.position.array))})')
  err=page.evaluate('''() => {try{window.__BUILDING_MOTHER__.setStair({flightWidth:2.5,landingDepth:2.5,treadDepth:.4,targetRiser:.1});return null;}catch(e){return e.message;}}''');assert err
  after=page.evaluate('JSON.stringify({config:window.__BUILDING_MOTHER__.snapshot().stairConfig,floors:window.__BUILDING_MOTHER__.snapshot().floors,mesh:window.__BUILDING_MOTHER__.roots[1].userData.stairs.children.map(o=>Array.from(o.geometry.attributes.position.array))})');assert prior==after
  page.locator('#stair-landingDepth').evaluate("el=>{el.value='0.8';el.dispatchEvent(new Event('input',{bubbles:true}))}");assert '拒绝' in page.locator('#stairAudit').inner_text();assert state(page)['stairConfig']['landingDepth']==1.2
  report['checks'].append({'invalid_fit_and_short_landing_rejected_atomically':'passed','rejection':err})
  page.evaluate('window.__BUILDING_MOTHER__.setStair({visible:false})');s=state(page);assert s['stair']['effectiveEnabled'] and not s['stair']['scene']['effectiveVisible'];assert s['stair']['openingApplied']
  page.evaluate('window.__BUILDING_MOTHER__.setStair({visible:true})')
  page.evaluate('window.__BUILDING_MOTHER__.setFloors({floorStates:{"slab-002":{enabled:false}}})');s=state(page);assert not s['stair']['effectiveEnabled'] and not s['stair']['scene']['effectiveVisible']
  page.evaluate('window.__BUILDING_MOTHER__.setFloors({floorStates:{}})');page.locator('#shellEnabled').uncheck();s=state(page);assert not s['stair']['effectiveEnabled'] and s['export']['authoredStair']['suppressedByHost'];assert not s['stair']['scene']['effectiveVisible']
  page.locator('#shellEnabled').check();page.evaluate('window.__BUILDING_MOTHER__.setStair({enabled:false})');s=state(page);assert len(s['floors']['openings'])==s['floors']['slabCount'];assert not s['stairsScene']['children']
  report['checks'].append({'display_assembly_endpoint_host_suppression_and_reversible_opening':'passed'})
  page.locator('#reset').click();s=state(page);assert not s['stair']['enabled'] and not s['floors']['enabled']
  reset=page.evaluate('window.__BUILDING_MOTHER__.roots[1].children.filter(o=>o.userData.patchId).map(o=>({id:o.userData.patchId,p:Array.from(o.geometry.attributes.position.array),n:Array.from(o.geometry.attributes.normal.array)}))');assert reset==original
  page.locator('#windowFocus').click();page.evaluate('window.__BUILDING_MOTHER__.setWindow({angleDegrees:80})');assert abs(state(page)['windowInspection']['scene']['displayedAngleDegrees']-80)<1e-8
  page.locator('#reset').click();page.locator('#stairFocus').click();page.set_viewport_size({'width':390,'height':844});shot(page,'stairs-mobile.png')
  assert page.locator('#failure').is_hidden();assert not report['errors'];assert not state(page)['errors'];assert state(page)['renderer']['triangles']>100
  report['checks'].append({'exact_source_arrays_reset_window_regression_mobile_webgl':'passed'})
  report['status']='passed'
 except Exception:
  report['status']='failed';report['failure']=traceback.format_exc()
  try:shot(page,'failure.png')
  except Exception:pass
  raise
 finally:
  (out/'results.json').write_text(json.dumps(report,indent=2));browser.close()
