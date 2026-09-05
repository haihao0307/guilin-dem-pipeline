from pathlib import Path
import json,sys,time,hashlib
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat,ImageChops
URL=sys.argv[1];OUT=Path(sys.argv[2]);OUT.mkdir(parents=True,exist_ok=True)
checks={};details={};errors=[];requests_failed=[]
def check(name,value):
 checks[name]=bool(value);print(name,checks[name],flush=True)
def grab(page,name):
 page.screenshot(path=str(OUT/f'{name}.png'));im=Image.open(OUT/f'{name}.png').convert('RGB');return im
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1200,'height':800},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('requestfailed',lambda r:requests_failed.append({'url':r.url,'failure':r.failure}))
 response=page.goto(URL+'?qa=1',wait_until='networkidle',timeout=60000);check('http_200',response.status==200)
 try:page.wait_for_function('window.OceanIsland?.qa.ready === true',timeout=60000)
 except Exception as e:errors.append('ready: '+str(e))
 if page.evaluate('!!window.OceanIsland?.qa.ready'):
  page.wait_for_timeout(1800);check('ready',True)
  state=page.evaluate('OceanIsland.getState()');details['initial']=state;check('correct_identity',state['version']=='0.3.0-island-r017')
  check('102_controls',page.locator('input[type=range]').count()==102)
  check('three_pages',page.locator('#parameterTabs [data-page]').count()==3)
  check('three_fire_sources',state['composition']['fireSources']==3)
  check('multiple_smoke_sources',state['composition']['smokeSources']==3)
  check('long_smoke',state['composition']['smokeExtentMeters']>30)
  check('no_trees',page.evaluate('OceanIsland.qa.treeCount')==0)
  check('all_three_curl_layers_drawn',all(v>0 for v in state['composition']['curlLayerTriangles']))
  overview=grab(page,'overview');im=overview.resize((180,120));pixels=list(im.getdata());lum=[(.2126*r+.7152*g+.0722*b)/255 for r,g,b in pixels]
  check('daylight_average',sum(lum)/len(lum)>.30);check('no_large_black_background',sum(l<.045 for l in lum)/len(lum)<.08)
  check('sand_visible',sum(r>g*1.02 and g>b*1.035 and r>130 for r,g,b in pixels)>130)
  check('water_visible',sum(b>r*1.08 and b>65 for r,g,b in pixels)>1000)
  page.evaluate('OceanIsland.pause()');page.wait_for_timeout(200)
  t0=page.evaluate('OceanIsland.getState().physicalTime');frame0=page.evaluate('OceanIsland.qa.sceneFrames');page.wait_for_timeout(700)
  check('pause_holds_simulation',page.evaluate('OceanIsland.getState().physicalTime')==t0)
  check('pause_reuses_scene',page.evaluate('OceanIsland.qa.sceneFrames')==frame0)
  page.locator('#panelToggle').click();page.wait_for_timeout(600);check('panel_opens',page.locator('#panelToggle').get_attribute('aria-expanded')=='true')
  first=grab(page,'glass-page1');page.wait_for_timeout(1000);second=grab(page,'glass-flow')
  region=(820,160,1180,680);diff=ImageStat.Stat(ImageChops.difference(first.crop(region),second.crop(region)))
  details['glass_flow_difference']=diff.mean;check('glass_flows_when_world_paused',sum(diff.mean)>.04)
  page.locator('[data-page="2"]').click();check('page2_visible',page.locator('#page-2').is_visible() and not page.locator('#page-1').is_visible());grab(page,'glass-page2')
  page.locator('[data-page="3"]').click();check('page3_visible',page.locator('#page-3').is_visible());grab(page,'glass-page3')
  page.evaluate("OceanIsland.setConfig('wind',20);OceanIsland.setConfig('windDir',90);OceanIsland.setConfig('turbulence',0)")
  a=page.evaluate('OceanIsland.sampleWind(0,10,0,0)');page.evaluate("OceanIsland.setConfig('windDir',270)");b=page.evaluate('OceanIsland.sampleWind(0,10,0,0)');check('shared_wind_direction_reverses',a[0]*b[0]<0)
  page.evaluate("OceanIsland.setConfig('wind',0)");check('zero_wind_reaches_consumer',abs(page.evaluate('OceanIsland.sampleWind(0,10,0,0)[0]'))<1e-5)
  check('invalid_parameter_rejected',not page.evaluate("OceanIsland.setConfig('unimplementedParameter',1)"))
  check('range_clamp',page.evaluate("OceanIsland.setConfig('wind',500);OceanIsland.getState().config.wind")==24)
  page.evaluate("OceanIsland.setConfig('wind',12);OceanIsland.setConfig('windDir',250);OceanIsland.setConfig('turbulence',.8)")
  page.evaluate("OceanIsland.setConfig('fireCount',4);OceanIsland.setConfig('radius',31)");page.wait_for_function("OceanIsland.getSources().length===4",timeout=20000)
  check('geometry_control_applies',page.evaluate('OceanIsland.getSources().length')==4)
  check('sources_stay_on_island',page.evaluate('OceanIsland.getSources().every(p=>p[1]>0)'))
  page.evaluate("OceanIsland.setConfig('fireCount',3);OceanIsland.setConfig('radius',27)");page.wait_for_timeout(600)
  page.locator('#panelClose').click();page.wait_for_timeout(400)
  for view in ('shore','breaker','rocks','fire','top'):
   page.evaluate('(v)=>OceanIsland.setView(v,true)',view);page.wait_for_timeout(400);grab(page,view)
   check(view+'_no_runtime_error',page.locator('#error').is_hidden())
  page.evaluate('OceanIsland.play()');page.wait_for_timeout(900);check('resume_advances',page.evaluate('OceanIsland.getState().physicalTime')>t0+.05)
  details['finalQA']=page.evaluate('OceanIsland.qa');check('no_GL_errors',not details['finalQA'].get('glErrors'))
  # Desktop pointer/transition and complete state carry-over.
  page.locator('[data-view="overview"]').click();page.wait_for_timeout(1100);check('camera_transition_completes',page.evaluate("OceanIsland.qa.view==='overview'"))
  # No external requests are made by the island source. Deep iframe is tested separately below.
  check('no_request_failures',not requests_failed);check('no_js_or_console_errors',not errors)
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile_errors=[];mobile.on('pageerror',lambda e:mobile_errors.append(str(e)))
  mr=mobile.goto(URL+'?qa=1&mobile=1',wait_until='networkidle',timeout=60000);mobile.wait_for_function('window.OceanIsland?.qa.ready === true',timeout=60000);mobile.wait_for_timeout(800);grab(mobile,'mobile')
  check('mobile_http_ready',mr.status==200 and not mobile_errors)
  check('mobile_no_horizontal_overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  mobile.locator('#panelToggle').tap();mobile.wait_for_timeout(500);mobile.locator('[data-page="2"]').tap();grab(mobile,'mobile-page2')
  check('mobile_tabs_usable',mobile.locator('#page-2').is_visible());check('mobile_parameters_present',mobile.locator('input[type=range]').count()==102)
  details['mobileQA']=mobile.evaluate('OceanIsland.qa');check('mobile_no_GL_errors',not details['mobileQA'].get('glErrors'))
  # Only public mode requires the existing deep ocean to be published and skinned.
  if URL.startswith('https:'):
   page.locator('#deepTab').click();page.wait_for_timeout(1500)
   frame=page.frame_locator('#deepFrame');check('deep_controls_present',frame.locator('#panel').count()==1)
   check('deep_glass_skin_applied',page.evaluate("document.getElementById('deepFrame').contentDocument.documentElement.dataset.oceanGlassSkin==='r017'"))
   grab(page,'public-deep');page.locator('#coastTab').click();page.wait_for_timeout(500);check('return_to_island',page.locator('#scene').is_visible())
  mobile.close()
 else:
  check('ready',False);grab(page,'failed-start');details['html']=page.content()[-6000:]
 browser.close()
report={'status':'PASS' if all(checks.values()) else 'FAIL','checksPassed':sum(checks.values()),'checksFailed':sum(not v for v in checks.values()),'checks':checks,'details':details,'errors':errors,'requestsFailed':requests_failed,'url':URL,'note':'Chromium SwiftShader; mobile viewport simulation, not a physical iPhone test','visualApproved':False,'productionApproved':False}
(OUT/'BROWSER_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='details'},ensure_ascii=False,indent=2))
if report['status']!='PASS':sys.exit(1)
