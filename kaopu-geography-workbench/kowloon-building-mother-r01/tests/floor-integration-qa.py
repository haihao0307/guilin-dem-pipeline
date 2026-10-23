"""Independent R07 real-DOM + native-field floor/room-door/route verification.
Imported by hosted QA only; does not launch a browser.
"""
from pathlib import Path
import json

def run_floor_qa(page, output_dir, settled, capture_native, exact_pair):
    out=Path(output_dir);out.mkdir(parents=True,exist_ok=True)
    report={'passed':False,'scope':'Self-designed floor system only, not an assertion of actual measured room plan or structural certification. Real DOM actions and GPU geometry, not dropdown-only.','frames':{},'checks':[]}
    def save():(out/'floor-integration-browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    def capture(label):
        settled(page);q=capture_native(page,label);report['frames'][label]=q;save();return q
    def click(selector):
        page.locator(selector).click();settled(page)
    def door_state():return page.evaluate("""()=>{const s=semanticInspection,b=s.buildings.find(b=>b.caseId==='lowrise'),route=s.floorPanel.route(),a=b.localModel.hostedComponents.apertures.find(a=>a.host.nodeId===route.doorGate.doorId),world=s.model.hostedComponents.apertures.find(q=>q.caseId==='lowrise'&&q.instanceId===a.instanceId),g=s.renderer;return{routeGate:route.doorGate,doorId:a.host.nodeId,openT:a.config.openT,ids:world.primitives.map(p=>p.objectId),leafId:world.primitives.find(p=>p.part==='leaf')?.objectId,token:g.apertureNeighborToken,tablePrimitiveCount:g.apertureNeighbors?.data?.[2],currentPrimitiveCount:g.apertures.reduce((n,a)=>n+a.primitives.length,0),runtime:s.roomDoors.snapshot()};}""")
    try:
        page.evaluate("semanticInspection.selectBuilding('lowrise')")
        panel=page.locator('#completeFloorPanel');assert panel.is_visible()
        assert panel.get_by_label('楼层实例',exact=True).locator('option').count()==2
        assert panel.get_by_label('房间 / 门',exact=True).locator('option').count()==7
        source=page.evaluate('JSON.stringify(semanticInspection.source.patches)')
        ids=page.evaluate('semanticInspection.registry.map(r=>r.objectId).sort((a,b)=>a-b)')
        for floor in ['L01','L02']:
            panel.get_by_label('楼层实例',exact=True).select_option(floor);q=capture('floor-'+floor)
            classes=page.evaluate("""hits=>{const s=semanticInspection,rows=s.registry.filter(r=>Number(hits[r.objectId]??0)>0&&r.caseId==='lowrise');return{classKeys:[...new Set(rows.map(r=>r.classKey))],floors:[...new Set(rows.map(r=>r.localFloorId).filter(Boolean))],inspection:s.floorInspection};}""",q['hitObjectPixels'])
            assert classes['inspection']['sameScene'] and classes['inspection']['sourceHidden'] and floor in classes['floors'],('wrong floor or hidden geometry',floor,classes)
            assert 'floor' in classes['classKeys'] and ('wall' in classes['classKeys'] or 'door' in classes['classKeys']),('not a physical complete floor view',classes)
            report['checks'].append({'floor':floor,'visible':classes})
            choices=panel.get_by_label('房间 / 门',exact=True).locator('option').evaluate_all("opts=>opts.map(o=>o.value)")
            for room in choices:
                calls=page.evaluate('semanticInspection.renderRequests')
                panel.get_by_label('房间 / 门',exact=True).select_option(room)
                selected=page.evaluate('semanticInspection.selected')
                assert selected and selected['caseId']=='lowrise' and selected['localFloorId']==floor and selected['classKey']=='door',('room door ownership/select failure',floor,room,selected)
                assert page.evaluate('semanticInspection.renderRequests')==calls,'Room identity selection retraced geometry'
                report['checks'].append({'room':room,'floor':floor,'selectedDoorId':selected['objectId'],'noGeometryRetrace':True})
            click('#completeFloorPanel [data-floor-bookmark="stair"]');stair=capture('stair-bookmark-'+floor)
            visible=page.evaluate("hits=>semanticInspection.registry.filter(r=>r.caseId==='lowrise'&&r.classKey==='stair'&&Number(hits[r.objectId]??0)>0).map(r=>({id:r.objectId,pixels:hits[r.objectId]}))",stair['hitObjectPixels'])
            assert visible,('Each floor stair bookmark must expose real stair hit IDs',floor)
            report['checks'].append({'floor':floor,'stairVisibleIds':visible})
        panel.get_by_label('房间 / 门',exact=True).select_option('living')
        click('#completeFloorPanel [data-floor-bookmark="door"]');before=door_state();assert before['openT']==1
        # A real in-flight frame exists before the close command. Queued edits
        # must not mutate its descriptors, and walking must be blocked immediately.
        isolation=page.evaluate("""()=>{const s=semanticInspection;s.render();const busy=s.renderer.busy,a=JSON.stringify(s.model.hostedComponents.apertures),registry=JSON.stringify(s.registry),camera=JSON.stringify(s.renderer.options);document.querySelector('#completeFloorPanel [data-room-door="close"]').click();const blocked=s.floorPanel.walk(1);return{busy,aperturesUnchanged:a===JSON.stringify(s.model.hostedComponents.apertures),registryUnchanged:registry===JSON.stringify(s.registry),cameraUnchanged:camera===JSON.stringify(s.renderer.options),blocked};}""")
        assert isolation['busy'] and isolation['aperturesUnchanged'] and isolation['registryUnchanged'] and isolation['cameraUnchanged'] and isolation['blocked']['blocked'],isolation
        closed=capture('room-door-closed');state=door_state()
        assert state['openT']==0 and not state['routeGate']['allowed'] and state['token']>before['token'],state
        assert state['tablePrimitiveCount']==state['currentPrimitiveCount']>0,state
        assert closed['hitObjectPixels'].get(str(state['leafId']),0)>0,('closed door leaf not visible',state)
        block=page.evaluate("""()=>{const s=semanticInspection,c=JSON.stringify(s.renderer.options),n=s.renderRequests,r=s.floorPanel.walk(1);return{r,cameraUnchanged:c===JSON.stringify(s.renderer.options),noRender:n===s.renderRequests};}""")
        assert block['r']['blocked'] and block['cameraUnchanged'] and block['noRender'],block
        exact_pair(page,'room-door-closed')
        click('#completeFloorPanel [data-room-door="open"]');opened=capture('room-door-open');opened_state=door_state()
        assert opened_state['openT']==1 and opened_state['routeGate']['allowed'] and opened_state['token']>state['token'],opened_state
        assert closed['fieldHashes']!=opened['fieldHashes'], 'Door operation must change authoritative geometry, not only a label'
        exact_pair(page,'room-door-open')
        report['checks'].append({'queuedDoorSameFrameIsolation':isolation,'closedWalkBlocked':block,'closed':state,'opened':opened_state})
        # Real panel slider drives the same continuous floor/stair/door route.
        for progress in [0,.25,.5,1]:
            panel.get_by_role('slider').evaluate("(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}",round(progress*1000));q=capture('route-'+str(progress))
            pose=page.evaluate('semanticInspection.routePose');assert pose and abs(pose['progress']-progress)<1e-9,('route did not advance',progress,pose)
            assert all(isinstance(v,(int,float)) for v in pose['foot'])
            report['checks'].append({'routeProgress':progress,'pose':pose,'wallMs':q['stats']['wallMs']})
        assert page.evaluate('JSON.stringify(semanticInspection.source.patches)')==source,'source geometry changed during route/door interaction'
        assert page.evaluate('semanticInspection.registry.map(r=>r.objectId).sort((a,b)=>a-b)')==ids,'object identity changed during door operations'
        report['passed']=True
    finally:save()
    return report
