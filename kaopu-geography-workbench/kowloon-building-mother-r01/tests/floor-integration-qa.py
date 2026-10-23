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
    def door_state():return page.evaluate("""async()=>{const s=semanticInspection,b=s.buildings.find(b=>b.caseId==='lowrise'),route=s.floorPanel.route(),a=b.localModel.hostedComponents.apertures.find(a=>a.host.nodeId===route.doorGate.doorId),world=s.model.hostedComponents.apertures.find(q=>q.caseId==='lowrise'&&q.instanceId===a.instanceId),r=s.renderer,g=r.gl,{packApertureDescriptors}=await import('./kowloon-building-mother-r01/r07/apertures.mjs'),packed=packApertureDescriptors(r.apertures);if(s.busy||r.busy)throw Error('Descriptor read requires completed frame');const previousDraw=g.getParameter(g.DRAW_FRAMEBUFFER_BINDING),previousRead=g.getParameter(g.READ_FRAMEBUFFER_BINDING),fb=g.createFramebuffer(),pixels=new Float32Array(packed.data.length);let status;try{g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,r.apertureTexture,0);status=g.checkFramebufferStatus(g.FRAMEBUFFER);if(status!==g.FRAMEBUFFER_COMPLETE)throw Error('Descriptor texture framebuffer incomplete '+status);g.readBuffer(g.COLOR_ATTACHMENT0);g.readPixels(0,0,packed.width,packed.height,g.RGBA,g.FLOAT,pixels);}finally{g.bindFramebuffer(g.DRAW_FRAMEBUFFER,previousDraw);g.bindFramebuffer(g.READ_FRAMEBUFFER,previousRead);g.deleteFramebuffer(fb);}const hash=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',a.buffer))].map(v=>v.toString(16).padStart(2,'0')).join(''),cpuHash=await hash(packed.data),gpuHash=await hash(pixels),old=window.__qaDoorTexture;if(!old||old.texture!==r.apertureTexture)window.__qaDoorTexture={texture:r.apertureTexture,serial:(old?.serial??0)+1};return{routeGate:route.doorGate,doorId:a.host.nodeId,openT:a.config.openT,ids:world.primitives.map(p=>p.objectId),leafId:world.primitives.find(p=>p.part==='leaf')?.objectId,textureSerial:window.__qaDoorTexture.serial,descriptorCpuHash:cpuHash,descriptorGpuHash:gpuHash,descriptorExact:cpuHash===gpuHash,descriptorDimensions:[packed.width,packed.height],gpuPrimitiveCount:pixels[0],currentPrimitiveCount:r.apertures.reduce((n,a)=>n+a.primitives.length,0),glError:g.getError(),runtime:s.roomDoors.snapshot()};}""")

    try:
        page.evaluate("semanticInspection.selectBuilding('lowrise')")
        panel=page.locator('#completeFloorPanel')
        floor_select=panel.locator("xpath=./label[normalize-space(text())='楼层实例']/select")
        room_select=panel.locator("xpath=./label[normalize-space(text())='房间 / 门']/select")
        # Verify native implicit-label ownership, not the aggregate option text.
        dom=panel.evaluate("""p=>({html:p.outerHTML,labels:[...p.querySelectorAll(':scope > label')].map(l=>({ownText:[...l.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim(),fullText:l.textContent,controlTag:l.control?.tagName,associated:l.control?.labels.length===1&&l.control.labels[0]===l,options:[...l.querySelectorAll('option')].map(o=>({value:o.value,text:o.textContent}))})),controls:[...p.querySelectorAll('button,select,input')].map(e=>({tag:e.tagName,text:e.textContent,id:e.id,dataset:{...e.dataset},aria:e.getAttribute('aria-label'),disabled:e.disabled}))})""")
        dom['oldExactLabelCounts']={'floor':panel.get_by_label('楼层实例',exact=True).count(),'room':panel.get_by_label('房间 / 门',exact=True).count()}
        dom['associatedLocatorCounts']={'floor':floor_select.count(),'room':room_select.count()}
        (out/'floor-panel-dom-contract.json').write_text(json.dumps(dom,ensure_ascii=False,indent=2))
        assert len(dom['labels'])==2 and [l['ownText'] for l in dom['labels']]==['楼层实例','房间 / 门'] and all(l['associated'] and l['controlTag']=='SELECT' for l in dom['labels']),dom
        assert dom['associatedLocatorCounts']=={'floor':1,'room':1},dom
        assert [o['value'] for o in dom['labels'][0]['options']]==['L01','L02'] and len(dom['labels'][1]['options'])==7,dom
        for selector in ['[data-floor-bookmark=slice]','[data-floor-bookmark=entry]','[data-floor-bookmark=stair]','[data-floor-bookmark=door]','[data-room-door=open]','[data-room-door=close]','input[type=range][aria-label="从入口经过楼梯走到房间的路线进度"]']:
            assert panel.locator(selector).count()==1,('nonunique floor control',selector)
        report['checks'].append({'locatorContract':{'passed':True,'oldExactLabelCounts':dom['oldExactLabelCounts'],'associatedLocatorCounts':dom['associatedLocatorCounts'],'evidence':'floor-panel-dom-contract.json'}});save()
        page.evaluate("window.__qaSavedDoorClose=document.querySelector('#completeFloorPanel [data-room-door=close]').onclick")
        for other in ['warehouse','kcc']:
            page.evaluate('c=>semanticInspection.selectBuilding(c)',other)
            guard=page.evaluate("""()=>{const s=semanticInspection,p=document.querySelector('#completeFloorPanel'),buttons=[...p.querySelectorAll('button,select,input')],snapshot=()=>JSON.stringify({door:s.roomDoors.snapshot(),apertures:s.model.hostedComponents.apertures,registry:s.registry,camera:s.renderer.options,renderRequests:s.renderRequests,frames:s.presentedFrames,view:s.view,selected:s.selected}),before=snapshot(),attempts=[];for(const [name,fn]of [['stale-close-handler',()=>window.__qaSavedDoorClose?.call(p.querySelector('[data-room-door=close]'))],['bookmark',()=>s.floorPanel.bookmark('door')],['walk',()=>s.floorPanel.walk(1)],['selectFloor',()=>s.floorPanel.selectFloor('L02')],['selectRoom',()=>s.floorPanel.selectRoom('living')]]){try{attempts.push({name,result:fn()});}catch(e){attempts.push({name,rejected:String(e)});}}return{case:s.caseId,controls:buttons.map(b=>({tag:b.tagName,text:b.textContent,disabled:b.disabled,visible:b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})})),noMutation:before===snapshot(),attempts};}""")
            assert guard['case']==other and guard['noMutation'] and guard['controls'] and all(x['disabled'] and not x['visible'] for x in guard['controls']),('Cross-building floor controls leaked',guard)
            report['checks'].append({'crossBuildingFloorControls':guard});save()
        page.evaluate("semanticInspection.selectBuilding('lowrise')")
        restored=page.locator('#completeFloorPanel').evaluate("p=>[...p.querySelectorAll('button,select,input')].every(b=>!b.disabled&&b.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))")
        assert restored,'Returning to lowrise did not restore valid controls'
        # Queue a real door command during a real native GPU frame, switch away
        # before the next-frame mutation boundary, and prove it is cancelled.
        cancel=page.evaluate("""()=>{const s=semanticInspection,doors=JSON.stringify(s.roomDoors.snapshot().doors),apertures=JSON.stringify(s.model.hostedComponents.apertures),registry=JSON.stringify(s.registry);s.render();const busy=s.renderer.busy;document.querySelector('#completeFloorPanel [data-room-door=close]').click();const queued=s.roomDoors.snapshot().pending.length;s.selectBuilding('warehouse');return{busy,queued,pendingAfterSwitch:s.roomDoors.snapshot().pending.length,doorsUnchanged:doors===JSON.stringify(s.roomDoors.snapshot().doors),aperturesUnchanged:apertures===JSON.stringify(s.model.hostedComponents.apertures),registryUnchanged:registry===JSON.stringify(s.registry),beforeDoors:doors};}""")
        assert cancel['busy'] and cancel['queued']>0 and cancel['pendingAfterSwitch']==0 and cancel['doorsUnchanged'] and cancel['aperturesUnchanged'] and cancel['registryUnchanged'],cancel
        settled(page)
        assert page.evaluate('JSON.stringify(semanticInspection.roomDoors.snapshot().doors)')==cancel['beforeDoors'],'Cancelled cross-building door command executed later'
        report['checks'].append({'queuedDoorCancelledOnBuildingSwitch':cancel});save()
        page.evaluate("semanticInspection.selectBuilding('lowrise')")
        panel=page.locator('#completeFloorPanel');assert panel.is_visible()
        assert floor_select.locator('option').count()==2
        assert room_select.locator('option').count()==7
        source=page.evaluate('JSON.stringify(semanticInspection.source.patches)')
        ids=page.evaluate('semanticInspection.registry.map(r=>r.objectId).sort((a,b)=>a-b)')
        for floor in ['L01','L02']:
            floor_select.select_option(floor);q=capture('floor-'+floor)
            classes=page.evaluate("""hits=>{const s=semanticInspection,rows=s.registry.filter(r=>Number(hits[r.objectId]??0)>0&&r.caseId==='lowrise');return{classKeys:[...new Set(rows.map(r=>r.classKey))],floors:[...new Set(rows.map(r=>r.localFloorId).filter(Boolean))],inspection:s.floorInspection};}""",q['hitObjectPixels'])
            assert classes['inspection']['sameScene'] and classes['inspection']['sourceHidden'] and floor in classes['floors'],('wrong floor or hidden geometry',floor,classes)
            assert 'floor' in classes['classKeys'] and ('wall' in classes['classKeys'] or 'door' in classes['classKeys']),('not a physical complete floor view',classes)
            report['checks'].append({'floor':floor,'visible':classes})
            choices=room_select.locator('option').evaluate_all("opts=>opts.map(o=>o.value)")
            for room in choices:
                calls=page.evaluate('semanticInspection.renderRequests')
                room_select.select_option(room)
                selected=page.evaluate('semanticInspection.selected')
                assert selected and selected['caseId']=='lowrise' and selected['localFloorId']==floor and selected['classKey']=='door',('room door ownership/select failure',floor,room,selected)
                assert page.evaluate('semanticInspection.renderRequests')==calls,'Room identity selection retraced geometry'
                report['checks'].append({'room':room,'floor':floor,'selectedDoorId':selected['objectId'],'noGeometryRetrace':True})
            click('#completeFloorPanel [data-floor-bookmark="stair"]');stair=capture('stair-bookmark-'+floor)
            visible=page.evaluate("hits=>semanticInspection.registry.filter(r=>r.caseId==='lowrise'&&r.classKey==='stair'&&Number(hits[r.objectId]??0)>0).map(r=>({id:r.objectId,pixels:hits[r.objectId]}))",stair['hitObjectPixels'])
            assert visible,('Each floor stair bookmark must expose real stair hit IDs',floor)
            report['checks'].append({'floor':floor,'stairVisibleIds':visible})
        room_select.select_option('living')
        click('#completeFloorPanel [data-floor-bookmark="door"]');before=door_state();assert before['openT']==1 and before['descriptorExact'] and before['glError']==0 and before['runtime']['revision']==before['runtime']['presentedRevision']
        # A real in-flight frame exists before the close command. Queued edits
        # must not mutate its descriptors, and walking must be blocked immediately.
        isolation=page.evaluate("""()=>{const s=semanticInspection;s.render();const busy=s.renderer.busy,a=JSON.stringify(s.model.hostedComponents.apertures),registry=JSON.stringify(s.registry),camera=JSON.stringify(s.renderer.options);document.querySelector('#completeFloorPanel [data-room-door="close"]').click();const blocked=s.floorPanel.walk(1);return{busy,aperturesUnchanged:a===JSON.stringify(s.model.hostedComponents.apertures),registryUnchanged:registry===JSON.stringify(s.registry),cameraUnchanged:camera===JSON.stringify(s.renderer.options),blocked};}""")
        assert isolation['busy'] and isolation['aperturesUnchanged'] and isolation['registryUnchanged'] and isolation['cameraUnchanged'] and isolation['blocked']['blocked'],isolation
        closed=capture('room-door-closed');state=door_state()
        assert state['openT']==0 and not state['routeGate']['allowed'] and state['textureSerial']>before['textureSerial'] and state['runtime']['revision']>before['runtime']['revision'],state
        assert state['runtime']['revision']==state['runtime']['presentedRevision'] and not state['runtime']['pending'],state
        assert state['descriptorExact'] and state['glError']==0 and state['gpuPrimitiveCount']==state['currentPrimitiveCount']>0,state
        assert closed['hitObjectPixels'].get(str(state['leafId']),0)>0,('closed door leaf not visible',state)
        block=page.evaluate("""()=>{const s=semanticInspection,c=JSON.stringify(s.renderer.options),n=s.renderRequests,r=s.floorPanel.walk(1);return{r,cameraUnchanged:c===JSON.stringify(s.renderer.options),noRender:n===s.renderRequests};}""")
        assert block['r']['blocked'] and block['cameraUnchanged'] and block['noRender'],block
        exact_pair(page,'room-door-closed')
        click('#completeFloorPanel [data-room-door="open"]');opened=capture('room-door-open');opened_state=door_state()
        assert opened_state['openT']==1 and opened_state['routeGate']['allowed'] and opened_state['textureSerial']>state['textureSerial'] and opened_state['runtime']['revision']>state['runtime']['revision'],opened_state
        assert opened_state['runtime']['revision']==opened_state['runtime']['presentedRevision'] and not opened_state['runtime']['pending'],opened_state
        assert opened_state['descriptorExact'] and opened_state['glError']==0 and opened_state['gpuPrimitiveCount']==opened_state['currentPrimitiveCount']>0,opened_state
        assert opened_state['descriptorGpuHash']!=state['descriptorGpuHash'],'Door GPU descriptor texture did not change'
        assert closed['fieldHashes']!=opened['fieldHashes'], 'Door operation must change authoritative geometry, not only a label'
        exact_pair(page,'room-door-open')
        report['checks'].append({'queuedDoorSameFrameIsolation':isolation,'closedWalkBlocked':block,'closed':state,'opened':opened_state})
        # Real panel slider drives the same continuous floor/stair/door route.
        for progress in [0,.25,.5,1]:
            panel.locator('input[type=range][aria-label="从入口经过楼梯走到房间的路线进度"]').evaluate("(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}",round(progress*1000));q=capture('route-'+str(progress))
            pose=page.evaluate('semanticInspection.routePose');assert pose and abs(pose['progress']-progress)<1e-9,('route did not advance',progress,pose)
            assert all(isinstance(v,(int,float)) for v in pose['foot'])
            report['checks'].append({'routeProgress':progress,'pose':pose,'wallMs':q['stats']['wallMs']})
        assert page.evaluate('JSON.stringify(semanticInspection.source.patches)')==source,'source geometry changed during route/door interaction'
        assert page.evaluate('semanticInspection.registry.map(r=>r.objectId).sort((a,b)=>a-b)')==ids,'object identity changed during door operations'
        report['passed']=True
    finally:
        try:
            (out/'floor-panel-final-dom.html').write_text(page.locator('#completeFloorPanel').inner_html())
        except Exception:pass
        save()
    return report
