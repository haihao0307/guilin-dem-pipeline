"""Original-worker catalogue sweep and original CommonViewer captures.
Completed failures remain failed; no generated images or alternate clothing.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import gzip,hashlib,json,os,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;A=P/'assets';D=P/'qa-continuation';D.mkdir(exist_ok=True)
BASE=os.environ.get('R04_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/')
SOURCE=os.environ.get('GITHUB_SHA','local');PUBLIC=BASE.startswith('https:')
CAT=json.loads((A/'catalogue.json').read_text())['rows'];LOCK=json.loads((A/'identity.json').read_text())
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
def digest(b):return hashlib.sha256(b).hexdigest()
def chromium(pw):
 args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']
 return pw.chromium.launch(headless=True,args=args,**({'executable_path':os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}))
HARNESS='''async id=>{
 const {sha,materialHash,facesOf}=await import('./source-contract.mjs');
 const lock=await(await fetch('assets/identity.json')).json();
 const row=(await(await fetch('assets/catalogue.json')).json()).rows.find(r=>r.id===id);
 const blob=await(await fetch(row.nativePaper)).blob();
 const text=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
 if(await sha(text)!==row.decodedSHA256)throw Error('Paper bytes differ');
 return await new Promise(resolve=>{
  const w=new Worker(new URL('native/kaopu-tailor-workbench/catalogue/native-adapter.mjs',location.href),{type:'module'});
  let spec=null,binding=null,lastStage=null,events=[];const start=performance.now();
  const finish=result=>{clearTimeout(timer);w.terminate();resolve({id,elapsedMs:performance.now()-start,events,lastStage,...result})};
  const timer=setTimeout(()=>finish({status:'native-time-budget',message:'180 second wall budget exhausted; no accepted result',material:window.materialSummary||null}),180000);
  w.onerror=e=>finish({status:'worker-error',message:e.message});
  w.onmessage=async({data:d})=>{try{
   events.push(d.type);if(events.length>24)events.shift();if(d.stage)lastStage=d.stage;
   if(d.type==='ready')w.postMessage({type:'load-native-paper',requestId:1,presetId:id,person:lock.person,paperText:text});
   else if(d.type==='paper'){
    spec=d.spec;binding=d.binding;
    if(await materialHash(spec)!==binding.materialSHA256)throw Error('Material hash mismatch');
    const area=p=>p.triangles.reduce((s,t)=>{const[a,b,c]=t.map(i=>p.uvMm[i]);return s+((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2},0);
    const polyarea=p=>Math.abs(p.boundary.reduce((s,id,i)=>{const a=p.uvMm[id],b=p.uvMm[p.boundary[(i+1)%p.boundary.length]];return s+a[0]*b[1]-a[1]*b[0]},0))/2;
    window.materialSummary={id,status:'native-material-ready',vertices:spec.panels.reduce((s,p)=>s+p.uvMm.length,0),triangles:facesOf(spec).length/3,binding,budget:spec.source.meshing.budgetPolicy,areaErrorMaxMm2:Math.max(...spec.panels.map(p=>Math.abs(area(p)-polyarea(p)))),maxPanelVertices:Math.max(...spec.panels.map(p=>p.uvMm.length)),maxPanelTriangles:Math.max(...spec.panels.map(p=>p.triangles.length))};
    if(!d.canSew){finish({status:'preflight-rejected',message:d.fitPreflight?.message,material:window.materialSummary});return}
    w.postMessage({type:'run',requestId:1,person:lock.person});
   }else if(d.type==='done'){
    if(JSON.stringify(d.binding)!==JSON.stringify(binding)||JSON.stringify(d.record.nativeBinding)!==JSON.stringify(binding))throw Error('Solver binding changed');
    finish({status:d.record.staticGate?.passed?'static-pass':'static-fail',material:window.materialSummary,packet:{spec,binding,record:d.record}});
   }else if(d.type==='error')finish({status:spec?'native-solve-abort':'native-material-rejected',message:d.message,material:window.materialSummary||null});
  }catch(e){finish({status:'contract-error',message:String(e)})}};
  w.postMessage({type:'boot',root:new URL('native/kaopu-tailor-workbench/',location.href).href,patternBase:new URL('native/kaopu-tailor-workbench/garment-pattern-catalogue-r01/browser/',location.href).href});
 });
}'''
def sweep_chunk(rows):
 results=[]
 with sync_playwright() as pw:
  b=chromium(pw);page=b.new_page();page.set_default_timeout(210000)
  page.goto(BASE+'probe.html',wait_until='domcontentloaded')
  for row in rows:
   try:
    page.evaluate('window.materialSummary=null')
    r=page.evaluate(HARNESS,row['id']);packet=r.pop('packet',None)
    if packet:
     raw=gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
     (A/'results'/f'{row["id"]}.json.gz').write_bytes(raw)
     r.update(file=row['id']+'.json.gz',sha256=digest(raw),qualityPassed=bool(packet['record']['staticGate']['passed']),gate=packet['record']['staticGate'])
    results.append(r);write(D/(row['id']+'-trial.json'),r)
    print('NATIVE_TRIAL',row['id'],r['status'],round(r['elapsedMs']/1000,2),flush=True)
   except Exception as e:
    r={'id':row['id'],'status':'harness-error','message':str(e)};results.append(r);write(D/(row['id']+'-trial.json'),r);print('HARNESS_ERROR',r,flush=True)
  b.close()
 return results

def sweep():
 (P/'probe.html').write_text('<!doctype html><html><head><link rel="icon" href="data:,"></head><body>Native worker verification only</body></html>')
 allresults=[];workers=4
 with ThreadPoolExecutor(max_workers=workers) as pool:
  for future in as_completed([pool.submit(sweep_chunk,CAT[i::workers]) for i in range(workers)]):allresults.extend(future.result())
 byid={r['id']:r for r in allresults};allresults=[byid[r['id']] for r in CAT]
 index={'source':'original-native-solver-only','sourceCommit':SOURCE,'person':LOCK['person'],'rows':{},'failed':{}}
 ready={'rows':{},'summary':{}};originalParity=json.loads((P/'NATIVE_PARITY.json').read_text())['checked'];checks=[]
 for r in allresults:
  m=r.get('material');id=r['id']
  if m:
   ready['rows'][id]={'status':'native-material-ready','reason':None,'vertices':m['vertices'],'budget':m['budget']}
   checks.append({'id':id,'areaPreserved':m['areaErrorMaxMm2']<.001,'nativeBudgetKept':m['maxPanelVertices']<=3000 and m['maxPanelTriangles']<=6000})
   orig=next(x for x in originalParity if x['id']==id)
   if orig['referenceOutcome']=='native-meshed':checks[-1]['unchangedMaterialSHA256']=m['binding']['materialSHA256']==orig['referenceMaterialSHA256']
  else:ready['rows'][id]={'status':'native-material-rejected','reason':r.get('message'),'vertices':0}
  if r.get('file'):index['rows'][id]={k:r[k] for k in ['file','sha256','qualityPassed']}|{'thumb':id+'.png','kind':'ORIGINAL_SOLVER_RESULT','person':LOCK['person']}
  else:index['failed'][id]={'phase':r['status'],'reason':r.get('message'),'kind':'NO_FINISHED_RESULT_NOT_REPLACED'}
 ready['summary']={'originalPapers':60,'nativeMaterialsReady':sum(bool(r.get('material')) for r in allresults),'nativeMaterialRejected':sum(not r.get('material') for r in allresults),'actualSolverRecords':len(index['rows']),'staticGatePassedRecords':sum(r['qualityPassed'] for r in index['rows'].values()),'all60GarmentsAccepted':False}
 summary={'sourceCommit':SOURCE,'person':LOCK['person'],'summary':ready['summary'],'all60Attempted':len(allresults)==60,'materialChecks':checks,'numericalSourceUnchanged':True,'sameBodyAndPaperInputs':True,'qualityThresholdsRaisedOrRelaxed':False,'trials':allresults,'allMaterialChecksPassed':all(all(v for k,v in c.items() if k!='id') for c in checks),'publicVerified':False}
 write(A/'results/index.json',index);write(A/'readiness.json',ready);write(P/'CONTINUATION_SWEEP.json',summary)
 assert len(allresults)==60 and summary['allMaterialChecksPassed']
 assert not any(r['status'] in ['contract-error','harness-error','worker-error'] for r in allresults)
 print('SWEEP_SUMMARY',ready['summary'],flush=True)

def render_verify():
 prefix='public-' if PUBLIC else '';errors=[];failedHTTP=[];forbidden=[];checks=[]
 def check(name,value):checks.append({'name':name,'passed':bool(value)});print('VERIFY',name,bool(value),flush=True)
 index=json.loads((A/'results/index.json').read_text());summary=json.loads((A/'readiness.json').read_text())['summary']
 with sync_playwright() as pw:
  b=chromium(pw);page=b.new_page(viewport={'width':1440,'height':1080})
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failedHTTP.append([r.url,r.status]) if r.status>=400 else None)
  page.on('request',lambda r:forbidden.append(r.url) if '/presets/r03/' in r.url or '/presets/r034-' in r.url else None)
  page.goto(BASE+'?preset=T01',wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.__R04?.state().ready',timeout=300000)
  state=page.evaluate('__R04.state()');check('Exact original common person/state/topology/adapter',state['person']==LOCK['person'] and state['commonVertexCount']==25417 and state['commonTriangleCount']==50624)
  check('No substitute body or display garments',not state['standaloneMannequin'] and not state['proxyGarment'] and not state['bodyScaling'])
  for id,r in index['rows'].items():
   page.evaluate('id=>__R04.select(id)',id);s=page.evaluate('__R04.state()')
   check('Exact original result '+id,s['phase']=='done' and s['renderCoordinateErrorM']==0 and s['clothIndexMatchesNative'] and s['staticGate']['passed']==r['qualityPassed'])
   if not PUBLIC:page.locator('#stage').screenshot(path=str(A/'results'/r['thumb']))
  for id in ['J06','T01','T03','T05','S02','P01']:
   page.evaluate('id=>__R04.select(id)',id);page.locator('#stage').screenshot(path=str(D/(prefix+id+'.png')))
  page.evaluate('__R04.select("T01")');page.screenshot(path=str(D/(prefix+'desktop.png')))
  page.locator('[data-view=side]').click();page.locator('#stage').screenshot(path=str(D/(prefix+'side.png')))
  page.locator('#search').fill('长袖');check('Search filters actual source styles',page.locator('#cards button').count()>0 and page.locator('#cards button').count()<60);page.locator('#search').fill('')
  preset=page.locator('#person option').nth(19).get_attribute('value');page.evaluate('id=>__R04.changePerson(id)',preset);s=page.evaluate('__R04.state()')
  check('Native preset changes original person and invalidates cloth',s['person']['geometrySHA256']!=LOCK['person']['geometrySHA256'] and s['clothVertices']==0 and not s['supportedPerson'])
  rejected=page.evaluate('async()=>{try{await __R04.loadPaper();return false}catch{return true}}');check('Direct API rejects wrong-person sewing inputs',rejected)
  page.evaluate('__R04.changePerson("default")');check('Default restores identical original model',page.evaluate('__R04.state().person')==LOCK['person'])
  page.evaluate('__R04.select("T01")');page.locator('[data-view=front]').click()
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250);page.screenshot(path=str(D/(prefix+'mobile.png')));check('Mobile 390x844 viewport has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('Exactly one original CommonViewer canvas',page.locator('canvas').count()==1)
  check('No R03 proxy requests and no page/HTTP errors',not errors and not failedHTTP and not forbidden)
  report={'sourceCommit':SOURCE,'url':BASE,'public':PUBLIC,'checks':checks,'passed':all(c['passed'] for c in checks),'pageErrors':errors,'httpErrors':failedHTTP,'proxyRequests':forbidden,'summary':summary,'physicalFitAccepted':False,'dynamicWearCertified':False,'mobileScope':'Chromium viewport, not physical phone'}
  write(P/('PUBLIC_CONTINUATION_REPORT.json' if PUBLIC else 'CONTINUATION_REPORT.json'),report);b.close()
 assert report['passed']
mode=os.environ.get('R04_MODE','sweep')
if mode=='sweep':sweep();render_verify()
elif mode=='render':render_verify()
else:raise ValueError(mode)
