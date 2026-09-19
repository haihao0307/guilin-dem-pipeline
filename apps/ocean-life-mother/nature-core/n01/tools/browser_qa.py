from pathlib import Path
import json, hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
html=(R/'qa/NATURE_MOTION_INTERNAL.html').read_text()
report={'scope':'Actual independent motion core, inline natural evidence and Canvas2D diagnostic. Not fish appearance, WebGL, wild-behavior or public-workbench validation.','transport':'set_content','networkPolicy':'all outbound requests blocked and counted','htmlSha256':hashlib.sha256(html.encode()).hexdigest(),'viewports':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for W,H in [(1280,900),(390,844)]:
  page=browser.new_page(viewport={'width':W,'height':H},device_scale_factor=1)
  errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def reject(route):
   requests.append(route.request.url);route.abort()
  page.route('**/*',reject)
  page.set_content(html,wait_until='load');page.wait_for_function('Boolean(window.NatureLab)')
  page.wait_for_timeout(200)
  animation=page.evaluate('NatureLab.getState()')
  page.evaluate("NatureLab.reset('hold');NatureLab.freeze();")
  hold=page.evaluate('NatureLab.advanceSeconds(10)')
  assert abs(hold['positionM'][0])<1e-10
  assert abs(hold['phaseCycles']-20.7)<1e-10
  assert abs(hold['frequencyHz']-2.07)<1e-12
  page.screenshot(path=str(R/f'qa/hold-{W}.png'))
  page.click('#cruise');page.evaluate("NatureLab.reset('cruise');NatureLab.freeze();")
  before=page.evaluate('NatureLab.getState()')
  page.click('#fast');after_control=page.evaluate('NatureLab.getState()')
  assert before['phaseCycles']==after_control['phaseCycles']
  ramp=page.evaluate('NatureLab.advanceSeconds(2)')
  assert abs(ramp['frequencyHz']-3.29)<1e-12
  assert abs(ramp['phaseCycles']-5.36)<1e-10
  page.screenshot(path=str(R/f'qa/ramp-{W}.png'))
  page.click('#adult');adult_note=page.locator('#warning').inner_text();assert '已拒绝' in adult_note
  page.wait_for_timeout(100);paused=page.evaluate('NatureLab.getState()');assert paused['timeS']==ramp['timeS']
  pixel_count=page.evaluate("(()=>{const c=document.getElementById('signal'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4)if(a[i])n++;return n;})()")
  overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
  r={'size':[W,H],'pageErrors':errors,'attemptedNetworkRequests':requests,'animationAdvances':animation['timeS']>0,'hold':hold,'ramp':ramp,'phaseUnchangedOnControl':before['phaseCycles']==after_control['phaseCycles'],'pauseStable':paused['timeS']==ramp['timeS'],'unsupportedAdultRejected':True,'canvasNonTransparentPixels':pixel_count,'horizontalOverflow':overflow}
  report['viewports'].append(r)
  assert not errors and not requests and not overflow and pixel_count>0
  page.close()
 browser.close()
report['pass']=all(not x['pageErrors']and not x['attemptedNetworkRequests']and not x['horizontalOverflow']and x['animationAdvances']for x in report['viewports'])
(R/'qa/BROWSER.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
