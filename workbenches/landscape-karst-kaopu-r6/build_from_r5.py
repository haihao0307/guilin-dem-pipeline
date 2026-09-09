from pathlib import Path
import hashlib, json, re
src = Path('workbenches/landscape-karst-kaopu-r5/index.html')
out = Path('workbenches/landscape-karst-kaopu-r6/index.html')
s = src.read_text()
repls = [
('candidate-0.4','candidate-0.5'),('KAOPU R5','KAOPU R6'),('轻量样板 R5','轻量样板 R6'),
('R5 主形重构：八座非同构塔峰采用陡壁主体、连续坡脚与方向相关的倾斜峰顶；两处真实洞拱和侧壁凹腔进入隐式体积。结构先于材质，局部方向随石块、矿物区与位置稳定变化，粗糙度独立。合成研究样板，不冒充 DEM 或地质调查。','R6 近景结构推进：保留 R5 的非同构塔峰与洞拱，把层理厚薄、竖向溶沟、有限裂隙、崩边与坡脚碎蚀真正写入表面；颜色继续由最终结构派生，粗糙度独立，显微方向随石块、矿物区与局部位置稳定变化。合成研究样板，不冒充 DEM 或地质调查。'),
('KAOPU:SYNTHETIC:LANDSCAPE:KARST_CLUSTER:R5','KAOPU:SYNTHETIC:LANDSCAPE:KARST_CLUSTER:R6'),
('landscape-karst-kaopu-r5','landscape-karst-kaopu-r6'),
('processingTime\":\"2026-09-10T04:08:00+08:00','processingTime\":\"2026-09-10T04:32:00+08:00'),
('candidate-only;R2-R3-preserved;R4-technical-superseded','candidate-only;R2-R3-R5-preserved;R4-technical-comparison'),
('order\":\"macro tower/crown/apron -> bedding ledges -> solution flutes -> fractures -> chips/scallops\"','order\":\"macro tower/crown/apron -> variable bedding ledges -> gravity-biased solution flutes -> finite fracture families -> chips/scallops\"'),
('R5 uses one deterministic spatially varying Rodrigues orientation frame per sample','R6 uses one deterministic spatially varying Rodrigues orientation frame per sample'),
('R5 constructs tower silhouette, sloped summit, foundation/saddle, two arch subtractions and meso damage before structural masks, albedo and independent roughness.','R6 preserves the R5 macro silhouette and arch volumes, then strengthens geometry-backed variable bedding, gravity-biased fluting, finite fracture families and chips before structural masks, albedo and independent roughness.'),
('R2 and R3 remain separate previous candidates; R4 remains a technical comparison and R5 supersedes it visually without overwriting it.','R2, R3 and R5 remain separate previous candidates; R4 remains a technical comparison and R6 derives from R5 without overwriting it.'),
('R5 macro form is synthetic','R6 macro form is synthetic'),
('{\"type\":\"deriveCandidate\",\"version\":\"R5\",\"scope\":[\"integrated sloped summits\",\"phase-dependent top taper\",\"three low foundation pedestals\",\"second true tunnel\",\"closer hero framing\"]}]','{\"type\":\"deriveCandidate\",\"version\":\"R5\",\"scope\":[\"integrated sloped summits\",\"phase-dependent top taper\",\"three low foundation pedestals\",\"second true tunnel\",\"closer hero framing\"]},{\"type\":\"deriveCandidate\",\"version\":\"R6\",\"scope\":[\"variable-thickness bedding\",\"gravity-biased merging flutes\",\"finite dual fracture families\",\"fracture/flute intersection scallops\",\"fresh-break material response\",\"near-wall review framing\"]}]'),
('\"r3Preserved\":true','\"r3Preserved\":true,\"r5Preserved\":true'),
('d+=rock*band*(.082*g.x+.138*g.y+.094*g.z+.270*g.w);','d+=rock*band*(.100*g.x+.165*g.y+.125*g.z+.315*g.w);'),
('return normalize(n-.038*(g-n*dot(g,n)));','return normalize(n-.043*(g-n*dot(g,n)));'),
('broken=clamp(dm.y*.26+dm.z*.40+chip*.78,0.,1.);','broken=clamp(dm.y*.23+dm.z*.54+chip*.82,0.,1.);'),
('fresh=clamp(edge*.78+broken*.52,0.,1.)*(1.-wet*.70)','fresh=clamp(edge*.72+broken*.66,0.,1.)*(1.-wet*.72)'),
('weather=clamp(pit*.58+cavity*.38+zoneB*.18+dm.z*.15,0.,.90)','weather=clamp(pit*.55+cavity*.41+zoneB*.18+dm.z*.20,0.,.92)'),
('rough=clamp(.54+.17*grain+.14*pit+.11*broken+.05*slope+.075*(porosity-.5)-.40*wet-.090*crystal,.17,.95);','rough=clamp(.53+.18*grain+.15*pit+.14*broken+.055*slope+.078*(porosity-.5)-.42*wet-.095*crystal,.16,.96);'),
('side:[-27,11,8,-1,8.6,1]','side:[-18.5,9.2,7.0,-4.0,8.0,2.2]'),
('R5 已就绪 · R2/R3 保留 · R4 技术对照保留 · 主形重构','R6 已就绪 · R2/R3/R5 保留 · 岩壁结构推进'),
]
for a,b in repls:
    if a not in s: raise SystemExit(f'missing replacement token: {a[:70]}')
    s=s.replace(a,b)
old=re.search(r'vec4 damage\(vec3 p\)\{.*?return vec4\(terrace,flute,fracture,chip\);\}',s)
if not old: raise SystemExit('R5 damage block not found')
new='''vec4 damage(vec3 p){mat3 F=orient(p,307.);vec3 q=transpose(F)*(p+vec3(2.7,-1.4,1.9));float c0=n3(q*.052+vec3(37.,11.,-19.)),c1=n3(q*.109+vec3(-17.,29.,61.)),c2=n3(q*.181+vec3(13.,-41.,7.));float dip=.13*(c0-.5)+.055*sin(q.x*.071-.8)+.038*sin(q.z*.093+1.7),bedPhase=q.y*(1.02+.15*(c0-.5))+q.x*dip+.23*sin(q.z*.135+c1*2.7)+.10*sin(q.x*.218-c0*3.1);float thick=.82+.22*c0+.12*sin(q.z*.058+2.2*c1),bed=.5+.5*sin(bedPhase*thick),terrace=pow(bed,13.)*smoothstep(.16,.86,c0)*(1.-.36*smoothstep(.74,.96,c2));float lx=q.x*.315+q.z*.168+.54*sin(q.y*.105+c0*2.2)+.19*sin(q.z*.083-c1*3.0),lz=-q.x*.146+q.z*.392+.39*sin(q.y*.083+1.4)+.12*sin(q.x*.117+c2*2.1);float f1=pow(.5+.5*sin(lx*2.05),20.),f2=pow(.5+.5*sin(lz*2.55+1.2),26.);float merge=smoothstep(.22,.80,n3(vec3(q.x*.07,q.y*.028,q.z*.07)+vec3(71.,13.,-23.))),flute=max(f1,f2*.66)*merge*smoothstep(.18,.90,1.-abs(c1-.5)*1.82);float fa=pow(1.-abs(sin(dot(q,normalize(vec3(.71,.09,-.69)))*.282+.42*sin(q.y*.061)+2.3*(c0-.5))),26.),fb=pow(1.-abs(sin(dot(q,normalize(vec3(.32,-.04,.95)))*.245+.31*sin(q.y*.052+1.4)-1.8*(c1-.5))),30.);float termA=smoothstep(.43,.72,n3(q*.071+vec3(9.,73.,31.)))*smoothstep(.17,.90,n3(q*.143+vec3(33.,-7.,49.))),termB=smoothstep(.51,.78,n3(q*.064+vec3(-51.,17.,27.)))*smoothstep(.22,.88,n3(q*.131+vec3(15.,61.,-39.)));float fracture=max(fa*termA,fb*termB*.78);vec3 cq=q*.305,ci=floor(cq),cf=fract(cq)-.5,co=(h33(ci+vec3(17.3,5.1,9.7))-.5)*.44;float gate=smoothstep(.80,.965,h31(ci+vec3(31.7,11.3,2.9))),chip=max(0.,.31-length((cf-co)*vec3(1.,1.66,1.16)))*gate;float inter=smoothstep(.45,.82,fracture)*smoothstep(.35,.76,flute),scallop=.16*inter*smoothstep(.48,.88,n3(q*.22+vec3(83.,-21.,47.)));return vec4(terrace,flute,fracture,chip+scallop);}'''
s=s[:old.start()]+new+s[old.end():]
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(s)
sha=hashlib.sha256(out.read_bytes()).hexdigest()
assert out.stat().st_size==30337, out.stat().st_size
assert sha=='4f9ad02eff6f909548f1b6ef1aa8b0c28c2af0f044d539cf53944d7d1964c756', sha
qa={
 'version':'R6','htmlBytes':out.stat().st_size,'htmlSHA256':sha,'runtimeAssets':0,'textures':0,'externalModels':0,
 'synthetic':True,'visualApproved':False,'productionReady':False,'truthApproved':False,
 'preserved':['R2','R3','R5'],'technicalComparison':['R4'],
 'notes':['R5 macro form and cavities preserved','variable-thickness bedding written into field','gravity-biased flutes use spatial gating and local merging','dual fracture families are spatially terminated','fracture/flute intersections can produce scalloped chips','albedo remains structure-derived','roughness remains independent','side view moved closer for wall review']
}
(out.parent/'QA.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n')
print(sha,out.stat().st_size)
