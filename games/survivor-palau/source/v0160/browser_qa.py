"""Real Chromium/WebGL checks. Software renderer results are not mobile FPS claims."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,math,shutil,sys,time,traceback,hashlib
ROOT=Path('games/survivor-palau/releases/v0.1.6.0')
OUT=ROOT/'evidence';OUT.mkdir(parents=True,exist_ok=True)
URL=sys.argv[1] if len(sys.argv)>1 else (ROOT/'index.html').resolve().as_uri()
PUBLIC=URL.startswith('https:')
REPORT=ROOT/('PUBLIC_BROWSER_QA.json' if PUBLIC else 'BROWSER_QA.json')
r={'passed':False,'url':URL,'normalQuality':True,'softwareRenderer':True,'physicalPhoneTested':False,'visualAcceptancePending':True,'consoleErrors':[],'pageErrors':[],'requestFailures':[],'views':[],'checks':{}}
def save(): REPORT.write_text(json.dumps(r,ensure_ascii=False,indent=2))
def wait_frames(p,n=3,timeout=120000):
    f=p.evaluate('OceanMotherR018.qa.frames')
    p.wait_for_function('(f)=>OceanMotherR018.qa.frames>=f',arg=f+n,timeout=timeout,polling=200)
def snapshot(p,name):
    wait_frames(p,2)
    p.screenshot(path=str(OUT/(('public-' if PUBLIC else '')+name+'.png')),timeout=90000)
    r['views'].append({'name':name,'qa':p.evaluate('({...OceanMotherR018.qa})')});save()
def connect(p):
    p.on('console',lambda m:r['consoleErrors'].append(m.text) if m.type=='error' else None)
    p.on('pageerror',lambda e:r['pageErrors'].append(str(e)))
    p.on('requestfailed',lambda q:r['requestFailures'].append({'url':q.url,'failure':q.failure}))
    resp=p.goto(URL,wait_until='domcontentloaded',timeout=90000)
    if PUBLIC:assert resp and resp.status==200
    p.wait_for_function('()=>window.OceanMotherR018?.qa?.ready && window.PalauExperience',timeout=120000,polling=250)
    wait_frames(p)
    qa=p.evaluate('({...OceanMotherR018.qa})')
    assert qa['webgl2'] and not qa['errors'] and qa.get('glError',0)==0,qa
    assert p.evaluate('PalauExperience.islands.length')==10
    assert '0.1.6.0' in p.evaluate('PalauExperience.version')
def click(p,selector):
    p.locator(selector).click(timeout=45000,no_wait_after=True)
def select_view(p,name):
    click(p,'#actionExplore');click(p,'[data-palau-view="'+name+'"]');wait_frames(p,4)
try:
 with sync_playwright() as pw:
    chrome=shutil.which('google-chrome') or shutil.which('chromium');assert chrome
    browser=pw.chromium.launch(executable_path=chrome,headless=False,args=['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'])
    p=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
    connect(p);snapshot(p,'desktop-overview')
    r['checks']['islandTops']=p.evaluate('PalauExperience.islands.map(a=>OceanMotherR018.sampleRock(a[0],a[1]))')
    assert min(r['checks']['islandTops'])>15
    for name in (['reef','karst','deepfish','money'] if not PUBLIC else ['reef']):
        select_view(p,name);snapshot(p,'desktop-'+name)
    click(p,'#actionSail')
    start=p.evaluate('({...PalauSurvivalGame.state})');p.keyboard.down('w')
    p.wait_for_function('(s)=>Math.hypot(PalauSurvivalGame.state.x-s.x,PalauSurvivalGame.state.z-s.z)>.05',arg=start,timeout=90000,polling=200)
    p.keyboard.up('w');end=p.evaluate('({...PalauSurvivalGame.state})')
    r['checks']['actualKeyMovementM']=math.hypot(end['x']-start['x'],end['z']-start['z']);assert end['depth']>.08
    snapshot(p,'desktop-canoe');p.close();save()
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    p=mobile.new_page();connect(p);snapshot(p,'mobile-overview')
    boxes=p.evaluate("['actionSail','actionFish','actionExplore'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return{id,x:b.x,y:b.y,w:b.width,h:b.height};})")
    assert all(b['x']>=0 and b['x']+b['w']<=390 and b['y']+b['h']<=844 and b['h']>=44 for b in boxes),boxes
    assert all(boxes[i]['x']+boxes[i]['w']<=boxes[i+1]['x'] for i in range(2)),boxes
    r['checks']['mobileActionBoxes']=boxes
    click(p,'#actionFish');assert p.evaluate('PalauExperience.fishing.phase')=='ready'
    snapshot(p,'mobile-fishing-ready')
    click(p,'#actionFish');p.wait_for_function("PalauExperience.fishing.phase==='bite'",timeout=180000,polling=100)
    click(p,'#actionFish');assert p.evaluate('PalauExperience.fishing.phase')=='reel'
    snapshot(p,'mobile-fishing-reel')
    # Real button hold/release events; no modifications to simulation state/time.
    box=p.locator('#actionFish').bounding_box();p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
    held=False;deadline=time.monotonic()+240
    while time.monotonic()<deadline:
        s=p.evaluate('({...PalauExperience.fishing})')
        if s['phase']!='reel':break
        desired=s['tension']<(.72 if held else .30)
        if desired!=held:
            (p.mouse.down if desired else p.mouse.up)();held=desired
        p.wait_for_timeout(150)
    if held:p.mouse.up()
    s=p.evaluate('({...PalauExperience.fishing})');r['checks']['fishingEnd']=s
    assert s['phase']=='caught' and s['catches']==1,s
    snapshot(p,'mobile-fishing-caught')
    click(p,'#fishCancel');wait_frames(p,3)
    assert p.evaluate('PalauExperience.fishing.catches')==1
    click(p,'#actionFish');click(p,'#actionFish');click(p,'#uiPause')
    before=p.evaluate('PalauExperience.fishing.time');p.wait_for_timeout(500)
    assert p.evaluate('PalauExperience.fishing.time')==before
    click(p,'#uiPause');click(p,'#fishCancel')
    r['checks']['pauseAndCancelPassed']=True
    p.close();mobile.close()
    p=browser.new_page(viewport={'width':844,'height':390},device_scale_factor=1)
    connect(p);snapshot(p,'landscape-overview');p.close()
    browser.close()
 r['passed']=not r['consoleErrors'] and not r['pageErrors'] and not r['requestFailures']
except Exception as exc:
 r['failure']=str(exc);r['traceback']=traceback.format_exc()
finally:
 save();print(json.dumps(r,ensure_ascii=False,indent=2),flush=True)
assert r['passed'],r.get('failure','browser errors')
