"""Refine this newly authored PUBLIC P01 specimen only. Idempotent, exact edits."""
from pathlib import Path
r=Path(__file__).parent
p=r/'main.mjs';s=p.read_text()
changes=[
('pitch=.0058, spacing=.00405, radius=.00076','pitch=.0058, spacing=.00290, radius=.00086'),
("color:'#b8a284'","color:'#d3c4af'"),
('const steps=48,sides=8;','const steps=64,sides=12;'),
('for(let h=0;h<180;h++){','for(let h=0;h<320;h++){'),
('const hid=id*181+h','const hid=id*337+h'),
('const root=p.clone().addScaledVector(n,radius*(1+.02*Math.sin(tt*49+phase*3)));',
 'const breathe=1+.038*Math.sin(tt*21+phase)+.022*Math.sin(tt*49+phase*3);\n   const twistAngle=ang+tt*TAU*2.8*settings.twist;\n   const envelope=1+.055*Math.cos(3*twistAngle)+.022*Math.sin(5*ang+phase+tt*11);\n   const root=p.clone().addScaledVector(n,radius*breathe*envelope+.000014);'),
('const fly=hash(hid*29)> .962;','const fly=hash(hid*29)> .991;'),
('const len=(fly?.0016:.00018)+(fly?.0016:.00058)*Math.pow(hash(hid*31),1.7);','const len=(fly?.0014:.00024)+(fly?.0015:.00070)*Math.pow(hash(hid*31),1.45);'),
('projectionMatrix[1][1]*.000020','projectionMatrix[1][1]*.000026'),
("const views={whole:[[.034,.018,.19],[0,0,0]]","const views={whole:[[.027,.012,.19],[0,0,0]]")
]
for old,new in changes:
 if old in s:
  assert s.count(old)==1,old
  s=s.replace(old,new)
 else:assert new in s,old
p.write_text(s)
p=r/'template.html';s=p.read_text()
old='</style></head>'
css='#stage-top{background:#f0f3e5cf;border-radius:6px;padding:8px 11px;text-shadow:none}#status,#counts{background:#eff4e2d9;padding:4px 7px;border-radius:4px;color:#303a28}'
if css not in s:s=s.replace(old,css+'\n'+old)
p.write_text(s)
print('PUBLIC-P01 refinement: dense row overlap; same envelope for geometry and fibres; smoother cross-sections; stable short fibres; UI contrast. No private inputs.')
