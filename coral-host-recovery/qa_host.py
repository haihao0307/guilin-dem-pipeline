from pathlib import Path
import base64, gzip, hashlib, json, os, random, string, sys, time
from playwright.sync_api import sync_playwright

base=sys.argv[1].rstrip('/')+'/'
out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
# Synthetic shader tests the generic HTTP host only. This is not coral or visual-acceptance evidence.
rng=random.Random(17)
fixture='#version 300 es\nprecision highp float;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;out vec4 fragColorOut;void main(){vec2 q=gl_FragCoord.xy/iResolution.xy;fragColorOut=vec4(q.x,q.y,0.5+0.4*sin(iTime),1.);}\n//'+''.join(rng.choice(string.ascii_letters) for _ in range(4600))
data={'schema':'coral-user-source-replay/1','sourceFile':'SYNTHETIC_HOST_TEST_NOT_CORAL.glsl','sha256':hashlib.sha256(fixture.encode()).hexdigest(),'fragment':fixture,'notice':'Synthetic test only, not teacher content.'}
packed=base64.urlsafe_b64encode(gzip.compress(json.dumps(data).encode(),mtime=0)).decode().rstrip('=')
url=base+'?qa=host-20261003#view=rosette&replay='+packed
report={'url':base,'test':'generic-host-only','teacherShaderTested':False,'testFragmentCharacters':len(packed),'checks':{},'errors':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page=ctx.new_page();requests=[]
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.on('request',lambda r:requests.append(r.url))
  response=page.goto(url,wait_until='domcontentloaded',timeout=60000)
  report['httpStatus']=response.status;report['contentType']=response.headers.get('content-type')
  page.wait_for_function('window.CoralRecoveryState?.ready || window.CoralRecoveryState?.error',timeout=30000)
  assert page.evaluate('CoralRecoveryState.ready'),page.evaluate('CoralRecoveryState')
  report['checks']['ready']=True
  report['checks']['sourceHash']=page.evaluate('CoralRecoveryState.sourceSHA256')==data['sha256']
  report['checks']['noFilePicker']=page.locator('input[type=file]').count()==0
  report['checks']['noImageStandin']=page.locator('img').count()==0
  sig=page.evaluate('CoralRecovery.pixelSignature()')
  report['checks']['bothCanvasOutputsEqual']=sig==page.evaluate('CoralRecovery.pixelSignature("teacher")')
  n=page.evaluate('CoralRecoveryState.draws');page.wait_for_timeout(250)
  report['checks']['pauseStopsRendering']=n==page.evaluate('CoralRecoveryState.draws')
  page.evaluate('CoralRecovery.seek(6)');page.wait_for_function('CoralRecoveryState.draws>'+str(n),timeout=15000)
  report['checks']['seekChangesPixels']=sig!=page.evaluate('CoralRecovery.pixelSignature()')
  page.locator('#reset').click();page.wait_for_timeout(250)
  report['checks']['resetRestoresPixels']=sig==page.evaluate('CoralRecovery.pixelSignature()')
  page.locator('#play').click();page.wait_for_timeout(250);page.locator('#home').click()
  n=page.evaluate('CoralRecoveryState.draws');page.wait_for_timeout(250)
  report['checks']['homeStopsRendering']=n==page.evaluate('CoralRecoveryState.draws')
  report['checks']['homeVisible']=page.locator('#view-home').is_visible()
  for x in ['blue','color','staghorn','ledger','rosette']:
   page.locator('[data-view="'+x+'"]').click();assert page.locator('#view-'+x).is_visible()
   page.locator('#know').click();assert page.locator('#drawer').is_visible();page.locator('#closeKnow').click()
  report['checks']['allInternalButtons']=True
  page.reload(wait_until='domcontentloaded');page.wait_for_function('CoralRecoveryState.ready',timeout=20000)
  report['checks']['reloadWithoutManualImport']=True
  page.goto(base+'?qa=stored-source#view=rosette',wait_until='domcontentloaded');page.wait_for_function('CoralRecoveryState.ready',timeout=20000)
  report['checks']['storedSourceRestoresAutomatically']=page.evaluate('CoralRecoveryState.sourceSHA256')==data['sha256']
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
  report['checks']['mobileNoHorizontalOverflow']=page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  report['checks']['noFragmentSentInHTTP']=all('#' not in x and 'replay=' not in x for x in requests)
  report['finalState']=page.evaluate('CoralRecoveryState');ctx.close()
  ctx=browser.new_context();ctx.add_init_script("(()=>{const o=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:o.call(this,t,...a)}})()")
  pg=ctx.new_page();pg.goto(url,wait_until='domcontentloaded');pg.wait_for_function('CoralRecoveryState.error',timeout=15000)
  report['checks']['explicitWebGLFailure']=pg.evaluate('!CoralRecoveryState.ready && !!CoralRecoveryState.error')
  report['checks']['noImageFallbackOnFailure']=pg.locator('img').count()==0
  ctx.close();browser.close()
 assert all(report['checks'].values()),report
 assert not report['errors'],report
 report['passed']=True
except Exception as e:
 report['passed']=False;report['exception']=str(e);raise
finally:
 (out/'HOST_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
