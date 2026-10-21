import http.server, threading, pathlib, json, time, argparse, functools
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--base');args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[4];out=pathlib.Path('elevator-evidence');out.mkdir(exist_ok=True)
server=None
if not args.base:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
base=args.base or f'http://127.0.0.1:{server.server_port}/kaopu-geography-workbench/kowloon-building-mother-r01/elevator-mother-r01/'
errors=[];checks=[];result={'passed':False,'base':base,'checks':checks,'errors':errors,'limits':'Chromium SwiftShader desktop and 390px viewport simulation; not iPhone hardware or certified elevator behavior.'}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto(base);page.wait_for_function("document.body.dataset.ready",timeout=90000)
  assert page.get_attribute('body','data-ready')=='true',page.locator('#failure').inner_text()
  page.evaluate('kaopuLift.pause(true)');page.screenshot(path=str(out/'desktop-overview.png'),full_page=True)
  snap=lambda:page.evaluate('kaopuLift.snapshot()')
  tick=lambda t:page.evaluate('(t)=>kaopuLift.advance(t)',t)
  page.locator('#doorDetail').click();tick(0);page.locator('.stage').screenshot(path=str(out/'stainless-door-close.png'))
  page.locator('#lightShift').evaluate("e=>{e.value='1.5';e.dispatchEvent(new Event('input',{bubbles:true}))}");tick(0);page.locator('.stage').screenshot(path=str(out/'stainless-light-shift.png'))
  page.locator('#doorFinish').select_option('1');tick(0);page.locator('.stage').screenshot(path=str(out/'paint-door-close.png'))
  page.locator('#doorFinish').select_option('0');page.locator('#lightShift').evaluate("e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}))}");page.locator('#overview').click();tick(0)
  checks.append('actual close stainless / master R06 paint / translated rectangular illumination screenshots, visual acceptance separate')
  page.locator('[data-floor="B2"] button').first.click();tick(4)
  page.screenshot(path=str(out/'car-in-motion.png'),full_page=True)
  moving=snap();assert moving['v']<0 and moving['carLock'] and all(moving['locks'].values())
  page.locator('#openDoor').click();assert snap()['carDoor']==0
  tick(6);arrived=snap();assert arrived['current']=='B2' and arrived['v']==0 and arrived['carDoor']>0
  checks.append('hall call B2, interlocked travel, reject open during travel, stationary arrival')
  page.locator('#closeup').click();tick(0);page.screenshot(path=str(out/'car-at-B2-open.png'),full_page=False)
  tick(1);page.locator('[data-car="L1"]').click();page.locator('#closeDoor').click();tick(.6);assert 0<snap()['carDoor']<1
  page.locator('#obstruction').click();tick(2);assert snap()['state']=='OBSTRUCTION_HOLD' and snap()['carDoor']==1
  page.screenshot(path=str(out/'obstruction-hold.png'),full_page=False)
  tick(20);assert snap()['current']=='B2' and snap()['v']==0
  page.locator('#obstruction').click();tick(22);assert snap()['current']=='L1'
  checks.append('car select L1, obstacle during closing reopens and holds, clear serves queued request')
  page.locator('#ground').select_option('F');page.locator('#basements').select_option('1');page.locator('#height').fill('4');page.locator('#rebuild').click();assert [f['label'] for f in snap()['floors']]==['B1','F','1'];assert snap()['floors'][0]['elevation']==-4
  page.locator('[data-served="B1"]').uncheck();page.locator('#applyFloors').click();assert page.locator('[data-car="B1"]').is_disabled()
  page.locator('[data-elevation="L1"]').fill('0');page.locator('#applyFloors').click();assert page.locator('#configError').inner_text()
  checks.append('G/F, basement count, floor height, served subset, invalid overlapping elevation rejection')
  page.evaluate('kaopuLift.reset()');page.locator('#overview').click();tick(0)
  page.set_viewport_size({'width':390,'height':844});tick(0);assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.screenshot(path=str(out/'mobile-390.png'),full_page=False)
  page.locator('#scene').scroll_into_view_if_needed();page.screenshot(path=str(out/'mobile-shaft.png'),full_page=False)
  checks.append('390px viewport layout, no horizontal overflow; not iPhone hardware')
  touch=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
  tp=touch.new_page();tp.on('pageerror',lambda e:errors.append(str(e)));tp.goto(base);tp.wait_for_function("document.body.dataset.ready==='true'",timeout=90000)
  tp.locator('[data-floor="B2"] button').first.tap();tp.wait_for_function('Math.abs(kaopuLift.snapshot().v)>.02',timeout=20000)
  real_before=tp.evaluate('kaopuLift.snapshot()');wall=time.monotonic();tp.wait_for_timeout(1500);real_after=tp.evaluate('kaopuLift.snapshot()')
  assert real_after['y']<real_before['y'];assert real_after['carLock'] and all(real_after['locks'].values())
  result['animationObservation']={'wallSeconds':time.monotonic()-wall,'simulationDeltaSeconds':real_after['time']-real_before['time'],'positionDeltaM':real_after['y']-real_before['y'],'renderer':'Chromium SwiftShader; not hardware FPS'}
  touch.close();checks.append('mobile touch hall call advances through actual requestAnimationFrame while locked')
  assert not errors,errors
  result.update(passed=True,stats=page.evaluate('kaopuLift.stats()'),lastSnapshot=snap())
 except Exception as e:
  errors.append(str(e));page.screenshot(path=str(out/'failure.png'),full_page=False);raise
 finally:
  (out/'receipt.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));browser.close()
  if server:server.shutdown()
