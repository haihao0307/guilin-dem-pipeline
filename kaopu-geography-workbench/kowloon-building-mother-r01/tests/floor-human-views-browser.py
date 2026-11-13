import asyncio,json,argparse,hashlib,sys,ast
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);r={'passed':False,'errors':[],'scope':'Camera-only two human-scale views, same room/shape/material/light/door-window state. No runtime changes, no publication, not physical-phone performance.'}
 base='http://127.0.0.1:8765/kaopu-geography-workbench/kowloon-building-mother-r01/'
 source=ast.parse(Path(__file__).with_name('floor-visual-browser.py').read_text());expected=next(ast.literal_eval(n.value)for n in source.body if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='EXPECTED_RUNTIME'for t in n.targets))
 async with async_playwright()as pw:
  browser=await pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);page=await browser.new_page(viewport={'width':800,'height':650});page.on('pageerror',lambda e:r['errors'].append(str(e)))
  try:
   r['runtimeHashes']={}
   for path,sha in expected.items():
    res=await page.request.get(base+path);assert res.status==200;actual=hashlib.sha256(await res.body()).hexdigest();assert actual==sha,path;r['runtimeHashes'][path]=actual
   r['guards']=await(await page.request.get(base+'evidence/floor-human-view-r01/guards.json')).json();await page.goto(base+'tests/floor-visual-probe.html');await page.wait_for_function('window.probe?.ready');r['setup']=await page.evaluate('probe.setup()');print('REAL COMPILE/LINK PASSED',json.dumps(r['setup']['compile']),flush=True);r['gpu']=await page.evaluate('probe.renderer.gpu');r['views']=[]
   for view in r['guards']['views']:
    await page.evaluate('(c)=>Object.assign(probe.renderer.options,{eye:c.eye,target:c.target,fov:c.fov,cut:false,sliceY:null})',view)
    v=await asyncio.wait_for(page.evaluate('probe.visual({width:640,coat:true,shadow:true})'),90);assert v['error']==0
    item={'camera':view,**v};r['views'].append(item)
    await page.locator('#view').screenshot(path=str(out/(view['name']+'.png')));print('CAPTURED',view['name'],v['stats']['wallMs'],flush=True)
    item['coverage']=await page.evaluate('''()=>{const r=probe.renderer,g=r.gl,ids={},roles={},status={};for(const tile of r.hitTiles){g.bindFramebuffer(g.FRAMEBUFFER,tile.target.fbo);g.readBuffer(g.COLOR_ATTACHMENT0);const a=new Float32Array(tile.width*tile.height*4);g.readPixels(tile.x,tile.y,tile.width,tile.height,g.RGBA,g.FLOAT,a);for(let i=0;i<a.length;i+=4){const s=a[i+3];status[s]=(status[s]??0)+1;if(s===1){const id=a[i+1],role=a[i+2];ids[id]=(ids[id]??0)+1;roles[role]=(roles[role]??0)+1;}}}g.bindFramebuffer(g.FRAMEBUFFER,null);return{ids,roles,status,error:g.getError()};}''')
    c=item['coverage'];item['visibleExpected']={k:sum(c['ids'].get(str(i),0)for i in v)for k,v in r['guards']['ids'].items()};print('VISIBLE IDs',json.dumps(item['visibleExpected']),flush=True)
    (out/'human-views.json').write_text(json.dumps(r,indent=2));assert c['error']==0;assert c['status'].get('3',0)==0,'unresolved primary rays';assert item['visibleExpected']['floor']>100,'Bedroom floor not visible';assert item['visibleExpected'][view['required']]>20,view['required']+' not visible';assert c['roles'].get('12',0)>100,'Existing interior wall not visible'
   assert not r['errors'];r['passed']=True
  except Exception as e:r['failure']=repr(e);print('FAIL',repr(e),flush=True)
  finally:
   (out/'human-views.json').write_text(json.dumps(r,indent=2));await browser.close();sys.exit(0 if r['passed'] else 1)
asyncio.run(main())
