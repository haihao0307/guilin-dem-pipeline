from pathlib import Path
p=Path(__file__).resolve().parent
f=p/'src/GroomTopology.js';s=f.read_text()
a=''' // The local crown comb flow covers the old oversized opening with real strands.
 const cover=(d.crownCover??86)*.01*crownWeight(root)*.82;
 x=mix(x,.18+(d.flow-10)*.004,cover);z=mix(z,.85,cover);'''
b=''' // Separate growth from styling: roots keep the original whorl rather than
 // translating its source point. Existing mid-shafts, not a hidden cap, overlap.
 const travelled=Math.hypot(...p.map((v,k)=>v-root[k]));
 const cap=Math.exp(-Math.pow(Math.hypot(root[0]+.008,root[2]-.005)/.060,6))*smooth(.335,.380,root[1]);
 // Rear roots must keep descending over the occiput; combing them all forward
 // merely trades a crown gap for a posterior gap and standing tufts.
 const rearGuard=smooth(-.032,-.010,root[2]);
 const cover=(d.crownCover??86)*.01*cap*rearGuard*smooth(.003,.014,travelled);
 x=mix(x,.08+(d.flow-10)*.002,cover);z=mix(z,1,cover);'''
assert s.count(a)==1
f.write_text(s.replace(a,b))
for name in ['src/app.js','index.html','package.py','README.md']:
 f=p/name;s=f.read_text().replace('R14.0','R14.2').replace('冠部局部前向梳理覆盖原大开口','保留根部发旋、后部下垂，只让既有发丝中段梳过冠部覆盖原大开口');f.write_text(s)
f=p/'README.md';f.write_text(f.read_text()+'''\n## 反例已拒绝\nR14.0 整个根部场加前向偏置仅把发旋露皮移到旁边，视觉拒绝。R14.1 将生长与中段梳理分开后顶视改善，但后部过度前梳又增加后冠露皮。R14.2 增加后根连续保护带，保留后脑下垂，三发型独立全视图对照。单一顶视ROI改善不能替代后视与侧视验收。\n''')
print('R14.2: fixed root whorl, bounded mid-shaft crown overlap, protected posterior roots')
