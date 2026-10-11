"""Two independent public-browser native solves. No tolerance is relaxed and no solved vertex is edited."""
from pathlib import Path
import os,json,gzip,hashlib,time,traceback,base64,shutil
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;STATE=json.loads((P/'R0434_RELEASE_STATE.json').read_text());BASE=STATE['fixedURL'].split('?')[0]
OUT=P/'qa-r0434-replay';OUT.mkdir(exist_ok=True)
R={'url':BASE,'actualPublicBrowser':True,'checks':[],'pageErrors':[],'passed':False,'replacedSolverMath':False,'editedSolvedVertices':False,'outputToleranceMm':1e-5,'allGarmentsAccepted':False}
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,d):(OUT/n).write_text(json.dumps(d,ensure_ascii=False,indent=2))
def check(n,b,d=None):R['checks'].append({'name':n,'passed':bool(b),'detail':d});print(n,bool(b),d,flush=True)
def error(a,b):
 assert len(a)==len(b) and all(len(u)==len(v) for u,v in zip(a,b))
 return max(abs(x-y) for u,v in zip(a,b) for x,y in zip(u,v))
try:
 index=json.loads((P/'assets/results/index.json').read_text());oldbytes=(P/'assets/results'/index['rows']['T08']['file']).read_bytes();assert sha(oldbytes)==index['rows']['T08']['sha256'];old=json.loads(gzip.decompress(oldbytes))
 (OUT/'T08-node-before.json.gz').write_bytes(oldbytes)
 packets=[];surfaces=[];timings=[]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  for run in range(2):
   context=browser.new_context(viewport={'width':1440,'height':1080});page=context.new_page();page.set_default_timeout(300000)
   page.on('pageerror',lambda e:R['pageErrors'].append(str(e)))
   page.goto(BASE+'?preset=T08',wait_until='domcontentloaded');page.wait_for_function('window.__R04?.state().ready')
   page.locator('#read-paper').click();page.wait_for_function('__R04.state().phase==="paper"');material=page.evaluate('__R04.materialPacket()');save(f'T08-run{run+1}-material.json',material)
   page.locator('#sew').click();start=time.monotonic()
   while time.monotonic()-start<900:
    s=page.evaluate('(()=>{let s=__R04.state();return {phase:s.phase,error:s.error,coords:s.renderCoordinateErrorM,indices:s.clothIndexMatchesNative}})()')
    if s['phase'] in ['done','failed','checkpoint']:break
    if s['phase']=='paused':page.locator('#resume').click()
    page.wait_for_timeout(400)
   timings.append(time.monotonic()-start);packet=page.evaluate('__R04.packet()');assert packet is not None,s
   packets.append(packet);surfaces.append(material)
   (OUT/f'T08-run{run+1}.json.gz').write_bytes(gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
   check(f'fresh independent browser {run+1}: real native completion, topology and unmodified thresholds',s['phase']=='done' and s['coords']==0 and s['indices'] and packet['record']['staticGate']['passed'] and packet['record']['staticGate']['thresholds']==old['record']['staticGate']['thresholds'],{'seconds':timings[-1],'materialSHA256':packet['binding']['materialSHA256']})
   check(f'fresh independent browser {run+1}: same original body and paper',all(packet['binding'][k]==old['binding'][k] for k in ['person','presetId','recipeHash','paperSHA256','nativeAnchor','patternSizingOrigin']))
   maxuv=0
   assert len(packet['spec']['panels'])==len(old['spec']['panels'])
   for a,b in zip(packet['spec']['panels'],old['spec']['panels']):
    assert a['id']==b['id'] and a['triangles']==b['triangles'];maxuv=max(maxuv,error(a['uvMm'],b['uvMm']))
   assert len(packet['spec']['seams'])==len(old['spec']['seams'])
   for a,b in zip(packet['spec']['seams'],old['spec']['seams']):
    assert all(a[k]==b[k] for k in ['id','a','b','stitchVertexPairs'])
   check(f'fresh independent browser {run+1}: source triangulation and stitch pairs unchanged; only compiler roundoff in rest coordinates',maxuv<1e-9,{'maxRecompiledUVDifferenceMm':maxuv,'oldMaterialSHA256':old['binding']['materialSHA256'],'browserMaterialSHA256':packet['binding']['materialSHA256'],'finalDifferenceFromNodeMm':error(packet['record']['positionsMm'],old['record']['positionsMm'])})
   page.evaluate('__R04.focus("scene")');views=[]
   for view in ['three','front','rear','side']:
    page.evaluate('v=>__R04.view(v)',view);views.append({'view':view,**page.evaluate('__R04.displayAudit()')});page.locator('#stage').screenshot(path=str(OUT/f'T08-run{run+1}-{view}.png'))
   check(f'fresh independent browser {run+1}: all four views framed',all(v['framed'] for v in views))
   if run==1:
    R['views']=views;page.evaluate('__R04.view("three")');thumb=base64.b64decode(page.evaluate('__R04.thumbnail()').split(',',1)[1]);(OUT/'T08.png').write_bytes(thumb)
    outfit_rows=[]
    for outfit in page.evaluate('__R04.outfits().filter(x=>x.members[0]==="T08")'):
     page.evaluate('id=>__R04.select(id)',outfit['id']);page.evaluate('__R04.view("three");__R04.focus("scene")');st=page.evaluate('(()=>{let s=__R04.state();return {id:s.selectedId,phase:s.phase,meshes:s.display.garmentMeshes,framed:s.display.framed,coords:s.renderCoordinateErrorM,indices:s.clothIndexMatchesNative,members:s.outfit.members.map(m=>m.presetId)}})()');data=base64.b64decode(page.evaluate('__R04.thumbnail()').split(',',1)[1]);(OUT/(outfit['id']+'.png')).write_bytes(data)
     outfit_rows.append({'id':outfit['id'],'members':outfit['members'],'passedDisplay':st['id']==outfit['id'] and st['phase']=='outfit' and st['meshes']==2 and st['framed'] and st['coords']==0 and st['indices'] and st['members']==outfit['members'],'thumbSHA256':sha(data)})
    R['outfits']=outfit_rows;check('all 24 affected outfits use the true freshly sewn top',len(outfit_rows)==24 and all(x['passedDisplay'] for x in outfit_rows))
   context.close()
  browser.close()
 same=error(packets[0]['record']['positionsMm'],packets[1]['record']['positionsMm']);check('independent Chromium worker recomputations agree at original 1e-5 mm tolerance',same<1e-5 and packets[0]['binding']==packets[1]['binding'],{'maximumDifferenceMm':same})
 check('no unhandled browser errors',not R['pageErrors'],R['pageErrors'])
 R.update(freshSeconds=timings,beforeRecordSHA256=sha(oldbytes),browserMaterialSHA256=packets[1]['binding']['materialSHA256'],nodeMaterialSHA256=old['binding']['materialSHA256'],nodeBrowserFinalDifferenceMm=error(packets[1]['record']['positionsMm'],old['record']['positionsMm']))
 R['passed']=all(c['passed'] for c in R['checks'])
except Exception as e:R.update(exception=str(e),traceback=traceback.format_exc());print(R['traceback'],flush=True)
finally:(P/'R0434_REPLAY_REPORT.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
if not R['passed']:raise SystemExit(1)
