"""Prepare and test the existing V013 candidate. Does not change geometry.

The repository candidate and the previous local ZIP have different field layouts.
This release uses the repository candidate exclusively; never mix their scene.bin.
No screenshots or new image assets are created. Software browser checks do not
constitute real-iPhone performance or artistic acceptance.
"""
from __future__ import annotations
import argparse
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import threading
import time
import traceback
import urllib.request

RELEASE = 'v013-online-20260903-r1'
PUBLIC = 'https://haihao0307.github.io/guilin-dem-pipeline/'
FILES = ['index.html', 'styles.css', 'app.js', 'scene.bin', 'SCENE_META.json']

def digest(data):
    return hashlib.sha256(data).hexdigest()

def prepare(root):
    html = (root/'index.html').read_text()
    assert '<link rel="stylesheet" href="styles.css">' in html
    html = html.replace('<title>Landscape Mother · 喀斯特材质实验 V013</title>', '<title>Landscape Mother V013 · 在线三维工作台</title>')
    html = html.replace('<link rel="stylesheet" href="styles.css">', '<link rel="icon" href="data:,">\n  <link rel="stylesheet" href="styles.css?v='+RELEASE+'">')
    html = html.replace('<script src="app.js"></script>', '<script src="app.js?v='+RELEASE+'"></script>')
    html = html.replace('initial-scale=1,maximum-scale=1,viewport-fit=cover', 'initial-scale=1,viewport-fit=cover')
    html = html.replace('id="hub" class="hub hidden"', 'id="hub" class="hub"')
    html = html.replace('完全由函数形成的地貌世界', 'Landscape Mother')
    html = html.replace('径流累积</button>', '径流分布</button>')
    html = html.replace('宏观结构 <output', '宏观色差 <output').replace('中观层次 <output', '中观粗糙变化 <output')
    html = html.replace('所有调节只作用于当前三维样板', '材料与展示独立调节，当前岩体几何保持固定')
    html = html.replace('</head>', '<noscript><style>#hub,#sheet,.top,.dock{display:none!important}#error{display:grid!important}</style></noscript>\n</head>')
    html = html.replace('<p id="errorText"></p>', '<p id="errorText">此工作台需要启用 JavaScript 和 WebGL。请通过在线地址打开。</p>')
    (root/'index.html').write_text(html, encoding='utf-8')
    css = (root/'styles.css').read_text()
    css += '\n/* Online entry: readable touch targets without altering the terrain. */\n.tab{height:44px}.tab-panel label{font-size:13px}.tab-panel input{height:32px}.identity span{font-size:11px}.hub-open .top,.hub-open .dock,.hub-open .toast{visibility:hidden}@media(prefers-reduced-transparency:reduce){.glass,.glass-heavy{backdrop-filter:none;-webkit-backdrop-filter:none;background:#17272b}}\n'
    (root/'styles.css').write_text(css, encoding='utf-8')
    js = (root/'app.js').read_text()
    assert 'try{load().catch' in js and 'setTour(true);requestAnimationFrame(loop)' in js
    assert 'if(uMode==6){OUT=vec4(vec3(rough),1.);return;}' in js
    js = js.replace('if(uMode==6){OUT=vec4(vec3(rough),1.);return;}', 'if(uMode==10){OUT=vec4(mat<.5?vec3(0.,1.,0.):vec3(1.,0.,0.),1.);return;}\n if(uMode==6){OUT=vec4(vec3(rough),1.);return;}')
    bridge = r'''
// Navigation is presentation state; camera/material/geometry remain intact.
const onlineRelease='v013-online-20260903-r1';
window.__LANDSCAPE_RELEASE__=onlineRelease;
window.__LANDSCAPE_GET_CAMERA__=()=>JSON.parse(JSON.stringify(camera));
function applyRoute(){
  const scene=location.hash==='#karst'||(location.hash!=='#home'&&new URLSearchParams(location.search).get('scene')==='karst');
  hub.classList.toggle('hidden',scene);document.body.classList.toggle('hub-open',!scene);
  sheet.classList.add('hidden');setTour(false);requestDraw();
}
function goRoute(scene){history.pushState({scene},'',scene?'#karst':'#home');applyRoute()}
$('home').onclick=()=>goRoute(false);$('enterKarst').onclick=()=>goRoute(true);
addEventListener('popstate',applyRoute);addEventListener('hashchange',applyRoute);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();setTour(false);fail('三维绘图上下文已中断，请按重新载入。')});
window.__LANDSCAPE_ROCK_METRICS__=()=>{
  const mode=state.mode;state.mode=10;draw();
  const w=canvas.width,h=canvas.height,mask=new Uint8Array(w*h*4),pixels=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,mask);state.mode=mode;draw();
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let count=0,lum=0,chroma=0,dark=0,bright=0,hash=2166136261;
  for(let i=0;i<pixels.length;i+=16){
    if(mask[i]<200||mask[i+1]>40||mask[i+3]<200)continue;
    const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,y=.2126*r+.7152*g+.0722*b;
    count++;lum+=y;chroma+=Math.max(r,g,b)-Math.min(r,g,b);dark+=y<.08;bright+=y>.94;
    hash=Math.imul(hash^pixels[i],16777619);hash=Math.imul(hash^pixels[i+1],16777619);hash=Math.imul(hash^pixels[i+2],16777619);
  }
  return {count,meanLuminance:lum/Math.max(1,count),meanChroma:chroma/Math.max(1,count),darkRatio:dark/Math.max(1,count),brightRatio:bright/Math.max(1,count),frameHash:(hash>>>0).toString(16),glError:gl.getError(),mask:'explicit-rock-material-id',width:w,height:h};
};
'''
    js = js.replace('try{load().catch', bridge+'\ntry{load().catch', 1)
    js = js.replace('setTour(true);requestAnimationFrame(loop)', 'applyRoute();requestAnimationFrame(loop)')
    js = js.replace("sub.textContent='已完成 · '", "sub.textContent='V013 · 已就绪 · '")
    (root/'app.js').write_text(js, encoding='utf-8')
    manifest = {'release':RELEASE, 'sourceCommit':os.environ.get('GITHUB_SHA'),
                'files':{f:digest((root/f).read_bytes()) for f in FILES},
                'geometryUnchangedByEntryRepair':True,'defaultView':'hub','directSceneQuery':'scene=karst',
                'realIPhoneVerified':False,'visualApproved':False,'productionReady':False}
    (root/'ONLINE_RELEASE.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))

INIT = r'''(()=>{window.__GPU_AUDIT__={uploads:0,textures:0};for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!C)continue;for(const method of ['bufferData','bufferSubData','createTexture']){const original=C.prototype[method];if(!original)continue;C.prototype[method]=function(...args){window.__GPU_AUDIT__[method==='createTexture'?'textures':'uploads']++;return original.apply(this,args)}}}})()'''

def check(root, url=None):
    from playwright.sync_api import sync_playwright
    server = None
    if url is None:
        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
            def log_message(self,*args): pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/'
    report={'release':RELEASE,'url':url,'passed':False,'screenshotsCreated':0,'profiles':[],
            'realIPhoneVerified':False,'visualApproved':False,'productionReady':False}
    try:
        with sync_playwright() as p:
            chrome=os.environ.get('CHROME_BIN') or shutil.which('google-chrome') or shutil.which('chromium')
            opts={'headless':True,'args':['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
            if chrome: opts['executable_path']=chrome
            browser=p.chromium.launch(**opts)
            for width,height,dpr,mobile in [(390,844,3,True),(1365,900,1,False)]:
                ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,is_mobile=mobile,has_touch=mobile)
                ctx.add_init_script(INIT)
                page=ctx.new_page();errors=[];warnings=[];failed=[];bad=[]
                page.on('console',lambda m: errors.append(m.text) if m.type=='error' else warnings.append(m.text) if m.type=='warning' else None)
                page.on('pageerror',lambda e: errors.append(str(e)))
                page.on('requestfailed',lambda r: failed.append({'url':r.url,'error':r.failure}))
                page.on('response',lambda r: bad.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
                item={'viewport':[width,height],'deviceScaleFactor':dpr,'mobileEmulation':mobile,'errors':errors,'warnings':warnings,'failedRequests':failed,'httpErrors':bad}
                report['profiles'].append(item)
                t=time.perf_counter();response=page.goto(url,wait_until='domcontentloaded',timeout=90000)
                assert response and response.ok
                page.wait_for_function('window.__LANDSCAPE_READY__===true',timeout=120000)
                assert page.evaluate('window.__LANDSCAPE_RELEASE__')==RELEASE
                item['readySeconds']=round(time.perf_counter()-t,3)
                assert page.locator('#hub').is_visible()
                item['defaultHub']=True
                page.click('#enterKarst');assert not page.locator('#hub').is_visible()
                page.evaluate('window.__setLandscapeTour__(false)')
                item['stats']=page.evaluate('window.__LANDSCAPE_STATS__')
                item['initialGPU']=page.evaluate('window.__GPU_AUDIT__')
                item['rockMetrics']=page.evaluate('window.__LANDSCAPE_ROCK_METRICS__()')
                metrics=item['rockMetrics'];assert metrics['count']>400 and metrics['glError']==0
                assert .10<metrics['meanLuminance']<.86 and metrics['meanChroma']>.018
                assert metrics['darkRatio']<.55
                page.click('#settings');assert page.locator('#sheet').is_visible()
                item['tabs']=[]
                for tab in ['stone','water','bio','surface','light','diagnostic']:
                    page.click(f'[data-tab="{tab}"]');assert page.locator(f'[data-panel="{tab}"]').is_visible();item['tabs'].append(tab)
                page.click('[data-tab="water"]')
                page.locator('#manganese').evaluate("e=>{e.value='0.90';e.dispatchEvent(new Event('input',{bubbles:true}))}")
                assert page.locator('#manganeseV').inner_text()=='0.90'
                page.click('[data-tab="light"]')
                page.locator('#sun').evaluate("e=>{e.value='2.0';e.dispatchEvent(new Event('input',{bubbles:true}))}")
                item['changedMetrics']=page.evaluate('window.__LANDSCAPE_ROCK_METRICS__()')
                assert item['changedMetrics']['frameHash']!=metrics['frameHash']
                page.click('#resetMaterial');page.click('#close')
                page.click('#home');assert page.locator('#hub').is_visible()
                page.click('#enterKarst');assert not page.locator('#hub').is_visible()
                item['returnAndReenter']=True
                item['viewMetrics']={}
                for view in ['hero','side','cliff','cave','top']:
                    page.click(f'[data-view="{view}"]')
                    m=page.evaluate('window.__LANDSCAPE_ROCK_METRICS__()');assert m['count']>100 and m['glError']==0
                    item['viewMetrics'][view]=m
                page.evaluate("window.__setLandscapeView__('hero');window.__setLandscapeTour__(false)")
                if mobile:
                    before=page.evaluate('window.__LANDSCAPE_GET_CAMERA__()')
                    cdp=ctx.new_cdp_session(page)
                    points=[{'x':120,'y':400,'id':1},{'x':240,'y':400,'id':2}]
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
                    points[1]['x']=300
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':points})
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                    after=page.evaluate('window.__LANDSCAPE_GET_CAMERA__()')
                    assert after['dist']<before['dist']-1
                    item['pinch']={'before':before,'after':after,'source':'Chromium CDP touch input'}
                item['finalGPU']=page.evaluate('window.__GPU_AUDIT__')
                assert item['finalGPU']==item['initialGPU'] and item['finalGPU']['textures']==0
                item['directResponse']=page.goto(url.split('?')[0]+'?scene=karst&v='+RELEASE,wait_until='domcontentloaded',timeout=90000).status
                page.wait_for_function('window.__LANDSCAPE_READY__===true',timeout=120000)
                assert not page.locator('#hub').is_visible() and page.evaluate('window.__LANDSCAPE_RELEASE__')==RELEASE
                item['oneClickDirectScene']=True
                assert not errors and not failed and not bad, {'errors':errors,'failed':failed,'bad':bad}
                ctx.close()
            browser.close()
        report['passed']=True
    except Exception:
        report['exception']=traceback.format_exc()
    finally:
        if server: server.shutdown()
        name='PUBLIC_BROWSER_QA.json' if url.startswith('https:') else 'BROWSER_QA.json'
        (root/name).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(report,ensure_ascii=False,indent=2))
    if not report['passed']: raise SystemExit(1)

def verify_public(root):
    expected=json.loads((root/'ONLINE_RELEASE.json').read_text())
    attempts=[]
    for attempt in range(25):
        try:
            request=urllib.request.Request(PUBLIC+'landscape-mother-v013/ONLINE_RELEASE.json?check='+RELEASE+str(attempt),headers={'Cache-Control':'no-cache'})
            with urllib.request.urlopen(request,timeout=25) as r: remote=json.load(r)
            if remote!=expected: raise ValueError('Published release manifest does not yet match')
            break
        except Exception as e:
            attempts.append(str(e))
            if attempt==24: raise
            time.sleep(15)
    checks={}
    for f in FILES:
        request=urllib.request.Request(PUBLIC+'landscape-mother-v013/'+f+'?check='+RELEASE,headers={'Cache-Control':'no-cache'})
        with urllib.request.urlopen(request,timeout=60) as r:
            data=r.read();checks[f]={'status':r.status,'bytes':len(data),'sha256':digest(data),'contentType':r.headers.get('Content-Type')}
        assert checks[f]['sha256']==expected['files'][f],f
    receipt={'release':RELEASE,'matched':True,'files':checks,'waitingAttempts':attempts,'sourceCommit':expected['sourceCommit']}
    (root/'PUBLIC_HTTP_QA.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    check(root,PUBLIC+'landscape-mother/?v='+RELEASE)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','check','public']);parser.add_argument('root',type=Path)
    args=parser.parse_args();root=args.root.resolve()
    if args.action=='prepare': prepare(root)
    elif args.action=='check': check(root)
    else: verify_public(root)
