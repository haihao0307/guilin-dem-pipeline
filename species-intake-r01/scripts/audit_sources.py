"""Read-only, exact-source fish intake. No source extraction, rewriting or fallback geometry."""
import base64, hashlib, io, json, math, pathlib, posixpath, struct, zipfile
from datetime import datetime, timezone
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
SEA = pathlib.Path('G:/Three.js/sea/FISH2')
DOWNLOADS = pathlib.Path('C:/Users/Administrator/Downloads')
DTYPES = {5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTH = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT2':4,'MAT3':9,'MAT4':16}
sha = lambda b: hashlib.sha256(b).hexdigest()

def virtual_packages(blob, label, depth=0):
    if depth > 3: raise ValueError('Nested source depth exceeds intake limit')
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        files = {n:z.read(n) for n in z.namelist() if not n.endswith('/')}
    yield label, files
    for n,b in files.items():
        if n.lower().endswith('.zip'):
            yield from virtual_packages(b, label+'!'+n, depth+1)

def matrix(n):
    if 'matrix' in n: return np.array(n['matrix'],float).reshape(4,4,order='F')
    x,y,z,w = n.get('rotation',[0,0,0,1]); sx,sy,sz=n.get('scale',[1,1,1])
    m=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],
                [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],
                [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],[0,0,0,1]],float)
    m[:3,:3] *= [sx,sy,sz]; m[:3,3]=n.get('translation',[0,0,0]); return m

def audit(files, name, container, container_hash):
    raw=files[name]; binary=None
    if name.lower().endswith('.glb'):
        magic,version,total=struct.unpack_from('<III',raw)
        if magic!=0x46546c67 or version!=2 or total!=len(raw): raise ValueError('Invalid GLB header')
        offset=12; g=None
        while offset<total:
            length,kind=struct.unpack_from('<II',raw,offset); chunk=raw[offset+8:offset+8+length];offset+=8+length
            if kind==0x4e4f534a:g=json.loads(chunk.decode('utf8').rstrip('\x00 \t\r\n'))
            elif kind==0x004e4942:binary=chunk
    else:g=json.loads(raw.decode('utf-8-sig'))
    parent=posixpath.dirname(name)
    def uri_bytes(uri):
        if uri.startswith('data:'):return base64.b64decode(uri.split(',',1)[1])
        from urllib.parse import unquote
        p=posixpath.normpath(posixpath.join(parent,unquote(uri)))
        if p not in files:raise ValueError('Source entry missing: '+p)
        return files[p]
    buffers=[uri_bytes(b['uri']) if 'uri' in b else binary for b in g.get('buffers',[])]
    if any(b is None for b in buffers):raise ValueError('Missing GLB BIN')
    for descriptor,b in zip(g.get('buffers',[]),buffers):
        if len(b)<descriptor['byteLength']:raise ValueError('Short source buffer')
    views=g.get('bufferViews',[]); arrays={}
    def view_array(v_index,offset,count,width,component,stride=None):
        v=views[v_index];dtype=np.dtype(DTYPES[component]);step=stride or v.get('byteStride',width*dtype.itemsize)
        start=v.get('byteOffset',0)+offset; length=(count-1)*step+width*dtype.itemsize if count else 0
        if start+length>v.get('byteOffset',0)+v['byteLength']:raise ValueError('Accessor exceeds bufferView')
        return np.ndarray((count,width),dtype,buffer=buffers[v['buffer']],offset=start,strides=(step,dtype.itemsize)).copy()
    def accessor(i):
        if i in arrays:return arrays[i]
        a=g['accessors'][i];width=WIDTH[a['type']];component=a['componentType'];count=a['count']
        if a['type'] in ('MAT2','MAT3') and component in (5120,5121,5122,5123):
            raise ValueError('Padded matrix accessor requires explicit conversion')
        ar=view_array(a['bufferView'],a.get('byteOffset',0),count,width,component) if 'bufferView' in a else np.zeros((count,width),DTYPES[component])
        if 'sparse' in a:
            sp=a['sparse'];indices=view_array(sp['indices']['bufferView'],sp['indices'].get('byteOffset',0),sp['count'],1,sp['indices']['componentType']).ravel()
            values=view_array(sp['values']['bufferView'],sp['values'].get('byteOffset',0),sp['count'],width,component)
            if len(indices) and (np.max(indices)>=count or len(np.unique(indices))!=len(indices)):raise ValueError('Invalid sparse indices')
            ar[indices]=values
        if a.get('normalized') and component!=5126:
            ar=ar.astype(np.float64); info=np.iinfo(DTYPES[component]);ar=np.maximum(ar/info.max,-1) if info.min<0 else ar/info.max
        if not np.isfinite(ar).all():raise ValueError('Nonfinite source accessor')
        arrays[i]=ar;return ar
    for i,a in enumerate(g.get('accessors',[])):
        if 'KHR_draco_mesh_compression' in g.get('extensionsRequired',[]):raise ValueError('Draco source requires decoder, no substitute')
        accessor(i)
    nodes=g.get('nodes',[]); parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}; worlds={}
    def world(i):
        if i not in worlds:worlds[i]=(world(parents[i]) if i in parents else np.eye(4))@matrix(nodes[i])
        return worlds[i]
    primitive_rows=[];vertices=triangles=morph_targets=0; geometry_hash=hashlib.sha256();skin_errors=[]
    for mi,mesh in enumerate(g.get('meshes',[])):
        for pi,p in enumerate(mesh.get('primitives',[])):
            at=p['attributes'];pos=accessor(at['POSITION']);ix=accessor(p['indices']).ravel() if 'indices' in p else np.arange(len(pos))
            if len(ix) and np.max(ix)>=len(pos):raise ValueError('Index outside full source surface')
            mode=p.get('mode',4);tc=len(ix)//3 if mode==4 else max(0,len(ix)-2) if mode in (5,6) else 0
            vertices+=len(pos);triangles+=tc;morph_targets+=len(p.get('targets',[]))
            attrs={k:{'count':len(accessor(v)),'sha256':sha(accessor(v).tobytes())} for k,v in at.items()}
            for k,v in sorted(at.items()):geometry_hash.update(k.encode());geometry_hash.update(accessor(v).tobytes())
            geometry_hash.update(ix.tobytes())
            for target in p.get('targets',[]):
                for k,v in sorted(target.items()):geometry_hash.update(k.encode());geometry_hash.update(accessor(v).tobytes())
            row={'mesh':mi,'primitive':pi,'name':mesh.get('name'),'vertices':len(pos),'indices':len(ix),'triangles':tc,'mode':mode,'attributes':attrs,'indexSha256':sha(ix.tobytes()),'morphTargets':len(p.get('targets',[])),'localBounds':{'min':pos.min(0).tolist(),'max':pos.max(0).tolist()}}
            if 'WEIGHTS_0' in at:
                weights=accessor(at['WEIGHTS_0']);joints=accessor(at['JOINTS_0']);sums=weights.sum(1)
                row['skinWeights']={'maxSumError':float(np.max(np.abs(sums-1))),'nonnegative':bool((weights>=0).all()),'maxJoint':int(joints.max()),'influences':4}
                if 'WEIGHTS_1' in at:row['skinWeights']['additionalInfluences']=True
                for ni,n in enumerate(nodes):
                    if n.get('mesh')==mi and 'skin' in n and joints.max()>=len(g['skins'][n['skin']]['joints']):skin_errors.append({'node':ni,'mesh':mi,'invalidJoint':True})
            primitive_rows.append(row)
    clips=[]
    for a in g.get('animations',[]):
        times=[accessor(s['input']).ravel() for s in a['samplers']]
        if any(len(t)>1 and np.any(np.diff(t)<=0) for t in times):raise ValueError('Non-increasing animation keys')
        clips.append({'name':a.get('name','unnamed'),'channels':len(a.get('channels',[])),'duration':max((float(t[-1]) for t in times if len(t)),default=0),'paths':sorted(set(c['target']['path'] for c in a.get('channels',[]))),'interpolation':sorted(set(s.get('interpolation','LINEAR') for s in a['samplers']))})
    images=[]
    for i,im in enumerate(g.get('images',[])):
        if 'uri' in im:ib=uri_bytes(im['uri'])
        else:v=views[im['bufferView']];ib=buffers[v['buffer']][v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        resolution=None
        try:
            from PIL import Image
            resolution=list(Image.open(io.BytesIO(ib)).size)
        except Exception:pass
        images.append({'index':i,'name':im.get('name',im.get('uri')),'sha256':sha(ib),'bytes':len(ib),'resolution':resolution})
    for skin in g.get('skins',[]):
        if any(j>=len(nodes) for j in skin['joints']):raise ValueError('Skin node missing')
        if 'inverseBindMatrices' in skin and len(accessor(skin['inverseBindMatrices']))!=len(skin['joints']):raise ValueError('Inverse bind count mismatch')
    license_text='\n'.join(b.decode('utf8',errors='replace') for n,b in files.items() if n.lower().endswith(('license.txt','license.md')))
    identity_blob=hashlib.sha256(raw)
    for b in buffers:identity_blob.update(b)
    for im in images:identity_blob.update(im['sha256'].encode())
    extra=g.get('asset',{}).get('extras',{});identity=identity_blob.hexdigest()
    return {'sourceId':identity,'container':container,'containerSha256':container_hash,'entry':name,'sourceEntrySha256':sha(raw),'asset':g.get('asset',{}),'licenseText':license_text,'biologicalIdentity':'SOURCE_LABEL_ONLY_UNCONFIRMED','geometrySha256':geometry_hash.hexdigest(),'nodes':len(nodes),'meshes':len(g.get('meshes',[])),'vertices':vertices,'triangles':triangles,'accessors':len(arrays),'skins':[{'joints':len(s['joints']),'jointNames':[nodes[j].get('name',str(j)) for j in s['joints']]} for s in g.get('skins',[])],'animationClips':clips,'morphTargets':morph_targets,'images':images,'materials':g.get('materials',[]),'extensionsUsed':g.get('extensionsUsed',[]),'primitiveAudit':primitive_rows,'skinErrors':skin_errors,'fullSurfaceRead':True,'allAccessorsFinite':True,'noReconstructionOrSimplification':True,'sourceGeometryPreserved':True,'intakePassed':not skin_errors,'productionReady':False,'nextStage':'SOURCE_ALIGNED_SINGLE_SPECIMEN_MEASUREMENT','axisAndScale':'MEASUREMENT_REQUIRED','bodyFinEyeBindings':'MEASUREMENT_REQUIRED'}

def main():
    ROOT.mkdir(exist_ok=True);(ROOT/'cards').mkdir(exist_ok=True)
    paths=sorted(SEA.rglob('*.zip'))+[DOWNLOADS/'school_of_herring.zip',DOWNLOADS/'muskellunge+fish+3d+model.zip']
    paths += sorted(DOWNLOADS.glob('鲨鱼海洋_全量项目包_0.4.0_2026-09-02*.zip'))
    seen_containers={};seen_sources={};records=[];containers=[];failures=[]
    for p in paths:
        if not p.exists():continue
        blob=p.read_bytes();digest=sha(blob)
        container={'path':str(p),'bytes':len(blob),'sha256':digest}
        if digest in seen_containers:
            container['duplicateOf']=seen_containers[digest];containers.append(container);continue
        seen_containers[digest]=str(p);containers.append(container)
        try:
            found=[];other=[]
            for label,files in virtual_packages(blob,str(p)):
                for name in files:
                    if name.lower().endswith(('.gltf','.glb')):
                        try:
                            r=audit(files,name,label,digest);r['label']=p.parent.name if p.parent!=SEA and p.parent!=DOWNLOADS else p.stem
                            if r['sourceId'] in seen_sources:r['duplicateOf']=seen_sources[r['sourceId']]
                            else:
                                seen_sources[r['sourceId']]=label+'!'+name
                                (ROOT/'cards'/('source-'+r['sourceId'][:16]+'.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
                            records.append(r);found.append(name)
                        except Exception as e:failures.append({'container':label,'entry':name,'error':str(e),'state':'HOLD_LOCAL_DECODER_OR_SOURCE'})
                    elif name.lower().endswith(('.fbx','.blend','.obj')):other.append({'container':label,'entry':name,'bytes':len(files[name]),'sha256':sha(files[name]),'state':'FORMAT_ADAPTER_REQUIRED'})
            container['gltfEntries']=found;container['otherSources']=other
            if not found:container['state']='FORMAT_ADAPTER_REQUIRED' if other else 'NO_MESH_SOURCE_IN_PACKAGE'
        except Exception as e:failures.append({'container':str(p),'error':str(e),'state':'HOLD_LOCAL_PACKAGE'})
    report={'checkedAt':datetime.now(timezone.utc).isoformat(),'sourceRoot':str(SEA),'scope':'All local FISH2 archive files plus user Downloads herring/muskellunge and shark project packages','containers':containers,'models':records,'failures':failures,'archiveCount':len(containers),'uniqueArchives':len(seen_containers),'gltfRecords':len(records),'uniqueGltfSources':len(seen_sources),'uniqueGeometryFingerprints':len(set(r['geometrySha256'] for r in records)),'noOriginalWrites':True,'noSourceSubstitutes':True,'stage':'EXACT_SOURCE_INTAKE_ONLY','productionReady':False,'visibleWorkbenchGenerated':False}
    (ROOT/'LOCAL_INVENTORY.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:report[k] for k in ['archiveCount','uniqueArchives','gltfRecords','uniqueGltfSources','uniqueGeometryFingerprints','failures']},ensure_ascii=False))
    print(json.dumps([{'label':r['label'],'entry':r['entry'],'vertices':r['vertices'],'triangles':r['triangles'],'joints':[s['joints'] for s in r['skins']],'clips':len(r['animationClips']),'morphTargets':r['morphTargets'],'duplicate':bool(r.get('duplicateOf'))} for r in records],ensure_ascii=False))

if __name__=='__main__':main()
