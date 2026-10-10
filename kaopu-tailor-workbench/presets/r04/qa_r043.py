"""Actual original CommonViewer, source parameters, native solve and two-member outfits."""
from pathlib import Path
import os,json,hashlib,time,base64,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).parent;A=P/'assets';BASE=os.environ.get('R043_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/');PUBLIC=BASE.startswith('https:');OUT=P/('qa-r043-public' if PUBLIC else 'qa-r043');OUT.mkdir(exist_ok=True)
LOCK=json.loads((A/'identity.json').read_text());INDEX=json.loads((A/'results/index.json').read_text());REPORT={'sourceCommit':os.environ.get('GITHUB_SHA'),'public':PUBLIC,'url':BASE,'checks':[],'errors':[],'failedHTTP':[],'fullPhysicsCertified':False,'all60GarmentsAccepted':False,'mobileScope':'Chromium viewport 390x844, not a physical phone'}
def check(n,v,d=None):REPORT['checks'].append({'name':n,'passed':bool(v),'detail':d});print('CHECK',n,bool(v),flush=True)
def state(p):return p.evaluate('__R04.state()')
def ready(p):p.wait_for_function('window.__R04?.state().ready',timeout=300000)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);p=b.new_page(viewport={'width':1440,'height':1080});p.set_default_timeout(300000)
  p.on('pageerror',lambda e:REPORT['errors'].append(str(e)))
  # During private capture generation, outfit PNGs do not exist yet; they are not advertised until generated.
  p.on('response',lambda r:REPORT['failedHTTP'].append({'url':r.url,'status':r.status}) if r.status>=400 and not('/assets/outfits/' in r.url and not PUBLIC) else None)
  p.goto(BASE+'?preset=S02',wait_until='domcontentloaded');ready(p);s=state(p)
  check('same exact original human geometry, topology, state and adapter',s['person']==LOCK['person'] and s['commonVertexCount']==25417 and s['commonTriangleCount']==50624)
  check('all 60 original paper identities retained',s['sourcePresets']==60)
  check('all 122 source parameters present',len(p.evaluate('__R04.parameterSchema().parameters'))==122)
  audit=json.loads((P/'PARAMETER_AUDIT_R043.json').read_text());check('each parameter changes actual regenerated source geometry in a documented valid context',audit.get('verifiedParameters')==122 and audit.get('sameRuntimeBaselineComparison'))
  for id,e in INDEX['rows'].items():
   p.evaluate('id=>__R04.select(id)',id);s=state(p);check('native coordinates and faces '+id,s['phase']=='done' and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'])
   if not PUBLIC:
    p.evaluate('__R04.view("three")');p.locator('#stage').screenshot(path=str(A/'results'/e['thumb']));e['thumbReady']=True;e['thumbSHA256']=hashlib.sha256((A/'results'/e['thumb']).read_bytes()).hexdigest()
  for id,e in INDEX.get('checkpoints',{}).items():
   p.evaluate('id=>__R04.select(id)',id);s=state(p);check('finite checkpoint is not called completed '+id,s['phase']=='checkpoint' and s['clothVertices']>0 and s['staticGate'] is None)
   if not PUBLIC:p.locator('#stage').screenshot(path=str(A/'results'/e['thumb']));e['thumbReady']=True
  if not PUBLIC:(A/'results/index.json').write_text(json.dumps(INDEX,ensure_ascii=False,indent=2))
  for id in ['S02','S06','S11','S12','T06','P01','D08','J06']:
   p.evaluate('id=>__R04.select(id)',id);p.evaluate('__R04.view("three")');p.locator('#stage').screenshot(path=str(OUT/(id+'.png')))
  p.evaluate('__R04.select("S02")');p.evaluate('__R04.view("side")');p.locator('#stage').screenshot(path=str(OUT/'S02-side.png'));p.evaluate('__R04.view("rear")');p.locator('#stage').screenshot(path=str(OUT/'S02-back.png'))
  # All combinations retain source membership. They are not 432 new paper patterns.
  pairs=p.evaluate('__R04.outfits()');check('18 by 24 native outfit identities',len(pairs)==432 and len({r['id'] for r in pairs})==432)
  O=A/'outfits';O.mkdir(exist_ok=True);outfitchecks=[]
  chosen=pairs if not PUBLIC else [r for r in pairs if r['id'] in ['T01-P01','T08-S02','T15-S01','T06-P03','T04-S06']]
  for r in chosen:
   if not all(id in INDEX['rows'] for id in r['members']):continue
   p.evaluate('id=>__R04.select(id)',r['id']);s=state(p);ok=s['phase']=='outfit' and s['outfit']['sameOriginalPerson'] and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'];outfitchecks.append({'id':r['id'],'passed':ok})
   if not PUBLIC:p.evaluate('__R04.view("three")');p.locator('#stage').screenshot(path=str(O/(r['id']+'.png')))
  check('outfits show two actual unchanged solver records',outfitchecks and all(r['passed'] for r in outfitchecks),{'tested':len(outfitchecks)})
  REPORT['outfitMembers']=outfitchecks
  p.evaluate('__R04.setCollection("outfits")');p.evaluate('__R04.select("T01-P01")');p.screenshot(path=str(OUT/'outfits.png'));p.evaluate('__R04.setCollection("single")')
  # Real new pattern generation, not a UI slider or geometry scaling trick.
  p.evaluate('__R04.select("T01")');p.evaluate('__R04.setParameters({"shirt.width":1.2},3,0)');p.evaluate('__R04.generateParameters()');s=state(p)
  check('source runtime produces a real parameter-specific material',s['phase']=='paper' and bool(s['binding'].get('parameterRequestSHA256')) and s['binding']['basePaperSHA256']==json.loads((A/'catalogue.json').read_text())['rows'][0]['decodedSHA256'],{'phase':s['phase'],'error':s['error']})
  check('new parameters are eligible for a fresh solve, not silently stale',not p.locator('#sew').is_disabled() and not s['parameterPending'])
  p.locator('#sew').click();p.wait_for_function('__R04.state().phase==="solving"');p.wait_for_timeout(500);p.locator('#pause').click();p.wait_for_function('__R04.state().phase==="paused"');check('native solve can pause',True);p.locator('#resume').click();p.wait_for_function('["done","failed","checkpoint"].includes(__R04.state().phase)',timeout=360000);s=state(p)
  check('new parameter solve returns its own geometry, not the base cached record',s['phase']=='done' and bool(s['binding'].get('parameterRequestSHA256')) and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'],{'phase':s['phase'],'error':s['error'],'gate':s['staticGate']})
  p.locator('#stage').screenshot(path=str(OUT/'T01-width-ease-variant.png'));REPORT['variantState']=s
  # Inactive field must not be counted as an effect merely because request hashes differ.
  p.evaluate('__R04.select("T01")');p.evaluate('__R04.setParameters({"pants.length":0.61},0,0)');p.evaluate('__R04.generateParameters()');check('inactive parameters explicitly reject false success',state(p)['phase']=='inactive' and state(p)['clothVertices']==0)
  p.evaluate('__R04.select("T01-P01")');old=state(p)['person'];person=p.locator('#person option').nth(19).get_attribute('value');p.evaluate('id=>__R04.changePerson(id)',person);s=state(p);check('person change clears both outfit members and prevents collider mismatch',s['person']['geometrySHA256']!=old['geometrySHA256'] and s['clothVertices']==0 and not s['supportedPerson']);check('direct API cannot use wrong-person collider',p.evaluate('async()=>{try{await __R04.loadPaper();return false}catch{return true}}'))
  p.evaluate('__R04.changePerson("default")');p.evaluate('__R04.select("S02")');p.evaluate('__R04.view("three")');p.screenshot(path=str(OUT/'desktop.png'));p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(250);p.screenshot(path=str(OUT/'mobile.png'));check('mobile has no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('one original CommonViewer context/canvas',p.locator('canvas').count()==1);check('no page, worker or HTTP errors',not REPORT['errors'] and not REPORT['failedHTTP'],{'errors':REPORT['errors'],'http':REPORT['failedHTTP']});b.close()
 REPORT['passed']=all(c['passed'] for c in REPORT['checks'])
except Exception as e:REPORT['exception']=str(e);REPORT['traceback']=traceback.format_exc();REPORT['passed']=False;print(REPORT['traceback'],flush=True)
finally:(P/('R043_PUBLIC_REPORT.json' if PUBLIC else 'R043_BROWSER_REPORT.json')).write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
if not REPORT['passed']:raise SystemExit(1)
