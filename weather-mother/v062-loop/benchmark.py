"""Read-only public runtime A/B. No images, no forced lower quality, no FPS target."""
import json,time,urllib.request,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
BASE='https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/v062-loop/'
result={'version':'0.6.2-loop','status':'RUNNING','scope':'SwiftShader comparison only; not user hardware or AAA performance approval','publicURL':BASE,'windows':[],'storedImageFiles':0,'visualAcceptance':False,'aaaQualityApproved':False,'userHardwarePerformanceVerified':False}
def save():(R/'PERFORMANCE_AB.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
try:
 manifest=json.loads((R/'MANIFEST.json').read_text())
 for attempt in range(24):
  try:
   for name,entry in manifest['files'].items():
    with urllib.request.urlopen(BASE+name+'?ab='+entry['sha256'][:16],timeout=20) as r:
     assert r.status==200 and hashlib.sha256(r.read()).hexdigest()==entry['sha256'],name
   break
  except Exception:
   if attempt==23:raise
   time.sleep(10)
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':480,'height':320},device_scale_factor=1)
  page.add_init_script("window.WeatherMotherBoot={still:true,quality:'balanced',weather:'fair',hour:16};")
  page.goto(BASE+'?ab=062-r1',wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('WeatherMother.qa.ready&&WeatherMother.qa.frames>0',timeout=120000)
  page.evaluate("WeatherMother.set('timeScale',0);WeatherMother.set('wind',0);WeatherMother.set('cloudSpeed',0);document.getElementById('temporal').checked=false;document.getElementById('temporal').dispatchEvent(new Event('change'));WeatherMother.setLoopPhase(.25);window.__WEATHER_QA_SNAP__=true;")
  n=page.evaluate('WeatherMother.qa.frames');page.wait_for_function('(n)=>WeatherMother.qa.frames>n',arg=n,timeout=90000)
  page.evaluate('WeatherMother.play()')
  result['renderer']=page.evaluate("(()=>{const g=document.getElementById('scene').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()")
  result['browser']=b.version
  # Interleave off/on and reverse order to avoid selecting favorable windows.
  for enabled in [False,True,True,False,False,True]:
   page.evaluate('(v)=>{const e=document.getElementById("fastEmpty");e.checked=v;e.dispatchEvent(new Event("change"));}',enabled)
   n=page.evaluate('WeatherMother.qa.frames');page.wait_for_function('(n)=>WeatherMother.qa.frames>=n+3',arg=n,timeout=120000)
   page.evaluate('WeatherMother.resetMeasurements()')
   page.wait_for_function('WeatherMother.qa.errors.length>0||WeatherMother.qa.performance.samples>=5',timeout=120000)
   q=page.evaluate('WeatherMother.qa');assert not q['errors'],q['errors']
   st=page.evaluate('WeatherMother.getState()');assert st['timeScale']==0
   item={'fastEmpty':enabled,'performance':q['performance'],'renderSize':q['renderSize'],'raySteps':q['steps'],'seed':st['seed'],'kind':st['kind'],'phase':st['loopPhase'],'simTime':q['simulationTimeS']}
   result['windows'].append(item);print(json.dumps(item),flush=True)
  page.evaluate('WeatherMother.pause()');b.close()
 windows=result['windows'];assert len({tuple(w['renderSize']) for w in windows})==1 and len({w['raySteps'] for w in windows})==1
 assert len({w['phase'] for w in windows})==1 and len({w['simTime'] for w in windows})==1
 for mode,label in [(False,'off'),(True,'on')]:
  ww=[w['performance'] for w in windows if w['fastEmpty']==mode]
  result[label]={'frameP50ms_mean':sum(w['frameP50ms'] for w in ww)/len(ww),'frameP95ms_each':[w['frameP95ms'] for w in ww], 'gpuP50ms_mean':sum(w['gpuP50ms'] for w in ww)/len(ww) if all(w['gpuP50ms'] is not None for w in ww) else None}
 off=result['off']['gpuP50ms_mean'] or result['off']['frameP50ms_mean'];on=result['on']['gpuP50ms_mean'] or result['on']['frameP50ms_mean']
 result['meanTimeReductionPercent']=(off-on)/off*100;result['equalQualityAndScene']=True;result['status']='MEASURED'
except Exception:
 import traceback
 result['status']='MEASUREMENT_FAILED';result['error']=traceback.format_exc();print(result['error'],flush=True)
finally:save()
if result['status']!='MEASURED':raise SystemExit(1)
