"""Post-release image decode audit. No production runtime or geometry changes.
Test requests lazy images eagerly to inspect all paginated assets without claiming
that offscreen lazy images load before the user reaches them.
"""
from pathlib import Path
import json,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;OUT=P/'qa-r0432-decoded';OUT.mkdir(exist_ok=True)
BASE='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r0432-eeca9dee0c3a/'
R={'public':True,'url':BASE,'runtimeSourceCommit':'eeca9dee0c3a01be2b203eb3422bd62f146b8795','checks':[],'images':[],'pageErrors':[],'httpErrors':[],'passed':False,'testOnlyLoadingChange':'Request offscreen lazy image URLs eagerly, then await decode; actual image bytes and production runtime are unchanged.','mobileScope':'Chromium 390x844 viewport, not a physical phone'}
def check(n,b):
 R['checks'].append({'name':n,'passed':bool(b)})
 if not b:raise AssertionError(n)
def decode(p):
 return p.evaluate('''async()=>{
 const cards=Array.from(document.querySelectorAll('.card'));
 await Promise.all(cards.map(async c=>{const i=c.querySelector('img');if(!i)throw Error('Missing image '+c.dataset.id);i.loading='eager';await i.decode();}));
 return cards.map(c=>{const i=c.querySelector('img'),canvas=document.createElement('canvas');canvas.width=80;canvas.height=104;const ctx=canvas.getContext('2d');ctx.drawImage(i,0,0,80,104);const p=ctx.getImageData(0,0,80,104).data,colors=new Set();for(let k=0;k<p.length;k+=16)colors.add((p[k]>>3)+','+(p[k+1]>>3)+','+(p[k+2]>>3));return{id:c.dataset.id,width:i.naturalWidth,height:i.naturalHeight,decoded:i.complete,colors:colors.size};});
 }''')
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);p=b.new_page(viewport={'width':1440,'height':1080});p.set_default_timeout(300000)
  p.on('pageerror',lambda e:R['pageErrors'].append(str(e)));p.on('response',lambda r:R['httpErrors'].append({'url':r.url,'status':r.status})if r.status>=400 else None)
  p.goto(BASE+'?preset=T01-P01',wait_until='domcontentloaded');p.wait_for_function('window.__R04?.state().ready');check('native runtime ready',p.evaluate('__R04.state().release')=='R04.3.2')
  p.evaluate('__R04.setCollection("single")');rows=decode(p);R['images']+=rows;check('all 60 source thumbnail PNGs decode and are nonblank',len(rows)==60 and all(r['decoded']and r['width']>200 and r['colors']>20 for r in rows))
  p.evaluate('__R04.setCollection("outfits")');ids=[]
  for page in range(1,19):
   rows=decode(p);R['images']+=rows;ids += [r['id']for r in rows];check('outfit page '+str(page)+' decoded and nonblank',len(rows)==24 and all(r['decoded']and r['width']>200 and r['colors']>20 for r in rows))
   if page==1:
    p.evaluate('scrollTo(0,0)');p.screenshot(path=str(OUT/'outfits-desktop-decoded.png'));p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(200);p.screenshot(path=str(OUT/'outfits-mobile-decoded.png'));check('mobile no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'));p.set_viewport_size({'width':1440,'height':1080})
   if page<18:p.locator('#page-next').click()
  check('exactly 432 different original outfit thumbnails',len(ids)==len(set(ids))==432);check('no public image or page failures',not R['pageErrors']and not R['httpErrors']);check('original result coordinates unchanged by card inspection',p.evaluate('__R04.state().renderCoordinateErrorM')==0);b.close()
 R['passed']=True
except Exception as e:R['exception']=str(e);R['traceback']=traceback.format_exc();print(R['traceback'],flush=True)
finally:(P/'R0432_DECODED_GALLERY_REPORT.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
print('PUBLIC_IMAGE_DECODE',R['passed'],len(R['images']),flush=True)
if not R['passed']:raise SystemExit(1)
