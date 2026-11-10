from pathlib import Path
import hashlib,json
r=Path(__file__).parent
p=r/'shader.wgsl'
s=p.read_text()
patches={
 'return hash(u32(p.x)*1597334677u^u32(p.y)*3812015801u^u32(p.z)*2798796415u);':'let x=u32(p.x)*1597334677u;let y=u32(p.y)*3812015801u;let z=u32(p.z)*2798796415u;return hash(x^y^z);',
 'let rd=direction(vec2<f32>(px)+.5);let p=planePoint(rd);let distance=length(p-g.eye.xyz);var measure=distance;':'var measure=g.control.x;',
 'if(g.dims.z==1u){let dx=planePoint':'if(g.dims.z==1u){let rd=direction(vec2<f32>(px)+.5);let p=planePoint(rd);let dx=planePoint',
 'vec4<f32>(w[4],w[5],distance,measure)':'vec4<f32>(w[4],w[5],g.control.x,measure)',
 'a>.001||g.control.w>.5':'a>0.||g.control.w>.5'
}
for old,new in patches.items():
 if old in s:s=s.replace(old,new)
 else:assert new in s,old
p.write_text(s)
a=r/'app.js';app=a.read_text().replace("world distance only; no pixel footprint or yarn pixel diameter","direct world-distance uniform; no per-pixel distance or yarn pixel diameter")
a.write_text(app)
html=(r/'shell.html').read_text().replace('/*SHADER*/','const SHADER='+json.dumps(s,ensure_ascii=False)+';').replace('/*APP*/',app)
(r/'index.html').write_text(html)
manifest={'version':'KNIT-DISTANCE-R03','bytes':len(html.encode()),'sha256':hashlib.sha256(html.encode()).hexdigest(),'files':{n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['app.js','shader.wgsl','shell.html']}}
(r/'BUILD.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest))
