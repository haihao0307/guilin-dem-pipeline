from pathlib import Path
p=Path(__file__).resolve().parent
f=p/'src/GroomTopology.js';s=f.read_text()
a=''' // The local crown comb flow covers the old oversized opening with real strands.
 const cover=(d.crownCover??86)*.01*crownWeight(root)*.82;
 x=mix(x,.18+(d.flow-10)*.004,cover);z=mix(z,.85,cover);'''
b=''' // Roots keep their original whorl. Only compatible existing mid-shafts
 // overlap the crown; reversing a backward strand produces a standing hairpin.
 const travelled=Math.hypot(...p.map((v,k)=>v-root[k]));
 const cap=Math.exp(-Math.pow(Math.hypot(root[0]+.008,root[2]-.005)/.060,6))*smooth(.335,.380,root[1]);
 const rearGuard=smooth(-.032,-.010,root[2]);
 const compatible=smooth(-.25,.35,z/Math.max(.00001,Math.hypot(x,z)));
 const cover=(d.crownCover??86)*.01*cap*rearGuard*compatible*smooth(.003,.014,travelled);
 const across=clamp((-.008-root[0])/.080,-.25,.25)+(d.flow-10)*.001;
 x=mix(x,across,cover);z=mix(z,1,cover);'''
assert s.count(a)==1
f.write_text(s.replace(a,b))
for name in ['src/app.js','index.html','package.py','README.md']:
 f=p/name;s=f.read_text().replace('R14.0','R14.3');f.write_text(s)
print('R14.3: root whorl fixed, direction-compatible oblique overlap without backward hairpins')
