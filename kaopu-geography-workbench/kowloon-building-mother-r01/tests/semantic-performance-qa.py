#!/usr/bin/env python3
"""Pinned original vs candidate, actual WebGL A/B. No production files change."""
import argparse,hashlib,json,time,traceback,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
cfg=json.loads((root/'semantic-performance-config.json').read_text())
pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');a,_=pa.parse_known_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
url=cfg['targetUrl'].rstrip('/')+'/'
r={'passed':False,'scope':'Actual Chromium SwiftShader A/B, not user-device FPS','startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'variants':{},'comparisons':[],'errors':[],'baselineHashes':{},'candidateHashes':{}}
def save():(out/'semantic-performance-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def stable(page,id=None):
 page.wait_for_function("id=>{const s=window.semanticInspection;if(s?.errors?.length)throw Error(s.errors.join('\\n'));return s?.ready&&!s.renderer.busy&&(!id||s.caseId===id)}",arg=id,timeout=240000)
def capture(page):return page.evaluate("""async()=>{const s=window.semanticInspection,g=s.renderer,p=g.readPixels(),hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''),hits=[];for(let y=7;y<s.lastStats.height;y+=61)for(let x=11;x<s.lastStats.width;x+=67)hits.push([x,y,g.readHit(x,y)]);return{stats:s.lastStats,camera:s.lastStats.camera,pixelSha256:hex(await crypto.subtle.digest('SHA-256',p)),hitSha256:hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(hits)))),hitCount:hits.length,invalidHits:hits.filter(x=>x[2].status>2.5).length,modelTriangles:g.stats.modelTriangles,modelVertexBuffers:g.stats.modelVertexBuffers,gpu:g.gpu,compileStats:g.compileStats,lifecycle:g.lifecycle.snapshot()};}""")
def instrument(page):page.evaluate("""()=>{const s=window.semanticInspection,g=s.renderer,render=g.render.bind(g);window.perfCalls=[];g.render=async function(...args){const started=performance.now(),l={...g.lifecycle.stats};const result=await render(...args);const completed=performance.now();window.perfCalls.push({started,completed,cancelled:result.cancelled,wallMs:result.wallMs,camera:result.camera,fenceCount:g.lifecycle.stats.submitted-l.submitted,polls:g.lifecycle.stats.polls-l.polls,requestRevision:result.requestRevision});return result;};}""")
with sync_playwright() as pw:
 browser=None
 try:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  r['browserVersion']=browser.version
  verify=browser.new_context()
  for rel,wanted in cfg['baselineSha256'].items():
   q=verify.request.get(url+rel,timeout=30000);digest=hashlib.sha256(q.body()).hexdigest();r['baselineHashes'][rel]={'httpStatus':q.status,'sha256':digest};save();assert q.status==200 and digest==wanted,('public baseline changed',rel,digest,wanted)
  verify.close()
  for rel,local in cfg['candidateFiles'].items():
   data=(root/local).read_bytes();digest=hashlib.sha256(data).hexdigest();r['candidateHashes'][rel]=digest;assert digest==cfg['candidateSha256'][rel]
  for variant in ['baseline','candidate']:
   context=browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1)
   if variant=='candidate':
    for rel,local in cfg['candidateFiles'].items():
     body=(root/local).read_bytes();context.route(url+rel,lambda route,body=body:route.fulfill(status=200,body=body,content_type='text/javascript'))
   page=context.new_page();page.set_default_timeout(240000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   observations={'cases':{},'pageErrors':errors};r['variants'][variant]=observations;start=time.monotonic();page.goto(url,wait_until='domcontentloaded');stable(page,'lowrise');observations['initialPageToCompleteMs']=(time.monotonic()-start)*1000;instrument(page)
   for id in ['lowrise','kcc','warehouse']:
    if id!='lowrise':page.evaluate('id=>window.semanticInspection.chooseCase(id)',id);stable(page,id)
    first=capture(page);assert first['modelTriangles']==first['modelVertexBuffers']==0 and not first['invalidHits'];case={'firstFrame':first,'warm':[]};observations['cases'][id]=case;save()
    base=page.evaluate('structuredClone(window.semanticInspection.renderer.options)')
    # Two predeclared, identical full-resolution cameras for both variants.
    for number in range(2):
     camera=json.loads(json.dumps(base))
     if number:
      dx=camera['eye'][0]-camera['target'][0];dz=camera['eye'][2]-camera['target'][2];co=.9975510002532796;si=.06994284733753277;camera['eye'][0]=camera['target'][0]+dx*co-dz*si;camera['eye'][2]=camera['target'][2]+dx*si+dz*co
     page.evaluate('async camera=>{Object.assign(window.semanticInspection.renderer.options,camera);await window.semanticInspection.render()}',camera);stable(page,id)
     result=capture(page);assert result['stats']['width']==720 and result['stats']['height']==648;assert not result['invalidHits'];case['warm'].append(result);save();print(variant,id,'warm',number,round(result['stats']['wallMs']),flush=True)
    page.screenshot(path=str(out/(variant+'-'+id+'-full-resolution.png')))
   # Real pointer events while KCC is rendering. Track completed GPU frame plus
   # next browser animation callback; this is NOT a photon/display-latency claim.
   page.evaluate("window.semanticInspection.chooseCase('kcc')");stable(page,'kcc');box=page.locator('#view').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5;page.mouse.move(x,y);page.mouse.down()
   start=page.evaluate('performance.now()');first_call=page.evaluate('window.perfCalls.length');frame_start=page.evaluate('window.semanticInspection.frames.length')
   for step in range(80):page.mouse.move(x+(step+1)*1.2,y+(step%5)*.3);time.sleep(.1)
   before_up=page.evaluate('({at:performance.now(),frames:window.semanticInspection.frames.length,calls:window.perfCalls.slice(),latest:structuredClone(window.semanticInspection.renderer.options)})');page.mouse.up();stable(page,'kcc');page.evaluate('new Promise(requestAnimationFrame)')
   done=page.evaluate('({at:performance.now(),frames:window.semanticInspection.frames.length,calls:window.perfCalls.slice(),camera:window.semanticInspection.lastStats.camera,latest:window.semanticInspection.renderer.options,errors:window.semanticInspection.errors})');calls=done['calls'][first_call:];completed=[q for q in calls if not q['cancelled']]
   interaction={'inputStart':start,'inputEnd':before_up['at'],'doneAt':done['at'],'completedDuringDrag':before_up['frames']-frame_start,'completedTotal':done['frames']-frame_start,'cancelledRenders':sum(1 for q in calls if q['cancelled']),'firstCompletedFrameAfterInputMs':completed[0]['completed']-start if completed else None,'lastCameraMatchesLatest':done['camera']['eye']==done['latest']['eye'] and done['camera']['target']==done['latest']['target'],'calls':calls}
   assert interaction['lastCameraMatchesLatest'] and completed and not done['errors'];observations['interaction']=interaction
   if variant=='candidate':assert interaction['completedDuringDrag']>0,('candidate still starves complete frames during sustained pointer movement',interaction)
   # Explicit cancellation drains submitted batches before setModel replacement.
   if variant=='candidate':
    cancellation=page.evaluate("""async()=>{const s=window.semanticInspection,g=s.renderer,before=g.lifecycle.stats.submitted,n=++g.requestRevision;const p=g.render({width:720,height:648,presentWidth:720,presentHeight:648,tileSize:96,source:true,design:true,requestRevision:n});setTimeout(()=>g.requestRevision++,0);const stats=await p,pending=g.lifecycle.snapshot().pendingFence;g.setModel(s.model,s.source);await s.render();return{cancelled:stats.cancelled,pendingAfterCancel:pending,busyAfter:g.busy,fences:g.lifecycle.stats.submitted-before,stats,errors:s.errors};}""")
    assert cancellation['cancelled'] and not cancellation['pendingAfterCancel'] and not cancellation['busyAfter'] and not cancellation['errors'];observations['cancellationModelReplacement']=cancellation
   assert not errors;save();context.close()
  for id in ['lowrise','kcc','warehouse']:
   b=r['variants']['baseline']['cases'][id];c=r['variants']['candidate']['cases'][id]
   for i in range(2):
    a,bv=b['warm'][i],c['warm'][i];cmp={'case':id,'camera':i,'sameCamera':a['camera']==bv['camera'],'samePixelSha256':a['pixelSha256']==bv['pixelSha256'],'sameHitSha256':a['hitSha256']==bv['hitSha256'],'beforeMs':a['stats']['wallMs'],'afterMs':bv['stats']['wallMs'],'candidateFenceCount':bv['stats']['fenceCount'],'candidatePollSleepWallMs':bv['stats']['pollSleepWallMs'],'candidateCpuSubmitWallMs':bv['stats']['cpuSubmitWallMs']};r['comparisons'].append(cmp)
    assert cmp['sameCamera'] and cmp['samePixelSha256'] and cmp['sameHitSha256'],cmp
  r['passed']=True
 except Exception:
  r['errors'].append(traceback.format_exc())
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps(r,ensure_ascii=False));raise SystemExit(1)
print('Actual fixed-resolution renderer A/B passed.',flush=True)
