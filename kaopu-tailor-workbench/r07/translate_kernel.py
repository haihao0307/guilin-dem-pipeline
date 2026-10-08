"""Build an additive f64 C++ kernel from the frozen original AssemblyScript.
The algebraic eigendirections replace only atan2/cos/sin, not original rest UVs.
R07 changes iteration/staging separately and does NOT claim reference equivalence.
"""
from pathlib import Path
import re, hashlib
R=Path(__file__).resolve().parent.parent
s=(R/'unified/physics/kernel.ts').read_text()
s=re.sub(r'@external[^\n]*\n','',s)
s=s.replace('@inline function','function').replace('export function','function').replace('export let','let')
old='let angle=.5*atan2(2*ab,aa-bb),co=cos(angle),si=sin(angle);'
assert s.count(old)==1
s=s.replace(old,'''let delta=aa-bb,rad=norm(delta,2*ab,0),co:f64=1,si:f64=0;
 if(rad>1e-30){if(delta>=0){co=Math.sqrt(.5*(1+delta/rad));si=ab/(rad*co);}else{si=(ab<0?-1.0:1.0)*Math.sqrt(.5*(1-delta/rad));co=ab==0?0:ab/(rad*si);}}''')
def signature(m):
 name,args,rt=m.groups();args=','.join(t.strip().split(':')[1]+' '+t.strip().split(':')[0] for t in args.split(',') if t.strip())
 return f'__attribute__((export_name("{name}"))) {rt} {name}({args})'+'{'
s=re.sub(r'function\s+(\w+)\(([^)]*)\):(\w+)\{',signature,s)
out='';i=0
while True:
 m=re.search(r'\blet ',s[i:])
 if not m:out+=s[i:];break
 start=i+m.start();out+=s[i:start];begin=start+4;dep=0;j=begin
 while j<len(s):
  c=s[j]
  if c in '([':dep+=1
  elif c in ')]':dep-=1
  if c==';' and dep==0:break
  j+=1
 text=s[begin:j];parts=[];dep=0;last=0
 for k,c in enumerate(text):
  if c in '([':dep+=1
  elif c in ')]':dep-=1
  elif c==',' and dep==0:parts.append(text[last:k]);last=k+1
 parts.append(text[last:]);ds=[]
 for part in parts:
  n,eq,val=part.partition('=');n=n.strip()
  if ':' in n:n,ty=n.split(':');ds.append(ty+' '+n+'='+val)
  else:ds.append('auto '+n+'='+val)
 out+=';'.join(ds)+';';i=j+1
s=out.replace('Math.sqrt','__builtin_sqrt').replace('Math.floor','__builtin_floor').replace('Math.abs','__builtin_fabs').replace('Math.max','max2').replace('Math.min','min2')
pre='''// R07 f64 mathematical kernel; original rest material remains unchanged.
using f64=double;using i32=int;using i16=short;using usize=unsigned;
template<class T> inline T load(usize p){return *reinterpret_cast<T*>(p);}
template<class T,class U> inline void store(usize p,U v){*reinterpret_cast<T*>(p)=static_cast<T>(v);}
inline double max2(double a,double b){return a>b?a:b;}
inline double min2(double a,double b){return a<b?a:b;}
'''
s=pre+s+'\n__attribute__((export_name("getContacts"))) int getContacts(){return contacts;}\n'
(R/'r07/kernel.cpp').write_text(s)
(R/'r07/global-all.cpp').write_text(s+(R/'r07/global.cpp').read_text())
print('Generated original-formula f64 kernel and additive local/global projection kernel')
