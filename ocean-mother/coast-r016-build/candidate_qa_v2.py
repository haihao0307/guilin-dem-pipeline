from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
import json
import shutil
import sys

url=sys.argv[1].rstrip('/')+'/'
out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
views=('overview','shore','breaker','rocks','fire','top')
water_views={'overview','shore','breaker'}
report={'url':url,'views':{},'waterDifference':{},'errors':[],'failedRequests':[],'checks':{},'mobileSafariHardwareTested':False,'visualApproved':False,'productionApproved':False}

def area_metrics(im:Image.Image,box):
    pixels=list(im.crop(box).resize((240,150)).getdata());n=len(pixels)
    lum=[(.2126*r+.7152*g+.0722*b)/255 for r,g,b in pixels]
    sat=[(max(r,g,b)-min(r,g,b))/max(1,max(r,g,b)) for r,g,b in pixels]
    earth=sum(1 for r,g,b in pixels if r>g*1.025 and g>b*1.008 and r>62)/n
    warm=sum(1 for r,g,b in pixels if r>155 and g>35 and g<r*.88 and b<g*.74)
    mean=sum(lum)/n;std=(sum((x-mean)**2 for x in lum)/n)**.5
    return {'mean':mean,'std':std,'saturation':sum(sat)/n,'earthRatio':earth,'warmPixels':warm}

def image_metrics(path:Path):
    im=Image.open(path).convert('RGB');w,h=im.size
    return {'full':area_metrics(im,(0,0,w,h)),'lower':area_metrics(im,(0,int(h*.42),w,h)),'middle':area_metrics(im,(int(w*.08),int(h*.24),int(w*.92),int(h*.84))),'size':[w,h],'bytes':path.stat().st_size}

def image_difference(a:Path,b:Path):
    ia=Image.open(a).convert('RGB');ib=Image.open(b).convert('RGB');w,h=ia.size
    box=(int(w*.04),int(h*.18),int(w*.96),int(h*.90))
    d=ImageChops.difference(ia.crop(box),ib.crop(box)).resize((320,200))
    px=list(d.getdata());n=len(px)
    mean=sum((r+g+b)/(3*255) for r,g,b in px)/n
    changed=sum(1 for r,g,b in px if max(r,g,b)>7)/n
    strong=sum(1 for r,g,b in px if max(r,g,b)>20)/n
    return {'meanAbsolute':mean,'changedRatio':changed,'strongChangedRatio':strong,'crop':box}

def next_frame(page):
    before=page.evaluate('OceanCoast.qa.frames')
    page.wait_for_function('(f)=>window.OceanCoast.qa.frames>f',arg=before,timeout=180000)
    page.wait_for_timeout(120)

with sync_playwright() as p:
    chrome=shutil.which('google-chrome') or shutil.which('chromium')
    browser=p.chromium.launch(executable_path=chrome,headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
    for view in views:
        page=browser.new_page(viewport={'width':1440,'height':900})
        page.set_default_navigation_timeout(180000);page.set_default_timeout(180000)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
        page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
        response=page.goto(url+f'?view={view}&qa=1',wait_until='domcontentloaded',timeout=180000)
        page.wait_for_function('window.OceanCoast?.qa.ready===true && window.OceanCoast.qa.frames>5',timeout=180000)
        page.wait_for_timeout(350)
        state=page.evaluate('OceanCoast.getState()');qa=page.evaluate('OceanCoast.qa')
        if view in water_views:
            page.evaluate('OceanCoast.pause();OceanCoast.setConfig("waterVisible",true)');next_frame(page)
        shot=out/f'{view}.png';page.screenshot(path=str(shot))
        report['views'][view]={'http':response.status if response else None,'build':page.locator('#build').evaluate('(e)=>e.textContent.trim()'),'state':state,'qa':qa,'image':image_metrics(shot)}
        if view in water_views:
            page.evaluate('OceanCoast.setConfig("waterVisible",false)');next_frame(page)
            off=out/f'{view}-water-off.png';page.screenshot(path=str(off))
            report['waterDifference'][view]=image_difference(shot,off)
            page.evaluate('OceanCoast.setConfig("waterVisible",true);OceanCoast.play()');next_frame(page)
        if view=='overview':
            page.click('#panelToggle');page.wait_for_timeout(450);page.screenshot(path=str(out/'glass-panel.png'))
            report['glass']={'visible':page.locator('#panel').is_visible(),'backdrop':page.locator('#panel').evaluate("e=>getComputedStyle(e).backdropFilter||getComputedStyle(e).webkitBackdropFilter"),'textBlurred':page.locator('#panel h1').evaluate("e=>getComputedStyle(e).filter!=='none'")}
            slider=page.locator('#control-contact');before=page.evaluate('OceanCoast.getState().config.contact')
            slider.evaluate("e=>{e.value='1.37';e.dispatchEvent(new Event('input',{bubbles:true}))}");after=page.evaluate('OceanCoast.getState().config.contact')
            report['contactControl']={'before':before,'after':after}
            page.click('#pause');t0=page.evaluate('OceanCoast.getState().physicalTime');page.wait_for_timeout(450);t1=page.evaluate('OceanCoast.getState().physicalTime');page.click('#pause');page.wait_for_timeout(500);t2=page.evaluate('OceanCoast.getState().physicalTime')
            report['clock']={'pausedDelta':t1-t0,'resumeDelta':t2-t1}
        page.close()

    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile.set_default_navigation_timeout(300000);mobile.set_default_timeout(300000)
    mobile.on('pageerror',lambda e:report['errors'].append('mobile: '+str(e)))
    mobile.on('console',lambda m:report['errors'].append('mobile: '+m.text) if m.type=='error' else None)
    mobile.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure,'mobile':True}))
    response=mobile.goto(url+'?view=overview&qa=1&mobile=1',wait_until='commit',timeout=300000)
    mobile.wait_for_function('window.OceanCoast?.qa.ready===true && window.OceanCoast.qa.frames>3',timeout=300000)
    mobile.wait_for_timeout(350);mobile.screenshot(path=str(out/'mobile.png'))
    report['mobile']={'http':response.status if response else None,'qa':mobile.evaluate('OceanCoast.qa'),'state':mobile.evaluate('OceanCoast.getState()'),'scrollWidth':mobile.evaluate('document.documentElement.scrollWidth'),'innerWidth':mobile.evaluate('innerWidth'),'image':image_metrics(out/'mobile.png')}
    mobile.click('#panelToggle');mobile.wait_for_timeout(350);mobile.screenshot(path=str(out/'mobile-panel.png'));report['mobile']['panelVisible']=mobile.locator('#panel').is_visible()
    browser.close()

ov=report['views']['overview'];shore=report['views']['shore'];rocks=report['views']['rocks'];fire=report['views']['fire'];mobile=report['mobile'];wd=report['waterDifference']
all_views=all(v['http']==200 and v['build']=='coast-r016-clear-shore-glass' and v['qa'].get('ready') is True and v['qa'].get('glError',0)==0 and not v['qa'].get('glErrors') for v in report['views'].values())
checks={
    'allDesktopViewsReady':all_views,
    'overviewWaterVisuallyChangesScene':wd['overview']['meanAbsolute']>.012 and wd['overview']['changedRatio']>.065,
    'shoreWaterVisuallyChangesScene':wd['shore']['meanAbsolute']>.012 and wd['shore']['changedRatio']>.065,
    'breakerWaterVisuallyChangesScene':wd['breaker']['meanAbsolute']>.016 and wd['breaker']['changedRatio']>.085,
    'sandReadable':ov['image']['lower']['earthRatio']>.40,
    'clearDaylight':.24<ov['image']['full']['mean']<.72 and ov['image']['full']['std']>.09,
    'shoreHasMaterialSeparation':shore['image']['full']['std']>.105 and shore['image']['full']['saturation']>.14,
    'rockMaterialReadable':rocks['image']['middle']['std']>.075 and rocks['image']['full']['saturation']>.09,
    'fireVisible':fire['image']['full']['warmPixels']>12 and fire['qa'].get('flameParticles',0)>20,
    'rockBoundaryCompiled':ov['qa'].get('rockHeightCompiled')==1 and ov['qa'].get('rockDegenerateTriangles')==0,
    'foamAndSprayActive':ov['qa'].get('foamActiveCells',0)>100 and ov['qa'].get('sprayParticles',0)>0,
    'obstacleRelation':ov['qa'].get('obstacleResponse')=='mesh-height boundary / shallow blocking / contact foam transport',
    'glassPanel':report['glass']['visible'] and 'blur' in report['glass']['backdrop'] and not report['glass']['textBlurred'],
    'contactControl':abs(report['contactControl']['after']-1.37)<.001,
    'pauseResume':abs(report['clock']['pausedDelta'])<.02 and report['clock']['resumeDelta']>.01,
    'mobileReady':mobile['http']==200 and mobile['qa'].get('ready') is True and mobile['qa'].get('glError',0)==0 and mobile['scrollWidth']<=mobile['innerWidth'] and mobile['panelVisible'],
    'noBrowserErrors':not report['errors'],
    'noFailedRequests':not report['failedRequests'],
}
report['checks']=checks;report['passed']=sum(bool(v) for v in checks.values());report['failed']=sum(not bool(v) for v in checks.values());report['status']='PASS' if all(checks.values()) else 'FAIL'
(out/'CANDIDATE_QA_V2.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':report['status'],'checks':checks,'waterDifference':wd,'errors':report['errors'],'failedRequests':report['failedRequests'],'metrics':{k:report['views'][k]['image'] for k in views},'mobile':report['mobile']},ensure_ascii=False,indent=2))
if report['status']!='PASS':raise SystemExit(1)
