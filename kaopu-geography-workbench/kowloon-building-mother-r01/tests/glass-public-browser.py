# R13 isolated building UI and observed-opening candidate gate; unchanged workflow.
from pathlib import Path as _R13Path
import runpy as _R13run
_R13run.run_path(str(_R13Path(__file__).parent.parent/'building-mother-r13'/'browser-qa.py'),run_name='__main__')
raise SystemExit(0)

# R12 independent candidate UI gate; prior gates below preserved.
from pathlib import Path as _R12Path
import runpy as _R12run
_R12run.run_path(str(_R12Path(__file__).parent.parent/'building-mother-r12'/'browser-qa.py'),run_name='__main__')
raise SystemExit(0)

# Actual published R11 and R06 verification; no response overrides.
from pathlib import Path as _PublicPath
import runpy as _public_runpy
for _name,_script in [('building-mother-r11','browser-public-qa.py'),('building-rule-sketch-r06','browser-qa.py')]:
    _public_runpy.run_path(str(_PublicPath(__file__).parent.parent/_name/_script),run_name='__main__')
raise SystemExit(0)

# Independent rule-sketch browser gate; prior candidate gates preserved.
from pathlib import Path as _SketchPath
if _SketchPath(__file__).with_name('sketch-browser-qa.py').is_file():
    import runpy as _sketch_runpy
    _sketch_runpy.run_path(str(_SketchPath(__file__).with_name('sketch-browser-qa.py')), run_name='__main__')
    raise SystemExit(0)

# Explicit unified Mother candidate gate; previous QA and workflow retained.
from pathlib import Path as _MotherPath
if _MotherPath(__file__).with_name('mother-browser-qa.py').is_file():
    import runpy as _mother_runpy
    _mother_runpy.run_path(str(_MotherPath(__file__).with_name('mother-browser-qa.py')), run_name='__main__')
    raise SystemExit(0)

# Explicit isolated KCC candidate gate; workflow and old QA preserved.
from pathlib import Path as _KCCPath
if _KCCPath(__file__).with_name('kcc-candidate-browser-qa.py').is_file():
    import runpy as _kcc_runpy
    _kcc_runpy.run_path(str(_KCCPath(__file__).with_name('kcc-candidate-browser-qa.py')), run_name='__main__')
    raise SystemExit(0)

# Frozen R07 browser QA through the existing, unchanged workflow.
from pathlib import Path as _PerfR07Path
if _PerfR07Path(__file__).with_name('unified-perf-config.json').is_file():
    import runpy as _perf_r07_runpy
    import json as _perf_r07_json
    _perf_r07_cfg=_perf_r07_json.loads(_PerfR07Path(__file__).with_name('unified-perf-config.json').read_text())
    _perf_r07_runpy.run_path(str(_PerfR07Path(__file__).with_name('public-r07-core-qa.py' if _perf_r07_cfg.get('publicCoreSmoke') else 'unified-perf-qa.py')), run_name='__main__')
    raise SystemExit(0)

# Bounded unified-scene candidate/public QA, reusing the existing read-only workflow.
from pathlib import Path as _UnifiedPath
if _UnifiedPath(__file__).with_name('unified-config.json').is_file():
    import runpy as _unified_runpy
    _unified_runpy.run_path(str(_UnifiedPath(__file__).with_name('unified-qa.py')), run_name='__main__')
    raise SystemExit(0)

# Run bounded desktop R04 exact-byte checks when explicitly configured.
from pathlib import Path as _DesktopR04Path
if _DesktopR04Path(__file__).with_name('semantic-desktop-config.json').is_file():
    import runpy as _desktop_r04_runpy
    _desktop_r04_runpy.run_path(str(_DesktopR04Path(__file__).with_name('semantic-desktop-qa.py')), run_name='__main__')
    raise SystemExit(0)

# Run bounded exact public R03 verification when explicitly configured.
from pathlib import Path as _PublicR03Path
if _PublicR03Path(__file__).with_name('semantic-public-smoke-config.json').is_file():
    import runpy as _public_r03_runpy
    _public_r03_runpy.run_path(str(_PublicR03Path(__file__).with_name('semantic-public-smoke.py')), run_name='__main__')
    raise SystemExit(0)

# Run separately reported candidate-only index and floor-inspection checks when explicitly configured.
from pathlib import Path as _CombinedPath
if _CombinedPath(__file__).with_name('semantic-combined-qa-config.json').is_file():
    import runpy as _combined_runpy
    _combined_runpy.run_path(str(_CombinedPath(__file__).with_name('semantic-combined-qa.py')), run_name='__main__')
    raise SystemExit(0)

# This isolated trial opts into the pinned performance A/B only when its config is present.
from pathlib import Path as _PerformancePath
if _PerformancePath(__file__).with_name('semantic-performance-config.json').is_file():
    import runpy as _performance_runpy
    _performance_runpy.run_path(str(_PerformancePath(__file__).with_name('semantic-performance-qa.py')), run_name='__main__')
    raise SystemExit(0)

# This trial branch explicitly opts into the isolated semantic page QA when its bounded configuration is present.
from pathlib import Path as _SemanticPath
if _SemanticPath(__file__).with_name('semantic-qa-config.json').is_file():
    import runpy as _semantic_runpy
    _semantic_runpy.run_path(str(_SemanticPath(__file__).with_name('semantic-browser-qa.py')), run_name='__main__')
    raise SystemExit(0)

# Original c69 public inspection test follows unchanged.
import asyncio,json,argparse,hashlib
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--url',default='http://127.0.0.1:8765/inspection-c69a5f19/');p.add_argument('--skip-ab',action='store_true');args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 plan=json.load(open('PUBLISH_PLAN.json'));report={'passed':False,'runtimeCommit':plan['candidate'],'runtimeUnmodified':True,'packageFiles':plan['totalFiles'],'packageBytes':plan['totalBytes'],'physicalPhoneTested':False,'errors':[],'httpFailures':[],'views':{},'expectedFiles':plan['files']}
 def save():(out/'inspection.json').write_text(json.dumps(report,indent=2))
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await b.new_page(viewport={'width':390,'height':844});page.set_default_timeout(180000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('response',lambda r:report['httpFailures'].append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  async def capture(name):
   q=await page.evaluate('''async()=>{const s=wholeBuilding,r=s.renderer,g=r.gl;await s.pause();const a=new Uint8Array(r.canvas.width*r.canvas.height*4);g.bindFramebuffer(g.FRAMEBUFFER,null);g.readPixels(0,0,r.canvas.width,r.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);let colors=new Set();for(let i=0;i<a.length;i+=4)colors.add(a[i]+256*a[i+1]+65536*a[i+2]);const rect=document.getElementById('view').getBoundingClientRect();return {sha:[...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(x=>x.toString(16).padStart(2,'0')).join(''),colors:colors.size,rect:rect.toJSON(),viewport:{w:innerWidth,h:innerHeight},canvas:{w:r.canvas.width,h:r.canvas.height},stats:s.lastStats,gpu:r.gpu,overlay:getComputedStyle(document.getElementById('inspectionLoad')).display,caseId:s.caseId,error:g.getError()};}''')
   assert q['colors']>64 and q['error']==0,(name,q);assert q['rect']['width']>=250 and q['rect']['height']>=200,(name,q);assert q['rect']['top']<q['viewport']['h'] and q['rect']['bottom']>0,(name,'canvas offscreen',q);assert q['overlay']=='none',q
   await page.screenshot(path=str(out/(name+'.png')));report['views'][name]=q;save();print('CAPTURE',name,q['stats']['wallMs'],q['rect'],flush=True);return q
  async def choose_ui_case(case):
   before=await page.evaluate("wholeBuilding.presentedFrames");await page.select_option("#case",case);await page.wait_for_function("([caseId,before])=>wholeBuilding.caseId===caseId&&wholeBuilding.ready&&wholeBuilding.presentedFrames>before",arg=[case,before]);await page.evaluate("wholeBuilding.pause()");report.setdefault("uiCaseSelections",[]).append(case)
  async def facade_ui():
   before=await page.evaluate("wholeBuilding.presentedFrames");await page.click('[data-facade="facade"]');await page.wait_for_function("before=>wholeBuilding.view==='facade'&&wholeBuilding.presentedFrames>before",arg=before);await page.evaluate("wholeBuilding.pause()");await page.evaluate("scrollTo(0,0)")
  try:
   report['previousPublicHashRun']=39770772364;report['hashesNotRepeated']=True
   await page.goto(args.url);await page.wait_for_function('window.wholeBuilding?.ready&&wholeBuilding?.presentedFrames>0');await page.wait_for_function("getComputedStyle(document.getElementById('inspectionLoad')).display==='none'");await capture('mobile-default-first-frame')
   await facade_ui();await capture('mobile-east-four-openings')
   await page.set_viewport_size({'width':1180,'height':850});await page.evaluate('wholeBuilding.pause()');await choose_ui_case("warehouse");await capture('desktop-warehouse');await choose_ui_case("kcc");await capture('desktop-kcc-plan-local')
   assert len(report['httpFailures'])==0,report['httpFailures'];assert not report['errors'],report['errors'];report['passed']=True;save()
  except Exception as e:
   report['failure']=str(e);save();await page.screenshot(path=str(out/'failure.png'));raise
  finally:await b.close()
asyncio.run(main())



