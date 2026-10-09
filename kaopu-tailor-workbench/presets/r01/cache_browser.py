"""Build the 60 cached papers with the SAME browser worker used for regeneration.
Native/WASM nonlinear curve solutions are not assumed byte- or geometry-identical.
Keep native results as evidence. Never widen geometry parity tolerances to hide them.
"""
from pathlib import Path
import gzip,json,time,subprocess
from playwright.sync_api import sync_playwright
from build import P,audit,canonical_geometry,encoded,write,compress
BASE='http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r01/'
def main():
 library=json.loads((P/'library.json').read_text());rows=library['presets'];seen=set();report=[];started=time.perf_counter()
 native_dir=P/'qa/native-baseline';native_dir.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox']);page=browser.new_page()
  page.goto(BASE,wait_until='networkidle',timeout=120000)
  page.evaluate('''()=>{const worker=new Worker(new URL('./worker.mjs',location.href),{type:'module'});let id=0;window.__cacheGenerate=request=>new Promise((resolve,reject)=>{const token=++id;const timer=setTimeout(()=>reject(Error('cache generation timed out')),180000);worker.onmessage=({data})=>{if(data.id!==token)return;if(data.type==='result'){clearTimeout(timer);resolve(data.pattern)}if(data.type==='error'){clearTimeout(timer);reject(Error(data.message))}};worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))};worker.postMessage({type:'generate',id:token,request});});window.__cacheClose=()=>worker.terminate();}''')
  try:
   for row in rows:
    target=P/row['paperAsset'];raw=target.read_bytes();native=json.loads(gzip.decompress(raw));(native_dir/(row['id']+'.json.gz')).write_bytes(raw)
    result=page.evaluate('(request)=>window.__cacheGenerate(request)',{'bodyCm':library['referenceBody']['bodyCm'],'design':native['design']})
    check=audit(result);assert result['design']==native['design'] and result['bodyCm']==native['bodyCm']
    signature=canonical_geometry(result);assert signature not in seen,('duplicate browser paper',row['id']);seen.add(signature)
    compare={'id':row['id'],'sameNumericDesign':True,'nativeRecipeHash':native['recipeHash'],'browserRecipeHash':result['recipeHash'],'nativeGeometryHash':native['geometryHash'],'browserGeometryHash':result['geometryHash'],'exactCrossBackendGeometryHashMatch':native['geometryHash']==result['geometryHash'],'browser2DPass':True}
    report.append(compare);compress(row['paperAsset'],result)
    row.update(recipeHash=result['recipeHash'],geometryHash=result['geometryHash'],shapeFingerprint=signature,panelCount=len(result['panels']),seamCount=len(result['seams']),dartCount=len(result['darts']),audit=check,paperWarnings=result['validation']['warnings'],generationMs=result['diagnostics']['generationMs'],previewBackend='actual browser worker / pinned Pyodide',nativeReferencePreserved='qa/native-baseline/'+row['id']+'.json.gz')
    print('BROWSER_CACHE',row['id'],'PASS',flush=True)
  finally:page.evaluate('window.__cacheClose()');browser.close()
 assert len(report)==60 and len(seen)==60
 library['previewBackend']='actual browser worker; fresh re-generation compared against same backend'
 write('library.json',library)
 # Rebuild actual SVGs, without resetting the independent parameter-effect atlas.
 subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import z from 'node:zlib';import {paperSVG} from './vendor/paper-preview.mjs';const l=JSON.parse(fs.readFileSync('library.json'));for(const r of l.presets){const p=JSON.parse(z.gunzipSync(fs.readFileSync(r.paperAsset)));fs.writeFileSync(r.thumbnail,paperSVG(p,{thumbnail:true}));}"],cwd=P,check=True)
 write('BROWSER_CACHE_REPORT.json',{'passed':60,'uniqueBrowserPaperGeometries':len(seen),'seconds':time.perf_counter()-started,'sameRuntimeAsUserRegeneration':True,'nativeBaselinePreserved':True,'crossBackendGeometricEqualityNotAssumed':True,'rows':report,'physicalFitAccepted':False})
 print('P01_BROWSER_CACHE_SUCCESS',len(report),flush=True)
if __name__=='__main__':main()
