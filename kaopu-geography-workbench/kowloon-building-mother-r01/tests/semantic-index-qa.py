#!/usr/bin/env python3
"""Candidate1 vs candidate2, unchanged perf app/source. Actual browser gate."""
import argparse,hashlib,json,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent;cfg=json.loads((root/'semantic-index-config.json').read_text());url=cfg['targetUrl'].rstrip('/')+'/'
pa=argparse.ArgumentParser();pa.add_argument('--output',default='public-inspection-evidence');args,_=pa.parse_known_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
r={'passed':False,'scope':'Actual software-GPU exact-output candidate1 vs primary-aperture-index candidate2; no resolution or geometry changes','variants':{},'comparisons':[],'errors':[],'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
def save():(out/'semantic-index-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def stable(page,id=None):page.wait_for_function("id=>{const s=window.semanticInspection;if(s?.errors?.length)throw Error(s.errors.join('\\n'));return s?.ready&&!s.renderer.busy&&(!id||s.caseId===id)}",arg=id,timeout=240000)
def capture(page,label):
 q=page.evaluate("""async()=>{const s=window.semanticInspection,g=s.renderer,p=g.readPixels(),hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''),hits=[];for(let y=7;y<s.lastStats.height;y+=61)for(let x=11;x<s.lastStats.width;x+=67)hits.push([x,y,g.readHit(x,y)]);return{stats:s.lastStats,camera:s.lastStats.camera,pixelSha256:hex(await crypto.subtle.digest('SHA-256',p)),hitSha256:hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(hits)))),invalidHits:hits.filter(x=>x[2].status>2.5).length,modelTriangles:g.stats.modelTriangles,modelVertexBuffers:g.stats.modelVertexBuffers,gpu:g.gpu};}""")
 assert q['stats']['width']==720 and q['stats']['height']==648 and q['modelTriangles']==q['modelVertexBuffers']==0 and not q['invalidHits'];r['variants'][variant]['frames'][label]=q;save();print(variant,label,round(q['stats']['wallMs']),flush=True);return q
with sync_playwright() as pw:
 browser=None
 try:
  browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);r['browserVersion']=browser.version
  verify=browser.new_context()
  for rel,wanted in cfg['publicSha256'].items():
   q=verify.request.get(url+rel,timeout=30000);assert q.status==200 and hashlib.sha256(q.body()).hexdigest()==wanted,('Public baseline changed',rel)
  verify.close()
  for name,v in cfg['variants'].items():
   for rel,asset in v.items():assert hashlib.sha256((root/asset['file']).read_bytes()).hexdigest()==asset['sha256'],('Local payload changed',name,rel)
  for variant,files in cfg['variants'].items():
   context=browser.new_context(viewport={'width':1280,'height':900},device_scale_factor=1)
   for rel,asset in files.items():
    body=(root/asset['file']).read_bytes();context.route(url+rel,lambda route,request,body=body:route.fulfill(status=200,body=body,content_type='text/javascript'))
   page=context.new_page();page.set_default_timeout(240000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));r['variants'][variant]={'frames':{},'pageErrors':errors}
   start=time.monotonic();page.goto(url,wait_until='domcontentloaded');stable(page,'lowrise');r['variants'][variant]['initialPageToCompleteMs']=(time.monotonic()-start)*1000
   page.evaluate('window.semanticInspection.render()');stable(page);capture(page,'lowrise-whole');page.screenshot(path=str(out/(variant+'-lowrise-whole.png')))
   for key in ['door','window']:
    page.evaluate("""async key=>{const s=window.semanticInspection,r=s.renderer,item=s.registry.find(q=>q.classKey===key&&q.part===(key==='door'?'leaf':'glass')&&q.bounds);if(!item)throw Error('Missing near-aperture target');s.inspect(item.objectId);const b=item.bounds,c=b.min.map((v,k)=>(v+b.max[k])/2),d=Math.max(1.4,...b.max.map((v,k)=>v-b.min[k])),n=item.focusNormal,eye=n?c.map((v,k)=>v+n[k]*d*1.8+(k===1?d*.12:0)):[c[0]+d*.85,c[1]+d*.55,c[2]-d*1.05];Object.assign(r.options,{target:c,eye,cut:false,sliceY:null});await s.render();}""",key);stable(page);capture(page,'lowrise-near-'+key);page.screenshot(path=str(out/(variant+'-near-'+key+'.png')))
   for view in ['cut','level']:
    page.evaluate('v=>window.semanticInspection.setView(v)',view);stable(page);capture(page,'lowrise-'+view)
   probes=page.evaluate((root/'aperture-probes.js').read_text(),variant=='candidate2');assert probes['parts']==41 and probes['probes']==410 and probes['hitProbes']>0;r['variants'][variant]['apertureProbes']=probes;save();print(variant,'all-aperture-probes',probes['probes'],flush=True)
   for id in ['kcc','warehouse']:
    page.evaluate('id=>window.semanticInspection.chooseCase(id)',id);stable(page,id);page.evaluate('window.semanticInspection.render()');stable(page);capture(page,id+'-whole')
    for view in (['plan','level'] if id=='kcc' else ['cut','level']):
     page.evaluate('v=>window.semanticInspection.setView(v)',view);stable(page);capture(page,id+'-'+view)
   assert not errors;save();context.close()
  first=r['variants']['candidate1'];second=r['variants']['candidate2']
  for label,a in first['frames'].items():
   b=second['frames'][label];cmp={'label':label,'sameCamera':a['camera']==b['camera'],'samePixels':a['pixelSha256']==b['pixelSha256'],'sameHits':a['hitSha256']==b['hitSha256'],'beforeMs':a['stats']['wallMs'],'afterMs':b['stats']['wallMs'],'index':b['stats']['primaryApertureIndex'],'apertureEmptyTilesSkipped':b['stats'].get('apertureEmptyTilesSkipped')};r['comparisons'].append(cmp);assert cmp['sameCamera'] and cmp['samePixels'] and cmp['sameHits'],cmp
  r['all410PrimaryRayProbesExact']=first['apertureProbes']['sha256']==second['apertureProbes']['sha256'];assert r['all410PrimaryRayProbesExact'];r['passed']=True
 except Exception:r['errors'].append(traceback.format_exc())
 finally:
  r['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
  if browser:browser.close()
if not r['passed']:print(json.dumps(r,ensure_ascii=False));raise SystemExit(1)
print('Aperture primary index exact-output A/B passed.',flush=True)
