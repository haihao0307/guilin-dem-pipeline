"""Actual browser pixels stay in process memory. Only source and numeric QA persist."""
import io,json,math,os,subprocess,sys,time,hashlib,re
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
URL=os.environ.get('WEATHER_URL','http://127.0.0.1:8765/weather-mother/v063-optics/')
report={'version':'0.6.3-optics','url':URL,'status':'RUNNING','checks':[],'errors':[],'storedImages':0,'visualAcceptance':False,'aaaQualityApproved':False,'productionReady':False,'hardwareScope':'Chromium SwiftShader; no user-GPU or universal frame-rate claim'}
def check(name,ok,data=None):
 report['checks'].append({'name':name,'pass':bool(ok),'details':data});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+': '+str(data))
def delta(a,b):
 st=ImageStat.Stat(ImageChops.difference(a,b));return {'mean':sum(st.mean)/3,'rms':math.sqrt(sum(v*v for v in st.rms)/3),'max':max(t[1] for t in st.extrema)}
def numeric():
 script=r'''
 const fs=require('fs'),vm=require('vm'),O=require('./optics.js'),M=require('./motion.js'),crypto=require('crypto');
 let r={};r.airyCenter=O.airy(0);r.airyFirstZero=O.airy(3.83170597);r.j1at8=O.j1(8);
 const a=O.makeDiffractionLUT(),b=O.makeDiffractionLUT(),sha=d=>crypto.createHash('sha256').update(Buffer.from(d.buffer)).digest('hex');
 r.lutDeterministic=sha(a.data)===sha(b.data);r.lutBytes=a.data.byteLength;r.lutFinite=Array.from(a.data).every(Number.isFinite);
 r.spectralVariation=Math.max(...O.diffractionRGB(.105,4.8).slice(0,3).map((v,i)=>Math.abs(v-O.diffractionRGB(.105,7.4)[i])));
 const ch=O.channel(4217,13,[0,4.8,0],'ground'),cc=O.channel(4217,13,[0,4.8,0],'intra');r.channelCount=ch.count;r.channelDeterminism=sha(ch.data)===sha(O.channel(4217,13,[0,4.8,0],'ground').data);r.finiteChannels=Array.from(ch.data).every(Number.isFinite);r.groundEndpoint=ch.segments[63][4];r.intracloudEndpoint=cc.segments[63][4];
 r.trunkContinuous=ch.segments.slice(1,64).every((v,k)=>v.slice(0,3).every((x,i)=>x===ch.segments[k][3+i]));r.eventReuse=O.lightning(10.025,42,6,1,true,10,'ground',1).key===O.lightning(10.07,42,6,1,true,10,'ground',1).key;
 r.flashDark=O.lightning(10,42,0,1,false).strength===0;r.flashPeak=O.lightning(10.025,42,0,1,false,10,'ground',1).strength>0.5;
 const box={self:{postMessage:()=>{}},console};vm.createContext(box);vm.runInContext(fs.readFileSync('field-worker.js','utf8'),box);
 box.size=[9,7,8];box.mask=new Uint8Array(9*7*8);const seeds=[[1,2,3],[6,4,5],[8,0,1]];for(const[x,y,z]of seeds)box.mask[(z*7+y)*9+x]=255;
 const d=vm.runInContext('occupancyDistance(mask,size)',box);let mismatch=0;for(let z=0;z<8;z++)for(let y=0;y<7;y++)for(let x=0;x<9;x++){const expected=Math.min(...seeds.map(p=>Math.max(Math.abs(p[0]-x),Math.abs(p[1]-y),Math.abs(p[2]-z))));if(d[(z*7+y)*9+x]!==expected)mismatch++;}r.distanceMismatches=mismatch;
 console.log(JSON.stringify(r));
 '''
 d=json.loads(subprocess.check_output(['node','-e',script],cwd=R,text=True).strip().splitlines()[-1]);report['numeric']=d
 check('Airy centre and first zero',d['airyCenter']==1 and d['airyFirstZero']<1e-12,d)
 check('Bessel transition accuracy',abs(d['j1at8']-.2346363468539146)<.00002)
 check('deterministic finite spectral LUT',d['lutDeterministic'] and d['lutFinite'])
 check('droplet radius changes spectral pattern',d['spectralVariation']>.05,d['spectralVariation'])
 check('connected fine lightning trunk',d['trunkContinuous'] and d['channelCount']==136 and d['finiteChannels'])
 check('channel retained across return strokes',d['channelDeterminism'] and d['eventReuse'])
 check('cloud and ground discharge are distinct',d['groundEndpoint']<.03 and d['intracloudEndpoint']>4)
 check('disabled and triggered lightning',d['flashDark'] and d['flashPeak'])
 check('distance field equals brute-force nearest occupied cell',d['distanceMismatches']==0)
 for n in ['engine.js','field-worker.js','motion.js','optics.js']:subprocess.check_call(['node','--check',str(R/n)])
 check('all JavaScript syntax',True)
 a=(R.parent/'v062-loop'/'index.html').read_text();b=(R/'index.html').read_text();old=set(re.findall(r'id="([^"]+)"',a));new=set(re.findall(r'id="([^"]+)"',b));check('all prior workbench controls preserved',old<=new,sorted(old-new))
try:
 numeric()
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':480,'height':320},device_scale_factor=1);page_errors=[];console_errors=[];failed=[]
  page.on('pageerror',lambda e:page_errors.append(str(e)))
  page.on('console',lambda m:console_errors.append(m.text) if m.type=='error' else None)
  page.on('requestfailed',lambda r:failed.append(r.url))
  page.add_init_script("window.WeatherMotherBoot={still:true,quality:'balanced',weather:'fair'};")
  res=page.goto(URL,wait_until='domcontentloaded',timeout=60000);check('HTTP 200 document',res.status==200)
  page.wait_for_function('window.WeatherMother?.qa?.errors?.length || (window.WeatherMother?.qa?.ready&&WeatherMother.qa.frames>0)',timeout=120000)
  check('shader links and first frame',not page.evaluate('WeatherMother.qa.errors') and page.evaluate('WeatherMother.qa.lastGLerror')==0,page.evaluate('WeatherMother.qa.errors'))
  page.add_style_tag(content='.panel,.footer,#loading{visibility:hidden!important}')
  page.evaluate("document.getElementById('temporal').checked=false;document.getElementById('temporal').dispatchEvent(new Event('change'));WeatherMother.set('cloudSpeed',0);WeatherMother.set('wind',0);WeatherMother.set('gust',0);window.__WEATHER_QA_SNAP__=true;")
  def settle():
   n=page.evaluate('WeatherMother.qa.frames');page.evaluate('window.__WEATHER_QA_SNAP__=true;WeatherMother.setLoopPhase(WeatherMother.getState().loopPhase)');page.wait_for_function('(n)=>WeatherMother.qa.errors.length || WeatherMother.qa.frames>n',arg=n,timeout=90000)
   if page.evaluate('WeatherMother.qa.errors'):raise RuntimeError(page.evaluate('WeatherMother.qa.errors'))
  def frame():return Image.open(io.BytesIO(page.locator('canvas').screenshot(timeout=90000))).convert('RGB')
  def setting(k,v):page.evaluate('(a)=>WeatherMother.set(a[0],a[1])',[k,v]);settle()
  def toggle(k,v):page.evaluate('(a)=>{const e=document.getElementById(a[0]);e.checked=a[1];e.dispatchEvent(new Event("change"));}',[k,v]);settle()
  def preset(k):
   page.evaluate('(k)=>WeatherMother.setWeather(k)',k);page.wait_for_function("document.getElementById('loading').style.display==='none'",timeout=120000);settle()
  settle();check('sixteen cases present',page.locator('#weather option').count()==16)
  base0=frame();page.evaluate('WeatherMother.setLoopPhase(.5)');settle();mid=frame();page.evaluate('WeatherMother.setLoopPhase(1)');settle();end=frame()
  ds=delta(base0,end);report['loopSeam']=ds;check('shape loop endpoints retained',ds['max']<=1,ds)
  check('shape changes inside cycle',delta(base0,mid)['rms']>.05)
  report['traversalPixels']=[]
  for phase in [0,.25,.50,.85]:
   page.evaluate('(v)=>WeatherMother.setLoopPhase(v)',phase);toggle('skipEmpty',False);ref=frame();toggle('skipEmpty',True);fast=frame();d=delta(ref,fast);report['traversalPixels'].append({'phase':phase,**d});check('equal-quality empty traversal phase '+str(phase),d['max']<=1,d)
  preset('iridescent');on=frame();toggle('iridescence',False);off=frame();d=delta(on,off);report['iridescencePixels']=d;check('iridescence visible in actual cloud pixels',d['rms']>.05,d)
  toggle('iridescence',True);setting('density',0);zero_on=frame();toggle('iridescence',False);zero_off=frame();d=delta(zero_on,zero_off);check('zero density has no floating colour overlay',d['max']<=1,d)
  setting('density',.32);toggle('iridescence',True);setting('hour',22);night_on=frame();toggle('iridescence',False);night_off=frame();d=delta(night_on,night_off);check('solar iridescence absent at night',d['max']<=1,d)
  for k in ['fair','coast','mountain','rain','storm','rainbow','snow','high','iridescent','irisEdge','lenticular','mackerel','dawn','sunset','fogbank','nightstorm']:
   preset(k);q=page.evaluate('WeatherMother.qa');check('case '+k,q['supportSafe'] and q['borderInputMax']==0 and q['lastGLerror']==0,{'genus':q['activeCloudKind'],'lobes':q['lobes']})
  preset('fair')
  for k in ['Cu','Cb','Sc','St','Ns','Ac','As','Ci','Cc','Cs']:
   page.evaluate('(k)=>WeatherMother.setKind(k)',k);page.wait_for_function("document.getElementById('loading').style.display==='none'",timeout=120000);settle();check('cloud genus '+k,page.evaluate('WeatherMother.qa.supportSafe&&WeatherMother.qa.lastGLerror===0'))
  preset('nightstorm');setting('rain',0);toggle('lightningEnabled',False)
  report['lightningPixels']=[]
  for mode in ['intra','ground']:
   page.evaluate('(k)=>document.getElementById("dischargeMode").value=k',mode);page.evaluate('WeatherMother.setTestTime(10)');settle();dark=frame();page.evaluate('WeatherMother.triggerLightning();WeatherMother.setTestTime(10.025)');settle();lit=frame();d=delta(dark,lit);report['lightningPixels'].append({'kind':mode,**d});check('localized '+mode+' lightning real pixels',d['rms']>.05,d)
  check('no page errors',not page_errors,page_errors);check('no console errors',not console_errors,console_errors);check('no failed requests',not failed,failed)
  report['browser']={'version':b.version,'renderer':page.evaluate("(()=>{const g=document.getElementById('scene').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()"),'qa':page.evaluate('WeatherMother.qa')}
  # Matched static scene, same grid and ray count, real completed-frame timings.
  if not os.environ.get('WEATHER_URL'):
   preset('fair');setting('wind',0);setting('cloudSpeed',0);setting('gust',0);setting('timeScale',0);toggle('lightningEnabled',False);toggle('temporal',False);page.evaluate('WeatherMother.setLoopPhase(.25)');settle();page.evaluate('WeatherMother.play()');windows=[]
   for enabled in [False,True,True,False,False,True]:
    page.evaluate('(v)=>{const e=document.getElementById("skipEmpty");e.checked=v;e.dispatchEvent(new Event("change"));}',enabled);n=page.evaluate('WeatherMother.qa.frames');page.wait_for_function('(n)=>WeatherMother.qa.frames>=n+2',arg=n,timeout=90000);n=page.evaluate('(()=>{WeatherMother.resetMeasurements();return WeatherMother.qa.frames})()');page.wait_for_function('(n)=>WeatherMother.qa.frames>=n+6&&WeatherMother.qa.performance.samples>=4',arg=n,timeout=120000);q=page.evaluate('WeatherMother.qa');windows.append({'skipEmpty':enabled,'startFrame':n,'endFrame':q['frames'],'renderSize':q['renderSize'],'raySteps':q['steps'],'performance':q['performance']});print('TIMING',json.dumps(windows[-1]),flush=True)
   page.evaluate('WeatherMother.pause()');off=[v['performance']['gpuP50ms'] for v in windows if not v['skipEmpty']];on=[v['performance']['gpuP50ms'] for v in windows if v['skipEmpty']];report['performanceAB']={'windows':windows,'sameQuality':len({(tuple(v['renderSize']),v['raySteps']) for v in windows})==1,'scope':'software renderer only','gpuMedianMeanOffMs':sum(off)/3 if all(v is not None for v in off) else None,'gpuMedianMeanOnMs':sum(on)/3 if all(v is not None for v in on) else None};check('performance comparison preserves quality',report['performanceAB']['sameQuality'])
  b.close()
 report['status']='AUTOMATIC_QA_PASS'
except Exception:
 import traceback
 report['status']='QA_FAILED';report['errors'].append(traceback.format_exc());print(report['errors'][-1],flush=True)
finally:
 try:
  if 'page' in globals() and not page.is_closed():report['failureState']=page.evaluate('WeatherMother.qa')
 except Exception:pass
 (R/('PUBLIC_QA.json' if os.environ.get('WEATHER_URL') else 'QA.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if report['status']!='AUTOMATIC_QA_PASS':raise SystemExit(1)
print('FINISHED',len(report['checks']),'checks',flush=True)
