"""Compare adapter with original module in SAME browser engine.
Native rejections stay rejections; this is provenance, not a capability pass.
"""
from pathlib import Path
import json,hashlib
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
 page=b.new_page();page.goto('http://127.0.0.1:8765/kaopu-tailor-workbench/presets/r04/',wait_until='domcontentloaded',timeout=120000)
 page.wait_for_function('window.__R04?.state().ready',timeout=300000)
 result=page.evaluate('''async()=>{
 const {nativeReference}=await import('./native/kaopu-tailor-workbench/catalogue/reference-probe.mjs');
 const {materialHash}=await import('./source-contract.mjs');
 const rows=(await(await fetch('assets/catalogue.json')).json()).rows;
 const audit=(await(await fetch('assets/MATERIAL_AUDIT.json')).json()).nativeMaterials;
 const checked=[];
 for(const row of rows){const actual=audit.find(r=>r.id===row.id);const raw=await(await fetch(row.nativePaper)).blob();const paper=await new Response(raw.stream().pipeThrough(new DecompressionStream('gzip'))).json();
  try{const spec=await nativeReference(paper),hash=await materialHash(spec);checked.push({id:row.id,referenceOutcome:'native-meshed',matched:hash===actual.binding?.materialSHA256,referenceMaterialSHA256:hash,adapterMaterialSHA256:actual.binding?.materialSHA256});}
  catch(e){checked.push({id:row.id,referenceOutcome:'native-rejected',matched:actual.error?.includes(e.message)===true,originalError:e.message,adapterError:actual.error});}
 }
 return{sourceParityPassed:checked.every(r=>r.matched),nativeMeshed:checked.filter(r=>r.referenceOutcome==='native-meshed').length,nativeRejected:checked.filter(r=>r.referenceOutcome==='native-rejected').length,allPatternsMeshable:checked.every(r=>r.referenceOutcome==='native-meshed'),checked};
}''')
 result['browserVersion']=b.version;result['comparisonScope']='Original source module versus source adapter in identical Chromium; native failures remain visible.'
 result['originalWorkerSHA256']=hashlib.sha256((P/'native/kaopu-tailor-workbench/catalogue/r074-worker.bundle.mjs').read_bytes()).hexdigest()
 (P/'NATIVE_PARITY.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
print('SAME_BROWSER_NATIVE_PARITY',result['sourceParityPassed'],result['nativeMeshed'],result['nativeRejected'],flush=True)
if not result['sourceParityPassed']:raise SystemExit(1)
