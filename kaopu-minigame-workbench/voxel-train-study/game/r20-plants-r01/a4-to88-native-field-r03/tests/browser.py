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
  page.screenshot(path=str(out/'01-overall.png'));canvas_box=page.locator('canvas').bounding_box()
  crop=(round(canvas_box['x']),round(canvas_box['y']),round(canvas_box['x']+canvas_box['width']),round(canvas_box['y']+canvas_box['height']))
  check('no shape triangles or geometry rebuilds',s['authoritativeShapeTriangles']==0 and s['geometryRebuilds']==0)
  check('bounded small shared shader',s['shaderCompiles']==1 and s['partCount']==11,s)
  probes=page.evaluate('''()=>{let r=[];let parts=trainField.getState().parts;for(let k=0;k<parts.length;k++){let p=parts[k];for(let i=0;i<8;i++){let q=p.bounds[0].map((x,j)=>x+(p.bounds[1][j]-x)*(.12+.1*((i*(j+2))%8)));r.push({part:k,point:q,...trainField.probe(k,q)});}}trainField.render();return r}''')
  check('GPU CPU field parity 88 real probes',all(abs(x['gpu']-x['cpu'])<.0001 for x in probes),{'maxError':max(abs(x['gpu']-x['cpu']) for x in probes)})
  (out/'gpu-field-probes.json').write_text(json.dumps(probes,indent=2))
  material_probes=page.evaluate('()=>{let points=[[-1.505,1.1,2.99],[-1.505,-1.1,2.99],[-1.62,1.1,2.99],[-1.62,0,2.99],[-2.135,1.1,3.23],[-2.0,1.1,3.6]];let r=points.map(p=>({point:p,...trainField.probeMaterial(0,p)}));trainField.render();return r}')
  check('procedural 88 paint material CPU GPU agreement',all(max(abs(a-b) for a,b in zip(x['cpu'],x['gpu']))<.004 for x in material_probes),material_probes)
  (out/'material-field-probes.json').write_text(json.dumps(material_probes,indent=2))
  axes=page.evaluate('trainField.getState().wheelDatums');check('ten datums retain unknown physical profile',len(axes)==10 and all(x['profile'] is None for x in axes))
  page.locator('[data-param="noseSweep"]').focus();page.locator('[data-param="noseSweep"]').press('End');page.wait_for_timeout(1500)
  check('shape control edits source field',page.evaluate('trainField.getState().params.noseSweep')==.25)
  check('shape change preserves official axes',page.evaluate('trainField.getState().wheelDatums')==axes)
  page.screenshot(path=str(out/'02-shape-edit.png'))
  shape_diff=ImageChops.difference(Image.open(out/'01-overall.png').convert('RGB').crop(crop),Image.open(out/'02-shape-edit.png').convert('RGB').crop(crop));shape_pixels=sum(1 for r,g,b in shape_diff.getdata() if max(r,g,b)>5);check('shape edit changes canvas pixels, not only UI',shape_pixels>300,{'changedCanvasPixels':shape_pixels})
  page.locator('[data-param="roughness"]').focus();page.locator('[data-param="roughness"]').press('End');page.wait_for_timeout(1500);page.screenshot(path=str(out/'03-material-edit.png'))
  check('material edit does not compile or rebuild geometry',page.evaluate('trainField.stats.shaderCompiles')==1 and page.evaluate('trainField.stats.geometryRebuilds')==0)
  before=Image.open(out/'02-shape-edit.png').convert('RGB').crop(crop);after=Image.open(out/'03-material-edit.png').convert('RGB').crop(crop);diff=ImageChops.difference(before,after);changed=sum(1 for r,g,b in diff.getdata() if max(r,g,b)>5)
  check('material edit changes actual pixels',changed>300,{'changedPixels':changed})
  page.locator('[data-part="cab"]').click();page.wait_for_timeout(1200);check('cab isolate retains separate material pane',page.evaluate('trainField.stats.partCount')==3);page.screenshot(path=str(out/'04-cab.png'))
  page.locator('[data-part="tender"]').click();page.wait_for_timeout(1200);check('tender isolate',page.evaluate('trainField.stats.partCount')==4);page.screenshot(path=str(out/'05-tender.png'))
  page.locator('[data-part="all"]').click();page.locator('#side').click();page.locator('#datum-toggle').check();page.wait_for_timeout(1400);check('measurement datums available but not physical wheels',page.locator('[data-axle]').count()==10);page.screenshot(path=str(out/'06-side-datums.png'))
  catalog=page.evaluate('trainField.getState().measuredParts');check('five source-based measurement segments do not fake assembly',len(catalog)==5 and all(x['assemblyTransform'] is None and not x['fullPart'] for x in catalog))
  component_probes=[]
  for part in catalog:
   page.locator('[data-component="'+part['id']+'"]').click();page.wait_for_timeout(250);check('component '+part['id']+' runs independently',page.evaluate('trainField.stats.partCount')==1)
   r,h=part['size'][:2]
   for q in [[0,0,0],[r,0,0],[0,h,0],[r*.6,h*.4,r*.2]]:
    component_probes.append(page.evaluate('([id,p])=>({id,p,...trainField.probe(id,p)})',[part['id'],q]))
   page.evaluate('trainField.render()')
  check('twenty measured-component GPU CPU probes',all(abs(x['gpu']-x['cpu'])<.000002 for x in component_probes),{'maxError':max(abs(x['gpu']-x['cpu']) for x in component_probes)})
  (out/'component-field-probes.json').write_text(json.dumps(component_probes,indent=2))
  page.locator('[data-component="journal.coupled"]').click();page.wait_for_timeout(300);page.screenshot(path=str(out/'08-measured-journal.png'))
  page.locator('[data-part="all"]').click();page.wait_for_timeout(250)
  c=page.locator('canvas').bounding_box();page.mouse.move(c['x']+c['width']*.6,c['y']+c['height']*.45);page.mouse.down();page.mouse.move(c['x']+c['width']*.21,c['y']+c['height']*.54,steps=20);page.mouse.up();page.wait_for_timeout(400);check('pointer orbit changes view without rebuilding geometry',abs(page.evaluate('trainField.getState().state.yaw'))>1 and page.evaluate('trainField.stats.geometryRebuilds')==0);page.screenshot(path=str(out/'09-opposite-orbit.png'))
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(1500);check('mobile no overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(out/'07-mobile.png'))
  check('no WebGL error after full lifecycle',not page.evaluate('trainField.stats.errors'),page.evaluate('trainField.stats'))
  check('no page errors after full lifecycle',not errors,errors)
  browser.close()
finally:
 (out/'browser-results.json').write_text(json.dumps({'results':results,'errors':errors,'completeVehicle':False,'screenshotsAreInternalQA':True},indent=2))
