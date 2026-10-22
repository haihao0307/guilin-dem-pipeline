import asyncio,json,argparse,hashlib
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/'
 report={'passed':False,'physicalPhoneTested':False,'errors':[],'httpFailures':[],'views':{},'originalDoorPackImported':False}
 def save():(out/'facade.json').write_text(json.dumps(report,indent=2))
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await b.new_page(viewport={'width':1180,'height':850});page.set_default_timeout(180000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('response',lambda r:report['httpFailures'].append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  async def capture(name):
   q=await page.evaluate('''async()=>{const s=wholeBuilding,r=s.renderer,g=r.gl;await s.pause();const a=new Uint8Array(r.canvas.width*r.canvas.height*4);g.bindFramebuffer(g.FRAMEBUFFER,null);g.readPixels(0,0,r.canvas.width,r.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(x=>x.toString(16).padStart(2,'0')).join('');const status={},ids={},raw=new Uint8Array(r.canvas.width*r.canvas.height*16);let rawOffset=0;for(const tile of r.hitTiles){g.bindFramebuffer(g.FRAMEBUFFER,tile.target.fbo);g.readBuffer(g.COLOR_ATTACHMENT0);const h=new Float32Array(tile.width*tile.height*4);g.readPixels(tile.x,tile.y,tile.width,tile.height,g.RGBA,g.FLOAT,h);raw.set(new Uint8Array(h.buffer),rawOffset);rawOffset+=h.byteLength;for(let i=0;i<h.length;i+=4){status[h[i+3]]=(status[h[i+3]]??0)+1;if(h[i+3]===1)ids[h[i+1]]=(ids[h[i+1]]??0)+1;}}g.bindFramebuffer(g.FRAMEBUFFER,null);const hitSha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(x=>x.toString(16).padStart(2,'0')).join('');return{sha,hitSha,status,ids,stats:s.lastStats,gpu:r.gpu,caseId:s.caseId,components:s.getIntegration().records,activeComponents:r.apertures.map(a=>a.instanceId),error:g.getError(),canvas:{w:r.canvas.width,h:r.canvas.height},sampling:s.sampling};}''')
   assert q['error']==0,name+' WebGL error';assert q['status'].get('1',0)>64,name+' no source/design hits'
   await page.locator('#view').screenshot(path=str(out/(name+'.png')));report['views'][name]=q;save();print('CAPTURE',name,q['stats']['wallMs'],q['status'],flush=True);return q
  try:
   await page.goto(base+'whole-building-facade-r01.html');await page.wait_for_function('wholeBuilding?.ready&&wholeBuilding?.presentedFrames>0');await capture('lowrise-whole')

   await page.evaluate("wholeBuilding.setView('facade')");front=await capture('east-four-observed-groups')
   await page.evaluate('wholeBuilding.renderer.options.observedFrameCoatColor=[.035,.043,.041]');await page.evaluate('wholeBuilding.render()');dark=await capture('east-original-dark-coat-control');assert dark['hitSha']==front['hitSha'];assert dark['sha']!=front['sha'];await page.evaluate('delete wholeBuilding.renderer.options.observedFrameCoatColor');await page.evaluate('wholeBuilding.render()');pale=await capture('east-pale-coat-reset');assert pale['hitSha']==front['hitSha'] and pale['sha']==front['sha'];report['paleCoatControl']={'primaryHitExact':True,'paleResetRGBAExact':True,'colorChanged':True}
   await page.evaluate('wholeBuilding.renderer.options.diagnostic=1');await page.evaluate('wholeBuilding.render()');await capture('east-primary-identity-diagnostic');await page.evaluate('wholeBuilding.renderer.options.diagnostic=0');await page.evaluate('wholeBuilding.render()')
   report['observedGroupVisibility']={}
   for group in range(4):
    ids=[4000+(200+group*10+i)*8+j for i in range(0,5 if group==3 else 3) for j in [1,2,3]]
    pixels=sum(front['ids'].get(str(i),0) for i in ids);assert pixels>10,('missing observed group',group,pixels);report['observedGroupVisibility'][str(group+1)]=pixels
   await page.evaluate("wholeBuilding.setView('facade-close')");close=await capture('east-01-cross-seam-close')
   await page.evaluate('wholeBuilding.setObservedEnabled(false)');hidden=await capture('east-01-original-restored');assert hidden['sha']!=close['sha'];assert not any(int(k)>=5600 and int(k)<5900 for k in hidden['ids'])
   await page.evaluate('wholeBuilding.setObservedEnabled(true)');reset=await capture('east-01-reset');assert reset['sha']==close['sha'],'Toggle restoration not exact'
   await page.evaluate("wholeBuilding.setView('facade-inside')");inside=await capture('east-01-inside');assert sum(inside['ids'].get(str(i),0) for i in [5603,5611,5619])>0,'Inside glass absent'
   report['glassRayParity']=await page.evaluate('''async()=>{const s=wholeBuilding,r=s.renderer,g=r.gl;await s.pause();const camera=structuredClone(r.options),out=[];for(const c of s.getIntegration().facade.components){const p=c.primitives.find(p=>p.part==='glass');if(!p)continue;for(const sign of[-1,1]){r.options={...camera,eye:p.origin.map((x,i)=>x+sign*.5*p.w[i]),target:p.origin,fov:.02,cut:false,sliceY:null};await r.render({width:1,height:1,presentWidth:1,presentHeight:1,tileSize:32,source:true,design:true});const h=new Float32Array(4),n=new Float32Array(4);g.bindFramebuffer(g.FRAMEBUFFER,r.hitTiles[0].target.fbo);g.readBuffer(g.COLOR_ATTACHMENT0);g.readPixels(0,0,1,1,g.RGBA,g.FLOAT,h);g.readBuffer(g.COLOR_ATTACHMENT1);g.readPixels(0,0,1,1,g.RGBA,g.FLOAT,n);out.push({id:p.objectId,sign,hit:[...h],normal:[...n],expectedNormal:p.w.map(x=>x*sign),expectedT:.497});}}g.bindFramebuffer(g.FRAMEBUFFER,null);r.options=camera;return out;}''')
   for q in report['glassRayParity']:
    assert q['hit'][3]==1 and q['hit'][1]==q['id'],q
    assert abs(q['hit'][0]-q['expectedT'])<.0001,q
    assert sum(q['normal'][i]*q['expectedNormal'][i] for i in range(3))>.9999,q
   save();print('GLASS PARITY',len(report['glassRayParity']),flush=True)
   await page.evaluate("wholeBuilding.setView('facade')");await capture('east-after-parity')
   await page.evaluate("wholeBuilding.setView('components')");await page.evaluate('wholeBuilding.setComponentState({doorOpenT:0})');closed=await capture('lowrise-entry-closed');await page.evaluate('wholeBuilding.setComponentState({doorOpenT:1})');opened=await capture('lowrise-entry-open');assert closed['sha']!=opened['sha'],'Door opening not visible'
   await page.evaluate("wholeBuilding.setView('component-window')");await page.evaluate('wholeBuilding.setComponentState({windowOpenT:0})');wc=await capture('lowrise-window-closed');await page.evaluate('wholeBuilding.setComponentState({windowOpenT:1})');wo=await capture('lowrise-window-open');assert wc['sha']!=wo['sha'],'Window opening not visible'
   report['componentVisibility']={k:{part:v['ids'].get(str(4000+inst*8+idx),0) for idx,part in enumerate(['host','frame','leaf','glass'])} for k,v,inst in [('windowClosed',wc,0),('windowOpen',wo,0),('entryClosed',closed,110),('entryOpen',opened,110)]}
   assert report['componentVisibility']['windowClosed']['glass']>0,'Finite glass not visible'
   assert report['componentVisibility']['windowOpen']['leaf']>0,'Moving window leaf not visible'
   assert report['componentVisibility']['entryOpen']['frame']>0,'Entry frame not visible'
   report['floorVisibility']=[]
   for floor,expected in [('L01',[110]),('L02',[0,200,201,202,210,211,212,220,221,222,230,231,232,233,234]),('missing',[])]:
    await page.evaluate('''async({floor})=>{const s=wholeBuilding;await s.pause();s.lastStats=await s.renderer.render({width:160,height:136,presentWidth:160,presentHeight:136,visibleFloorIds:[floor],source:true,design:true,tileSize:96});}''',{'floor':floor})
    cap=await capture('floor-filter-'+floor);assert cap['activeComponents']==expected,(floor,cap['activeComponents']);report['floorVisibility'].append({'floor':floor,'active':cap['activeComponents'],'ids':cap['ids']})
   assert report['floorVisibility'][0]['ids'].get('1120',0)>0,'Hidden upper window did not restore original p120 source'
   assert not any(k in report['floorVisibility'][0]['ids'] for k in ['4001','4002','4003']),'Hidden upper window still appears'
   await page.evaluate('wholeBuilding.render()')
   await page.evaluate("wholeBuilding.setView('source')");before=await capture('lowrise-original-source');await page.evaluate('wholeBuilding.setComponentState({enabled:false})');after=await capture('lowrise-source-disabled');assert before['sha']==after['sha'],'Source baseline changed by proposal state'
   await page.evaluate('wholeBuilding.setComponentState({enabled:true})');await page.evaluate("wholeBuilding.setView('whole')");await page.evaluate('wholeBuilding.renderer.options.cut=true');await page.evaluate('wholeBuilding.render()');await capture('lowrise-cutaway-stairs')
   await page.evaluate("wholeBuilding.chooseCase('warehouse')");await capture('warehouse-whole');await page.evaluate("wholeBuilding.setView('components')");await page.evaluate('wholeBuilding.setComponentState({doorOpenT:1})');await capture('warehouse-vehicle-personnel');await page.evaluate("wholeBuilding.setView('component-personnel')");await page.evaluate('wholeBuilding.setComponentState({doorOpenT:0})');pc=await capture('warehouse-person-closed');await page.evaluate('wholeBuilding.setComponentState({doorOpenT:1})');po=await capture('warehouse-person-open');assert pc['sha']!=po['sha'];assert await page.evaluate('wholeBuilding.getIntegration().components.every(a=>a.kind!=="window")')
   await page.evaluate("wholeBuilding.chooseCase('kcc')");await capture('kcc-preserved-plan');assert await page.evaluate('wholeBuilding.getFloorStudy().evidenceModel.upperFloorRelation.upperFloorId!==null')
   await page.set_viewport_size({'width':390,'height':844});await page.evaluate("wholeBuilding.chooseCase('lowrise')");await capture('mobile-lowrise-whole');await page.evaluate("wholeBuilding.setView('facade')");await capture('mobile-east-four-groups')
   report['unchangedCaseRGBAGuard']={'lowrise-original-source': '82d07bff660e4b1f9e1f2828af38ab41e5823c79c3c9df6cdaefa103a71bfd60', 'warehouse-whole': '37c6c56bb4775fe34cc6024db37d68c76415dd4cc888c73c17a202fbdbc8fddb', 'warehouse-vehicle-personnel': 'd2e0fd346d09e53450fd7438aff9e6cf81eb5126c5e20f5154fa5fa8d9f0e22b', 'warehouse-person-closed': '100c87fc4387487fbce41d624fb37dd9f7de4a9b1b72774aef363edf067beb5c', 'warehouse-person-open': '71af2de02c91fef491d926b463ae5881daad8ab5d4b4ab27cf483ee3886cf8dc', 'kcc-preserved-plan': '0f832fb91434efdff24505b92a84f267f98430e2cc6e8c1e46cd91cb59c04dba'}
   for name,sha in report['unchangedCaseRGBAGuard'].items():assert report['views'][name]['sha']==sha,(name,'Unrelated source/case color changed')
   report['oldSourceAndControllerGuard']='covered by CPU immutable model/source tests; original modules not changed'
   assert not report['errors'],report['errors'];assert not report['httpFailures'],report['httpFailures'];report['passed']=True;save()
  except Exception as e:report['failure']=str(e);save();raise
  finally:await b.close()
asyncio.run(main())
