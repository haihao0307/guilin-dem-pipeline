"""Actual sample, actual Chromium. Captures stay evidence-only. No fixture or image substitute."""
from pathlib import Path
import argparse,json,time
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
r={'url':a.url,'target':'actual B3.1 procedural sample','sourceGlbImported':False,'imageGenerationUsed':False,'browserExecuted':False,'passed':False,'errors':[],'visualApproved':False,'productionReady':False}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':2048,'height':1152},device_scale_factor=1)
  page.on('pageerror',lambda e:r['errors'].append(str(e)))
  page.on('requestfailed',lambda q:r['errors'].append(str(q.failure)))
  page.add_init_script("window.probe={textures:0,uploads:0};for(const n of ['createTexture','bufferData']){const old=WebGL2RenderingContext.prototype[n];WebGL2RenderingContext.prototype[n]=function(...v){window.probe[n==='createTexture'?'textures':'uploads']++;return old.apply(this,v)}}")
  page.goto(a.url,wait_until='domcontentloaded',timeout=45000)
  page.wait_for_function('window.__LANDSCAPE?.ready||window.__LANDSCAPE?.error',timeout=180000)
  assert page.evaluate('__LANDSCAPE.error') is None,page.evaluate('__LANDSCAPE.error')
  page.wait_for_function('__LANDSCAPE.frames>0',timeout=30000)
  assert page.locator('input[type=file]').count()==0
  r['browserExecuted']=True;r['browserVersion']=b.version;r['audit']=page.evaluate('__LANDSCAPE.audit')
  assert r['audit']['body']['closed'] and r['audit']['soil']['closed'] and r['audit']['talus']['closed']
  async_digest="""async()=>{let hashes=[];for(const m of __LANDSCAPE.cpuMeshData)for(const k of ['positions','normals','attributes','rest','indices']){let x=m[k],h=await crypto.subtle.digest('SHA-256',new Uint8Array(x.buffer,x.byteOffset,x.byteLength));hashes.push(Array.from(new Uint8Array(h),n=>n.toString(16).padStart(2,'0')).join(''))}return hashes}"""
  before_hash=page.evaluate(async_digest);before=page.evaluate('({probe,snapshot:__LANDSCAPE.snapshot()})')
  for name in ['overview','detail','side','back','crown','base','underside']:
   previous=page.evaluate('__LANDSCAPE.frames');page.evaluate('(v)=>__LANDSCAPE.bookmark(v)',name)
   page.wait_for_function(f'__LANDSCAPE.frames>{previous}',timeout=30000)
   page.evaluate('document.querySelector("canvas").getContext("webgl2").finish()')
   page.screenshot(path=str(out/(name+'.png')),timeout=60000)
  page.evaluate('__LANDSCAPE.bookmark("overview")');page.wait_for_timeout(150)
  page.mouse.move(1400,470);page.mouse.down();page.mouse.move(1530,525,steps=20);page.mouse.up();page.mouse.wheel(0,-120);page.wait_for_timeout(400)
  after=page.evaluate('({probe,snapshot:__LANDSCAPE.snapshot()})');after_hash=page.evaluate(async_digest)
  assert before_hash==after_hash;assert before['probe']['uploads']==after['probe']['uploads'];assert after['probe']['textures']==0;assert before['snapshot']['counts']==after['snapshot']['counts'];assert before['snapshot']['camera']!=after['snapshot']['camera']
  r['softwareDrawWindow']=page.evaluate("""async()=>{const start=performance.now(),f=__LANDSCAPE.frames;let frames=0;while(performance.now()-start<3000){__LANDSCAPE.bookmark(frames%2?'overview':'side');await new Promise(requestAnimationFrame);frames++}return {seconds:(performance.now()-start)/1000,submittedFrames:__LANDSCAPE.frames-f,hardwareClass:'CI SwiftShader; not end-user hardware'}}""")
  page.set_viewport_size({'width':390,'height':844});page.evaluate('__LANDSCAPE.bookmark("overview")');page.wait_for_timeout(300)
  page.evaluate('document.querySelector("canvas").getContext("webgl2").finish()');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.evaluate('__LANDSCAPE.snapshot().counts')==before['snapshot']['counts']
  page.screenshot(path=str(out/'mobile.png'),timeout=60000)
  assert page.evaluate('__LANDSCAPE.snapshot().glError')==0
  from PIL import Image
  import numpy as np
  img=np.asarray(Image.open(out/'overview.png').convert('RGB'));region=img[180:-160,500:-200];assert float(region.std())>12,'blank/flat screen'
  r.update(passed=not r['errors'],texturesAllocated=after['probe']['textures'],geometryUploadsDuringMotion=after['probe']['uploads']-before['probe']['uploads'],allGeometryBufferHashesUnchanged=True,backAndSideAndUndersideCaptured=True,desktopViewport=[2048,1152],mobileViewport=[390,844],physicalPhoneMeasured=False)
  b.close()
except Exception as e:r['errors'].append(str(e))
finally:
 (out/'browser.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps(r,ensure_ascii=False))
raise SystemExit(0 if r['passed'] else 1)
