from pathlib import Path
import json,urllib.request,hashlib,concurrent.futures,time
root=Path(__file__).parent; dest=root/'browser/vendor/pyodide';dest.mkdir(parents=True,exist_ok=True)
lock=json.loads((root/'pyodide-lock.json').read_text())
items=[{'file_name':n} for n in ['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']]+[lock['packages'][n] for n in ['numpy','scipy','openblas','pyyaml']]
def get(item):
 fn=item['file_name'];p=dest/fn
 if not p.exists():
  for i in range(3):
   try:
    urllib.request.urlretrieve('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'+fn,p);break
   except Exception:
    if i==2:raise
    time.sleep(2)
 h=hashlib.sha256(p.read_bytes()).hexdigest()
 if item.get('sha256'):assert h==item['sha256'],fn
 return {'file':fn,'bytes':p.stat().st_size,'sha256':h}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as e:result=list(e.map(get,items))
(root/'reports/runtime-download.json').write_text(json.dumps({'pyodide':'0.26.4','files':result,'totalBytes':sum(x['bytes'] for x in result)},indent=2))
print(json.dumps(result,indent=2))
