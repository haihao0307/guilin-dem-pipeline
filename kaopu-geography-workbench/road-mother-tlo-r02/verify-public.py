import urllib.request,time,hashlib,json,pathlib
base='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/road-mother-tlo-r02/'
root=pathlib.Path(__file__).parent
files=['index.html','app.mjs','renderer.mjs','shaders.mjs','road-mother.mjs','knowledge.json','style.css','README.md','source-notices.md']
deadline=time.time()+720
while True:
 try:
  proof=[]
  for name in files:
   data=urllib.request.urlopen(base+name,timeout=30).read();expected=(root/name).read_bytes()
   if data!=expected:raise ValueError('Not yet matching '+name)
   proof.append(dict(file=name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
  pathlib.Path('road-r02-proof').mkdir(exist_ok=True)
  pathlib.Path('road-r02-proof/public-files.json').write_text(json.dumps(proof,indent=2));print('PUBLIC FILES MATCH');break
 except Exception as e:
  if time.time()>deadline:raise
  print(str(e),flush=True);time.sleep(25)
