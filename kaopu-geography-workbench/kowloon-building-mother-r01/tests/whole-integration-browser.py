import asyncio,json,argparse,hashlib
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/'
 report={'passed':False,'physicalPhoneTested':False,'errors':[],'httpFailures':[],'views':{},'originalDoorPackImported':False}
 def save():(out/'integration.json').write_text(json.dumps(report,indent=2))
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await b.new_page(viewport={'width':1180,'height':850});page.set_default_timeout(180000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('response',lambda r:report['httpFailures'].append({'status':r.status,'url':r.url}) if r.status>=400 else None)
  async def capture(name):
   q=await page.evaluate('''async()=>{const s=wholeBuilding,r=s.renderer,g=r.gl;await s.pause();const a=new Uint8Array(r.canvas.width*r.canvas.height*4);g.bindFramebuffer(g.FRAMEBUFFER,null);g.readPixels(0,0,r.canvas.width,r.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(x=>x.toString(16).padStart(2,'0')).join('');const status={},ids={};for(const tile of r.hitTiles){g.bindFramebuffer(g.FRAMEBUFFER,tile.target.fbo);g.readBuffer(g.COLOR_ATTACHMENT0);const h=new Float32Array(tile.width*tile.height*4);g.readPixels(tile.x,tile.y,tile.width,tile.height,g.RGBA,g.FLOAT,h);for(let i=0;i<h.length;i+=4){status[h[i+3]]=(status[h[i+3]]??0)+1;if(h[i+3]===1)ids[h[i+1]]=(ids[h[i+1]]??0)+1;}}g.bindFramebuffer(g.FRAMEBUFFER,null);return{sha,status,ids,stats:s.lastStats,gpu:r.gpu,caseId:s.caseId,components:s.getIntegration().records,activeComponents:r.apertures.map(a=>a.instanceId),error:g.getError(),canvas:{w:r.canvas.width,h:r.canvas.height},sampling:s.sampling};}''')
   assert q['error']==0,name+' WebGL error';assert q['status'].get('1',0)>64,name+' no source/design hits'
   await page.locator('#view').screenshot(path=str(out/(name+'.png')));report['views'][name]=q;save();print('CAPTURE',name,q['stats']['wallMs'],q['status'],flush=True);return q
  try:
   await page.goto(base+'whole-building-integrated-r01.html');await page.wait_for_function('wholeBuilding?.ready&&wholeBuilding?.presentedFrames>0');await capture('lowrise-whole')
   await page.evaluate("wholeBuilding.setView('components')");await page.evaluate('wholeBuilding.setComponentState({doorOpenT:0})');closed=await capture('lowrise-entry-closed');await page.evaluate('wholeBuilding.setComponentState({doorOpenT:1})');opened=await capture('lowrise-entry-open');assert closed['sha']!=opened['sha'],'Door opening not visible'
   await page.evaluate("wholeBuilding.setView('component-window')");await page.evaluate('wholeBuilding.setComponentState({windowOpenT:0})');wc=await capture('lowrise-window-closed');await page.evaluate('wholeBuilding.setComponentState({windowOpenT:1})');wo=await capture('lowrise-window-open');assert wc['sha']!=wo['sha'],'Window opening not visible'
   report['componentVisibility']={k:{part:v['ids'].get(str(4000+inst*8+idx),0) for idx,part in enumerate(['host','frame','leaf','glass'])} for k,v,inst in [('windowClosed',wc,0),('windowOpen',wo,0),('entryClosed',closed,110),('entryOpen',opened,110)]}
   assert report['componentVisibility']['windowClosed']['glass']>0,'Finite glass not visible'
   assert report['componentVisibility']['windowOpen']['leaf']>0,'Moving window leaf not visible'
   assert report['componentVisibility']['entryOpen']['frame']>0,'Entry frame not visible'
   report['floorVisibility']=[]
   for floor,expected in [('L01',[110]),('L02',[0]),('missing',[])]:
    await page.evaluate('''async({floor})=>{const s=wholeBuilding;await s.pause();s.lastStats=await s.renderer.render({width:160,height:136,presentWidth:160,presentHeight:136,visibleFloorIds:[floor],source:true,design:true,tileSize:96});}''',{'floor':floor})
    cap=await capture('floor-filter-'+floor);assert cap['activeComponents']==expected,(floor,cap['activeComponents']);report['floorVisibility'].append({'floor':floor,'active':cap['activeComponents'],'ids':cap['ids']})
   assert report['floorVisibility'][0]['ids'].get('1120',0)>0,'Hidden upper window did not restore original p120 source'
   assert not any(k in report['floorVisibility'][0]['ids'] for k in ['4001','4002','4003']),'Hidden upper window still appears'
   await page.evaluate('wholeBuilding.render()')
   await page.evaluate("wholeBuilding.setView('source')");before=await capture('lowrise-original-source');await page.evaluate('wholeBuilding.setComponentState({enabled:false})');after=await capture('lowrise-source-disabled');assert before['sha']==after['sha'],'Source baseline changed by proposal state'
   await page.evaluate('wholeBuilding.setComponentState({enabled:true})');await page.evaluate("wholeBuilding.setView('whole')");await page.evaluate('wholeBuilding.renderer.options.cut=true');await page.evaluate('wholeBuilding.render()');await capture('lowrise-cutaway-stairs')
   await page.evaluate("wholeBuilding.chooseCase('warehouse')");await capture('warehouse-whole');await page.evaluate("wholeBuilding.setView('components')");await page.evaluate('wholeBuilding.setComponentState({doorOpenT:1})');await capture('warehouse-vehicle-personnel');await page.evaluate("wholeBuilding.setView('component-personnel')");await page.evaluate('wholeBuilding.setComponentState({doorOpenT:0})');pc=await capture('warehouse-person-closed');await page.evaluate('wholeBuilding.setComponentState({doorOpenT:1})');po=await capture('warehouse-person-open');assert pc['sha']!=po['sha'];assert await page.evaluate('wholeBuilding.getIntegration().components.every(a=>a.kind!=="window")')
   await page.evaluate("wholeBuilding.chooseCase('kcc')");await capture('kcc-preserved-plan');assert await page.evaluate('wholeBuilding.getFloorStudy().evidenceModel.upperFloorRelation.upperFloorId!==null')
   await page.set_viewport_size({'width':390,'height':844});await page.evaluate("wholeBuilding.chooseCase('lowrise')");await capture('mobile-lowrise-whole')
   report['oldSourceAndControllerGuard']='covered by CPU immutable model/source tests; original modules not changed'
   assert not report['errors'],report['errors'];assert not report['httpFailures'],report['httpFailures'];report['passed']=True;save()
  except Exception as e:report['failure']=str(e);save();raise
  finally:await b.close()
asyncio.run(main())
