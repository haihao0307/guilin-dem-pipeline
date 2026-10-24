"""Native-pixel R17 neighbour-index equivalence and timing, intended for real WebGL CI.
No screenshots, image scaling, LOD or reduced framebuffer stand in for hit checks.
The optional R17_URL targets a published page; otherwise serve this exact directory.
"""
import functools, http.server, json, os, threading, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
OUT=Path(os.environ.get('R17_EVIDENCE_DIR','r17-renderer-evidence'));OUT.mkdir(parents=True,exist_ok=True)
report={'passed':False,'errors':[],'comparisons':[], 'scope':'same-camera Float32 hit/normal/local bitwise equality and native output pixels; software GPU is not user-device performance'}
server=None
try:
 url=os.environ.get('R17_URL')
 if not url:
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
  threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html'
 with sync_playwright() as pw:
  launch={'headless':True,'args':['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
  if os.environ.get('CHROMIUM_PATH'):launch['executable_path']=os.environ['CHROMIUM_PATH']
  browser=pw.chromium.launch(**launch)
  page=browser.new_page(viewport={'width':1366,'height':900},device_scale_factor=float(os.environ.get('QA_DPR','1')))
  page.set_default_timeout(360000);page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(url);page.wait_for_function('window.semanticInspection&&(semanticInspection.errors.length||semanticInspection.ready&&!semanticInspection.busy)')
  assert not page.evaluate('semanticInspection.errors'),page.evaluate('semanticInspection.errors')
  report['url']=url
  setup=page.evaluate('''async()=>{
   const s=semanticInspection,r=s.renderer; s.stopDisplayObserver?.();
   const {fitBoundsCamera}=await import('./desktop-display.mjs');
   const size=s.getDisplaySize(),aspect=size.width/size.height;
   if(!size.native)throw Error('Native framebuffer unavailable, refusing downsampled QA');
   const camera=b=>{const c=fitBoundsCamera(b,{aspect,direction:[.12,.35,-1],margin:.88});return {eye:c.eye,target:c.target,fov:c.fov,cut:false,sliceY:null,clipNormal:[0,0,1],clipOffset:0}};
   const scenarios=s.buildings.map(b=>({name:b.caseId+'-whole',options:camera(b.bounds),source:true,design:true}));
   scenarios.push({name:'complete-comparison',options:camera(s.getBounds()),source:true,design:true});
   const pane=r.apertures.find(a=>a.caseId==='kcc'&&a.primitives.some(p=>p.materialRole===6))?.primitives.find(p=>p.materialRole===6);
   if(pane)scenarios.push({name:'kcc-pane-oblique',options:{...camera(s.getBounds()),eye:pane.origin.map((v,k)=>v+pane.w[k]*6+pane.u[k]*2+pane.v[k]*.5),target:[...pane.origin],fov:.7},source:true,design:true});
   const low=s.buildings.find(b=>b.caseId==='lowrise'),bounds=low.sourceBounds,level=s.model.levels.find(l=>l.caseId==='lowrise'),y=level.elevation+1.6;
   const eye=[(bounds.min[0]+bounds.max[0])/2,y,(bounds.min[2]+bounds.max[2])/2];
   scenarios.push({name:'lowrise-interior',options:{...camera(bounds),eye,target:[eye[0]+3,y,eye[2]+7],fov:.9},source:false,design:true});
   scenarios.push({name:'lowrise-floor-filter-restore',options:{...camera(low.bounds),sliceY:[level.elevation+.05,level.elevation+2.6]},source:false,design:true,visibleFloorIds:[level.id]});
   const kcc=s.buildings.find(b=>b.caseId==='kcc'),tower=kcc.localModel.kccUnitAccess?.levels[0],room=tower?.rooms[0];
   if(room){const shift=kcc.transform.translation,eye=room.approach.map((v,k)=>v+shift[k]+(k===1?tower.elevation+1.6:0)),target=room.inRoom.map((v,k)=>v+shift[k]+(k===1?tower.elevation+1.6:0));for(const openT of [0,1])scenarios.push({name:'kcc-design-door-'+(openT?'open':'closed'),options:{...camera(kcc.bounds),eye,target,fov:.9},source:false,design:true,door:{caseId:'kcc',buildingId:kcc.buildingId,floorId:tower.id,roomKey:room.key,openT}});}
   window.neighborQA={size,scenarios};
   const readHits=()=>{const chunks=[];const g=r.gl;if(!r.hitDataComplete||g.isContextLost()||g.getError()!==g.NO_ERROR)throw Error('Completed valid WebGL frame required');for(const tile of r.hitTiles){g.bindFramebuffer(g.FRAMEBUFFER,tile.target.fbo);for(let a=0;a<3;a++){g.readBuffer(g.COLOR_ATTACHMENT0+a);const values=new Float32Array(tile.width*tile.height*4);g.readPixels(tile.x,tile.y,tile.width,tile.height,g.RGBA,g.FLOAT,values);chunks.push(new Uint32Array(values.buffer));}}g.bindFramebuffer(g.FRAMEBUFFER,null);if(g.getError()!==g.NO_ERROR)throw Error('Float32 readPixels failed');return chunks;};
   neighborQA.capture=()=>{const result={hits:readHits(),pixels:r.readPixels(),width:r.canvas.width,height:r.canvas.height};if(r.gl.getError()!==r.gl.NO_ERROR)throw Error('Presentation readPixels failed');return result;};
   neighborQA.compare=(a,b)=>{let hitComponents=0,pixelChannels=0,hitMismatches=0,pixelMismatches=0,firstMismatch=null;if(a.width!==b.width||a.height!==b.height||a.hits.length!==b.hits.length)throw Error('Framebuffer/tile layout differs');for(let k=0;k<a.hits.length;k++){if(a.hits[k].length!==b.hits[k].length)throw Error('Hit tile dimensions differ');for(let j=0;j<a.hits[k].length;j++){hitComponents++;if(a.hits[k][j]!==b.hits[k][j]){hitMismatches++;firstMismatch??={chunk:k,index:j,before:a.hits[k][j],after:b.hits[k][j]};}}}for(let j=0;j<a.pixels.length;j++){pixelChannels++;if(a.pixels[j]!==b.pixels[j])pixelMismatches++;}return {hitComponents,pixelChannels,hitMismatches,pixelMismatches,firstMismatch};};
   neighborQA.render=async(scenario,enabled)=>{Object.assign(r.options,scenario.options,{selectedId:-1,apertureNeighborIndex:enabled,staticHitCache:false});return await r.render({width:size.width,height:size.height,presentWidth:size.width,presentHeight:size.height,tileSize:96,gpuBatchTiles:8,source:scenario.source,design:scenario.design,visibleFloorIds:scenario.visibleFloorIds??null});};
   return {gpu:r.gpu,size,scenarioNames:scenarios.map(x=>x.name),apertureInstances:r.apertures.length,apertureParts:r.primaryApertureBounds.length};
  }''')
  report['setup']=setup
  for index,name in enumerate(setup['scenarioNames']):
   door=page.evaluate('index=>neighborQA.scenarios[index].door??null',index)
   if door:
    page.evaluate('semanticInspection.selectBuilding("kcc")');page.wait_for_function('!semanticInspection.busy&&!semanticInspection.renderer.busy')
    result=page.evaluate('q=>semanticInspection.kccDoors.set(q)',door);assert result.get('queued'),result
    page.wait_for_function('!semanticInspection.busy&&!semanticInspection.renderer.busy&&semanticInspection.kccDoors.snapshot().pending.length===0')
   comparison=page.evaluate('''async index=>{
    const q=neighborQA,scenario=q.scenarios[index];
    const baseline=await q.render(scenario,false);if(baseline.cancelled)throw Error('Baseline frame cancelled');q.baseline=q.capture();
    const indexed=await q.render(scenario,true);if(indexed.cancelled)throw Error('Indexed frame cancelled');const checks=q.compare(q.baseline,q.capture());delete q.baseline;
    return {name:scenario.name,baseline,indexed,checks};
   }''',index)
   report['comparisons'].append(comparison)
   (OUT/'r17-renderer-neighbor-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   assert comparison['indexed']['apertureNeighborIndex']['enabled'],name
   assert comparison['checks']['hitMismatches']==0,comparison['checks']
   assert comparison['checks']['pixelMismatches']==0,comparison['checks']
   assert comparison['baseline']['width']==setup['size']['width'] and comparison['indexed']['height']==setup['size']['height']
   page.locator('#view').screenshot(path=str(OUT/(name+'.png')))
  # The final filtered frame must not leave a stale subset for the whole scene.
  restored=page.evaluate('''async()=>{const q=neighborQA,r=semanticInspection.renderer;await q.render(q.scenarios[3],true);return {instances:r.apertures.length,parts:r.primaryApertureBounds.length};}''')
  assert restored['instances']==setup['apertureInstances'];assert restored['parts']==setup['apertureParts']
  report['restored']=restored
  assert not report['errors'];report['passed']=True;browser.close()
except Exception:
 report['errors'].append(traceback.format_exc());raise
finally:
 (OUT/'r17-renderer-neighbor-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if server:server.shutdown()
