"""Real browser QA. PNGs are evidence only and never renderer inputs."""
import argparse, hashlib, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',required=True);p.add_argument('--chromium');args=p.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
report={'method':'real Chromium module-worker and WebGL2 QA','sourceUrl':args.url,'cases':[], 'errors':[], 'artisticApproval':False,'productionReady':False}
spy="""(()=>{const proto=WebGL2RenderingContext.prototype;window.__gpuProbe={textures:0,uploads:0,draws:0,indexCounts:new Set()};for(const [name,run]of [['createTexture',function(){window.__gpuProbe.textures++}],['bufferData',function(){window.__gpuProbe.uploads++}],['drawElements',function(mode,count){window.__gpuProbe.draws++;window.__gpuProbe.indexCounts.add(count)}]]){const original=proto[name];proto[name]=function(...a){run(...a);return original.apply(this,a)}}})();"""
try:
 with sync_playwright() as pw:
  kw={'headless':True,'channel':'chromium','args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
  if args.chromium:kw['executable_path']=args.chromium;kw.pop('channel',None)
  browser=pw.chromium.launch(**kw)
  page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
  page.set_default_timeout(90000)
  page.add_init_script(spy)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.on('requestfailed',lambda r:report['errors'].append('request:'+r.url+':'+str(r.failure)))
  page.goto(args.url,wait_until='load',timeout=90000)
  def capture(name):
   report['captureInProgress']=name
   state=page.evaluate('() => window.__LM.renderer.waitForFrame()')
   report['lastCaptureState']=state
   assert not state['lost'] and state['error']==0,state
   page.screenshot(path=str(out/name),timeout=90000)
   report['captureInProgress']=None
  for case in ['karst','river','paddy']:
   if case!='karst':page.evaluate('(id)=>window.__LM.select(id)',case)
   page.wait_for_function("window.__LM?.ready || window.__LM?.error",timeout=180000)
   error=page.evaluate('window.__LM.error');assert not error,error
   audit=page.evaluate('window.__LM.audit');assert audit['caseId']==case;assert audit['river']['technicalPass'];assert audit['seams']['passed'];assert audit['spacing']==1 and audit['grid']==2049
   capture(f'{case}-overview.png')
   page.evaluate("window.__LM.bookmark('close')");page.wait_for_timeout(300);capture(f'{case}-close.png')
   before=page.evaluate('({state:window.__LM.snapshot(),uploads:window.__gpuProbe.uploads,textures:window.__gpuProbe.textures})')
   motion=[];page.mouse.move(870,410);page.mouse.down()
   for i in range(12):
    start=time.perf_counter();page.mouse.move(870+i*8,410+i*2);page.wait_for_timeout(40)
    s=page.evaluate('({state:window.__LM.snapshot(),uploads:window.__gpuProbe.uploads,textures:window.__gpuProbe.textures})')
    s['observedStepMs']=(time.perf_counter()-start)*1000;motion.append(s)
   page.mouse.up();page.mouse.wheel(0,-110);page.evaluate('() => window.__LM.renderer.waitForFrame()')
   after=page.evaluate('({state:window.__LM.snapshot(),uploads:window.__gpuProbe.uploads,textures:window.__gpuProbe.textures})')
   assert all(s['uploads']==before['uploads'] for s in motion+[after]),'camera rebuilt buffers'
   assert all(s['textures']==0 for s in motion+[after]),'texture allocation'
   assert all(s['state']['grid']==2049 and s['state']['terrainTriangles']==8388608 for s in motion+[after]),'geometry changed'
   assert before['state']['eye']!=after['state']['eye'],'camera did not move'
   assert page.evaluate('window.__LM.renderer.gl.getError()')==0
   report['cases'].append({'id':case,'audit':audit,'before':before,'after':after,'motion':motion,'textureAllocationsObserved':after['textures'],'bufferUploadsDuringMotion':after['uploads']-before['uploads']})
  page.set_viewport_size({'width':390,'height':844});page.evaluate("window.__LM.bookmark('overview')");page.wait_for_timeout(500)
  capture('mobile-paddy.png')
  mobile=page.evaluate('window.__LM.snapshot()');assert mobile['grid']==2049 and mobile['spacingM']==1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  report['mobile']=mobile;report['browserVersion']=browser.version;report['passed']=not report['errors']
  browser.close()
except Exception as e:
 report['passed']=False;report['errors'].append(str(e))
finally:
 (out/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps({'passed':report.get('passed',False),'cases':len(report['cases']),'errors':report['errors']},ensure_ascii=False))
raise SystemExit(0 if report.get('passed') else 1)
