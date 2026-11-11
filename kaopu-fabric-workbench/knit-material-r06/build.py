from pathlib import Path
import re,json,hashlib
r=Path(__file__).parent
base=r.parent/'baseline-r03'
if not base.exists():base=r.parent/'knit-distance-r03'
s=(base/'shader.wgsl').read_text()
s=s.replace('appearance:vec4<f32>, dims:vec4<u32>, }','appearance:vec4<f32>, dims:vec4<u32>, geom:vec4<f32>, fabric:vec4<f32>, palette:vec4<f32>, pattern:vec4<f32>, fibre:vec4<f32>, }')
s=s.replace('const PITCH:f32=11.6;','').replace('const RADIUS:f32=1.72;','').replace('PITCH','g.geom.x').replace('RADIUS','g.geom.z')
s=s.replace('const PI:', '@group(0) @binding(7) var<storage,read_write> hairAccum:array<atomic<u32>>;\nconst PI:',1)
s=s.replace('let shift=vec3<f32>(162.4,156.6,0.);','let shift=swatchShift();')
s=s.replace('g.geom.x*.5','g.geom.x*.5*g.geom.y')
s=s.replace('col>=28','col>=i32(g.fabric.x)').replace('row>=54','row>=i32(g.fabric.y)')
s=s.replace('let rad=g.geom.z*(1.+.038*sin(ft*21.+phase)+.022*sin(ft*49.+phase*3.));let envelope=1.+.055*cos(3.*(a+ft*TAU*2.8*.55))+.022*sin(5.*a+phase+ft*11.);','let rad=materialYarnRadius(bestT,a,bestLane);let envelope=1.;')
s=s.replace('let lo=vec3<f32>(-164.8,-164.,-7.6);let hi=vec3<f32>(164.8,166.,7.6);','let sh=swatchShift();let lo=vec3<f32>(-sh.xy-vec2<f32>(g.geom.x),-g.geom.x*.4*g.geom.w-g.geom.z-1.35);let hi=vec3<f32>(sh.xy+vec2<f32>(g.geom.x),g.geom.x*.4*g.geom.w+g.geom.z+1.35);')
a=s.index('fn volume(');b=s.index('fn softShadow(')
s=s[:a]+'\n//__MATERIAL__\n'+s[b:]
s=s.replace('let base=g.appearance.yzw*','let base=materialColor(vec2<f32>(f.t,f.lane))*')
s=s.replace('g.appearance.x>.001','g.appearance.x>.001&&g.fibre.z>.001')
s=s.replace('a*g.appearance.yzw*lum','a*materialColor(vec2<f32>(f.t,f.lane))*lum')
s=s.replace('let span=slab(g.eye.xyz,rd);','if(g.fibre.w>.5){let p=planePoint(rd);let sh=swatchShift();if(abs(p.x)<sh.x&&abs(p.y)<sh.y){let t=length(p-g.eye.xyz);let check=f32((i32(floor(p.x/10.))+i32(floor(p.y/10.)))&1);return vec4<f32>(vec3<f32>(.18+.04*check),t);}return vec4<f32>(.035,.035,.035,1.e8);}\n let span=slab(g.eye.xyz,rd);')
s=s.replace('pixels[index]=vec4<f32>(color,depth);','pixels[index]=vec4<f32>(sum,depth);')
s=s.replace('// KNIT-DISTANCE-R03:','// KNIT-MATERIAL-R04:')
s+='\n'+(r/'fibres.wgsl').read_text()
(r/'core.wgsl').write_text(s)
html=(r/'shell.html').read_text().replace('/*DATA*/','const CORE='+json.dumps(s,ensure_ascii=False)+';\nconst DEFAULT_MATERIAL='+json.dumps((r/'material.wgsl').read_text(),ensure_ascii=False)+';\nconst PRESET_DATA='+ (r/'presets.json').read_text()+';').replace('/*APP*/',(r/'app.js').read_text())
(r/'index.html').write_text(html)
(r/'BUILD.json').write_text(json.dumps({'version':'KNIT-MATERIAL-R04','sha256':hashlib.sha256(html.encode()).hexdigest(),'bytes':len(html.encode()),'baseRuntime':'888fe07369ef1f1e3ab69bd38729e1c9229a33f6','note':'P02 structure + noise + procedural curve fibres; not pure noise; no triangle draw; no surface cloud'},indent=2))
print('BUILT',len(html.encode()),hashlib.sha256(html.encode()).hexdigest())
