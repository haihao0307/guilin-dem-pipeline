from pathlib import Path
import hashlib
src=Path('games/survivor-palau/releases/v0.1.3/Survivor_Palau_V0.1.3.1_Natural_World_Runtime_Fix_Direct_Open.html')
out=Path('games/survivor-palau/releases/v0.1.4.1/Survivor_Palau_V0.1.4.1_Cloud_Restore_Direct_Open.html')
s=src.read_text(encoding='utf-8')
def R(a,b,n=1):
    global s
    c=s.count(a)
    if c<n:
        raise SystemExit(f'marker missing {c}<{n}: {a[:120]!r}')
    s=s.replace(a,b,n)
R('<title>Survivor: Palau | V0.1.3.1 Natural World</title>','<title>Survivor: Palau | V0.1.4 Cloud Surf Karst Canoe</title>')
R('<small>NATURAL WORLD / V0.1.3.1</small>','<small>CLOUD · SURF · KARST · CANOE / V0.1.4</small>')
R("const VERSION='survivor-palau-0.1.3.1-natural-world-runtime-fix';","const VERSION='survivor-palau-0.1.4-cloud-surf-karst-canoe';")
R("relationshipPass:'survivor-palau-natural-world-v0131'","relationshipPass:'survivor-palau-cloud-surf-karst-canoe-v014'")
R("KARST_ROCKS.push([-3.2,-1.8,7.2,14.8,6.5,801],[4.4,-2.6,7.0,15.8,6.2,829],[-1.8,5.2,6.2,12.9,5.7,857],[7.6,4.5,5.5,10.8,5.0,883],[-8.0,4.7,5.2,10.2,4.8,899]);","KARST_ROCKS.push([-6.0,-2.4,4.9,12.8,4.5,801],[3.9,-4.5,5.2,14.2,4.6,829],[-1.4,6.6,4.5,11.6,4.0,857],[8.1,4.8,4.0,9.7,3.7,883],[-8.7,4.6,4.1,9.2,3.8,899]);")
R("const foot=isKarst&&uy<-.30?mix(.34,.72,smooth(-1.0,-.30,uy)):(uy<-.58?.90+(uy+.58)*.07:1);\n   const shoulder=isKarst?1.0+.30*smooth(-.30,.08,uy)*(1.0-smooth(.48,.88,uy)):1.0;\n   const crownTaper=isKarst?mix(1.0,.72,smooth(.58,1.0,uy)):1.0;","const foot=isKarst&&uy<-.24?mix(.24,.64,smooth(-1.0,-.24,uy)):(uy<-.58?.90+(uy+.58)*.07:1);\n   const shoulder=isKarst?1.0+.22*smooth(-.24,.10,uy)*(1.0-smooth(.44,.80,uy)):1.0;\n   const crownTaper=isKarst?mix(1.04,.66,smooth(.52,1.0,uy)):1.0;")
old_cloud=""" vec2 cp=rd.xz/max(.14,rd.y+.34)*.22+vec2(uTime*.0025*p_cloudSpeed,-uTime*.0015*p_cloudSpeed);
 vec2 warp=vec2(fbm(cp*.62+vec2(3.1,-7.4)),fbm(cp*.62+vec2(-5.2,6.8)))-.5;
 float body=.56*fbm(cp+warp*2.05)+.29*fbm(cp*1.88-warp*.72)+.15*noise2(cp*4.7+warp*1.2);
 float cover=clamp(p_cloudiness,0.0,1.0),threshold=mix(.70,.53,cover);
 float altitude=smoothstep(.025,.115,rd.y)*(1.0-smoothstep(.72,.94,sat(rd.y)));
 float cloudBand=smoothstep(threshold,threshold+.075,body)*altitude;
 float cloudCore=smoothstep(threshold+.055,threshold+.14,body)*altitude;
 float underside=smoothstep(threshold-.025,threshold+.055,body)*altitude*(1.0-smoothstep(.16,.52,rd.y));
 float silver=pow(max(dot(normalize(vec3(rd.x+.13,rd.y+.045,rd.z)),sunDir),0.0),4.0);
 vec3 cloudDark=vec3(.43,.50,.52),cloudMid=vec3(.92,.94,.92),cloudBright=vec3(1.62,1.58,1.42);
 vec3 cloudLit=mix(cloudMid,cloudBright,sat(.28+sun*.62+silver*.85));
 c=mix(c,cloudDark,underside*.38);c=mix(c,cloudLit,cloudBand*.82);c+=cloudBright*silver*cloudCore*.23;"""
new_cloud=""" vec2 cp=rd.xz/max(.13,rd.y+.31)*.205+vec2(uTime*.0028*p_cloudSpeed,-uTime*.0017*p_cloudSpeed);
 vec2 warp=vec2(fbm(cp*.54+vec2(3.1,-7.4)),fbm(cp*.58+vec2(-5.2,6.8)))-.5;
 float coarse=fbm(cp*.82+warp*2.25),mid=fbm(cp*1.63-warp*.68),fine=noise2(cp*4.2+warp*1.35);
 float body=.58*coarse+.29*mid+.13*fine+.055;
 float cover=clamp(p_cloudiness+.18,0.0,1.0),threshold=mix(.615,.455,cover);
 float altitude=smoothstep(.010,.060,rd.y)*(1.0-smoothstep(.58,.88,sat(rd.y)));
 float breakup=smoothstep(.33,.67,fbm(cp*.35+vec2(18.3,-4.6))+.10*sin(cp.x*.61-cp.y*.37));
 float cloudBand=smoothstep(threshold,threshold+.050,body)*altitude*mix(.52,1.0,breakup);
 float cloudCore=smoothstep(threshold+.045,threshold+.115,body)*altitude;
 float underside=smoothstep(threshold-.035,threshold+.050,body)*altitude*(1.0-smoothstep(.18,.50,rd.y));
 float silver=pow(max(dot(normalize(vec3(rd.x+.12,rd.y+.055,rd.z)),sunDir),0.0),3.6);
 vec3 cloudDark=vec3(.46,.53,.55),cloudMid=vec3(1.02,1.04,1.01),cloudBright=vec3(1.74,1.68,1.48);
 vec3 cloudLit=mix(cloudMid,cloudBright,sat(.24+sun*.66+silver*.88));
 c=mix(c,cloudDark,underside*.45);c=mix(c,cloudLit,cloudBand*.92);c+=cloudBright*silver*cloudCore*.28;"""
R(old_cloud,new_cloud)
R("crest+=wall*(.22+.46*lace)*smoothstep(.015,.18,thickness);","crest+=wall*(.34+.62*lace)*smoothstep(.012,.16,thickness);")
R("float shoreLace=(1.0-smoothstep(.14,2.05,abs(shoreDistance)))*p_shoreFoam*(.06+.25*lace)*shorePacket;","float shoreLace=(1.0-smoothstep(.12,1.82,abs(shoreDistance)))*p_shoreFoam*(.09+.34*lace)*shorePacket;")
R("foam*=mix(.06,1.0,foamCell*mix(.38,1.0,elongated));","foam*=mix(.08,1.24,foamCell*mix(.34,1.0,elongated));")
R("foam=max(foam,sat((residualBand*.64+outerBreak*.76)*p_foamThickness));","foam=max(foam,sat((residualBand*.98+outerBreak*1.18)*p_foamThickness));")
R("water+=vec3(1.65,.30,.028)*fireReflection*uFireIntensity*(.38+.62*(1.0-foam));vec3 foamColor=mix(vec3(1.05,1.12,1.10),vec3(1.52,1.48,1.34),.34+.56*ndl);water=mix(water,foamColor,foam);","water+=vec3(1.65,.30,.028)*fireReflection*uFireIntensity*(.38+.62*(1.0-foam));vec3 foamColor=mix(vec3(1.16,1.20,1.17),vec3(1.78,1.69,1.48),.34+.56*ndl);float foamVisible=smoothstep(.10,.72,foam);water=mix(water,foamColor,foamVisible);water+=vec3(.18,.20,.19)*foamVisible*(.35+.65*lace);")
R("const data=[],indices=[],cx=CANOE_POS[0],cz=CANOE_POS[2],cy=waterLevel(0,SURFACE)+.10,angle=-.58,co=Math.cos(angle),si=Math.sin(angle),N=36;","const data=[],indices=[],cx=CANOE_POS[0],cz=CANOE_POS[2],cy=waterLevel(0,SURFACE)+.28,angle=-.58,co=Math.cos(angle),si=Math.sin(angle),N=40;")
R("const t=i/N*2-1,tip=Math.pow(Math.abs(t),1.7),shape=Math.pow(Math.max(.012,1-t*t),.48),half=.18+1.05*shape,long=t*5.15;\n  const gunY=.40+.30*tip,chineY=.02+.20*tip,keelY=-.22+.34*tip,innerHalf=Math.max(.06,half*.50);","const t=i/N*2-1,tip=Math.pow(Math.abs(t),1.75),shape=Math.pow(Math.max(.012,1-t*t),.47),half=.22+1.18*shape,long=t*5.35;\n  const gunY=.56+.24*tip,chineY=.08+.17*tip,keelY=-.24+.30*tip,innerHalf=Math.max(.10,half*.56);")
R("inL.push(pv(world(-innerHalf,long,.02+.10*tip),[0,1,0],7));inR.push(pv(world(innerHalf,long,.02+.10*tip),[0,1,0],7));","inL.push(pv(world(-innerHalf,long,.13+.08*tip),[0,1,0],7));inR.push(pv(world(innerHalf,long,.13+.08*tip),[0,1,0],7));")
R("function bench(longitudinal,width=.82,depth=.48){const p0=world(-width,longitudinal,.46),p1=world(width,longitudinal,.46),p2=world(width,longitudinal+depth,.46),p3=world(-width,longitudinal+depth,.46)","function bench(longitudinal,width=.90,depth=.52){const p0=world(-width,longitudinal,.59),p1=world(width,longitudinal,.59),p2=world(width,longitudinal+depth,.59),p3=world(-width,longitudinal+depth,.59)")
R("SURVIVOR: PALAU V0.1.2 · 峰林与自然白浪候选","SURVIVOR: PALAU V0.1.4 · 云/破浪/峰林/独木舟候选")
R("buildId:'survivor-palau-v0131-natural-world-runtime-fix'","buildId:'survivor-palau-v014-cloud-surf-karst-canoe'")
R("cloudModel:'broken bright cumulus cells with shaded bases and blue-sky gaps'","cloudModel:'high-contrast broken cumulus cells with shaded bases and explicit blue-sky gaps'")
R("karstMushroomProfile:true,","karstMushroomProfile:true,cloudVisibilityV2:true,breakerVisibilityV2:true,canoeReadabilityV3:true,")
s=s.replace('"key":"cloudiness","label":"云量","min":0,"max":1,"step":0.02,"value":0.25','"key":"cloudiness","label":"云量","min":0,"max":1,"step":0.02,"value":0.48')
s=s.replace("const VERSION='survivor-palau-0.1.4-cloud-surf-karst-canoe';","const VERSION='survivor-palau-0.1.4.1-cloud-restore';")
s=s.replace('<small>CLOUD · SURF · KARST · CANOE / V0.1.4</small>','<small>CLOUD RESTORE · SURF · KARST · CANOE / V0.1.4.1</small>')
s=s.replace('SURVIVOR: PALAU V0.1.4 · 云/破浪/峰林/独木舟候选','SURVIVOR: PALAU V0.1.4.1 · 云层恢复候选')
s=s.replace("buildId:'survivor-palau-v014-cloud-surf-karst-canoe'","buildId:'survivor-palau-v0141-cloud-restore'")
s=s.replace('float body=.58*coarse+.29*mid+.13*fine+.055;','float body=.58*coarse+.29*mid+.13*fine+.105;')
s=s.replace('float cover=clamp(p_cloudiness+.18,0.0,1.0),threshold=mix(.615,.455,cover);','float cover=clamp(p_cloudiness+.20,0.0,1.0),threshold=mix(.565,.405,cover);')
s=s.replace('c=mix(c,cloudDark,underside*.45);c=mix(c,cloudLit,cloudBand*.92);c+=cloudBright*silver*cloudCore*.28;','c=mix(c,cloudDark,underside*.55);c=mix(c,cloudLit,cloudBand*.98);c+=cloudBright*silver*cloudCore*.34;')
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(s,encoding='utf-8')
print(out, len(s.encode()), hashlib.sha256(s.encode()).hexdigest())
