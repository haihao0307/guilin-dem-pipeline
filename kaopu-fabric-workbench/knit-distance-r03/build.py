from pathlib import Path
import hashlib,json
r=Path(__file__).parent
p=r/'shader.wgsl';s=p.read_text()
old='fn render(@builtin(global_invocation_id) gid:vec3<u32>){let p=gid.xy;'
new='fn render(@builtin(global_invocation_id) gid:vec3<u32>){let p=gid.xy+vec2<u32>(0u,g.dims.w);'
if old in s:s=s.replace(old,new)
else:assert new in s
p.write_text(s)
app=(r/'app.js').read_text().rstrip()
assert app.endswith('boot();')
app=app[:-len('boot();')]+'\n'+(r/'scheduler.js').read_text()+'\nboot();\n'
html=(r/'shell.html').read_text().replace('/*SHADER*/','const SHADER='+json.dumps(s,ensure_ascii=False)+';').replace('/*APP*/',app)
(r/'index.html').write_text(html)
manifest={'version':'KNIT-DISTANCE-R03','bytes':len(html.encode()),'sha256':hashlib.sha256(html.encode()).hexdigest(),'files':{n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['app.js','scheduler.js','shader.wgsl','shell.html']}}
(r/'BUILD.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest))
