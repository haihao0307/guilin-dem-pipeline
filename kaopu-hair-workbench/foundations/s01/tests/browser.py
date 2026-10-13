"""Actual browser test against a local candidate OR immutable public HTTPS URL.
No screenshots or timings from the local suite are labelled public."""
import functools,hashlib,http.server,json,os,pathlib,sys,threading,time
from playwright.sync_api import sync_playwright
P=pathlib.Path(__file__).resolve().parents[1];url=sys.argv[1] if len(sys.argv)>1 else 'local';mode='candidate' if url=='local' else 'public';out=P/'evidence'/mode;out.mkdir(parents=True,exist_ok=True)
server=None
if url=='local':
 server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(P/'site')));threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:8765/'
checks=[];errors=[];report={'url':url,'mode':mode,'checks':checks,'errors':errors,'phoneScope':'390x844 viewport only, not a phone device'}
def check(name,value,detail=None):
 checks.append({'name':name,'pass':bool(value),'detail':detail});print(('PASS ' if value else 'FAIL ')+name,flush=True)
 if not value:raise AssertionError(name)
def snap(page,name):page.wait_for_timeout(300);page.screenshot(path=str(out/(name+'.png')))
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if os.environ.get('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
 browser=p.chromium.launch(**opts);context=browser.new_context(viewport={'width':1320,'height':940},accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));console_errors=[];page.on('console',lambda e:console_errors.append(e.text) if e.type=='error' else None)
 try:
  t=time.monotonic();response=page.goto(url,wait_until='load',timeout=60000);check('HTTP 200',response.status==200);received=response.body();manifest=json.loads((P/'site/BUILD_MANIFEST.json').read_text());check('Exact tested HTML hash',hashlib.sha256(received).hexdigest()==manifest['htmlSha256']);page.wait_for_function('window.s01?.ready===true',timeout=60000);report['coldReadySeconds']=time.monotonic()-t
  resource_hashes={}
  for name,meta in manifest['files'].items():
   result=context.request.get(url+name);blob=result.body();resource_hashes[name]={'status':result.status,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()};check('Exact public/candidate resource '+name,result.status==200 and resource_hashes[name]['sha256']==meta['sha256'] and len(blob)==meta['bytes'])
  report['resourceHashes']=resource_hashes
  initial=page.evaluate('s01.stats()');report['initial']=initial;binding=initial['rootBindingHash'];check('Runtime matches tested source',initial['source']==manifest['source']);check('One original head, no full hairstyle',initial['visibleHeadMeshes']==1 and not initial['hasFullHair']);check('Roots visible and no out-of-domain activation',initial['activeRoots']>1000 and initial['outsideRoots']==0);snap(page,'three')
  for v in ['front','left','right','back','top']:
   page.click('[data-view="'+v+'"]');snap(page,v);check('Actual camera button '+v,page.evaluate('s01.stats().rootBindingHash')==binding)
  page.select_option('#mode','distance');snap(page,'distance');check('Distance display selectable',page.input_value('#mode')=='distance');page.select_option('#mode','density');snap(page,'density');check('Density field selectable',page.input_value('#mode')=='density');page.select_option('#mode','clay');snap(page,'clay');page.select_option('#mode','domain')
  rail=page.locator('#density').bounding_box();page.mouse.click(rail['x']+rail['width']*.40,rail['y']+rail['height']/2);reduced=page.evaluate('s01.stats()');check('Pointer density change keeps root bindings',reduced['rootBindingHash']==binding and reduced['activeRoots']<initial['activeRoots']*.6);page.locator('#density').focus();page.keyboard.press('End');check('Restore density restores exact active count',page.evaluate('s01.stats().activeRoots')==initial['activeRoots'])
  page.check('#normal');page.locator('#probe').focus();page.keyboard.press('End');snap(page,'normal-probes');check('Probe length independent of bindings',page.evaluate('s01.stats().rootBindingHash')==binding);page.uncheck('#normal');page.check('#tangent');snap(page,'test-tangents');page.uncheck('#tangent')
  page.locator('#shape').focus();page.keyboard.press('End');changed=page.evaluate('s01.stats()');check('Same-topology deformation moves head but not root IDs',changed['positionHash']!=initial['positionHash'] and changed['rootBindingHash']==binding);snap(page,'binding-stress');page.locator('#shape').evaluate("e=>{e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}))}")
  page.click('[data-view="front"]');page.wait_for_timeout(300)
  root=page.evaluate("()=>{const id=s01.active().find(id=>{const r=s01.root(id).position;return r[2]>.075&&Math.abs(r[0])<.035&&r[1]>.356&&r[1]<.38});return {id,xy:s01.inspectProjection(id)}}")
  page.mouse.click(root['xy']['x'],root['xy']['y']);check('Actual pointer picks a surface root',page.evaluate('s01.pick()?.inside===true'));original_mask=page.evaluate('s01.stats().maskHash');page.select_option('#tool','erase');before_png=page.locator('canvas').screenshot(path=str(out/'before-erase-canvas.png'));page.mouse.click(root['xy']['x'],root['xy']['y']);edited=page.evaluate('s01.stats()');check('Actual surface brush removes roots and preserves bindings',edited['maskHash']!=original_mask and edited['rootBindingHash']==binding and edited['activeRoots']<initial['activeRoots'],{'before':initial['activeRoots'],'after':edited['activeRoots']});snap(page,'edited-domain');after_png=page.locator('canvas').screenshot(path=str(out/'after-erase-canvas.png'));check('Actual canvas PNG changes after erase',hashlib.sha256(before_png).hexdigest()!=hashlib.sha256(after_png).hexdigest());page.click('#undo');check('Undo restores exact mask and roots',page.evaluate('s01.stats().maskHash')==original_mask and page.evaluate('s01.stats().activeRoots')==initial['activeRoots']);page.click('#redo');check('Redo restores edit',page.evaluate('s01.stats().maskHash')==edited['maskHash']);page.select_option('#tool','add');page.mouse.click(root['xy']['x'],root['xy']['y']);check('Add brush visibly restores root activation',page.evaluate('s01.stats().activeRoots')>edited['activeRoots']);snap(page,'added-domain');page.click('#undo');page.click('#undo');page.select_option('#tool','thin');page.select_option('#mode','density');page.mouse.click(root['xy']['x'],root['xy']['y']);thin=page.evaluate('s01.stats()');check('Actual density brush changes roots but not domain',thin['maskHash']==original_mask and thin['activeRoots']<initial['activeRoots']);snap(page,'density-brush');page.click('#undo');page.select_option('#tool','inspect');page.select_option('#mode','domain')
  page.click('#save');page.click('#reset');page.click('#load');check('Local save/load restores fields',page.evaluate('s01.stats().maskHash')==original_mask)
  with page.expect_download() as dl:page.click('#export')
  fn=out/'export.json';dl.value.save_as(str(fn));archive=json.loads(fn.read_text());check('Actual JSON download has current topology',archive['topology']==manifest['topology']);page.locator('details').first.locator('summary').click();page.locator('#json').fill('{"schema":"wrong"}');page.click('#import');check('Invalid import rejected without changing mask',page.evaluate('s01.stats().maskHash')==original_mask and '未导入' in page.inner_text('#status'))
  page.reload(wait_until='load');page.wait_for_function('window.s01?.ready===true',timeout=60000);page.click('#load');check('Refresh and explicit load retain saved data',page.evaluate('s01.stats().maskHash')==original_mask)
  mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1);mp=mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)));mp.goto(url,wait_until='load');mp.wait_for_function('window.s01?.ready===true',timeout=60000);snap(mp,'mobile-view');mp.click('#openPanel');snap(mp,'mobile-controls');check('Mobile viewport has visible controls and no horizontal overflow',mp.locator('aside').is_visible() and mp.evaluate('document.documentElement.scrollWidth<=innerWidth'));mobile.close()
  check('No runtime JavaScript errors',not errors,errors);check('No console or shader errors',not console_errors,console_errors);report['success']=True
 except Exception as e:
  report['success']=False;report['failure']=repr(e)
  try:snap(page,'failure')
  except:pass
 finally:
  report['consoleErrors']=console_errors;report['browserVersion']=browser.version;report['finishedUTC']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
if server:server.shutdown()
if not report['success']:raise SystemExit(1)
