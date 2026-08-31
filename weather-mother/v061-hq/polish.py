"""Second visual pass. Read only generated HQ files; no source images."""
from pathlib import Path
import hashlib,json,subprocess
R=Path(__file__).resolve().parent

def replace(s,a,b):
 assert s.count(a)==1, (a[:90],s.count(a))
 return s.replace(a,b)
s=(R/'cloud.glsl').read_text()
s=replace(s,'vec3 q=flowPos(p);float b=shape(q);if(b<.002)return 0.;if(!detail){float n=fb(q*1.4);return smoothstep(.075,.39,b+(n-.5)*.23)*uOpt.x*.75;}','vec3 q=flowPos(p);float b;if(!detail){b=shape(q);if(b<.002)return 0.;float n=fb(q*1.4);return smoothstep(.075,.39,b+(n-.5)*.23)*uOpt.x*.75;}')
s=replace(s,'q+=w*(.33+.19*uOpt.y);b=shape(q);','vec3 wm=vec3(nv(q*3.9+9.),nv(q*4.1+23.),nv(q*3.7+37.))-.5;q+=w*(.55+.25*uOpt.y)+wm*(.18+.12*uOpt.y);b=shape(q);')
s=replace(s,'float broad=fb(q*1.8+vec3(0.,-uEvolution*.004,0.)),billow=texture(uNoise,q*5.1/8.+.17).g,fine=fb(q*15.7+3.),edge=1.-smoothstep(.20,.66,b);','float broad=fb(q*2.2+vec3(0.,-uEvolution*.004,0.)),billow=.58*texture(uNoise,q*3.8/8.+.17).g+.28*texture(uNoise,q*8.2/8.+.53).g+.14*texture(uNoise,q*16.4/8.+.31).g,fine=fb(q*19.7+3.),edge=1.-smoothstep(.22,.76,b);')
s=replace(s,'float d=b+(broad-.5)*.48-(1.-billow)*(.075+.085*uOpt.y)*edge-(1.-fine)*.055*uOpt.y*edge;','float d=b+(broad-.5)*.94-(1.-billow)*(.13+.15*uOpt.y)*edge-(1.-fine)*.065*uOpt.y*edge;')
s=replace(s,'d=smoothstep(.018,.185,d)*mix(.86,1.12,broad)*uOpt.x;','d=smoothstep(.012,.205,d)*mix(.65,1.18,broad)*uOpt.x;')
s=replace(s,'sh.x*1.18-.19*d','sh.x*1.35-.19*d')
s=replace(s,'m1=.29*exp(-tau*.24),m2=.10*exp(-tau*.064)','m1=.23*exp(-tau*.24),m2=.075*exp(-tau*.064)')
s=replace(s,'sunlight*(direct*(.27+.46*ph)','sunlight*(direct*(.36+.58*ph)')
(R/'cloud.glsl').write_text(s)
w=(R/'field-worker.js').read_text()
w=replace(w,'a[k]-r[k]-1.65','a[k]-r[k]-2.6')
w=replace(w,'a[k]+r[k]+1.65','a[k]+r[k]+2.6')
(R/'field-worker.js').write_text(w)
j=(R/'engine.js').read_text().replace('?v=061hq','?v=061hq-r2')
j=replace(j,'const state={hour:14.1,','const state={hour:16,')
(R/'engine.js').write_text(j)
h=(R/'index.html').read_text().replace('?v=061hq','?v=061hq-r2')
h=replace(h,'step="0.05" value="14.1"','step="0.05" value="16"')
(R/'index.html').write_text(h)
for name in ['engine.js','field-worker.js']:
 subprocess.run(['node','--check',str(R/name)],check=True)
m=json.loads((R/'MANIFEST.json').read_text())
for name in m['files']:
 b=(R/name).read_bytes();m['files'][name]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitBlobSha':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()}
m['totalSourceBytes']=sum(d['bytes'] for d in m['files'].values())
m['revision']=2
m['visualPass']=['two-scale boundary deformation','three-scale cellular erosion','preserved hollow and lit folds','connected storm crown','expanded conservative group margin']
(R/'MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(m,ensure_ascii=False))
