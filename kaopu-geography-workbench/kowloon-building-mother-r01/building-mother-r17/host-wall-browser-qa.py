"""Actual native-pixel host-wall compiler QA. This isolated wall is not the final whole-building user delivery."""
import functools,http.server,json,threading,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent;OUT=Path('public-inspection-evidence');OUT.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
report={'passed':False,'scope':'native host field only; no claim whole-building journey passed','views':[]}
def save():(OUT/'host-wall-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1366,'height':900},device_scale_factor=1);page.set_default_timeout(180000)
  page.goto(f'http://127.0.0.1:{server.server_port}/index.html?startupProbe=1');page.wait_for_function('window.semanticInspection?.phase==="startup-probe-ready"||window.semanticInspection?.errors.length');assert not page.evaluate('semanticInspection.errors')
  for side in ['outside','inside','oblique']:
   q=page.evaluate('''async(side)=>{const s=semanticInspection,r=s.renderer,h=r.integratedHost,{hostWorld,traceHostWall}=await import('./host-wall-field.mjs'),w=h.windows[10],c=[(w.hole[0]+w.hole[2])/2,(w.hole[1]+w.hole[3])/2,0],eye=hostWorld(h,[c[0]+(side==='oblique'?1.2:0),c[1]+.15,side==='inside'?-2.4:2.8]),target=hostWorld(h,c);Object.assign(r.options,{onlyHostField:true,eye,target,cut:false,sliceY:null,fov:Math.PI/3});s.cameraFraming='manual';s.fit=null;await s.render();if(s.errors.length)throw Error(s.errors.join());const size=s.presentedDisplay,unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],f=unit(target.map((v,k)=>v-eye[k])),right=unit(cross(f,[0,1,0])),up=cross(right,f),mismatches=[];let samples=0;for(let dy=-90;dy<=90;dy+=18)for(let dx=-90;dx<=90;dx+=18){const x=Math.floor(size.width/2)+dx,y=Math.floor(size.height/2)+dy,uv=[(2*(x+.5)-size.width)/size.height,(2*(y+.5)-size.height)/size.height],rd=unit(f.map((v,k)=>v+Math.tan(r.options.fov/2)*(uv[0]*right[k]+uv[1]*up[k]))),cpu=traceHostWall(h,eye,rd),gpu=r.readHit(x,y);samples++;if(cpu.hit!==(gpu.status>.5)||cpu.hit&&(cpu.objectId!==gpu.objectId||Math.abs(cpu.t-gpu.t)>.001))mismatches.push({x,y,cpu,gpu});}return{side,samples,mismatches,stats:s.lastStats,windowCount:h.windows.length,sourceId:h.objectId,excludedLegacy:r.hostExcludedIds.size,display:size}}''',side)
   report['views'].append(q);save();page.screenshot(path=str(OUT/f'host-wall-{side}.png'));assert not q['mismatches'],q['mismatches'][:2];assert q['stats']['passCounts']['host']>0 and q['stats']['passCounts']['aperture']==0
  report['passed']=True;browser.close()
except Exception:
 report['error']=traceback.format_exc();raise
finally:save();server.shutdown()
