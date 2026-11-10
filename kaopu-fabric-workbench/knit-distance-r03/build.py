from pathlib import Path
import hashlib,json
r=Path(__file__).parent
s=(r/'shell.html').read_text().replace('/*SHADER*/','const SHADER='+json.dumps((r/'shader.wgsl').read_text(),ensure_ascii=False)+';').replace('/*APP*/',(r/'app.js').read_text())
(r/'index.html').write_text(s)
manifest={'version':'KNIT-DISTANCE-R03','bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'files':{n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['app.js','shader.wgsl','shell.html']}}
(r/'BUILD.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest))
