from pathlib import Path
p=Path('ocean-mother/releases/Ocean_Mother_R0196_Mobile_Lite_Quality_Direct_Open.html')
s=p.read_text(encoding='utf-8')
old_func='vec3 landColorL(vec3 p,vec3 n){float h=p.y,c=coastSignedL(p.xz);float beach=1.-smoothstep(5.,18.,c);float high=smoothstep(13.,36.,h);float cliff=sat((1.-n.y)*1.7);float grain=.82+.26*noise2l(p.xz*.095)+.08*noise2l(p.xz*.23+7.3);vec3 sand=vec3(.47,.34,.18),earth=vec3(.24,.20,.13),green=vec3(.065,.22,.095),rock=vec3(.30,.31,.29);vec3 base=mix(green,earth,.34+high*.34);base=mix(base,sand,beach*.92);base=mix(base,rock,cliff*.72);return base*grain;}\n'
old='vec3 n=normalBedL(lp.xz);vec3 base=landColorL(lp,n);float ndl=max(dot(n,sunL()),0.),hemi=.26+.30*sat(n.y),rim=.16*pow(1.-sat(dot(n,-rd)),2.);col=base*(hemi+.78*ndl*sunTransL())+vec3(.10,.15,.14)*rim;'
new='vec3 n=normalBedL(lp.xz);float hL=lp.y,cL=coastSignedL(lp.xz);float beachL=1.-smoothstep(5.,18.,cL),highL=smoothstep(13.,36.,hL),cliffL=sat((1.-n.y)*1.7);float grainL=.82+.26*noise2l(lp.xz*.095)+.08*noise2l(lp.xz*.23+vec2(7.3));vec3 sandL=vec3(.47,.34,.18),earthL=vec3(.24,.20,.13),greenL=vec3(.065,.22,.095),rockL=vec3(.30,.31,.29);vec3 base=mix(greenL,earthL,.34+highL*.34);base=mix(base,sandL,beachL*.92);base=mix(base,rockL,cliffL*.72);base*=grainL;float ndl=max(dot(n,sunL()),0.),hemi=.26+.30*sat(n.y),rim=.16*pow(1.-sat(dot(n,-rd)),2.);col=base*(hemi+.78*ndl*sunTransL())+vec3(.10,.15,.14)*rim;'
if s.count(old_func)!=1:
    raise RuntimeError(f'expected one landColorL function, found {s.count(old_func)}')
if s.count(old)!=1:
    raise RuntimeError(f'expected one landColorL call, found {s.count(old)}')
s=s.replace(old_func,'',1).replace(old,new,1)
p.write_text(s,encoding='utf-8')
print(p)
