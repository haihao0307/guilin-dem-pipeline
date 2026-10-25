from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,subprocess,sys,base64
P=Path(__file__).parent
server=subprocess.Popen([sys.executable,'-m','http.server','8121','--directory',str(P)])
time.sleep(1)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':1240,'height':1000});page.on('console',lambda m:print(m.type,m.text,flush=True));page.goto('http://127.0.0.1:8121')
  page.wait_for_function('window.QA && (QA.done || QA.errors.length)',timeout=300000)
  first=page.evaluate('QA');assert first.get('done')and not first['errors'],first
  assert page.locator('#installation').input_value()=='baseline'
  views=[]
  samples=[('baseline',[12,3.5,-4],100,.4,'baseline'),('baseline_collision',[12,3.5,-4],0,3.3545228223,'baseline'),('candidate_collision',[12,3.5,-4],0,3.3545228223,'candidate'),('candidate_motion',[12,3.5,-4],100,1.4,'candidate'),('candidate_opposite',[-12,3.5,-4],100,1.4,'candidate'),('baseline_return',[12,3.5,-4],100,.4,'baseline')]
  for name,eye,cut,theta,mode in samples:
   start=time.monotonic();page.evaluate('async v=>{await renderAt(v.theta-.4,{eye:v.eye},{cut:v.cut,initialTheta:.4,angularSpeed:1,installation:{mode:v.mode,beta:.126}})}',{'eye':eye,'cut':cut,'theta':theta,'mode':mode})
   raw=page.evaluate('c.toDataURL("image/png")');(P/(name+'-whole.png')).write_bytes(base64.b64decode(raw.split(',')[1]))
   q=page.evaluate('QA');q['canvas_object_bounds']=page.evaluate("""()=>{const a=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,a);let x0=c.width,y0=c.height,x1=-1,y1=-1,n=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){let i=4*(y*c.width+x);if(a[i]!=a[0]||a[i+1]!=a[1]||a[i+2]!=a[2]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);n++;}}return {x0,y0,x1,y1,foregroundPixels:n};}""");q['pixel_readback_wall_s']=time.monotonic()-start;q['view']=name;views.append(q);print(json.dumps(q),flush=True)
   assert q.get('done')and not q['errors']and q['draws']==519 and q.get('glError')==0,q
   assert q['installation']['mode']==mode,q
   bnd=q['canvas_object_bounds'];assert bnd['x0']>2 and bnd['x1']<717 and bnd['y0']>2 and bnd['y1']<397 and bnd['foregroundPixels']>10000,bnd
   if mode=='candidate': assert q['outsideValves']['reconstructed'] and not q['outsideValves']['middleFrozen'] and q['centralControl']['plateOverlapKnown'],q
  assert (P/'baseline-whole.png').read_bytes()==(P/'baseline_return-whole.png').read_bytes(),'same baseline failed exact PNG return'
  assert (P/'baseline_collision-whole.png').read_bytes()!=(P/'candidate_collision-whole.png').read_bytes(),'candidate produced no changed whole image'
  page.locator('#example').click();page.wait_for_function('!RESEARCH_UI.busy && QA.installation.mode==="candidate"',timeout=300000)
  assert '推断' in page.locator('#rendered').inner_text()
  page.locator('#baseline').click();page.wait_for_function('!RESEARCH_UI.busy && QA.installation.mode==="baseline"',timeout=300000)
  assert 'FAIL' in page.locator('.badge').inner_text()
  (P/'BROWSER_QA.json').write_text(json.dumps({'views':views,'baseline_return_exact_png':True,'candidate_cut_changed':True,'ui_example_and_restore_pass':True,'scope':'whole research baseline/inferred candidate and reversible controls; local clearance only, overall mechanical acceptance remains false'},indent=2));b.close()
finally:server.terminate()
