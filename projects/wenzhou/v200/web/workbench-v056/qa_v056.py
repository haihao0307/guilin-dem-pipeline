"""Functional browser QA. Software-renderer timing is recorded, never treated as real phone approval."""
from pathlib import Path
import argparse,json,time,traceback,hashlib
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

LAYERS={'ci':[8000,12000],'cc':[7000,11000],'cs':[6000,12000],'ac':[3000,6000],'as':[2500,7000],'ns':[600,6000],'sc':[600,2200],'st':[80,900],'cu':[700,3500],'cb':[600,14000]}
VERSION='wenzhou-workbench-0.5.6-mobile-view-stream'

def run(url,out,public=False):
    out.mkdir(parents=True,exist_ok=True)
    report={'version':VERSION,'url':url,'passed':False,'public':public,'checks':[],'screenshots':[],'visualApproved':False,'productionApproved':False,'performanceApproved':False,'realPhoneTested':False,'scope':'functional checks; physical-device frame-rate approval remains pending'}
    def check(name,value,detail=None):
        report['checks'].append({'name':name,'passed':bool(value),'detail':detail})
        print(name,bool(value),flush=True)
        assert value,(name,detail)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
        page=None
        try:
            for label,w,h,dpr,touch in [('phone',390,844,2,True),('desktop',2560,1600,1,False)]:
                context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr,is_mobile=touch,has_touch=touch)
                page=context.new_page();page.set_default_timeout(120000)
                errors=[];failed=[];requests=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
                page.on('requestfailed',lambda r:failed.append({'url':r.url,'error':r.failure}) if r.failure not in ('net::ERR_ABORTED',) else None)
                page.on('request',lambda r:requests.append(r.url))
                start=time.monotonic();r=page.goto(url,wait_until='domcontentloaded',timeout=120000)
                page.wait_for_function('window.__WZ_FULL__?.ready && window.__WZ_FULL__?.cloudRendered',timeout=240000)
                initial=page.evaluate('window.__WZ_FULL__')
                check(label+' startup',r.status==200 and initial['version']==VERSION,{'seconds':time.monotonic()-start})
                check(label+' full drawing buffer',initial['nativeRenderPixels']==[w*dpr,h*dpr],initial['nativeRenderPixels'])
                check(label+' one context',initial['oneCanvas'] and initial['oneCamera'] and initial['iframeCount']==0 and initial['sharedDepth'])
                check(label+' menu hidden',not page.locator('#panel').is_visible() and not page.locator('#touchToolbar').is_visible())
                check(label+' daylight stable',initial['weather']['clock']['hour']==12 and initial['weather']['clock']['calendarPlaying'] is False,initial['weather']['clock'])
                check(label+' no eager vectors',not any('/data/vectors.json.gz' in u for u in requests))
                frame=initial['frames'];page.wait_for_function('(n)=>window.__WZ_FULL__.frames>n+2',arg=frame,timeout=120000)
                before=page.evaluate('window.__WZ_FULL__.frames');t0=time.monotonic()
                page.wait_for_timeout(6000)
                # At least three new submissions imply two fences actually completed.
                # A fixed six-second window can contain no completion on a slow software GPU.
                page.wait_for_function('(n)=>window.__WZ_FULL__.frames>=n+3',arg=before,timeout=120000)
                after=page.evaluate('window.__WZ_FULL__.frames');elapsed=time.monotonic()-t0
                report[label+'FrameSample']={'frames':after-before,'elapsedSeconds':elapsed,'fps':(after-before)/elapsed,'renderer':'Chromium SwiftShader software; not physical phone','physicalDevicePerformanceApproved':False}
                check(label+' continuously completing frames',after>=before+3,report[label+'FrameSample'])
                def shot(name):
                    path=out/(name+'.png');page.screenshot(path=str(path),timeout=120000)
                    a=np.asarray(Image.open(path).convert('RGB'))
                    report['screenshots'].append({'path':path.name,'width':a.shape[1],'height':a.shape[0],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mean':float(a.mean()),'std':float(a.std())})
                    return a
                image=shot(label+'-day')
                check(label+' nonempty render',image.std()>15,float(image.std()))
                if touch:
                    cdp=context.new_cdp_session(page)
                    def send(t,pts):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[{'x':x,'y':y,'id':i,'radiusX':5,'radiusY':5} for i,x,y in pts]})
                    send('touchStart',[(1,180,390)]);send('touchEnd',[])
                    page.wait_for_function('!document.getElementById("touchToolbar").hidden')
                    check('tap shows tools',page.locator('#touchToolbar').is_visible())
                    send('touchStart',[(1,120,360)]);send('touchMove',[(1,150,350)]);send('touchEnd',[])
                    send('touchStart',[(1,110,380),(2,250,380)])
                    send('touchMove',[(1,85,385),(2,275,385)]);send('touchEnd',[])
                    page.wait_for_function('window.__WZ_TOUCH__.stats.pinch>0 && window.__WZ_TOUCH__.stats.pan>0 && window.__WZ_TOUCH__.stats.rotate>0')
                    check('real touch rotate pinch pan',True,page.evaluate('window.__WZ_TOUCH__.stats'))
                    send('touchStart',[(1,130,420)]);send('touchCancel',[])
                    check('touch cancel clears gesture',page.evaluate('window.__WZ_TOUCH__.stats.cancel>0'))
                    page.locator('#menuButton').click();page.locator('[data-tab-button="weather"]').click()
                    check('phone sheet opens',page.locator('#panel').is_visible() and page.locator('[data-tab="weather"]').first.is_visible())
                    shot('phone-weather-sheet')
                    size=page.locator('#sheetClose').bounding_box();check('touch target 44px',size['height']>=44,size)
                    page.locator('#sheetClose').click()
                    check('phone sheet closes',not page.locator('#panel').is_visible())
                    old=page.evaluate('window.__WZ_FULL__.viewStream')
                    page.evaluate('window.__WZ_API__.navigate(-20000,10000,32000)')
                    page.wait_for_function('(e)=>window.__WZ_FULL__.viewStream.epoch>e && window.__WZ_FULL__.viewStream.activeTiles>0 && window.__WZ_FULL__.viewStream.pending===0',arg=old.get('epoch',0),timeout=120000)
                    s1=page.evaluate('window.__WZ_FULL__.viewStream')
                    check('zoom requests local tiles',s1['activeTiles']>0 and s1['detailLevel']=='当前视野完整河段',s1)
                    page.evaluate('window.__WZ_API__.navigate(65000,15000,28000)')
                    page.wait_for_function('(e)=>window.__WZ_FULL__.viewStream.epoch>e && window.__WZ_FULL__.viewStream.pending===0',arg=s1['epoch'],timeout=120000)
                    s2=page.evaluate('window.__WZ_FULL__.viewStream')
                    check('move changes requested area',s2['visibleIds']!=s1['visibleIds'] and s2['cachedTiles']<=24,s2)
                    check('full native not claimed',page.evaluate('window.__WZ_FULL__.fullNativeOnline===false'))
                    page.set_viewport_size({'width':844,'height':390})
                    page.wait_for_function('window.__WZ_FULL__.nativeRenderPixels[0]===1688')
                    shot('phone-landscape')
                    check('landscape no page scroll',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                else:
                    page.evaluate('window.__WZ_API__.setHour(0)')
                    page.wait_for_function('window.__WZ_FULL__.weather.clock.hour===0')
                    start_frame=page.evaluate('window.__WZ_FULL__.frames')
                    page.wait_for_function('(f)=>window.__WZ_FULL__.frames>f+1',arg=start_frame,timeout=120000)
                    night=shot('desktop-night')
                    check('night is explicit time change',night.mean()<image.mean(),{'dayMean':float(image.mean()),'nightMean':float(night.mean())})
                    page.locator('#menuButton').click()
                    page.locator('[data-tab-button="view"]').click()
                    page.locator('#dayReview').click()
                    page.wait_for_function('window.__WZ_FULL__.weather.clock.hour===12')
                    page.locator('#sheetClose').click()
                check(label+' no runtime errors',not errors,errors)
                check(label+' no failed resources',not failed,failed)
                report[label+'State']=page.evaluate('window.__WZ_FULL__')
                report[label+'Requests']=requests
                context.close();page=None
            context=browser.new_context(viewport={'width':640,'height':400},device_scale_factor=1)
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(url,wait_until='domcontentloaded')
            page.wait_for_function('window.__WZ_FULL__?.ready&&window.__WZ_FULL__?.cloudRendered',timeout=240000)
            for id,layer in LAYERS.items():
                page.evaluate('(id)=>window.__WZ_API__.setWeather(id)',id)
                page.wait_for_function('(id)=>window.__WZ_FULL__.weather.caseId===id && window.__WZ_FULL__.weather.ready && window.__WZ_FULL__.cloudRendered',arg=id,timeout=120000)
                m=page.evaluate('window.__WZ_FULL__.weather.fieldMetrics')
                check('physical layer '+id,[m['baseM'],m['topM']]==layer and m['verticalScale']==1 and m['altitudeOffsetM']==0,m)
            check('ten genera no errors',not errors,errors)
            check('manual altitude controls absent',page.evaluate('!Array.from(document.querySelectorAll("input,select")).some(e=>/(cloud.*(base|top|height)|altitude)/i.test(e.id))'))
            context.close();page=None;report['passed']=True
        except Exception as e:
            report['error']=str(e);report['traceback']=traceback.format_exc()
            if page:
                try:report['failureState']=page.evaluate('window.__WZ_FULL__');page.screenshot(path=str(out/'failure.png'),timeout=20000)
                except Exception:pass
            raise
        finally:
            (out/'browser-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            browser.close()
if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--url',required=True);a.add_argument('--out',type=Path,required=True);a.add_argument('--public',action='store_true');x=a.parse_args();run(x.url,x.out,x.public)
