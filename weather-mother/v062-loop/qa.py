"""Real Chromium tests. Pixel observations stay in memory; only numeric QA is saved."""
import hashlib,io,json,math,os,subprocess,sys,time
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
URL=os.environ.get('WEATHER_URL','http://127.0.0.1:8765/weather-mother/v062-loop/')
report={'version':'0.6.2-loop','url':URL,'status':'RUNNING','checks':[],'errors':[],'storedImageFiles':0,'aaaQualityApproved':False,'manualVisualAcceptance':False,'productionReady':False,'performanceHardware':'headless Chromium with SwiftShader; not the user GPU'}
def check(name,ok,details=None):
 report['checks'].append({'name':name,'pass':bool(ok),'details':details})
 print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+': '+repr(details))
def save():
 (R/('PUBLIC_QA.json' if os.environ.get('WEATHER_URL') else 'QA.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
def numeric_tests():
 script=r'''
 const fs=require('fs'),vm=require('vm'),M=require('./motion.js');
 let report={};
 const err=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
 report.signalSeam=err(M.loopSignal(0),M.loopSignal(1));
 report.phaseClock=Math.abs(M.phaseAdvance(.25,120,60)-.25);
 const eps=1e-5,d0=M.loopSignal(eps).map((v,i)=>(v-M.loopSignal(0)[i])/eps),d1=M.loopSignal(1).map((v,i)=>(v-M.loopSignal(1-eps)[i])/eps);
 report.derivativeSeam=err(d0,d1);
 report.pausePhase=M.phaseAdvance(.47,0,60)===.47;
 report.boltDeterminism=JSON.stringify(M.boltSegments(4217,1,[0,4.8,0]))===JSON.stringify(M.boltSegments(4217,1,[0,4.8,0]));
 report.boltSegments=M.boltSegments(4217,1,[0,4.8,0]).length;
 report.flashOff=M.lightning(5,1,0,1,false).strength===0;
 report.manualFlash=M.lightning(5.045,1,0,1,false,5).strength>0.9;
 const sandbox={self:{postMessage:()=>{}},console};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('field-worker.js','utf8'),sandbox);
 sandbox.dim=[40,24,32];sandbox.lo=[-19,-1,-16];sandbox.hi=[19,13,16];sandbox.data=new Uint8Array(40*24*32);
 for(let z=6;z<24;z++)for(let y=6;y<17;y++)for(let x=10;x<29;x++)sandbox.data[(z*24+y)*40+x]=(x+y+z)%3?255:0;
 sandbox.occ=vm.runInContext('occupancyField(data,dim,lo,hi)',sandbox);const oc=sandbox.occ;
 let excludedNonzero=0;
 const dims=sandbox.dim,lo=sandbox.lo,hi=sandbox.hi;
 for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++)if(sandbox.data[(z*dims[1]+y)*dims[0]+x]){
  const source=[x,y,z].map((v,k)=>lo[k]+(v+.5)*(hi[k]-lo[k])/dims[k]);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){
   const q=source.map((v,k)=>v+[a,b,c][k]*.56),ci=q.map((v,k)=>Math.max(0,Math.min(oc.size[k]-1,Math.floor((v-lo[k])/(hi[k]-lo[k])*oc.size[k]))));
   if(!oc.data[(ci[2]*oc.size[1]+ci[1])*oc.size[0]+ci[0]])excludedNonzero++;
  }
 }
 report.occupancyFalseExclusions=excludedNonzero;report.occupancyBytes=oc.data.length;
 console.log(JSON.stringify(report));
 '''
 out=subprocess.check_output(['node','-e',script],cwd=R,text=True)
 d=json.loads(out.strip().splitlines()[-1]);report['numeric']=d
 check('periodic signal endpoint identity',d['signalSeam']==0,d['signalSeam'])
 check('period accumulator closes after two cycles',d['phaseClock']<1e-12)
 check('periodic first derivative continuity',d['derivativeSeam']<.003,d['derivativeSeam'])
 check('zero delta preserves phase',d['pausePhase'])
 check('deterministic branched lightning',d['boltDeterminism'] and d['boltSegments']==15)
 check('disabled lightning is dark',d['flashOff'])
 check('manual event creates localized flash',d['manualFlash'])
 check('majorant never excludes displaced nonzero support',d['occupancyFalseExclusions']==0,d['occupancyFalseExclusions'])
 for file in ['engine.js','field-worker.js','motion.js']:subprocess.check_call(['node','--check',str(R/file)])
 check('javascript syntax',True)
 original=(R.parent/'v061-hq'/'index.html')
 if original.exists():
  import re
  baseline=set(re.findall(r'id="([^"]+)"',original.read_text()))
  current=set(re.findall(r'id="([^"]+)"',(R/'index.html').read_text()))
  check('all baseline workbench IDs preserved',baseline<=current,sorted(baseline-current))
def image_delta(a,b):
 st=ImageStat.Stat(ImageChops.difference(a,b));return {'mean':sum(st.mean)/len(st.mean),'rms':math.sqrt(sum(v*v for v in st.rms)/len(st.rms)),'max':max(h for l,h in st.extrema)}
try:
 numeric_tests()
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':480,'height':320},device_scale_factor=1)
  console_errors=[];failed=[];page.on('pageerror',lambda e:console_errors.append(str(e)))
  page.on('requestfailed',lambda r:failed.append({'url':r.url,'error':r.failure}))
  page.add_init_script("window.WeatherMotherBoot={still:true,quality:'balanced'};")
  response=page.goto(URL,wait_until='domcontentloaded',timeout=60000)
  check('document HTTP 200',response.status==200,response.status)
  page.wait_for_function('window.WeatherMother?.qa?.ready && window.WeatherMother.qa.frames>=1',timeout=120000)
  check('WebGL2 first actual frame',page.evaluate('WeatherMother.qa.lastGLerror')==0)
  check('zero source density on boundary',page.evaluate('WeatherMother.qa.borderInputMax')==0)
  page.evaluate("document.getElementById('temporal').checked=false;document.getElementById('temporal').dispatchEvent(new Event('change'));WeatherMother.set('cloudSpeed',0);WeatherMother.set('wind',0);window.__WEATHER_QA_SNAP__=true;")
  page.add_style_tag(content='.panel,.footer,#loading{visibility:hidden!important}')
  def settle():
   n=page.evaluate('WeatherMother.qa.frames');page.evaluate('window.__WEATHER_QA_SNAP__=true;WeatherMother.setLoopPhase(WeatherMother.getState().loopPhase)')
   page.wait_for_function('(n)=>WeatherMother.qa.frames>n',arg=n,timeout=90000)
   page.wait_for_timeout(180)
  def frame():return Image.open(io.BytesIO(page.locator('canvas').screenshot(timeout=90000))).convert('RGB')
  def phase(v):page.evaluate('(v)=>WeatherMother.setLoopPhase(v)',v);settle();return frame()
  a=phase(0);mid=phase(.5);z=phase(1)
  seam=image_delta(a,z);movement=image_delta(a,mid);report['loopPixels']={'seam':seam,'halfCycle':movement}
  check('visible morphology changes within loop',movement['rms']>.05,movement)
  check('same image at 0 and 100 percent with fixed external clocks',seam['max']<=1,seam)
  page.evaluate("document.getElementById('fastEmpty').checked=true;document.getElementById('fastEmpty').dispatchEvent(new Event('change'))");fast=phase(.25)
  page.evaluate("document.getElementById('fastEmpty').checked=false;document.getElementById('fastEmpty').dispatchEvent(new Event('change'))");slow=phase(.25)
  diff=image_delta(fast,slow);report['optimizationPixels']=diff
  check('empty-space optimization preserves image',diff['max']<=1,diff)
  page.evaluate("document.getElementById('fastEmpty').checked=true;WeatherMother.set('density',0)");settle();empty=frame()
  page.evaluate("WeatherMother.set('density',.86)");settle();full=frame()
  check('density slider changes real render',image_delta(empty,full)['rms']>2)
  for kind in ['Cu','Cb','Sc','St','Ns','Ac','As','Ci','Cc','Cs']:
   page.evaluate('(k)=>WeatherMother.setKind(k)',kind)
   page.wait_for_function('(k)=>WeatherMother.qa.activeCloudKind===k&&WeatherMother.getState().blend>=.999',arg=kind,timeout=120000)
   check('cloud genus '+kind,page.evaluate('WeatherMother.qa.supportSafe && WeatherMother.qa.lastGLerror===0'))
  page.evaluate("WeatherMother.setWeather('storm');WeatherMother.set('rain',0);document.getElementById('lightningEnabled').checked=false;")
  page.wait_for_function("WeatherMother.qa.activeCloudKind==='Cb'&&WeatherMother.getState().blend>=.999",timeout=120000)
  page.evaluate('WeatherMother.setTestTime(10)');settle();dark=frame()
  page.evaluate('WeatherMother.triggerLightning();WeatherMother.setTestTime(10.045)');settle();lit=frame()
  ld=image_delta(dark,lit);check('lightning changes actual cloud and bolt pixels',ld['rms']>.05,ld)
  page.evaluate("WeatherMother.setTestTime(11);WeatherMother.setWeather('fair');WeatherMother.set('cloudSpeed',25);WeatherMother.set('wind',0);WeatherMother.set('gust',0);WeatherMother.set('direction',270);WeatherMother.set('timeScale',1);document.getElementById('follow').checked=true;window.__WEATHER_QA_SNAP__=true")
  page.wait_for_function("WeatherMother.qa.activeCloudKind==='Cu'&&WeatherMother.getState().blend>=.999",timeout=120000)
  settle();s0=page.evaluate('WeatherMother.getState()');t0=page.evaluate('WeatherMother.qa.simulationTimeS')
  page.evaluate('WeatherMother.play()');page.wait_for_timeout(2200);page.evaluate('WeatherMother.pause()');settle()
  s1=page.evaluate('WeatherMother.getState()');t1=page.evaluate('WeatherMother.qa.simulationTimeS');dx=s1['windOffset'][0]-s0['windOffset'][0]
  check('independent cloud drift from west to east',dx>0 and abs(dx-.025*(t1-t0))<.003,{'dx':dx,'dt':t1-t0,'wind':s1['wind'],'speed':s1['cloudSpeed']})
  frozen=page.evaluate('WeatherMother.getState().loopPhase');page.wait_for_timeout(300)
  check('global pause freezes cyclic shape',abs(page.evaluate('WeatherMother.getState().loopPhase')-frozen)<1e-12)
  report['browser']= {'version':browser.version,'renderer':page.evaluate("(()=>{const g=document.getElementById('scene').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()"),'qa':page.evaluate('WeatherMother.qa'),'consoleErrors':console_errors,'failedRequests':failed}
  check('no browser page errors',not console_errors,console_errors)
  check('no failed runtime requests',not failed,failed)
  check('performance measurements are not fabricated',report['browser']['qa']['performance']['method'].startswith('completed GPU-frame cadence'))
  browser.close()
 report['status']='AUTOMATIC_QA_PASS'
except Exception as e:
 import traceback
 report['status']='QA_FAILED';report['errors'].append(traceback.format_exc());print(report['errors'][-1],flush=True)
finally:save()
if report['status']!='AUTOMATIC_QA_PASS':sys.exit(1)
print('FINISHED',len(report['checks']),'checks')
