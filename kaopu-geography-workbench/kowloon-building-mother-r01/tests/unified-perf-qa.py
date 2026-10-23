#!/usr/bin/env python3
"""Bounded first-frame diagnostics only. Never a release or full E2E pass."""
import argparse,hashlib,json,mimetypes,re,time,traceback
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent;cfg=json.loads((root/'unified-perf-config.json').read_text());pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
url=cfg['targetUrl'].rstrip('/')+'/';report={'scope':'Startup diagnostic, not end-to-end acceptance. Exact frozen111 source files; only HTML boot imports a QA observer before unchanged app. No shader/geometry/quality/draw order/fence cadence/guard changes. Each viewport uses a new browser process; never resize during a frame. SwiftShader software GPU only.','cases':[],'complete':False}
def save():(out/'r07-startup-diagnostic.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def route_site(context):
 files=cfg['variants']['candidate']['files'];data={rel:(root/spec['file']).read_bytes() for rel,spec in files.items()}
 html=data['index.html'].decode();before='<script type="module" src="semantic-app.mjs"></script>';assert html.count(before)==1;data['index.html']=html.replace(before,'<script type="module" src="startup-probe.mjs"></script>').encode();data['startup-probe.mjs']=(root/'startup-probe.mjs').read_bytes()
 def fulfill(route,request):
  u=urlsplit(request.url);base=urlsplit(url)
  if u.netloc!=base.netloc or not u.path.startswith(base.path):return route.abort('blockedbyclient')
  rel=u.path[len(base.path):] or 'index.html';assert rel in data,('Unfrozen dependency',rel)
  typ='text/javascript' if rel.endswith(('.js','.mjs')) else mimetypes.guess_type(rel)[0] or 'application/octet-stream';route.fulfill(status=200,body=data[rel],content_type=typ)
 context.route('**/*',fulfill)
for rel,spec in cfg['variants']['candidate']['files'].items():assert hashlib.sha256((root/spec['file']).read_bytes()).hexdigest()==spec['sha256'],('Changed freeze',rel)
report['rawSourceFiles']=len(cfg['variants']['candidate']['files']);report['bootstrapSha256']=hashlib.sha256((root/'startup-probe.mjs').read_bytes()).hexdigest();save()
with sync_playwright() as pw:
 for width,height in [(1920,1080),(1366,768)]:
  browser=None;page=None;errors=[];case={'viewport':{'width':width,'height':height,'dpr':1},'diagnosticOnly':True,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'pageErrors':errors};report['cases'].append(case);save()
  try:
   browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);case['browserVersion']=browser.version;context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1);route_site(context);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url,wait_until='domcontentloaded')
   page.wait_for_function("()=>{const s=window.semanticInspection;return window.__qaBootError||s?.phase==='error'||(s?.ready&&!s.busy&&!s.renderer.busy);}",timeout=180000)
  except Exception:case['probeError']=traceback.format_exc()
  finally:
   if page:
    try:
     case['observed']=page.evaluate("""()=>{const s=window.semanticInspection,g=s?.renderer,c=g?.canvas,b=c?.getBoundingClientRect();return{phase:s?.phase,ready:s?.ready,busy:s?.busy,frames:s?.frames,errors:s?.errors,bootError:window.__qaBootError,probe:window.__startupProbe,display:s?.display,canvas:c?{width:c.width,height:c.height,cssWidth:b.width,cssHeight:b.height}:null,gpu:g?.gpu,compileStats:g?.compileStats,lifecycle:g?.lifecycle.snapshot()};}""")
     page.screenshot(path=str(out/('startup-'+str(width)+'.png')),timeout=10000)
    except Exception:case['readbackError']=traceback.format_exc()
   case['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
   if browser:browser.close()
  q=case.get('observed',{});print('STARTUP_DIAGNOSTIC',width,q.get('phase'),'fences',len(q.get('probe',{}).get('fences',[])),'completedFrames',len(q.get('frames',[])),flush=True)
report['complete']=True;save();print('Diagnostic observations recorded; no release acceptance is asserted.',flush=True)
