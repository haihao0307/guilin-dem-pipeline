"""Exercise original common person, original material and original solver; failures stay failures."""
from pathlib import Path
import base64,gzip,hashlib,json,os,time,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;A=P/'assets';D=P/'qa';D.mkdir(exist_ok=True)
PUBLIC=os.environ.get('R04_BASE','').startswith('https:');BASE=os.environ.get('R04_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/')
R={'url':BASE,'public':PUBLIC,'checks':[],'passed':False,'pageErrors':[],'httpErrors':[],'forbiddenProxyRequests':[],'physicalFitAccepted':False,'dynamicWearCertified':False,'mobileScope':'Chromium 390x844 viewport, not a physical phone'}
def check(name,ok,data=None):
 R['checks'].append({'name':name,'passed':bool(ok),'data':data});print('CHECK',name,bool(ok),flush=True)
def dump(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=b.new_page(viewport={'width':1440,'height':1080});page.on('pageerror',lambda e:R['pageErrors'].append(str(e)))
  page.on('response',lambda r:R['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  page.on('request',lambda r:R['forbiddenProxyRequests'].append(r.url) if '/presets/r03/' in r.url or '/presets/r034-' in r.url else None)
  page.goto(BASE+'?preset=J06',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.__R04?.state().ready',timeout=300000)
  s=page.evaluate('__R04.state()');R['initialState']=s
  lock=json.loads((A/'identity.json').read_text())
  check('Original common person byte identities, not an Anny substitute',s['person']==lock['person'] and s['commonVertexCount']==25417 and s['commonTriangleCount']==50624)
  check('60 exact original source patterns kept',s['sourcePresets']==60)
  check('One native original CommonViewer canvas',s['canvasCount']==1)
  if not PUBLIC:
   material=[]
   for row in json.loads((A/'catalogue.json').read_text())['rows']:
    page.evaluate('id=>__R04.select(id)',row['id']);page.evaluate('__R04.loadPaper()')
    page.wait_for_function('! ["meshing","boot"].includes(__R04.state().phase)',timeout=45000)
    v=page.evaluate('__R04.state()');material.append({'id':row['id'],'phase':v['phase'],'error':v['error'],'vertices':v['clothVertices'],'triangles':v['clothTriangles'],'binding':v['binding']})
    check('Native source material '+row['id'],v['clothVertices']>0 and v['binding']['paperSHA256']==row['decodedSHA256'] and v['binding']['recipeHash']==row['recipeHash'] and v['renderCoordinateErrorM']==0 and v['clothIndexMatchesNative'])
   dump(A/'MATERIAL_AUDIT.json',{'nativeMaterials':material,'sourceSizingUnchanged':True,'notSewn':True})
  solved={};cache=json.loads((A/'results/index.json').read_text())
  for id in (['J06','T01','P01'] if not PUBLIC else ['T01']):
   page.evaluate('id=>__R04.select(id)',id);page.evaluate('__R04.loadPaper()');page.wait_for_function('__R04.state().phase!=="meshing"',timeout=45000)
   before=page.evaluate('__R04.state()');check('Original material is the displayed mesh '+id,before['clothIndexMatchesNative'] and before['renderCoordinateErrorM']==0 and before['clothVertices']>0)
   if before['phase']=='paper':
    page.evaluate('__R04.sew()');page.wait_for_function('["done","failed"].includes(__R04.state().phase)',timeout=210000)
   result=page.evaluate('__R04.state()');solved[id]=result
   check('Real native solver returns a truthful outcome '+id,result['phase'] in ['done','failed'] and result['proxyGarment']==False)
   check('Solver output coordinates and triangle order are unmodified '+id,result['renderCoordinateErrorM']==0 and result['clothIndexMatchesNative'])
   page.locator('#stage').screenshot(path=str(D/(('public-' if PUBLIC else '')+id+'.png')))
   packet=page.evaluate('__R04.packet()')
   if packet and not PUBLIC:
    assert packet['record']['sourceBody']=='common-native-default-r04'
    data=json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode();compressed=gzip.compress(data,mtime=0);file=id+'.json.gz';(A/'results'/file).write_bytes(compressed)
    thumb=id+'.png';page.locator('#stage').screenshot(path=str(A/'results'/thumb))
    cache['rows'][id]={'file':file,'sha256':hashlib.sha256(compressed).hexdigest(),'thumb':thumb,'qualityPassed':bool(packet['record'].get('staticGate',{}).get('passed')),'kind':'ORIGINAL_SOLVER_RESULT','person':lock['person']}
   if not packet and not PUBLIC:cache.setdefault('failed',{})[id]={'phase':result['phase'],'reason':result['error'],'kind':'NO_FINISHED_RESULT_NOT_REPLACED'}
  R['nativeTrials']=solved
  if not PUBLIC:dump(A/'results/index.json',cache)
  preset=page.locator('#person option').nth(19).get_attribute('value')
  page.evaluate('id=>__R04.changePerson(id)',preset)
  changed=page.evaluate('__R04.state()')
  check('Original character preset changes actual common geometry',changed['person']['geometrySHA256']!=lock['person']['geometrySHA256'] and changed['commonVertexCount']==25417)
  check('Switching person invalidates clothing and blocks stale inputs',changed['clothVertices']==0 and not changed['supportedPerson'] and page.locator('#sew').is_disabled() and page.locator('#read-paper').is_disabled())
  rejection=page.evaluate('async()=>{try{await __R04.loadPaper();return false}catch(e){return /人物身份/.test(e.message)}}');check('Direct API cannot bypass identity gate',rejection)
  page.locator('#stage').screenshot(path=str(D/(('public-' if PUBLIC else '')+'original-preset-person.png')))
  page.evaluate('__R04.changePerson("default")');restored=page.evaluate('__R04.state()');check('Restoring original default restores exact geometry and state',restored['person']==lock['person'])
  page.evaluate('__R04.select("T01")');page.evaluate('__R04.view("front")');page.screenshot(path=str(D/(('public-' if PUBLIC else '')+'desktop.png')))
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200);page.screenshot(path=str(D/(('public-' if PUBLIC else '')+'mobile.png')));check('Mobile viewport no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('No rejected R03 mannequin/shell dependencies fetched',not R['forbiddenProxyRequests']);check('No browser page/HTTP errors',not R['pageErrors'] and not R['httpErrors'],{'errors':R['pageErrors'],'http':R['httpErrors']})
  R['finalState']=page.evaluate('__R04.state()');b.close()
 R['passed']=all(c['passed'] for c in R['checks'])
except Exception as e:R['exception']=str(e);R['traceback']=traceback.format_exc();print(R['traceback'],flush=True)
finally:dump(P/('PUBLIC_REPORT.json' if PUBLIC else 'BROWSER_REPORT.json'),R)
print('SOURCE_CORRECTION_QA',R['passed'],len(R['checks']),flush=True)
if not R['passed']:raise SystemExit(1)
