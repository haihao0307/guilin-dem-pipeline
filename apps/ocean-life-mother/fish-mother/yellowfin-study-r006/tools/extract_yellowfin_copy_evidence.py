from __future__ import annotations
import argparse, hashlib, json, math, struct, collections
from pathlib import Path
import numpy as np
import trimesh

ACCEPTED={
'f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0':6137560,
'5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe':58908280,
}
DT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}

def sha256(b:bytes)->str:return hashlib.sha256(b).hexdigest()

def read_glb(path:Path):
    raw=path.read_bytes(); h=sha256(raw)
    if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,4)[0]!=2 or struct.unpack_from('<I',raw,8)[0]!=len(raw):
        raise ValueError('invalid GLB')
    if h not in ACCEPTED or ACCEPTED[h]!=len(raw):
        raise ValueError(f'exact FISH-REF-002 required, got {h} / {len(raw)} bytes')
    off=12; g=None; binv=None
    while off+8<=len(raw):
        n,t=struct.unpack_from('<II',raw,off); s=off+8; e=s+n
        if t==0x4E4F534A:g=json.loads(raw[s:e].decode().rstrip('\x00 \t\r\n'))
        elif t==0x004E4942:binv=memoryview(raw)[s:e]
        off=e
    if g is None or binv is None:raise ValueError('missing JSON/BIN')
    return raw,h,g,binv

def acc(g,binv,i):
    a=g['accessors'][i]; bv=g['bufferViews'][a['bufferView']]
    dt=np.dtype(DT[a['componentType']]).newbyteorder('<'); c=NC[a['type']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0); stride=bv.get('byteStride',dt.itemsize*c)
    out=np.empty((a['count'],c),dt)
    for k in range(a['count']):out[k]=np.frombuffer(binv,dt,c,off+k*stride)
    if a.get('normalized'):
        info=np.iinfo(dt); out=out.astype(float)/(info.max if info.min==0 else info.max); out=np.maximum(out,-1)
    return out

def group(n:str)->str:
    if n in {'_rootJoint','Hips_01'}:return'root'
    if n.startswith('Spine')or n=='Head_05':return'axial'
    if 'UpperJaw'in n:return'upper_jaw'
    if 'LoweJaw'in n:return'lower_jaw'
    if n.startswith('Eye.'):return'eye'
    if n.startswith('Side.')and'Fin'not in n:return'operculum_candidate'
    if n.startswith('SideFin'):return'pectoral_fin'
    if n.startswith('LowerFin')and'Back'not in n:return'pelvic_fin'
    if n.startswith('UpperFin'):return'dorsal_fin'
    if n.startswith('LowerBackFin'):return'anal_fin'
    if n.startswith('UpperTail'):return'caudal_upper'
    if n.startswith('LowerTail'):return'caudal_lower'
    return'unclassified'

def scene_meshes(path:Path):
    sc=trimesh.load(path,force='scene',process=False); out={}
    for node in sc.graph.nodes_geometry:
        T,name=sc.graph[node]; m=sc.geometry[name].copy(); m.apply_transform(T)
        key='body' if name.startswith('FishC') else 'eyes' if name.startswith('EyesC') else 'cornea' if name.startswith('CorneaC') else name
        out[key]=m
    return out

def normalize_points(p,L,tail_y):
    q=np.asarray(p,float).copy();q[:,0]/=L;q[:,1]=(q[:,1]-tail_y)/L;q[:,2]/=L;return q

def face_group_inventory(g,binv,body):
    skin=g['skins'][0]; prim=g['meshes'][0]['primitives'][0]
    J=acc(g,binv,prim['attributes']['JOINTS_0']).astype(int)
    W=acc(g,binv,prim['attributes']['WEIGHTS_0']).astype(float);W/=np.maximum(W.sum(1,keepdims=True),1e-12)
    I=acc(g,binv,prim['indices']).reshape(-1).astype(int).reshape(-1,3)
    names=[g['nodes'][n].get('name',f'node_{n}') for n in skin['joints']]
    dom=np.take_along_axis(J,np.argmax(W,1)[:,None],1)[:,0]
    vg=np.array([group(names[i]) for i in dom])
    fg=[]
    for f in I:
        vals,cnt=np.unique(vg[f],return_counts=True);fg.append(vals[np.argmax(cnt)])
    return I,vg,np.array(fg),names

def components_for_group(body,faces,face_groups,target,L,tail_y):
    idx=np.where(face_groups==target)[0]
    if not len(idx):return []
    fs=faces[idx]
    edge_to_faces=collections.defaultdict(list)
    for li,f in enumerate(fs):
        for a,b in ((f[0],f[1]),(f[1],f[2]),(f[2],f[0])):edge_to_faces[tuple(sorted((int(a),int(b))))].append(li)
    adj=[]
    for lst in edge_to_faces.values():
        if len(lst)>1:
            for a in lst:
                for b in lst:
                    if a<b:adj.append([a,b])
    if adj:
        comps=trimesh.graph.connected_components(np.asarray(adj,int),nodes=np.arange(len(fs)),min_len=1)
    else:comps=[np.array([i]) for i in range(len(fs))]
    out=[]
    for ci,c in enumerate(comps):
        fsel=fs[np.asarray(list(c),int)];vi=np.unique(fsel);pts=body.vertices[vi];n=normalize_points(pts,L,tail_y)
        mn=n.min(0);mx=n.max(0);ctr=n.mean(0)
        out.append({
          'component':ci,'faces':int(len(fsel)),'vertices':int(len(vi)),
          'uRange':[round(float(mn[1]),6),round(float(mx[1]),6)],
          'xRange':[round(float(mn[0]),6),round(float(mx[0]),6)],
          'zRange':[round(float(mn[2]),6),round(float(mx[2]),6)],
          'centroid':[round(float(x),6) for x in ctr],
          'uSpanPctL':round(float((mx[1]-mn[1])*100),3),
          'xSpanPctL':round(float((mx[0]-mn[0])*100),3),
          'zSpanPctL':round(float((mx[2]-mn[2])*100),3),
        })
    out.sort(key=lambda x:(x['centroid'][1],-x['faces']))
    return out

def core_mesh(body,faces,fg):
    core={'axial','root','upper_jaw','lower_jaw','operculum_candidate','eye'}
    sel=faces[np.array([x in core for x in fg])]
    return trimesh.Trimesh(vertices=body.vertices.copy(),faces=sel,process=False)

def section_span(mesh,y):
    sec=mesh.section(plane_origin=[0,float(y),0],plane_normal=[0,1,0])
    if sec is None:return None
    pts=np.asarray(sec.vertices,float)
    if len(pts)<4:return None
    xlo,xhi=np.quantile(pts[:,0],[.02,.98]);zlo,zhi=np.quantile(pts[:,2],[.02,.98])
    return {'width':float(xhi-xlo),'depth':float(zhi-zlo),'xRange':[float(xlo),float(xhi)],'zRange':[float(zlo),float(zhi)],'points':pts}

def peduncle_scan(core,L,tail_y):
    rows=[]
    for u in np.linspace(.055,.24,75):
        y=tail_y+u*L;s=section_span(core,y)
        if not s:continue
        rows.append({'u':float(u),'widthPctL':s['width']/L*100,'depthPctL':s['depth']/L*100,'areaProxyPctL2':s['width']*s['depth']/(L*L)*10000,'raw':s})
    if not rows:return {'rows':[],'minimum':None}
    cand=[r for r in rows if r['u']>=.08]
    m=min(cand,key=lambda r:r['areaProxyPctL2'])
    pts=m['raw']['points'];half=max(abs(m['raw']['xRange'][0]),abs(m['raw']['xRange'][1]));near=pts[np.abs(pts[:,0])>=.80*half]
    zvals=np.sort(near[:,2]/L) if len(near) else np.array([])
    clusters=[]
    for z in zvals:
        if not clusters or abs(z-np.mean(clusters[-1]))>.012:clusters.append([float(z)])
        else:clusters[-1].append(float(z))
    keel=[round(float(np.mean(c)),6) for c in clusters if len(c)>=1]
    return {
      'scan':[{'u':round(r['u'],6),'widthPctL':round(r['widthPctL'],3),'depthPctL':round(r['depthPctL'],3),'areaProxyPctL2':round(r['areaProxyPctL2'],3)} for r in rows],
      'minimum':{'u':round(m['u'],6),'widthPctL':round(m['widthPctL'],3),'depthPctL':round(m['depthPctL'],3),'lateralKeelZCandidatesNormalized':keel}
    }

def animation_inventory(g,binv):
    out=[]
    for ai,anim in enumerate(g.get('animations',[])):
        channels=[]
        for ch in anim.get('channels',[]):
            node=ch.get('target',{}).get('node');path=ch.get('target',{}).get('path');sam=anim['samplers'][ch['sampler']]
            vals=acc(g,binv,sam['output']).astype(float);extent=0.0
            if path=='translation' or path=='scale':extent=float(np.linalg.norm(vals.max(0)-vals.min(0)))
            elif path=='rotation':
                b=vals[0]/max(np.linalg.norm(vals[0]),1e-12)
                mx=0
                for q in vals:
                    q=q/max(np.linalg.norm(q),1e-12);d=min(1,max(-1,abs(float(np.dot(b,q)))));mx=max(mx,2*math.acos(d))
                extent=float(mx)
            channels.append({'node':node,'name':g['nodes'][node].get('name') if node is not None else None,'group':group(g['nodes'][node].get('name','')) if node is not None else None,'path':path,'extent':extent})
        out.append({'index':ai,'name':anim.get('name'), 'channels':channels})
    return out

def main():
    ap=argparse.ArgumentParser(description='Extract copy evidence from exact FISH-REF-002 without generating a fish')
    ap.add_argument('glb',type=Path);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    raw,h,g,binv=read_glb(a.glb);ms=scene_meshes(a.glb);body=ms['body'];L=float(body.bounds[1,1]-body.bounds[0,1]);tail_y=float(body.bounds[0,1])
    faces,vg,fg,names=face_group_inventory(g,binv,body)
    component_groups={x:components_for_group(body,faces,fg,x,L,tail_y) for x in ['dorsal_fin','anal_fin','pelvic_fin','pectoral_fin','caudal_upper','caudal_lower','upper_jaw','lower_jaw','operculum_candidate']}
    core=core_mesh(body,faces,fg);ped=peduncle_scan(core,L,tail_y)
    mats=[]
    for i,m in enumerate(g.get('materials',[])):
        p=m.get('pbrMetallicRoughness',{})
        mats.append({'index':i,'name':m.get('name'),'alphaMode':m.get('alphaMode','OPAQUE'),'doubleSided':bool(m.get('doubleSided')),'baseColorAlpha':p.get('baseColorFactor',[1,1,1,1])[3],'baseColorTexture':p.get('baseColorTexture',{}).get('index'),'metallicRoughnessTexture':p.get('metallicRoughnessTexture',{}).get('index'),'normalTexture':m.get('normalTexture',{}).get('index'),'occlusionTexture':m.get('occlusionTexture',{}).get('index')})
    report={
      'schema':'kaopu.fish-mother.yellowfin-exact-source-copy-evidence/1.0','date':'2026-09-21','referenceId':'FISH-REF-002',
      'input':{'filename':a.glb.name,'bytes':len(raw),'sha256':h},
      'frame':{'bodyLengthSourceUnits':round(L,6),'tailY':round(tail_y,6),'snoutY':round(float(body.bounds[1,1]),6)},
      'sourceCounts':{'bodyVertices':len(body.vertices),'bodyTriangles':len(body.faces),'joints':len(g['skins'][0]['joints']),'materials':len(g.get('materials',[])),'images':len(g.get('images',[]))},
      'faceGroupCounts':{x:int(np.count_nonzero(fg==x)) for x in sorted(set(fg))},
      'groupConnectedComponents':component_groups,
      'peduncleCoreScan':ped,
      'materials':mats,
      'animations':animation_inventory(g,binv),
      'interpretationBoundary':{
        'componentCountIsGeometryFact':True,
        'componentIsFinletOnlyAfterVisualClassification':True,
        'keelCandidatesRequireVisualConfirmation':True,
        'sourceCopyGeometryGenerated':False,
        'productionReady':False
      }
    }
    out=a.out/'YELLOWFIN_EXACT_SOURCE_COPY_EVIDENCE_R001.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(out)

if __name__=='__main__':main()
