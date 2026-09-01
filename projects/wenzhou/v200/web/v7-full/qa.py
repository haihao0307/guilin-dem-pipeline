"""Verify the real served full-domain viewer and retain evidence on every failure."""
from pathlib import Path
import argparse,json,traceback
from datetime import datetime,timezone
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
P=argparse.ArgumentParser();P.add_argument('--url',required=True);P.add_argument('--out',type=Path,required=True);P.add_argument('--chromium',required=True);P.add_argument('--commit',required=True);a=P.parse_args();a.out.mkdir(parents=True,exist_ok=True)
R={'schema':'wenzhou-full-public-browser-qa-1','url':a.url,'checkedUtc':datetime.now(timezone.utc).isoformat(),'expectedCommit':a.commit,'passed':False,'cases':[],'visualApproved':False,'productionApproved':False}
def save(): (a.out/'browser-qa.json').write_text(json.dumps(R,indent=2,ensure_ascii=False)+'\n')
def state(p): return p.evaluate('window.__WZ_FULL__ || null')
def frame(p,condition='true'):
    before=state(p)['frames'];p.wait_for_function(f'window.__WZ_FULL__?.errors.length || (window.__WZ_FULL__?.frames>{before} && ({condition}))',timeout=90000)
    q=state(p);assert not q['errors'],q;p.wait_for_timeout(150)
def shot(p,name): p.screenshot(path=str(a.out/name))
def difference(f1,f2,width,height,mobile):
    aa=np.asarray(Image.open(a.out/f1).convert('RGB')).astype('int16');bb=np.asarray(Image.open(a.out/f2).convert('RGB')).astype('int16');x=0 if mobile else 300
    d=np.max(np.abs(aa[100:height-60,x:width]-bb[100:height-60,x:width]),axis=2)
    return int((d>10).sum())
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=a.chromium,headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    R['browserVersion']=browser.version
    try:
        for name,w,h,mobile in [('desktop',1440,960,False),('mobile',390,844,True)]:
            C={'name':name,'viewport':[w,h],'passed':False,'step':'open','consoleErrors':[],'pageErrors':[],'failedRequests':[],'badResponses':[],'imageRequests':[]};R['cases'].append(C)
            ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=mobile,has_touch=mobile);p=ctx.new_page()
            p.on('console',lambda m:C['consoleErrors'].append(m.text) if m.type=='error' else None)
            p.on('pageerror',lambda e:C['pageErrors'].append(str(e)))
            p.on('requestfailed',lambda r:C['failedRequests'].append({'url':r.url,'error':r.failure}))
            p.on('response',lambda r:C['badResponses'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
            p.on('request',lambda r:C['imageRequests'].append(r.url) if r.resource_type=='image' and not r.url.startswith('data:') else None)
            try:
                res=p.goto(a.url,wait_until='domcontentloaded',timeout=120000);assert res and res.status==200
                p.wait_for_function('window.__WZ_FULL__?.ready || window.__WZ_FULL__?.errors.length',timeout=180000)
                q=state(p);C['initial']=q;assert q['ready'] and not q['errors'],q
                assert q['version']=='v7-full-review-r3' and q['sourceCommit']==a.commit,q
                assert q['overviewGrid']==[276,281] and q['sourceGrid']==[17555,17918] and q['overviewSpacingM']==800 and q['sourceSpacingM']==12.5,q
                assert q['riverSourceParts']==6797 and q['riverRenderedParts']>0 and q['reservoirsExcluded']==571,q
                assert q['samplerCount']==0 and q['shaderLinked'] and not q['fullNativeOnline'] and not q['sourceDeleted'],q
                source=p.evaluate('window.__WZ_API__.sourceHash()');assert source=='c24a874e8adb1d076cc863e7d84b6964111fe27174c096fca7b9e3223a999746'
                frame(p);shot(p,name+'-neutral.png')
                C['step']='visible-water';p.evaluate('document.querySelector("#waterOn").checked=false');frame(p,'window.__WZ_FULL__.renderedWater===false');shot(p,name+'-water-off.png')
                C['waterChangedPixels']=difference(name+'-neutral.png',name+'-water-off.png',w,h,mobile);assert C['waterChangedPixels']>(500 if mobile else 3000),C
                p.evaluate('document.querySelector("#waterOn").checked=true');frame(p,'window.__WZ_FULL__.renderedWater===true')
                def ui(selector):
                    if mobile and not p.locator('#panel').evaluate('(e)=>e.classList.contains("open")'):p.locator('#menu').click()
                    p.locator(selector).click()
                    if mobile:p.locator('#menu').click()
                C['step']='three-modes';ui('[data-mode="studio"]');frame(p,'window.__WZ_FULL__.renderedMode===1');shot(p,name+'-studio.png')
                C['studioChangedPixels']=difference(name+'-neutral.png',name+'-studio.png',w,h,mobile);assert C['studioChangedPixels']>(500 if mobile else 3000)
                p.evaluate('document.querySelector("#key").value=0;document.querySelector("#key").dispatchEvent(new Event("input"))');frame(p);shot(p,name+'-key-off.png')
                C['keyChangedPixels']=difference(name+'-studio.png',name+'-key-off.png',w,h,mobile);assert C['keyChangedPixels']>(150 if mobile else 1000)
                p.evaluate('document.querySelector("#key").value=1;document.querySelector("#key").dispatchEvent(new Event("input"))')
                ui('[data-mode="diagnostic"]');frame(p,'window.__WZ_FULL__.renderedMode===2');shot(p,name+'-diagnostic.png')
                C['diagnosticChangedPixels']=difference(name+'-neutral.png',name+'-diagnostic.png',w,h,mobile);assert C['diagnosticChangedPixels']>(500 if mobile else 3000)
                assert p.evaluate('window.__WZ_API__.sourceHash()')==source
                ui('[data-mode="neutral"]');frame(p,'window.__WZ_FULL__.renderedMode===0')
                C['step']='camera';old=state(p)['eye'];p.mouse.move(w*.75,h*.5);p.mouse.wheel(0,-120);frame(p);assert np.linalg.norm(np.array(state(p)['eye'])-old)>1
                old=state(p)['eye'];p.mouse.move(w*.8,h*.4);p.mouse.down();p.mouse.move(w*.7,h*.43,steps=8);p.mouse.up();frame(p);assert np.linalg.norm(np.array(state(p)['eye'])-old)>1
                ui('#home');frame(p);ui('#top');frame(p);shot(p,name+'-top.png');ui('#home');frame(p)
                C['step']='clocks';p.evaluate('document.querySelector("#speed").value=1;document.querySelector("#speed").dispatchEvent(new Event("input"))');p.wait_for_timeout(1200);frame(p)
                q=state(p);assert q['physicalTime']>0 and abs(q['physicalTime']-q['solverTick']*q['solverStep'])<1e-8 and q['displayTime']>=q['physicalTime'],q
                p.evaluate('document.querySelector("#speed").value=0;document.querySelector("#speed").dispatchEvent(new Event("input"))');frame(p);q=state(p);t=q['physicalTime'];p.wait_for_timeout(500);frame(p);assert state(p)['physicalTime']==t;C['clocks']=q
                C['step']='ground';ui('#ground');frame(p,'window.__WZ_FULL__.ground===true');q=state(p);assert 1.6<=q['clearance']<2,q
                p.keyboard.down('KeyW');p.wait_for_timeout(700);p.keyboard.up('KeyW');frame(p);q=state(p);C['ground']=q;assert q['clearance']>=1.6 and q['minClearance']>=1.6,q;shot(p,name+'-ground.png')
                assert p.evaluate('window.__WZ_API__.sourceHash()')==source
                for key in ['consoleErrors','pageErrors','failedRequests','badResponses','imageRequests']:assert not C[key],(key,C[key])
                C['sourceUnchanged']=True;C['passed']=True;C['step']='complete';save();print('PASS',name,C['waterChangedPixels'],flush=True)
            except Exception as exc:
                C['error']=str(exc);C['traceback']=traceback.format_exc()
                try:C['state']=state(p);shot(p,name+'-failure.png')
                except Exception as ee:C['captureError']=str(ee)
                save();print(json.dumps(C,ensure_ascii=False,indent=2),flush=True);raise
            finally:ctx.close()
        R['passed']=True
    except Exception as exc:R['error']=str(exc)
    finally:browser.close();save()
print(json.dumps({'passed':R['passed'],'cases':len(R['cases']),'out':str(a.out)}))
if not R['passed']:raise SystemExit(1)
