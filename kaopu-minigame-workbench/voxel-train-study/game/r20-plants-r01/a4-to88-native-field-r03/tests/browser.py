import argparse,json,pathlib,time
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops
ap=argparse.ArgumentParser();ap.add_argument('--url',required=True);ap.add_argument('--output',required=True);a=ap.parse_args();out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
results=[];errors=[]
def check(name,ok,detail=None):
 results.append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok:raise AssertionError(name+': '+str(detail))
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
  page.on('pageerror',lambda e:errors.append(str(e)))
  t=time.time();page.goto(a.url,wait_until='networkidle');page.wait_for_function('window.trainField?.stats.ready',timeout=90000)
  s=page.evaluate('trainField.stats');check('actual WebGL field ready',s['ready'],s);check('no compiler or page errors',not errors,errors)
  page.screenshot(path=str(out/'01-overall.png'))
  check('no shape triangles or geometry rebuilds',s['authoritativeShapeTriangles']==0 and s['geometryRebuilds']==0)
  check('bounded small shared shader',s['shaderCompiles']==1 and s['partCount']==4,s)
  probes=page.evaluate('''()=>{let r=[];let parts=trainField.getState().parts;for(let k=0;k<parts.length;k++){let p=parts[k];for(let i=0;i<8;i++){let q=p.bounds[0].map((x,j)=>x+(p.bounds[1][j]-x)*(.12+.1*((i*(j+2))%8)));r.push({part:k,point:q,...trainField.probe(k,q)});}}trainField.render();return r}''')
  check('GPU CPU field parity 32 real probes',all(abs(x['gpu']-x['cpu'])<.0001 for x in probes),{'maxError':max(abs(x['gpu']-x['cpu']) for x in probes)})
  (out/'gpu-field-probes.json').write_text(json.dumps(probes,indent=2))
  axes=page.evaluate('trainField.getState().wheelDatums');check('ten datums retain unknown physical profile',len(axes)==10 and all(x['profile'] is None for x in axes))
  page.locator('[data-param="noseSweep"]').focus();page.locator('[data-param="noseSweep"]').press('End');page.wait_for_timeout(1500)
  check('shape control edits source field',page.evaluate('trainField.getState().params.noseSweep')==.25)
  check('shape change preserves official axes',page.evaluate('trainField.getState().wheelDatums')==axes)
  page.screenshot(path=str(out/'02-shape-edit.png'))
  page.locator('[data-param="roughness"]').focus();page.locator('[data-param="roughness"]').press('End');page.wait_for_timeout(1500);page.screenshot(path=str(out/'03-material-edit.png'))
  check('material edit does not compile or rebuild geometry',page.evaluate('trainField.stats.shaderCompiles')==1 and page.evaluate('trainField.stats.geometryRebuilds')==0)
  before=Image.open(out/'02-shape-edit.png').convert('RGB');after=Image.open(out/'03-material-edit.png').convert('RGB');diff=ImageChops.difference(before,after);changed=sum(1 for r,g,b in diff.getdata() if max(r,g,b)>5)
  check('material edit changes actual pixels',changed>300,{'changedPixels':changed})
  page.locator('[data-part="cab"]').click();page.wait_for_timeout(1200);check('cab isolate retains separate material pane',page.evaluate('trainField.stats.partCount')==2);page.screenshot(path=str(out/'04-cab.png'))
  page.locator('[data-part="tender"]').click();page.wait_for_timeout(1200);check('tender isolate',page.evaluate('trainField.stats.partCount')==1);page.screenshot(path=str(out/'05-tender.png'))
  page.locator('[data-part="all"]').click();page.locator('#side').click();page.locator('#datum-toggle').check();page.wait_for_timeout(1400);check('measurement datums available but not physical wheels',page.locator('[data-axle]').count()==10);page.screenshot(path=str(out/'06-side-datums.png'))
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(1500);check('mobile no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(out/'07-mobile.png'))
  check('no WebGL error after full lifecycle',not page.evaluate('trainField.stats.errors'),page.evaluate('trainField.stats'))
  check('no page errors after full lifecycle',not errors,errors)
  browser.close()
finally:
 (out/'browser-results.json').write_text(json.dumps({'results':results,'errors':errors,'completeVehicle':False,'screenshotsAreInternalQA':True},indent=2))
