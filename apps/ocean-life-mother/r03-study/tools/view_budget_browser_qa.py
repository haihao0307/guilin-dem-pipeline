from pathlib import Path
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1]
kernel=(R/'src/field-kernel.js').read_text()
make_doc=r'''() => {
 function rank1(rows,cols){return{rank:1,rows:[rows],cols:[cols]}}
 const W=65,H=33,onesW=Array(W).fill(1),onesH=Array(H).fill(1),lin=Array.from({length:W},(_,i)=>-0.5+i/(W-1)),vcurve=Array.from({length:H},(_,i)=>0.12*Math.sin(Math.PI*i/(H-1))),zeroW=Array(W).fill(0),zeroH=Array(H).fill(0);
 const fields={x:rank1(onesH,lin),y:rank1(vcurve,onesW),z:rank1(onesH,zeroW),red:rank1(onesH,Array(W).fill(.3)),green:rank1(onesH,Array(W).fill(.5)),blue:rank1(onesH,Array(W).fill(.2)),alpha:rank1(onesH,onesW),roughness:rank1(onesH,Array(W).fill(.6)),nx:rank1(onesH,zeroW),ny:rank1(onesH,onesW),nz:rank1(onesH,zeroW),er:rank1(onesH,zeroW),eg:rank1(onesH,zeroW),eb:rank1(onesH,zeroW),sx:rank1(onesH,zeroW),sy:rank1(onesH,onesW),sz:rank1(onesH,zeroW)};
 const patch={id:'synthetic',width:W,height:H,mirrorX:false,domain:Array.from({length:H},()=>[0,W-1]),fields}; const doc={schema:'kaopu-source-chart-field-study/0.1',sourceLengthUnits:1,patches:[patch]};
 const run=px=>{const plan=FieldKernel.conduct(px),t=performance.now(),f=FieldKernel.fish(doc,plan);return{px,detail:plan.detail,count:f.count,ms:performance.now()-t,sourceTriangleCount:f.sourceTriangleCount,intermediateRaster:f.intermediateRaster,finite:f.data.every(Number.isFinite)}};
 return {near:run(420),mid:run(100),far:run(15),probe:FieldKernel.patchAt(patch,.37,.61),inner:[innerWidth,innerHeight],ua:navigator.userAgent};
}'''
report={'revision':'R03.A-run1','engine':'Chromium headless','transport':'real browser evaluation of synthetic continuous-field kernel; no black-bass visual acceptance','viewports':[]}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for wh in [(1280,900),(390,844)]:
        page=b.new_page(viewport={'width':wh[0],'height':wh[1]}); errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
        page.add_script_tag(content=kernel); q=page.evaluate(make_doc); q['errors']=errors; q['viewport']=list(wh); report['viewports'].append(q); page.close()
    b.close()
report['pass']=all(not q['errors'] and q['near']['count']>q['mid']['count']>q['far']['count'] and q['near']['sourceTriangleCount']==0 and q['far']['sourceTriangleCount']==0 and not q['near']['intermediateRaster'] and q['near']['finite'] and q['far']['finite'] for q in report['viewports'])
(R/'qa/view-budget-browser.json').write_text(json.dumps(report,indent=2)); print(json.dumps(report,indent=2))
if not report['pass']: raise SystemExit(1)
