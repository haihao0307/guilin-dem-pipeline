"""Actual isolated R09 candidate browser gate. Reuses unchanged authorized workflow."""
import functools,http.server,json,threading,traceback,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
report={'passed':False,'scope':'Same-page KCC unregistered 3D candidate; no production deployment','physicalDeviceTested':False,'errors':[],'frames':{},'checks':[]}
def save():(out/'kcc-candidate-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/kcc-layout-candidate-r09/index.html'
browser=None;page=None
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1366,'height':900},device_scale_factor=1);page.set_default_timeout(180000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.semanticInspection?.ready&&!semanticInspection.busy')
  report['browserVersion']=browser.version
  frozen=page.evaluate('JSON.stringify(semanticInspection.model.levels)')
  page.locator('[data-building=kcc]').click();page.wait_for_function('!semanticInspection.busy')
  assert page.locator('#candidateStructurePanel').is_visible()
  assert not page.locator('#kccCandidateCanvas').is_visible()
  assert '非一比一验收' in page.locator('#candidateStructurePanel').inner_text()
  panel=page.locator('#candidateStructurePanel')
  panel.get_by_role('button',name='打开三维结构候选',exact=True).click()
  def settle(before=-1):
   page.wait_for_function('n=>{const s=semanticInspection.candidateViewer.state;return s.errors.length||s.ready&&!s.busy&&s.frames.length>n}',arg=before)
   errors=page.evaluate('semanticInspection.candidateViewer.state.errors');assert not errors,errors
  def capture(name):
   settle();q=page.evaluate('''()=>{const v=semanticInspection.candidateViewer,r=v.renderer,g=r.gl,p=r.readPixels(),colors=new Set();for(let i=0;i<p.length;i+=4)colors.add(p[i]+256*p[i+1]+65536*p[i+2]);const hitIds={};for(let y=8;y<r.canvas.height;y+=16)for(let x=8;x<r.canvas.width;x+=16){const h=r.readHit(x,y);if(h.objectId>=10000)hitIds[h.objectId]=(hitIds[h.objectId]||0)+1;}return {snapshot:v.snapshot(),colors:colors.size,hitIds,registry:r.semanticRegistry,rect:r.canvas.getBoundingClientRect().toJSON(),canvas:{w:r.canvas.width,h:r.canvas.height},glError:g.getError(),gpu:r.gpu};}''')
   assert q['colors']>20,(name,q['colors']);assert len(q['hitIds'])>5,(name,q['hitIds']);assert q['glError']==0
   assert abs(q['rect']['width']-q['canvas']['w'])<2 and q['canvas']['h']==480
   image=page.locator('#kccCandidateCanvas').screenshot(path=str(out/(name+'.png')))
   q['screenshotSHA256']=hashlib.sha256(image).hexdigest();report['frames'][name]=q;save();print('CAPTURE',name,q['snapshot']['frames'][-1]['wallMs'],flush=True);return q
  first=capture('candidate-floor5-lowwall')
  def action(fn):
   n=page.evaluate('semanticInspection.candidateViewer.state.frames.length');fn();settle(n)
  action(lambda:panel.get_by_role('button',name='打开入户门 / 梯门',exact=True).click())
  opened=capture('candidate-floor5-entrydoors-open');assert opened['screenshotSHA256']!=first['screenshotSHA256']
  for i in range(1,4):
   action(lambda i=i:panel.get_by_role('button',name=f'开/关电梯{i}门',exact=True).click())
  lifts=capture('candidate-floor5-all-lift-doors-open');assert lifts['snapshot']['values']['liftOpen']==[1,1,1]
  action(lambda:panel.get_by_role('button',name='低墙剖视 / 完整墙高',exact=True).click());capture('candidate-floor5-fullwall')
  action(lambda:panel.locator('[data-candidate-floor]').select_option('6'));six=capture('candidate-floor6-platforms');assert six['snapshot']['modelPrimitiveCount']==123
  action(lambda:panel.locator('[data-candidate-floor]').select_option('18'));eighteen=capture('candidate-floor18-family');assert eighteen['snapshot']['modelPrimitiveCount']==104
  action(lambda:panel.locator('select').nth(1).select_option('R180'));capture('candidate-floor18-R180-unregistered')
  assert page.evaluate('JSON.stringify(semanticInspection.model.levels)')==frozen
  page.locator('[data-building=warehouse]').click();assert not panel.is_visible();assert not page.evaluate('semanticInspection.candidateViewer.snapshot().active')
  assert not report['errors'],report['errors']
  report['checks']=['actual WebGL displayed nonblank analytic geometry','same-page KCC only visibility','native CSS pixel resolution','entry door state changes screenshot','three independent elevator door controls','cut/full wall state','6F platforms and 18F separate family','R180 explicitly unregistered','original levels unchanged','switching other building pauses candidate'];report['passed']=True;save();browser.close();browser=None
except Exception:
 report['errors'].append(traceback.format_exc());save()
 if page:
  try:page.screenshot(path=str(out/'candidate-failure.png'),full_page=True)
  except Exception:pass
finally:
 if browser:
  try:browser.close()
  except Exception:pass
 server.shutdown();save()
if not report['passed']:print(report['errors'],flush=True);raise SystemExit(1)
print('Actual KCC candidate browser gate passed',flush=True)
