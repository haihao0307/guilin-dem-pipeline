from pathlib import Path
import gzip,json,os,traceback
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;BASE=os.environ.get('R074_BASE','http://127.0.0.1:8765/kaopu-tailor-workbench/r07/continuation/')
PUBLIC=BASE.startswith('https://');report={'scope':'preset design handoff and real current-body paper generation; not finished garments','public':PUBLIC,'cases':[],'passed':False,'physicalFitAccepted':False}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=browser.new_page(viewport={'width':1440,'height':1000})
 try:
  page.goto(BASE+'?case=MetaGarmentDress',wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('window.__TAILOR_CONTINUATION_QA__?.getPresetCount()===60&&window.__TAILOR_CATALOGUE_QA__?.getState().phase==="paper"',timeout=180000)
  body=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getAnalytic().bodyCm')
  library=page.request.get('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r01/library.json').json()
  for id in ['D01','P07','T13']:
   row=next(r for r in library['presets'] if r['id']==id)
   raw=page.request.get('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r01/'+row['paperAsset']).body()
   reference=json.loads(gzip.decompress(raw) if raw[:2]==b'\x1f\x8b' else raw)
   page.locator('[data-tab="styles"]').click();page.locator('#continuation-preset-select').select_option(id);page.locator('#continuation-preset-apply').click()
   page.wait_for_function('(id)=>{const s=window.__TAILOR_CATALOGUE_QA__.getState();return s.activePresetId===id&&!s.generating&&(s.phase==="paper"||s.phase==="error")}',arg=id,timeout=180000)
   state=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getState()');assert state['phase']=='paper',state
   actual=page.evaluate('window.__TAILOR_CATALOGUE_QA__.getAnalytic()')
   assert actual['design']==reference['design'] and actual['bodyCm']==body and actual['validation']['analytic2DPass'] is True
   assert state['caseId']==row['style'] and state['editOperationCount']==0
   report['cases'].append({'id':id,'style':row['style'],'name':row['name'],'fullDesignPreserved':True,'currentBodyPreserved':True,'liveGeneratorExecuted':True,'panelCount':len(actual['panels']),'sourceRecipeHash':actual['recipeHash'],'physicalFitAccepted':False})
  report['passed']=True;report['presetCount']=60
 except Exception:report['error']=traceback.format_exc();raise
 finally:
  (P/('PUBLIC_PRESET_HANDOFF.json' if PUBLIC else 'PRESET_HANDOFF.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close();print('R074_PRESET_HANDOFF',json.dumps(report,ensure_ascii=False),flush=True)
