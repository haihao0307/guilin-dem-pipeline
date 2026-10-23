#!/usr/bin/env python3
"""Cold isolation only. Original 60-second GPU guard and full native app output."""
import argparse,hashlib,json,mimetypes,time,traceback
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent;cfg=json.loads((root/'unified-perf-config.json').read_text());pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
url=cfg['targetUrl'].rstrip('/')+'/';report={'scope':'Private bounded cold startup isolation, NOT release or low-resolution acceptance. Every arm starts a fresh Chromium process. Original GPU 60-second guard unchanged. App arms use fixed1920x1080 DPR1 native output.','cases':[],'complete':False}
def save():(out/'r07-cold-isolation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def route_site(context,legacy=False,probe=False):
 files=cfg['variants']['candidate']['files'];data={rel:(root/spec['file']).read_bytes() for rel,spec in files.items()}
 if legacy:data['kowloon-building-mother-r01/whole-building-facade-r01/semantic-renderer.mjs']=(root/cfg['legacyRenderer']['file']).read_bytes()
 html=data['index.html'].decode();before='<script type="module" src="semantic-app.mjs"></script>';assert html.count(before)==1;data['index.html']=html.replace(before,'<script type="module" src="startup-probe.mjs"></script>').encode();data['startup-probe.mjs']=(root/'startup-probe.mjs').read_bytes();data['aperture-cold-probe.mjs']=(root/'aperture-cold-probe.mjs').read_bytes()
 def fulfill(route,request):
  u=urlsplit(request.url);base=urlsplit(url)
  if u.netloc!=base.netloc or not u.path.startswith(base.path):return route.abort('blockedbyclient')
  rel=u.path[len(base.path):] or 'index.html';assert rel in data,('Unfrozen dependency',rel)
  typ='text/javascript' if rel.endswith(('.js','.mjs')) else mimetypes.guess_type(rel)[0] or 'application/octet-stream';route.fulfill(status=200,body=data[rel],content_type=typ)
 context.route('**/*',fulfill)
for rel,spec in cfg['variants']['candidate']['files'].items():assert hashlib.sha256((root/spec['file']).read_bytes()).hexdigest()==spec['sha256'],('Changed freeze',rel)
assert hashlib.sha256((root/cfg['legacyRenderer']['file']).read_bytes()).hexdigest()==cfg['legacyRenderer']['sha256']
report['frozenBaseFiles']=len(cfg['variants']['candidate']['files']);report['legacyRenderer']=cfg['legacyRenderer'];save()
with sync_playwright() as pw:
 for name,legacy,tiny in [('r07-d-shader-flags-off',False,False),('r07-original-r06a-shader',True,False),('r07-d2-tiny-aperture-cold',False,True)]:
  browser=None;page=None;errors=[];case={'name':name,'legacyRenderer':legacy,'flagsOff':not tiny,'tinyProbe':tiny,'viewport':{'width':1920,'height':1080,'dpr':1},'diagnosticOnly':True,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'pageErrors':errors};report['cases'].append(case);save()
  try:
   browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);case['browserVersion']=browser.version;context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1);route_site(context,legacy=legacy);page=context.new_page();
   if tiny:page.add_init_script("window.__startupControl={flagsOff:false,tiny:true};")
   else:page.add_init_script("window.__startupControl={flagsOff:true,tiny:false};")
   page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url,wait_until='domcontentloaded')
   page.wait_for_function("()=>{const s=window.semanticInspection;return window.__tinyProbeDone||window.__qaBootError||s?.phase==='error'||(s?.ready&&!s.busy&&!s.renderer.busy);}",timeout=180000)
  except Exception:case['probeError']=traceback.format_exc()
  finally:
   if page:
    try:
     case['observed']=page.evaluate("""()=>{const s=window.semanticInspection,g=s?.renderer,c=g?.canvas,b=c?.getBoundingClientRect();return{phase:s?.phase,ready:s?.ready,busy:s?.busy,frames:s?.frames,errors:s?.errors,bootError:window.__qaBootError,probe:window.__startupProbe,tinyProbe:window.__tinyProbe,tinyProbeDone:window.__tinyProbeDone,display:s?.display,canvas:c?{width:c.width,height:c.height,cssWidth:b.width,cssHeight:b.height}:null,gpu:g?.gpu,compileStats:g?.compileStats,lifecycle:g?.lifecycle.snapshot()};}""")
     page.screenshot(path=str(out/(name+'.png')),timeout=10000)
    except Exception:case['readbackError']=traceback.format_exc()
   case['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
   if browser:browser.close()
  q=case.get('observed',{});print('COLD_ISOLATION',name,q.get('phase'),'fences',len(q.get('probe',{}).get('fences',[])),'completedFrames',len(q.get('frames',[])),flush=True)
report['complete']=True;save();print('Cold isolation observations recorded; no release acceptance asserted.',flush=True)
