from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;OUT=P/'qa-r042';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('R04_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/')
PUBLIC=BASE.startswith('https:');checks=[];errors=[]
def check(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok:raise AssertionError((name,detail))
index=json.loads((P/'assets/results/index.json').read_text());summary=json.loads((P/'assets/readiness.json').read_text())['summary']
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'?preset=T08',wait_until='domcontentloaded',timeout=120000);page.wait_for_function('window.__R04?.state().ready',timeout=300000)
 s=page.evaluate('__R04.state()');check('Corrected runtime revision',s['version']=='R04-SOURCE-4' and s['panelSideFixApplied'])
 check('All original styles remain',page.locator('#cards .card').count()==60)
 for filter,expected in [('static-pass',summary['staticGatePassedRecords']),('needs-repair',summary['actualSolverRecords']-summary['staticGatePassedRecords']),('no-result',60-summary['actualSolverRecords']),('all',60)]:
  page.locator('[data-quality="'+filter+'"]').click();check('Actual result filter '+filter,page.locator('#cards .card').count()==expected,expected)
 page.locator('[data-quality="no-result"]').click()
 labels=page.locator('#cards .pending b').all_text_contents()
 check('No result is not misreported as loading',all(x in ['求解已中止','材料 / 缝边受限','材料网格受限','尚未完成缝合计算'] for x in labels),labels)
 check('Missing records expose their reasons',all(len(s)>5 for s in page.locator('#cards .pending p').all_text_contents()))
 page.screenshot(path=str(OUT/('public-' if PUBLIC else '')+'no-results.png')) if False else None
 page.screenshot(path=str(OUT/(('public-' if PUBLIC else '')+'no-results.png')))
 page.locator('[data-quality="all"]').click()
 for id in ['T01','T05','T06','T07','T08','T09','T10','T11','T12','T13','T15','P07','J06']:
  page.evaluate('id=>__R04.select(id)',id);s=page.evaluate('__R04.state()')
  if id in index['rows']:check('Exact corrected display '+id,s['clothIndexMatchesNative'] and s['renderCoordinateErrorM']==0)
  page.locator('#stage').screenshot(path=str(OUT/(('public-' if PUBLIC else '')+id+'.png')))
 page.evaluate('__R04.select("T08")');page.screenshot(path=str(OUT/(('public-' if PUBLIC else '')+'desktop.png')))
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/(('public-' if PUBLIC else '')+'mobile.png')))
 check('390x844 no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 check('No thumbnail loading errors',page.evaluate('__R04.state().thumbnailLoadErrors')==[])
 check('No browser exceptions',not errors,errors)
 b.close()
report={'public':PUBLIC,'url':BASE,'passed':all(c['passed'] for c in checks),'checks':checks,'summary':summary,'errors':errors,'mobileScope':'Chromium viewport, not a physical phone','physicalFitAccepted':False,'all60GarmentsAccepted':False}
(P/('R042_PUBLIC_UI_REPORT.json' if PUBLIC else 'R042_UI_REPORT.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('R042_UI_PASS',len(checks),flush=True)
