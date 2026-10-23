"""Importable, real-browser R07 lift gate. Does not launch a browser or server.

Call run_lift_integration_qa(page, output_dir) after the composite page is ready.
Uses the existing shared scene and actual DOM buttons. A renderer completion
wait is deliberately separate from controller success. Current frame latency
is recorded, not disguised as interactive animation performance.
"""
from pathlib import Path
import json

def _run_lift_integration_qa(page, output_dir, timeout_ms=300000, verify_gpu_equivalence=True):
    out=Path(output_dir);out.mkdir(parents=True,exist_ok=True)
    page.wait_for_function("window.semanticInspection?.ready && window.semanticInspection?.lifts && window.semanticInspection?.liftPanel",timeout=timeout_ms)
    def settled():
        page.wait_for_function("(()=>{const s=semanticInspection;return !s.busy&&!s.renderer.busy&&s.lifts.snapshot().presentedRevision===s.lifts.snapshot().revision;})()",timeout=timeout_ms)
    def snap(): return page.evaluate("semanticInspection.lifts.snapshot()")
    progress={'status':'running','passed':False,'realBrowser':True,'stages':[],
              'interiorInspectionSourceHidden':True,'sourceOnlyPhysicalEntryClaim':False,
              'scope':'Authored lobby-to-car passage; source-only mode keeps the unchanged solid shell. No verified physical entrance through that shell is claimed.'}
    def checkpoint(label, **facts):
        record={'stage':label,'snapshot':snap(),**facts}
        progress['stages'].append(record)
        progress['presentedFrames']=page.evaluate('semanticInspection.presentedFrames??null')
        (out/'lift-integration-progress.json').write_text(json.dumps(progress,ensure_ascii=False,indent=2))
    checkpoint('started')
    def advance(seconds):
        page.evaluate("dt=>semanticInspection.lifts.advance(dt)",seconds)
        settled()
    def gpu_hits():
        return page.evaluate("""()=>{const s=semanticInspection,b=s.lifts.getBinding('kcc'),parts=b.parts.filter(p=>['car','car-door'].includes(p.mode)),ids=new Set(parts.flatMap(p=>p.archetype.primitives.map(q=>2000000+p.instance.objectIdOffset+q.objectId))),records=new Map(s.registry.map(r=>[r.objectId,r])),count={},kcc={},unknown=new Set(),g=s.renderer.gl;let pixels=0,bad=0;for(const t of s.renderer.hitTiles){g.bindFramebuffer(g.FRAMEBUFFER,t.target.fbo);g.readBuffer(g.COLOR_ATTACHMENT0);const data=new Float32Array(t.width*t.height*4);g.readPixels(t.x,t.y,t.width,t.height,g.RGBA,g.FLOAT,data);pixels+=t.width*t.height;for(let i=0;i<data.length;i+=4){const status=data[i+3],id=data[i+1];if(!Number.isFinite(status)||status>2.5)bad++;if(status>.5&&status<1.5){const record=records.get(id);if(!record)unknown.add(id);if(record?.caseId==='kcc')kcc[id]=(kcc[id]??0)+1;if(ids.has(id))count[id]=(count[id]??0)+1;}}}g.bindFramebuffer(g.FRAMEBUFFER,null);return{scope:'All native pixels, exact primary hit IDs, not sampled rays',coveredPixels:pixels,width:s.lastStats.width,height:s.lastStats.height,liftPixels:Object.values(count).reduce((a,b)=>a+b,0),kccPixels:Object.values(kcc).reduce((a,b)=>a+b,0),hitIds:count,kccHitIds:kcc,expectedCarIds:[...ids],unknown:[...unknown],bad,glError:g.getError(),frame:s.lifts.snapshot().presentedRevision,wallMs:s.lastStats.wallMs,modelTriangles:s.modelTriangles};}""")

    equivalence=[]
    def exact_gpu_pair(label):
        if not verify_gpu_equivalence:
            return
        # Read exact float MRT bits tile-by-tile from authoritative completed
        # targets, plus presented RGBA. Hashing occurs in the browser, not from
        # screenshots or approximate sampled rays.
        capture="""async()=>{const s=semanticInspection,r=s.renderer,g=r.gl,w=s.lastStats.width,h=s.lastStats.height,planes=[0,1,2].map(()=>new Float32Array(w*h*4));for(const t of r.hitTiles){g.bindFramebuffer(g.FRAMEBUFFER,t.target.fbo);for(let k=0;k<3;k++){g.readBuffer(g.COLOR_ATTACHMENT0+k);const data=new Float32Array(t.width*t.height*4);g.readPixels(t.x,t.y,t.width,t.height,g.RGBA,g.FLOAT,data);for(let row=0;row<t.height;row++)planes[k].set(data.subarray(row*t.width*4,(row+1)*t.width*4),((t.y+row)*w+t.x)*4);}}g.bindFramebuffer(g.FRAMEBUFFER,null);const rgba=r.readPixels();const hash=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',a.buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');return{width:w,height:h,hashes:await Promise.all([...planes,rgba].map(hash)),wallMs:s.lastStats.wallMs,revision:s.lifts.snapshot().presentedRevision,glError:g.getError()};}"""
        original=page.evaluate("({primitive:semanticInspection.renderer.options.primitiveTileIndex??true,aperture:semanticInspection.renderer.options.apertureTileIndex??true})")
        page.evaluate("async()=>{const s=semanticInspection;Object.assign(s.renderer.options,{primitiveTileIndex:false,apertureTileIndex:false});await s.render();}")
        settled(); baseline=page.evaluate(capture)
        checkpoint(label+'-indices-off',baseline=baseline)
        page.evaluate("async()=>{const s=semanticInspection;Object.assign(s.renderer.options,{primitiveTileIndex:true,apertureTileIndex:true});await s.render();}")
        settled(); indexed=page.evaluate(capture)
        checkpoint(label+'-indices-on',indexed=indexed)
        assert baseline['hashes']==indexed['hashes'],{'pose':label,'baseline':baseline,'indexed':indexed}
        assert baseline['revision']==indexed['revision'] and baseline['glError']==0 and indexed['glError']==0
        equivalence.append({'pose':label,'passed':True,'baseline':baseline,'indexed':indexed})
        checkpoint(label+'-exact-pair',exactPairs=equivalence)
        page.evaluate("o=>Object.assign(semanticInspection.renderer.options,{primitiveTileIndex:o.primitive,apertureTileIndex:o.aperture})",original)
    initial_source=page.evaluate("JSON.stringify(semanticInspection.source.patches)")
    page.evaluate("semanticInspection.selectBuilding('kcc')")
    page.evaluate("""()=>{const p=document.querySelector('[data-lift-panel=building-owned]');window.__qaStaleLiftButtons=[...p.querySelectorAll('button')];window.__qaStaleLiftHall=p.querySelector('[data-lift-hall-floor]');}""")
    for other in ['lowrise','warehouse']:
        page.evaluate('c=>semanticInspection.selectBuilding(c)',other)
        guard=page.evaluate("""()=>{const s=semanticInspection,p=document.querySelector('[data-lift-panel=building-owned]'),snapshot=()=>JSON.stringify({lift:s.lifts.snapshot('kcc'),paused:s.liftPanel.paused,camera:s.renderer.options,renderRequests:s.renderRequests,frames:s.presentedFrames,view:s.view}),before=snapshot(),attempts=[];for(const b of window.__qaStaleLiftButtons){try{attempts.push({text:b.textContent,result:b.onclick?.()});}catch(e){attempts.push({text:b.textContent,rejected:String(e)});}}const hall=window.__qaStaleLiftHall;hall.value='T24';try{attempts.push({hall:hall.onchange?.()});}catch(e){attempts.push({hallRejected:String(e)});}try{attempts.push({api:s.liftPanel.send({kind:'car',floor:'T24'})});}catch(e){attempts.push({apiRejected:String(e)});}return{case:s.caseId,controlsParentDisplay:getComputedStyle(hall.parentElement).display,controls:[...p.querySelectorAll('button,select')].map(e=>({disabled:e.disabled,visible:e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})})),noMutation:before===snapshot(),attempts};}""")
        assert guard['case']==other and guard['controlsParentDisplay']=='none' and guard['noMutation'] and guard['controls'] and all(x['disabled'] and not x['visible'] for x in guard['controls']),('Cross-building lift controls leaked',guard)
        checkpoint('cross-building-lift-controls-'+other,guard=guard)
    page.evaluate("semanticInspection.selectBuilding('kcc')")
    panel=page.locator('[data-lift-panel="building-owned"]')
    assert panel.is_visible(), 'Integrated lift panel must be visible, not a report-only artifact'
    assert panel.locator('[data-lift-car-floor]').count()==28
    assert panel.locator('[data-lift-car-floor=\"T01\"]').is_enabled() and panel.locator('[data-lift-hall-floor]').is_enabled(),'Return to KCC did not restore valid lift controls'
    # Disable automatic time so every visual pose has an exact reproducible state.
    if not page.evaluate('semanticInspection.liftPanel.paused'):
        panel.get_by_role('button',name='暂停演示',exact=True).click()
    panel.locator('[data-lift-hall-floor]').select_option('P01')
    panel.locator('[data-lift-call="up"]').click()
    advance(2)
    assert snap()['carDoor']==1 and snap()['boardableFloors']==['P01']
    panel.locator('[data-lift-focus="car"]').click();settled()
    opened=gpu_hits()
    assert opened['liftPixels']>0, 'Must see actual lift-owned GPU hit IDs; a dropdown/focus pose alone is not proof'
    assert not opened['unknown'],opened
    page.screenshot(path=str(out/'r07-lift-in-building-open.png'))
    checkpoint('open-at-P01',gpu=opened,screenshot='r07-lift-in-building-open.png')
    panel.locator('[data-lift-passenger="board"]').click();advance(2)
    assert snap()['passenger']['mode']=='boarding' and snap()['obstruction']
    assert snap()['passengerGeometry']['passed'] and snap()['passengerGeometry']['continuousFootSupport']['passed']
    assert panel.locator('[data-lift-door="close"]').is_disabled()
    assert page.evaluate("semanticInspection.view==='walk'"), 'Passenger inspection must explicitly use source-hidden interior mode, not imply passage through original shell'
    entering=gpu_hits();assert entering['liftPixels']>0 and not entering['unknown'] and entering['bad']==entering['glError']==0,entering
    boarding_camera=page.evaluate('semanticInspection.presentedCamera')
    page.screenshot(path=str(out/'r07-lift-passenger-entering.png'))
    checkpoint('passenger-entering',gpu=entering,camera=boarding_camera,bodyAndFootEnvelope=snap()['passengerGeometry'],screenshot='r07-lift-passenger-entering.png')
    advance(2)
    assert snap()['passenger']['mode']=='inside'
    assert not snap()['obstruction']
    inside=gpu_hits();assert inside['liftPixels']>0 and not inside['unknown'],inside
    checkpoint('passenger-inside',gpu=inside)
    panel.locator('[data-lift-car-floor="T01"]').click()
    panel.locator('[data-lift-car-floor="T01"]').click()
    assert len([q for q in snap()['queue'] if q['id']=='T01'])==1
    panel.locator('[data-lift-door="close"]').click()
    advance(.4)
    exact_gpu_pair('mid-door')
    panel.locator('[data-lift-obstruction]').click()
    advance(2)
    assert snap()['state']=='OBSTRUCTION_HOLD'
    assert snap()['carDoor']==1 and snap()['current']=='P01'
    checkpoint('obstruction-reopened')
    panel.locator('[data-lift-obstruction]').click()
    advance(6)
    assert snap()['state'] in ['ACCELERATING','CRUISING','DECELERATING','LEVELING']
    assert snap()['guards']['closed'] and snap()['guards']['locked']
    panel.locator('[data-lift-door="open"]').click()
    assert snap()['carDoor']==0, 'Original R02 guard must reject open during travel'
    settled()
    # Make a real GPU frame run, then advance simulation. The frame geometry
    # and registry must stay bit-for-bit unchanged until the frame completes.
    isolation=page.evaluate("""()=>{const s=semanticInspection;s.render();const busy=s.renderer.busy,geometry=JSON.stringify(s.model.instances),registry=JSON.stringify(s.registry),frame=s.lifts.snapshot().frameRevision;s.lifts.advance(.4);let rejected=false;try{s.lifts.beforeFrame();}catch(e){rejected=/between GPU frames/.test(e.message);}return{busy,geometryUnchanged:JSON.stringify(s.model.instances)===geometry,registryUnchanged:JSON.stringify(s.registry)===registry,rejected,frame,simulationRevision:s.lifts.snapshot().revision};}""")
    assert isolation['busy'] and isolation['geometryUnchanged'] and isolation['registryUnchanged'] and isolation['rejected'],isolation
    settled()
    checkpoint('inflight-snapshot-isolated',sameFrameIsolation=isolation)
    # Deliberately restore one old/wrong dynamic AABB between frames. The next
    # frame snapshot must recompute it before native-resolution tile filtering.
    stale=page.evaluate("""()=>{const s=semanticInspection,b=s.lifts.getBinding('kcc'),p=b.worldParts.find(p=>p.mode==='car'),old=p.world.bounds;p.world.bounds={min:[1e6,1e6,1e6],max:[1e6+1,1e6+1,1e6+1]};s.lifts.beforeFrame();const t=p.world.translation,expected={min:p.archetype.bounds.min.map((v,k)=>v+t[k]),max:p.archetype.bounds.max.map((v,k)=>v+t[k])};return{recomputed:JSON.stringify(p.world.bounds)===JSON.stringify(expected),oldBounds:old,currentBounds:p.world.bounds,expected};}""")
    assert stale['recomputed'],stale
    checkpoint('stale-bounds-repaired',staleBounds=stale)
    panel.locator('[data-lift-passenger="ride"]').click();settled()
    ride_camera=page.evaluate('semanticInspection.presentedCamera')
    assert abs(ride_camera['eye'][1]-snap()['y']-1.65)<1e-6
    assert abs(ride_camera['eye'][1]-boarding_camera['eye'][1])>.01
    moving=gpu_hits();assert moving['liftPixels']>0 and not moving['unknown'],moving
    exact_gpu_pair('moving')
    page.screenshot(path=str(out/'r07-lift-in-building-moving.png'))
    checkpoint('passenger-riding',camera=ride_camera,gpu=moving,screenshot='r07-lift-in-building-moving.png')
    advance(25)
    # A long advance may have completed dwell. Request the arrived floor again
    # through the actual panel, then verify only that floor can open/board.
    panel.locator('[data-lift-car-floor="T01"]').click();advance(2)
    s=snap();assert s['current']=='T01' and s['carDoor']==1 and s['boardableFloors']==['T01']
    assert all(v==0 for f,v in s['landingDoors'].items() if f!='T01')
    panel.locator('[data-lift-hall-floor]').select_option('T01')
    assert '双门全开' in panel.inner_text()
    panel.locator('[data-lift-passenger="ride"]').click();settled()
    arrived_camera=page.evaluate('semanticInspection.presentedCamera')
    assert abs(arrived_camera['eye'][1]-snap()['y']-1.65)<1e-6
    arrived=gpu_hits();assert arrived['liftPixels']>0 and not arrived['unknown'],arrived
    exact_gpu_pair('arrived-double-door-open')
    page.screenshot(path=str(out/'r07-lift-in-building-arrived.png'))
    checkpoint('arrived-at-T01',camera=arrived_camera,gpu=arrived,screenshot='r07-lift-in-building-arrived.png')
    panel.locator('[data-lift-passenger="exit"]').click();advance(2)
    assert snap()['passenger']['mode']=='exiting' and snap()['obstruction']
    exiting=gpu_hits();assert exiting['kccPixels']>0 and not exiting['unknown'],exiting
    checkpoint('passenger-exiting',gpu=exiting,camera=page.evaluate('semanticInspection.presentedCamera'),bodyAndFootEnvelope=snap()['passengerGeometry'])
    advance(2)
    assert snap()['passenger']['mode']=='outside' and not snap()['obstruction']
    assert page.evaluate('semanticInspection.lifts.ridePose().followCar')==False
    exited=gpu_hits();assert exited['kccPixels']>0 and not exited['unknown'],exited
    page.screenshot(path=str(out/'r07-lift-passenger-exited.png'))
    checkpoint('passenger-exited',gpu=exited,camera=page.evaluate('semanticInspection.presentedCamera'),screenshot='r07-lift-passenger-exited.png')
    cross=page.evaluate("""()=>{const r=semanticInspection.lifts,s=r.snapshot();return{wrongBuilding:r.command({caseId:'kcc',buildingId:'warehouse',liftId:s.liftId,kind:'car',floor:'P01'}),wrongFloor:r.commandFor('kcc',{kind:'car',floor:'warehouse::L01'}),lowrise:r.commandFor('lowrise',{kind:'car',floor:'L01'})};}""")
    assert all(not r['accepted'] for r in cross.values()),cross
    page.evaluate("semanticInspection.selectBuilding('lowrise')")
    assert '不强行添加' in panel.inner_text()
    assert not panel.locator('[data-lift-car-floor="T01"]').is_visible()
    page.evaluate("semanticInspection.selectBuilding('warehouse')")
    assert '未绑定交互控制器' in panel.inner_text()
    page.evaluate("semanticInspection.selectBuilding('kcc')")
    assert panel.locator('[data-lift-car-floor]').count()==28
    assert panel.locator('[data-lift-car-floor=\"T01\"]').is_enabled() and panel.locator('[data-lift-hall-floor]').is_enabled(),'Return to KCC did not restore valid lift controls'
    assert page.evaluate('JSON.stringify(semanticInspection.source.patches)')==initial_source
    checkpoint('all-actions-completed',crossBuildingRejected=cross)
    report={'interiorInspectionSourceHidden':True,'sourceOnlyPhysicalEntryClaim':False,'sourceShellScope':progress['scope'],'stages':progress['stages'],'passed':True,'realBrowser':True,'exactMovingGpuEquivalence':equivalence,'exactMovingGpuEquivalenceRun':verify_gpu_equivalence,'allConservativeIndicesCompared':verify_gpu_equivalence,'d2PerformanceIsolationClaim':False,'passengerEnterRideExitPassed':True,'boardingCamera':boarding_camera,'rideCamera':ride_camera,'arrivedCamera':arrived_camera,'sharedThreeBuildingScene':True,'sourceUnchanged':True,'servedOriginalFloors':28,'physicalButtonCommandRouteCount':page.evaluate("semanticInspection.lifts.getBinding('kcc').actions.length"),'uiActionCoverage':['P01 up hall call','enter car with door-zone interlock','ride first-person camera','exit at arrived floor','repeat T01 car selection','close car door','obstruction on','obstruction off','reject open while moving','repeat arrived T01 selection','car focus open/moving/arrived','switch lowrise/warehouse/kcc'],'enteringGpu':entering,'insideGpu':inside,'exitingGpu':exiting,'exitedGpu':exited,'openedGpu':opened,'movingGpu':moving,'arrivedGpu':arrived,'sameFrameIsolation':isolation,'staleBoundsRecomputedBeforeTrace':stale,'crossBuildingRejected':cross,'finalState':snap(),'performanceClaim':'Frame times recorded; state correctness does not certify smooth animation.'}
    (out/'lift-integration-browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    progress['status']='passed';progress['passed']=True
    (out/'lift-integration-progress.json').write_text(json.dumps(progress,ensure_ascii=False,indent=2))
    return report


def run_lift_integration_qa(page, output_dir, timeout_ms=300000, verify_gpu_equivalence=True):
    """Persist completed stages even if a later assertion/timeout fails."""
    try:
        return _run_lift_integration_qa(page, output_dir, timeout_ms, verify_gpu_equivalence)
    except BaseException as error:
        out=Path(output_dir);out.mkdir(parents=True,exist_ok=True)
        path=out/'lift-integration-progress.json'
        progress=json.loads(path.read_text()) if path.exists() else {'stages':[]}
        progress.update(status='failed',passed=False,errorType=type(error).__name__,error=str(error))
        path.write_text(json.dumps(progress,ensure_ascii=False,indent=2))
        raise
