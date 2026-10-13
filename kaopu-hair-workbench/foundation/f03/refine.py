"""Apply the visual review patch once, preserving all approved scalp sources."""
from pathlib import Path
p=Path(__file__).resolve().parent/'src/GuideKernel.mjs'
s=p.read_text()
pairs=[
("if(p[1]<.34)desire=r.family==='natural'?[Math.sign(p[0])*.08,-1,-.06]:[Math.sign(p[0])*.11,-1,-.10];", "const down=[Math.sign(p[0])*.10,-1,-.08];desire=mix(desire,down,smooth((.353-p[1])/.035));"),
("let t=tangent(desire,n,[0,-1,0]),surface=unit(add(t,mul(n,.025))),free=[Math.sign(p[0])*.015,-1,-.025];\n const released=smooth((near-.005)/.011);return unit(mix(surface,free,released));", "let t=tangent(desire,n,[0,-1,0]),surface=unit(add(t,mul(n,clamp((.004-near)*65,-.65,.25)))),free=[Math.sign(p[0])*.015,-1,-.025];\n // First follow the scalp's styling field; release below the side head.\n // Distance alone caused premature gravity-like drops and visible hooks.\n const released=smooth((.319-p[1])/.037)*smooth((s-.01)/.02);return unit(mix(surface,free,released));"),
("g=groomDirection(p,h.n,root,r,h.distance,dist)","g=groomDirection(p,unit(point(this.head,h.t,h.b,this.normals)),root,r,h.distance,dist)")]
for a,b in pairs:
    if b in s:continue
    assert s.count(a)==1,a
    s=s.replace(a,b)
p.write_text(s)
print('Visual review applied: continuous orientation transition, interpolated native normals, upper-scalp grooming support. No growth field change.')
