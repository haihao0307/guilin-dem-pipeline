from pathlib import Path
p=Path(__file__).resolve().parent
f=p/'src/GroomTopology.js';s=f.read_text()
a=''' // The local crown comb flow covers the old oversized opening with real strands.
 const cover=(d.crownCover??86)*.01*crownWeight(root)*.82;
 x=mix(x,.18+(d.flow-10)*.004,cover);z=mix(z,.85,cover);'''
b=''' // Growth and styling are different: do NOT translate the root-field singularity.
 // Roots retain the original whorl. Existing rear strands comb over the crown
 // after their initial physical root segment; no duplicate roots or scalp paint.
 const travelled=Math.hypot(...p.map((v,k)=>v-root[k]));
 const cap=Math.exp(-Math.pow(Math.hypot(root[0]+.008,root[2]-.005)/.060,6))*smooth(.335,.380,root[1]);
 const cover=(d.crownCover??86)*.01*cap*smooth(.003,.014,travelled);
 x=mix(x,.08+(d.flow-10)*.002,cover);z=mix(z,1,cover);'''
assert s.count(a)==1
f.write_text(s.replace(a,b))
f=p/'src/app.js';s=f.read_text().replace("'R14.0'","'R14.1'");f.write_text(s)
print('R14.1: unchanged root whorl; mid-shaft crown overlap instead of shifted root opening')
