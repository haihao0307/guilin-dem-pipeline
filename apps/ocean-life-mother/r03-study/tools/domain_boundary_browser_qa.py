from pathlib import Path
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1]
js=(R/'src/field-kernel.js').read_text()
html=f'''<!doctype html><meta charset="utf-8"><script>{js}</script><script>
function rank1(rows,cols){{return{{rank:1,rows:[rows],cols:[cols]}}}}
const W=65,H=33,oneW=Array(W).fill(1),oneH=Array(H).fill(1),zeroW=Array(W).fill(0),lin=Array.from({{length:W}},(_,i)=>-0.5+i/(W-1));
const fields={{}};for(const k of ['x','red','green','blue','alpha','roughness','ny','sy'])fields[k]=rank1(oneH,k==='x'?lin:k==='alpha'||k==='ny'||k==='sy'?oneW:Array(W).fill(.5));for(const k of ['y','z','nx','nz','er','eg','eb','sx','sz'])fields[k]=rank1(oneH,zeroW);
const patch={{id:'synthetic-boundaries',width:W,height:H,mirrorX:false,domain:Array.from({{length:H}},()=>[0,20,30,31,44,64]),fields}},doc={{schema:'kaopu-source-chart-field-study/0.1',sourceLengthUnits:1,patches:[patch]}};
window.run=(px)=>{{const plan=FieldKernel.conduct(px),a=FieldKernel.fish(doc,plan);return{{detail:plan.detail,count:a.count,boundary:a.patchPlans[0].boundarySamples,finite:a.data.every(Number.isFinite),boundaryPreserving:a.boundaryPreserving}}}};
</script>'''
report={'revision':'R03.A-run2','engine':'Chromium headless','transport':'set_content synthetic field only','viewports':[]}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for W,H in [(1280,900),(390,844)]:
        page=b.new_page(viewport={'width':W,'height':H}); errors=[]; page.on('pageerror',lambda e:errors.append(str(e))); page.set_content(html)
        vals=[page.evaluate('run(15)'),page.evaluate('run(100)'),page.evaluate('run(420)')]
        report['viewports'].append({'size':[W,H],'errors':errors,'values':vals})
        assert not errors and vals[0]['count']<vals[1]['count']<vals[2]['count'] and all(v['finite'] and v['boundaryPreserving'] and v['boundary']>0 for v in vals)
        page.close()
    b.close()
report['pass']=True;report['scope']='Real Chromium execution of synthetic explicit-domain fields. Not a black-bass visual/WebGL/iPhone/public-navigation acceptance.'
print(json.dumps(report,indent=2))
