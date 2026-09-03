from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_build.py <copied-v012-build-script>")

p = Path(sys.argv[1])
s = p.read_text()
s = s.replace("SEED=91203\n", """SEED=91203
SHAPE_SEED=91203
CAVITY_SEED=27491
WATER_SEED=54133
COLOR_SEED=68111
WEATHER_SEED=73547
BIO_SEED=88469
DETAIL_SEED=99223
""", 1)

start = s.index("for ti in [0,2,3,4]:")
end = s.index("\ndef ground_height", start)
new_cavities = '''dissolution_events=[]
# Multi-scale solution pockets are biased toward authored rain channels. Their seed is
# independent from colour, weather and detail. They are cut before meshing.
for ti,spec in enumerate(specs):
    cx,cz,h,rx,rz,rot,leanx,leanz,phase,faces=spec
    rr=np.random.default_rng(CAVITY_SEED+ti*1907)
    channel_angles=[q[0] for q in tower_meta[ti]['channels']]
    count=int(rr.integers(3,7))
    for j in range(count):
        if channel_angles and rr.random()<.72:
            ang=float(channel_angles[int(rr.integers(0,len(channel_angles)))]+rr.normal(0,.07))
        else:
            ang=float(rr.uniform(-np.pi,np.pi))
        t=float(rr.uniform(.12,.73))
        u=np.cos(ang)*rx*.94
        v=np.sin(ang)*rz*.94
        c=np.cos(rot); sn=np.sin(rot)
        pcx=cx+u*c-v*sn+leanx*(t-.12)
        pcz=cz+u*sn+v*c+leanz*(t-.12)
        pcy=-1.05+h*t
        scale=float(rr.choice([.48,.66,.92,1.18],p=[.28,.34,.26,.12]))
        ex=float(scale*rr.uniform(.58,.92))
        ey=float(scale*rr.uniform(.74,1.32))
        ez=float(scale*rr.uniform(.62,1.08))
        event=(pcx,pcy,pcz,ex,ey,ez,rot+ang+float(rr.normal(0,.16)))
        dissolution_events.append(event)
        cluster=[event,
                 (pcx-.16*np.cos(rot+ang),pcy+.13,pcz-.16*np.sin(rot+ang),ex*.72,ey*.61,ez*.82,event[6]+.14),
                 (pcx+.11*np.cos(rot+ang),pcy-.16,pcz+.11*np.sin(rot+ang),ex*.56,ey*.52,ez*.68,event[6]-.12)]
        for cc in cluster:
            phi=np.maximum(phi,-ellipsoid_sdf(*cc).astype(np.float32))

'''
s = s[:start] + new_cavities + s[end:]

needle = """runoff=np.clip(runoff,0,1)
cave_field=np.zeros(V,dtype=np.float32)
for cx,cy,cz,rx,ry,rz,rot in caves+[(7.6,5.2,5.6,4.1,2.45,2.2,.48),(-2.0,3.2,-1.2,3.4,2.15,2.0,-.20)]:
"""
replacement = """runoff=np.clip(runoff,0,1)
# Gravity routing adds actual downhill accumulation to the authored rain-channel field.
rain_input=(.012+.24*np.clip(N[:,1],0,1)).astype(np.float64)
down=np.full(V,-1,dtype=np.int32)
for i,nb in enumerate(adj):
    if not nb: continue
    ids=np.fromiter(set(nb),dtype=np.int32)
    delta=P[i]-P[ids]
    drop=delta[:,1]
    valid=drop>.012
    if not np.any(valid): continue
    ids2=ids[valid]; d2=delta[valid]
    score=drop[valid]/np.maximum(np.linalg.norm(d2,axis=1),1e-5)+.055*runoff[ids2]
    down[i]=int(ids2[int(np.argmax(score))])
acc=rain_input.copy()
for i in np.argsort(-P[:,1]):
    j=int(down[i])
    if j>=0: acc[j]+=min(acc[i]*.955,350.0)
flow_log=np.log1p(acc)
rock_ids=np.where(material==1)[0]
flow_ref=float(np.percentile(flow_log[rock_ids],99.35)) if len(rock_ids) else float(flow_log.max())
flow_acc=np.clip(flow_log/max(flow_ref,1e-6),0,1).astype(np.float32)
runoff=np.clip(.58*runoff+.70*np.power(flow_acc,1.35),0,1)

cave_field=np.zeros(V,dtype=np.float32)
cavity_sources=caves+[(7.6,5.2,5.6,4.1,2.45,2.2,.48),(-2.0,3.2,-1.2,3.4,2.15,2.0,-.20)]+dissolution_events
for cx,cy,cz,rx,ry,rz,rot in cavity_sources:
"""
if needle not in s:
    raise RuntimeError("V012 runoff/cavity anchor changed")
s = s.replace(needle, replacement, 1)

s = s.replace("moist=np.clip(.10+.50*runoff+.34*cave_field+.22*concave+.18*(1-height)+.12*(var-.5),0,1)",
              "moist=np.clip(.07+.42*runoff+.29*cave_field+.19*concave+.12*(1-height)+.08*(var-.5),0,1)")
s = s.replace("bio=np.clip((.20+.62*moist+.20*(N[:,1]*.5+.5)+.20*concave-.55*fresh+.18*(var-.5))* (material==1),0,1)",
              "bio=np.clip((.10+.52*moist+.18*(N[:,1]*.5+.5)+.19*concave-.58*fresh+.12*(var-.5))* (material==1),0,1)")
s = s.replace("iron=np.clip((.04+.48*runoff+.20*moist+.13*(var-.5))* (material==1),0,1)",
              "iron=np.clip((.025+.38*runoff+.17*moist+.10*(var-.5))* (material==1),0,1)")
s = s.replace("ao=np.clip(1.0-.56*cave_field-.28*concave-.13*curv-.10*(1-height),.18,1.0)",
              "ao=np.clip(1.0-.46*cave_field-.24*concave-.11*curv-.07*(1-height),.27,1.0)")
s = s.replace("roughness=np.clip(.78+.12*(var-.5)+.12*bio+.08*concave-.30*moist-.10*fresh,.34,.96)",
              "roughness=np.clip(.79+.08*(var-.5)+.10*bio+.07*concave-.22*moist-.10*fresh,.38,.96)")

old = """runoff=np.where(soil,np.clip(.15+.35*(1-height)+.15*(var-.5),0,1),runoff)
talus_mask=np.arange(V)>=primary_vertex_count
"""
new = """runoff=np.where(soil,np.clip(.10+.22*(1-height)+.10*(var-.5),0,1),runoff)
# Dark manganese is a sparse deposit at strong, sheltered flow paths. It is not wet-rock colour.
manganese=np.clip(np.power(runoff,2.35)*(.18+.58*cave_field+.34*concave)*(1-.48*vis),0,1)
manganese=np.where(material==1,manganese,0).astype(np.float32)
talus_mask=np.arange(V)>=primary_vertex_count
"""
if old not in s:
    raise RuntimeError("V012 soil/talus anchor changed")
s = s.replace(old, new, 1)
s = s.replace("var[talus_mask]=np.clip(.18+.56*var[talus_mask],0,1)\nao[talus_mask]",
              "var[talus_mask]=np.clip(.18+.56*var[talus_mask],0,1)\nmanganese[talus_mask]=0\nao[talus_mask]", 1)

old_fields = """fields=np.stack([
    material,np.rint(moist*255),np.rint(bio*255),np.rint(runoff*255),
    np.rint(fresh*255),np.rint(ao*255),np.rint(roughness*255),np.rint(vis*255),
    np.rint(iron*255),np.rint(var*255),np.rint(height*255),np.rint(curv*255),
],axis=1).astype(np.uint8)"""
new_fields = """fields=np.stack([
    material,np.rint(moist*255),np.rint(bio*255),np.rint(runoff*255),
    np.rint(fresh*255),np.rint(ao*255),np.rint(roughness*255),np.rint(vis*255),
    np.rint(iron*255),np.rint(var*255),np.rint(cave_field*255),np.rint(manganese*255),
],axis=1).astype(np.uint8)"""
if old_fields not in s:
    raise RuntimeError("V012 field stack anchor changed")
s = s.replace(old_fields, new_fields, 1)
s = s.replace("'schema':'landscape-mother-karst-v012/1'", "'schema':'landscape-mother-karst-v013/1'", 1)
s = s.replace("'fields':['material','moisture','bio','runoff','freshFracture','skyAccessibility','roughness','sunVisibility','ironDeposit','mineralVariation','height','curvature']",
              "'fields':['material','wetness','bioSuitability','runoffAccumulation','freshFracture','skyAccessibility','roughness','sunVisibility','ironDeposit','mineralVariation','cavity','manganeseDeposit']", 1)
anchor = "'components':int(len(mesh.split(only_watertight=False))),\n"
insert = """'independentSeeds':{'shape':SHAPE_SEED,'cavity':CAVITY_SEED,'water':WATER_SEED,'color':COLOR_SEED,'weather':WEATHER_SEED,'bio':BIO_SEED,'detail':DETAIL_SEED},
 'dissolutionEventCount':len(dissolution_events)+len(caves)+4,
 'formationHierarchy':{'macro':.46,'meso':.36,'micro':.18},
 'approvals':{'visualApproved':False,'visualAcceptance':False,'productionReady':False},
 """
if anchor not in s:
    raise RuntimeError("V012 metadata anchor changed")
s = s.replace(anchor, insert + anchor, 1)
p.write_text(s)
