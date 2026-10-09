"""Idempotent R03.4 display-only smooth-surface and waist-layering migration."""
from pathlib import Path
p=Path(__file__).resolve().parent
f=p/'anatomical-cloth.mjs';s=f.read_text()
if 'refineClothSurface' not in s:
 s="import {refineClothSurface} from './surface-refine.mjs';\n"+s
 s=s.replace('const pos=[],idx=[],ids=new Map();','let pos=[],idx=[];const ids=new Map();')
 old=" const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));"
 assert old in s
 s=s.replace(old," const refined=refineClothSurface(pos,idx);pos=refined.positions;idx=refined.indices;\n"+old)
 s=s.replace('if(q.y<1.42)target=Math.max(target,tension);','target=Math.max(target,mix(f.r+ease+.006,tension,1-smooth(1.34,1.465,q.y)));')
 s=s.replace('else target+=.013*smooth(wy+.055,wy-.04,q.y);','else target+=.022*smooth(wy+.12,wy+.025,q.y);')
 old='const low=(1-smooth(wy+.08,1.43,q.y))*torsoWeight,fold='
 new="if(onePiece){const k=smooth(wy+.055,wy+.01,q.y)*torsoWeight;q.x=mix(q.x,(f.r+.022)*Math.sin(a),k);q.z=mix(q.z,f.cz+(f.r+.022)*Math.cos(a),k);}\n   "+old
 assert old in s;s=s.replace(old,new);f.write_text(s)
f=p/'surface-kernel.mjs';s=f.read_text().replace('u*TAU,.028','u*TAU,.034');f.write_text(s)
f=p/'surfaces.mjs';s=f.read_text().replace('T.PCFSoftShadowMap','T.VSMShadowMap').replace('key.shadow.radius=3;','key.shadow.radius=4;key.shadow.blurSamples=8;').replace('key.position.set(-2.5,5,3)','key.position.set(-2.0,5,4)');f.write_text(s)
f=p/'app.mjs';s=f.read_text().replace("version:'R03.3'","version:'R03.4'");f.write_text(s)
f=p/'index.html';s=f.read_text().replace('<b>R03.3</b>','<b>R03.4</b>');f.write_text(s)
f=p/'qa_browser.py';s=f.read_text().replace("state['version']=='R03.3'","state['version']=='R03.4'").replace('reviewed R03.3 revision','reviewed R03.4 revision');f.write_text(s)
f=p/'README.md';s=f.read_text()
if 'R03.4 表面与腰部层次' not in s:f.write_text(s+'\n## R03.4 表面与腰部层次\n\n在继承 R03.3 的基础上增加服装曲面细分、保形边界与局部平滑；去掉胸前包络的硬截断。只调整服装曲面，不修改展示人体。收进腰头的上衣与外罩上衣分别处理腰部余量，腰头外表面分离；灯光阴影改为柔化处理。源配方、原始纸样与 R02 不覆盖。每款细分后的曲面继续通过实际 WebGL 和几何身份检查。视觉完善仍不等于真实缝合与动态穿着认证。\n')
print('R03.4 source migration complete')
