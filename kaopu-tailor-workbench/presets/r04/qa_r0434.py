"""Full 60-style and 432-outfit rendering regression. Physical gates are never overwritten."""
from pathlib import Path
import os,json,base64,hashlib,traceback,io
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat
P=Path(__file__).resolve().parent
BASE=os.environ.get('R0434_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/')
PUBLIC=BASE.startswith('https:');GENERATE=os.environ.get('R0434_GENERATE')=='1'
OUT=P/('qa-r0434-public' if PUBLIC else 'qa-r0434');OUT.mkdir(exist_ok=True)
REPORT={'sourceCommit':os.environ.get('GITHUB_SHA'),'url':BASE,'actualPublicBrowser':PUBLIC,'checks':[],'categories':{},'styles':[],'outfits':[],'errors':[],'httpErrors':[], 'mobileScope':'Chromium 390x844 viewport, not physical phone','rendererScope':'Chromium WebGL2 with SwiftShader, not a hardware-GPU performance certification','allGarmentsQualityAccepted':False,'jointOutfitPhysicsCertified':False,'userAccepted':False}
INDEX=json.loads((P/'assets/results/index.json').read_text());CAT=json.loads((P/'assets/catalogue.json').read_text());LOCK=json.loads((P/'assets/identity.json').read_text())
def check(name,value,detail=None):
 REPORT['checks'].append({'name':name,'passed':bool(value),'detail':detail});print(name,bool(value),flush=True)
def small(p):return p.evaluate('''(()=>{const s=__R04.state();return {id:s.selectedId,phase:s.phase,ready:s.ready,display:s.display,coords:s.renderCoordinateErrorM,indices:s.clothIndexMatchesNative,vertices:s.clothVertices,staticPassed:s.staticGate?.passed,failures:s.staticGate?.failures,packetCacheSize:s.packetCacheSize,collection:s.collection,samePerson:s.supportedPerson,normalAudits:s.sewnNormalAudits,memberIds:s.outfit?.members.map(m=>m.presetId)}})()''')
def png(p):
 data=base64.b64decode(p.evaluate('__R04.thumbnail()').split(',',1)[1]);im=Image.open(io.BytesIO(data));assert im.size==(320,400);assert max(ImageStat.Stat(im.convert('RGB')).stddev)>5;return data
def audit_cards(p,name):
 old=p.evaluate('[scrollX,scrollY]');p.locator('#cards .card').first.scroll_into_view_if_needed()
 p.wait_for_function("[...document.querySelectorAll('#cards .thumb img')].filter(e=>{const b=e.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).every(e=>e.complete&&e.naturalWidth>0)")
 rows=p.evaluate("""[...document.querySelectorAll('#cards .thumb img')].filter(e=>{const b=e.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight}).map(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.querySelector(':scope>span')?.getBoundingClientRect();return{natural:[e.naturalWidth,e.naturalHeight],ratio:a.width/a.height,fit:getComputedStyle(e).objectFit,labelBelow:!!b&&b.top>=a.bottom-.5}})""")
 check(name,len(rows)>0 and all(r['natural']==[320,400] and abs(r['ratio']-.8)<.01 and r['fit']=='contain' and r['labelBelow'] for r in rows),rows)
 p.evaluate('p=>scrollTo(...p)',old)
try:
 with sync_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']}
  if os.environ.get('R0434_CHROME'):opts.update(executable_path=os.environ['R0434_CHROME'],env={**os.environ,'DISPLAY':os.environ.get('DISPLAY',':99')})
  browser=pw.chromium.launch(**opts);page=browser.new_page(viewport={'width':1440,'height':1080});page.set_default_timeout(120000)
  if os.environ.get('R0434_OFFLINE_CAPTURE'):
   assert not PUBLIC,'Network replay is not public acceptance'
   root=Path(os.environ['R0434_OFFLINE_CAPTURE']);net=json.loads((root/'network.json').read_text())
   def replay(route):
    r=net.get(route.request.url)
    if not r:REPORT['errors'].append('Missing replay: '+route.request.url);route.abort();return
    body=(root/'network'/r['file']).read_bytes();assert hashlib.sha256(body).hexdigest()==r['sha256']
    route.fulfill(status=r['status'],body=body,headers={'Content-Type':r['contentType'],'Access-Control-Allow-Origin':'*'})
   page.route('https://**/*',replay);REPORT['immutableNetworkReplay']=True
  page.on('pageerror',lambda e:REPORT['errors'].append(str(e)))
  page.on('response',lambda r:REPORT['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  page.goto(BASE+'?preset=T01-P01',wait_until='domcontentloaded');page.wait_for_function('window.__R04?.state().ready',timeout=300000)
  state=page.evaluate('__R04.state()');check('same original person and topology',state['person']==LOCK['person'] and state['commonVertexCount']==25417 and state['commonTriangleCount']==50624)
  check('current R0434 runtime',state['release']=='R04.3.4')
  check('deep linked outfit, category tab and both selectors agree',state['selectedId']=='T01-P01' and state['collection']=='outfits' and page.locator('#pair-top').input_value()=='T01' and page.locator('#pair-bottom').input_value()=='P01')
  check('60 source papers, 432 source outfits and 122 parameters retained',state['sourcePresets']==60 and state['outfitCount']==432 and len(page.evaluate('__R04.parameterSchema().parameters'))==122)
  check('original common runtime frozen without changing identity',state['personRuntimeCommit']=='537c0f619fb9391c6a1e72ee29d2f889b5d1782f')
  audit_cards(page,'desktop outfit labels never cover garment images')
  for row in CAT['rows']:
   id=row['id'];page.evaluate('id=>__R04.select(id)',id);page.evaluate('__R04.focus("scene")');s=small(page);views=[]
   for view in ['three','front','rear','side']:
    page.evaluate('v=>__R04.view(v)',view);a=page.evaluate('__R04.displayAudit()');views.append({'view':view,**a})
    if view in ['front','side']:page.locator('#stage').screenshot(path=str(OUT/(id+'-'+view+'.png')))
   ok=s['id']==id and s['phase']=='done' and s['vertices']>0 and s['coords']==0 and s['indices'] and s['samePerson'] and all(v['framed'] and v['contextAvailable'] for v in views)
   data=png(page)
   if GENERATE:
    dest=P/'assets/results'/INDEX['rows'][id]['thumb'];dest.write_bytes(data);INDEX['rows'][id].update(thumbReady=True,thumbSHA256=hashlib.sha256(data).hexdigest(),thumbnailScope='original person, original native result, garment-framed 320x400')
   r={'id':id,'name':row['name'],'category':row['category'],'passedDisplay':ok,'staticPassed':s['staticPassed'],'physicalFailures':s['failures'],'views':views,'normalAudits':s['normalAudits'],'thumbSHA256':hashlib.sha256(data).hexdigest()};REPORT['styles'].append(r)
   cat=REPORT['categories'].setdefault(row['category'],{'total':0,'displayPassed':0,'staticPassed':0});cat['total']+=1;cat['displayPassed']+=int(ok);cat['staticPassed']+=int(bool(s['staticPassed']))
   print('STYLE',id,ok,flush=True)
  check('all 60 styles show actual unchanged native coordinates from all four views',len(REPORT['styles'])==60 and all(r['passedDisplay'] for r in REPORT['styles']))
  for r in page.evaluate('__R04.outfits()'):
   page.evaluate('id=>__R04.select(id)',r['id']);page.evaluate('__R04.view("three");__R04.focus("scene")');s=small(page);data=png(page)
   ok=s['id']==r['id'] and s['phase']=='outfit' and s['memberIds']==r['members'] and s['display']['garmentMeshes']==2 and s['coords']==0 and s['indices'] and s['display']['framed']
   REPORT['outfits'].append({'id':r['id'],'passedDisplay':ok,'members':s['memberIds'],'thumbSHA256':hashlib.sha256(data).hexdigest()})
   if GENERATE:(P/'assets/outfits'/(r['id']+'.png')).write_bytes(data)
  check('all 432 outfits rendered with exactly their two original members',len(REPORT['outfits'])==432 and all(r['passedDisplay'] for r in REPORT['outfits']))
  check('bounded parsed-result cache',small(page)['packetCacheSize']<=32)
  if GENERATE:
   (P/'assets/results/index.json').write_text(json.dumps(INDEX,ensure_ascii=False,indent=2));page.reload(wait_until='domcontentloaded');page.wait_for_function('window.__R04?.state().ready',timeout=300000)
  page.evaluate('__R04.select("T01-P01")');s=small(page)
  invalid=page.evaluate('async()=>{try{await __R04.select("MISSING");return false;}catch{return true;}}');check('bad selection cannot erase good garment',invalid and small(page)['id']==s['id'] and small(page)['vertices']==s['vertices'])
  page.evaluate('async()=>{await Promise.all([__R04.select("S06"),__R04.select("D10"),__R04.select("T01-P01")]);}');s=small(page);check('latest selection wins over stale asynchronous loads',s['id']=='T01-P01' and s['memberIds']==['T01','P01'])
  for cat in REPORT['categories']:
   page.evaluate('__R04.setCollection("single")');page.locator('#categories button',has_text=cat).click();check('category button '+cat,page.locator('#cards .card').count()==REPORT['categories'][cat]['total'])
   audit_cards(page,'desktop '+cat+' labels below complete garment images')
  page.evaluate('async()=>{await __R04.select("T01-P01");__R04.focus("scene");__R04.view("three");}');page.screenshot(path=str(OUT/'desktop.png'))
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
  mobile=[]
  for id in ['T08','P01','S06','D09','J06','T01-P01']:
   page.evaluate('id=>__R04.select(id)',id);s=small(page);mobile.append({'id':id,'framed':s['display']['framed'],'coords':s['coords']})
  check('mobile viewport five categories and outfit retain full scene',all(r['framed'] and r['coords']==0 for r in mobile),mobile)
  audit_cards(page,'mobile labels below complete garment images')
  check('mobile no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(OUT/'mobile.png'))
  before=small(page);page.evaluate('__R04.loseContext()');page.wait_for_function('!__R04.state().ready');check('context loss keeps garment but disables actions',small(page)['vertices']==before['vertices'] and page.locator('#read-paper').is_disabled())
  page.wait_for_timeout(150);page.evaluate('__R04.restoreContext()');page.wait_for_function('__R04.state().ready');px=page.evaluate('__R04.pixelAudit()');check('context restoration renders original garment again',small(page)['vertices']==before['vertices'] and px['colors']>100 and px['error']==0,px)
  page.evaluate("dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));")
  check('persisted-page lifecycle handler does not dispose the viewer',page.evaluate('__R04.pixelAudit().colors')>100);REPORT['backForwardCacheScope']='persisted lifecycle event regression, not a claim that the browser used actual BFCache'
  page.evaluate('__R04.select("T01")');before=small(page);person=page.locator('#person option').nth(19).get_attribute('value');page.evaluate('id=>__R04.changePerson(id)',person);s=small(page);check('changing original person cannot reuse wrong collider/garment',not s['samePerson'] and s['vertices']==0)
  page.evaluate('__R04.changePerson("default")');page.evaluate('__R04.select("T01-P01")');check('restoring default person restores valid source selection',small(page)['vertices']>0 and small(page)['samePerson'])
  check('one original WebGL canvas',page.locator('canvas').count()==1)
  check('no page errors or failed HTTP resources',not REPORT['errors'] and not REPORT['httpErrors'],{'errors':REPORT['errors'],'httpErrors':REPORT['httpErrors']})
  if GENERATE:(P/'assets/results/index.json').write_text(json.dumps(INDEX,ensure_ascii=False,indent=2))
  browser.close()
 REPORT['passed']=all(c['passed'] for c in REPORT['checks'])
except Exception as e:REPORT['passed']=False;REPORT['exception']=str(e);REPORT['traceback']=traceback.format_exc();print(REPORT['traceback'],flush=True)
finally:
 (P/('R0434_PUBLIC_REPORT.json' if PUBLIC else 'R0434_BROWSER_REPORT.json')).write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
if not REPORT['passed']:raise SystemExit(1)
