import os,json,hashlib,time,traceback
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
out=Path(os.environ.get('KNIT_QA_OUT','qa-output'));out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('KNIT_URL','http://127.0.0.1:8873/index.html')
report={'url':url,'checks':{},'errors':[],'consoleErrors':[],'public':url.startswith('https://'),'device':'Chromium SwiftShader software GPU; viewport checks, not phone hardware','visualAcceptedByUser':False}
def check(k,v):
 report['checks'][k]=bool(v)
 if not v:raise AssertionError(k)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':1000},device_scale_factor=1)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None)
 try:
  t=time.monotonic();response=page.goto(url,wait_until='domcontentloaded',timeout=120000)
  check('http_ok',response.status==200)
  report['htmlSHA256']=hashlib.sha256(response.body()).hexdigest()
  page.wait_for_function('window.KnitPublic && KnitPublic.report().ready',timeout=180000)
  report['readySecondsSoftwareGPU']=time.monotonic()-t
  page.screenshot(path=str(out/'desktop-fiber.png'),timeout=120000)
  initial=page.evaluate('KnitPublic.report()');report['initial']=initial
  check('version',initial['version']=='KNIT-PUBLIC-P01')
  check('independent_not_native',not initial['nativeR15'] and not initial['privateRuntimeImported'] and not initial['clothPhysics'])
  check('explicit_scope_visible','非 R15' in page.locator('.tag').inner_text())
  check('geometry_generated',initial['vertices']>10000 and initial['hairCount']>10000)
  lighting=initial['lighting']['profile']
  check('EB1_native_core',initial['lighting']['version']=='EB1-1.1.0' and initial['lighting']['lights']==2)
  page.locator('[data-view="close"]').click();page.wait_for_timeout(400)
  page.screenshot(path=str(out/'macro-fiber.png'),timeout=120000)
  page.locator('[data-mode="carrier"]').click();page.wait_for_timeout(400)
  page.screenshot(path=str(out/'macro-carrier.png'),timeout=120000)
  a=Image.open(out/'macro-fiber.png').convert('RGB');b=Image.open(out/'macro-carrier.png').convert('RGB')
  report['macroByteDifference']=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
  check('visible_surface_difference',report['macroByteDifference']>.2)
  check('mode_button',page.evaluate('KnitPublic.report().settings.mode')=='carrier')
  page.locator('[data-mode="fiber"]').click()
  before=page.evaluate('KnitPublic.report().builds')
  page.locator('[data-param="fuzz"]').evaluate('e=>{e.value="0.4";e.dispatchEvent(new Event("input",{bubbles:true}))}')
  check('density_control',abs(page.evaluate('KnitPublic.report().settings.fuzz')-.4)<1e-7)
  page.locator('[data-param="length"]').evaluate('e=>{e.value="1.1";e.dispatchEvent(new Event("input",{bubbles:true}))}')
  check('length_control',abs(page.evaluate('KnitPublic.report().settings.length')-1.1)<1e-7)
  check('no_rebuild_for_fuzz_controls',page.evaluate('KnitPublic.report().builds')==before)
  for pattern in ['stripe','diamond','plain']:
   page.locator('[data-param="pattern"]').select_option(pattern)
   check('pattern_'+pattern,page.evaluate('KnitPublic.report().settings.pattern')==pattern)
  page.locator('[data-param="shape"]').select_option('rib')
  page.locator('[data-view="whole"]').click();page.wait_for_timeout(400)
  page.screenshot(path=str(out/'rib.png'),timeout=120000)
  check('rib_control',page.evaluate('KnitPublic.report().settings.shape')=='rib')
  check('EB1_unchanged_by_material',page.evaluate('KnitPublic.report().lighting.profile')==lighting)
  check('reject_bad_input',page.evaluate('()=>{try{KnitPublic.set({fuzz:NaN});return false}catch(e){return true}}'))
  page.locator('#export').click()
  check('JSON_export',json.loads(page.locator('#json').input_value())['schema']=='kaopu.public-yarn/1')
  page.reload(wait_until='domcontentloaded');page.wait_for_function('window.KnitPublic && KnitPublic.report().ready',timeout=180000)
  check('saved_material_state',page.evaluate('KnitPublic.report().settings.shape')=='rib' and abs(page.evaluate('KnitPublic.report().settings.fuzz')-.4)<1e-7)
  page.locator('#reset').click();page.locator('[data-view="edge"]').click();page.wait_for_timeout(400)
  page.screenshot(path=str(out/'grazing.png'),timeout=120000)
  check('reset_keeps_EB1',page.evaluate('KnitPublic.report().lighting.profile')==lighting)
  page.locator('#eb1').click();check('EB1_panel_opens',page.locator('#eb1-panel').get_attribute('open') is not None)
  page.evaluate('document.getElementById("eb1-panel").remove()')
  page.locator('[data-view="back"]').click();page.wait_for_timeout(200)
  check('back_view',page.evaluate('KnitPublic.report().camera.position[2]')<0)
  page.locator('[data-view="whole"]').click()
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(800)
  page.screenshot(path=str(out/'mobile-viewport.png'),timeout=120000)
  check('mobile_no_horizontal_overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('mobile_canvas_visible',page.locator('#stage canvas').bounding_box()['height']>=270)
  report['final']=page.evaluate('KnitPublic.report()')
  check('no_WebGL_error',report['final']['glError']==0)
  check('no_page_errors',not report['errors'])
  check('no_console_errors',not report['consoleErrors'])
  report['passed']=True
 except Exception as e:
  report['passed']=False;report['error']=str(e);report['trace']=traceback.format_exc()
  try:page.screenshot(path=str(out/'failure.png'),timeout=120000)
  except Exception:pass
 finally:
  report['imageSHA256']={x.name:hashlib.sha256(x.read_bytes()).hexdigest() for x in out.glob('*.png')}
  (out/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
print(json.dumps({'passed':report['passed'],'checks':report['checks'],'error':report.get('error'),'consoleErrors':report['consoleErrors']},ensure_ascii=False))
if not report['passed']:raise SystemExit(1)
