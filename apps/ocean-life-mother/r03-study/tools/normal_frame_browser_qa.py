from playwright.sync_api import sync_playwright
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
kernel=(R/'src/field-kernel.js').read_text()
html=f'''<!doctype html><html><body><canvas id="c" width="320" height="180"></canvas><pre id="out"></pre><script>{kernel}\nwindow.ready=true;</script></body></html>'''
report={'revision':'R03.A-run3','transport':'set_content','viewports':[],'scope':'synthetic browser execution of position-derived geometric normal and domain-aware view sampling; not public navigation or black-bass fidelity'}
js=r'''() => {
 function rank1(rows,cols){return {rank:1,rows:[rows],cols:[cols]}}
 const W=65,H=33,oneW=Array(W).fill(1),oneH=Array(H).fill(1),u=Array.from({length:W},(_,i)=>i/(W-1)),v=Array.from({length:H},(_,i)=>i/(H-1)),zeroW=Array(W).fill(0),k=.42;
 const fields={x:rank1(oneH,u),y:rank1(v,oneW),z:rank1(v,u.map(x=>k*x)),red:rank1(oneH,Array(W).fill(.4)),green:rank1(oneH,Array(W).fill(.5)),blue:rank1(oneH,Array(W).fill(.6)),alpha:rank1(oneH,oneW),roughness:rank1(oneH,Array(W).fill(.5)),nx:rank1(oneH,zeroW),ny:rank1(oneH,zeroW),nz:rank1(oneH,oneW),er:rank1(oneH,zeroW),eg:rank1(oneH,zeroW),eb:rank1(oneH,zeroW),sx:rank1(v,u.map(x=>-k*x)),sy:rank1(v.map(y=>-k*y),oneW),sz:rank1(oneH,oneW)};
 const domain=Array.from({length:H},(_,i)=>i===17?[0,20,44,64]:[0,64]),patch={id:'warped',width:W,height:H,mirrorX:false,domain,fields},doc={schema:'kaopu-source-chart-field-study/0.1',sourceLengthUnits:1,patches:[patch]};
 const near=FieldKernel.fish(doc,FieldKernel.conduct(420)),far=FieldKernel.fish(doc,FieldKernel.conduct(15)),f=FieldKernel.geometricFrame(patch,.5,16/(H-1),{dv:1/(H-1)}),gl=document.getElementById('c').getContext('webgl2');
 if(!gl) throw new Error('WebGL2 unavailable');gl.clearColor(.1,.2,.3,1);gl.clear(gl.COLOR_BUFFER_BIT);
 const r={near:near.count,far:far.count,derived:near.geometryNormalFromPositionField,vNeighbours:f.vNeighbours,finite:near.data.every(Number.isFinite)&&far.data.every(Number.isFinite),glError:gl.getError(),overflow:document.documentElement.scrollWidth>innerWidth};document.getElementById('out').textContent=JSON.stringify(r);return r;
}'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for W,H in [(1280,900),(390,844)]:
  page=b.new_page(viewport={'width':W,'height':H});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html,wait_until='load');page.wait_for_function('window.ready===true');r=page.evaluate(js);assert r['derived'] and r['finite'] and r['glError']==0 and r['near']>r['far'];report['viewports'].append({'size':[W,H],'errors':errors,'result':r});page.close()
 b.close()
(R/'qa/NORMAL_FRAME_BROWSER_R03A_RUN3.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
