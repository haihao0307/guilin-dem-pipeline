"""Read three preserved CSDI models and extract measured plane/boundary recipes.

The outputs are a research adapter, not a frozen global KAOPU schema. Source
triangulation is used only here and in the explicitly labelled source preview.
The runtime reconstruction module reads only the measured recipes.
"""
import collections
import hashlib
import json
import math
import shutil
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
SOURCE = Path('/workspace/shared/hk_city_models_research/rail_corridor_gltf')
CASES = [
    ('B367642137201063C0', '33 La Salle Road · 复杂低层屋顶', 'complex-low-rise'),
    ('B359971994401063C0', '翼状高塔 · 名称与年代待核', 'wing-plan-tower'),
    ('B369121858401063C0', '宽体斜屋面 · 名称与用途待核', 'broad-sloped-roof'),
]
PLANE_TOLERANCE = 0.00025
NORMAL_DOT_MIN = 0.99999999
BOUNDARY_COLLINEAR_TOLERANCE = 0.00001

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')

def accessor(doc, folder, ix):
    a = doc['accessors'][ix]; bv = doc['bufferViews'][a['bufferView']]
    raw = (folder / doc['buffers'][bv['buffer']]['uri']).read_bytes()
    dtype = np.dtype({5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']])
    dim = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    return np.ndarray((a['count'],dim), dtype=dtype, buffer=raw,
        offset=bv.get('byteOffset',0)+a.get('byteOffset',0),
        strides=(bv.get('byteStride',dim*dtype.itemsize),dtype.itemsize)).copy()

def node_matrix(node):
    if 'matrix' in node: return np.array(node['matrix'], float).reshape(4,4,order='F')
    x,y,z,w = node.get('rotation',[0,0,0,1]); sx,sy,sz = node.get('scale',[1,1,1])
    m = np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w,0],
                  [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w,0],
                  [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y,0],[0,0,0,1]],float)
    m[:3,:3] = m[:3,:3] @ np.diag([sx,sy,sz]); m[:3,3] = node.get('translation',[0,0,0])
    return m

def load_source(path):
    doc = json.loads(path.read_text()); triangles=[]; hierarchy=[]
    def walk(ix, parent):
        node=doc['nodes'][ix]; mat=parent@node_matrix(node)
        hierarchy.append({'nodeIndex':ix,'name':node.get('name'), 'worldMatrix':mat.flatten(order='F').tolist()})
        if 'mesh' in node:
            for prim in doc['meshes'][node['mesh']]['primitives']:
                if prim.get('mode',4) != 4: raise ValueError('Non-triangle primitive is unsupported in this experiment')
                p=accessor(doc,path.parent,prim['attributes']['POSITION'])
                p=(np.c_[p,np.ones(len(p))]@mat.T)[:,:3]
                ixes=accessor(doc,path.parent,prim['indices']).ravel() if 'indices' in prim else np.arange(len(p))
                triangles.append(p[ixes.reshape(-1,3)][:,:,[0,2,1]] * np.array([1,-1,1]))
        for child in node.get('children',[]): walk(child,mat)
    for ix in doc['scenes'][doc.get('scene',0)]['nodes']: walk(ix,np.eye(4))
    world=np.concatenate(triangles)
    # Stable source root origin. Heights below are local to its preserved mPD height.
    root=node_matrix(doc['nodes'][doc['scenes'][doc.get('scene',0)]['nodes'][0]])
    origin=np.array([root[0,3],-root[2,3],root[1,3]])
    return doc,world-origin,origin,hierarchy

def clean_loop(loop, points):
    loop=list(loop)
    changed=True
    while changed and len(loop)>3:
        changed=False
        for i in range(len(loop)):
            a,b,c=points[loop[i-1]],points[loop[i]],points[loop[(i+1)%len(loop)]]
            v=c-a; denom=np.linalg.norm(v)
            if denom and np.linalg.norm(np.cross(b-a,v))/denom <= BOUNDARY_COLLINEAR_TOLERANCE and np.dot(b-a,c-b)>=0:
                loop.pop(i);changed=True;break
    return loop

def area2(points):
    return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))/2

def rounded(a):
    return np.round(np.asarray(a),8).tolist()

def extract(triangles):
    # Exact source position identity: never weld unrelated nearby vertices.
    point_ids={}; points=[]; tris=[]
    for tri in triangles:
        ids=[]
        for p in tri:
            key=tuple(p.tolist())
            if key not in point_ids: point_ids[key]=len(points);points.append(p)
            ids.append(point_ids[key])
        tris.append(ids)
    points=np.array(points);tris=np.array(tris)
    cross=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]);lengths=np.linalg.norm(cross,axis=1)
    degenerate=np.where(lengths<1e-10)[0].tolist();normals=cross/np.maximum(lengths[:,None],1e-30)
    edge_faces=collections.defaultdict(list)
    for i,tri in enumerate(tris):
        if i in degenerate:continue
        for a,b in zip(tri,np.roll(tri,-1)):edge_faces[tuple(sorted((int(a),int(b))))].append(i)
    neighbors=collections.defaultdict(set)
    for fs in edge_faces.values():
        if len(fs)==2:
            a,b=fs
            if np.dot(normals[a],normals[b]) >= NORMAL_DOT_MIN:
                neighbors[a].add(b);neighbors[b].add(a)
    unused=set(range(len(tris)))-set(degenerate);groups=[]
    while unused:
        root=min(unused);unused.remove(root);group=[root];queue=[root]
        n=normals[root];d=float(np.dot(n,triangles[root,0]))
        while queue:
            for other in sorted(neighbors[queue.pop()]):
                if other in unused and np.dot(n,normals[other])>=NORMAL_DOT_MIN and np.max(abs(points[tris[other]]@n-d))<=PLANE_TOLERANCE:
                    unused.remove(other);queue.append(other);group.append(other)
        groups.append(sorted(group))
    recipes=[];report=[]
    for gi,group in enumerate(groups):
        count=collections.Counter();directed={}
        for ti in group:
            for a,b in zip(tris[ti],np.roll(tris[ti],-1)):
                key=tuple(sorted((int(a),int(b))));count[key]+=1;directed[key]=(int(a),int(b))
        edges=[directed[k] for k,v in count.items() if v==1]
        outgoing=collections.defaultdict(list)
        for a,b in edges:outgoing[a].append(b)
        if any(len(v)!=1 for v in outgoing.values()):raise ValueError(f'Non-simple patch boundary {gi}')
        remaining=set(edges);loops=[]
        while remaining:
            start=min(remaining)[0];loop=[start];cur=start
            while True:
                nxt=outgoing[cur][0];remaining.remove((cur,nxt))
                if nxt==start:break
                if nxt in loop:raise ValueError('Boundary repeated a vertex')
                loop.append(nxt);cur=nxt
            loops.append(clean_loop(loop,points))
        n=normals[group[0]];d=float(np.dot(n,triangles[group[0],0]))
        allp=points[np.unique(tris[group])]
        err=float(np.max(abs(allp@n-d)))
        rid=f'p{gi:03d}';entry={'id':rid}
        if abs(n[2])<0.5:
            horizontal_length=np.linalg.norm(n[:2])
            tangent=np.array([-n[1],n[0],0])/horizontal_length
            base=np.array([n[0]*d,n[1]*d,0])/(horizontal_length**2)
            drift=-n[:2]*n[2]/(horizontal_length**2)
            projected=[[[float(np.dot(points[i]-base,tangent)),float(points[i,2])] for i in loop] for loop in loops]
            outer=max(range(len(projected)),key=lambda i:abs(area2(projected[i])))
            projected=[projected[outer]]+[p for i,p in enumerate(projected) if i!=outer]
            all2=np.array([p for loop in projected for p in loop]);lo=all2.min(0);hi=all2.max(0)
            if abs(n[2])<1e-8 and len(projected)==1 and len(projected[0])==4 and all(min(abs(p[0]-lo[0]),abs(p[0]-hi[0]))<1e-7 and min(abs(p[1]-lo[1]),abs(p[1]-hi[1]))<1e-7 for p in projected[0]):
                entry.update({'kind':'wallStrip','edge':rounded([(base+tangent*lo[0])[:2],(base+tangent*hi[0])[:2]]),'bottom':round(float(lo[1]),8),'top':round(float(hi[1]),8)})
            else:
                entry.update({'kind':'wallProfile','origin':rounded(base[:2]),'tangent':rounded(tangent[:2]),'horizontalDriftPerHeight':rounded(drift),'loops':rounded(projected)})
        else:
            projected=[[[float(points[i,0]),float(points[i,1])] for i in loop] for loop in loops]
            outer=max(range(len(projected)),key=lambda i:abs(area2(projected[i])))
            projected=[projected[outer]]+[p for i,p in enumerate(projected) if i!=outer]
            entry.update({'kind':'roofPlane' if n[2]>0 else 'undersidePlane','heightPlane':rounded([-n[0]/n[2],-n[1]/n[2],d/n[2]]),'loops':rounded(projected)})
        recipes.append(entry)
        report.append({'id':rid,'sourceTriangles':group,'normal':rounded(n),'maxPlaneFitErrorMetres':err,'boundaryLoops':len(loops),'boundaryPoints':sum(map(len,loops)),'kind':entry['kind']})
    return recipes,{'sourceTriangles':len(tris),'sourceUniquePositions':len(points),'degenerateTriangles':degenerate,'patches':report,'maxPlaneFitErrorMetres':max((p['maxPlaneFitErrorMetres'] for p in report),default=0)}

def main():
    manifest={'schema':'hk-three-buildings-research-manifest/1','status':'experimental_measured_plane_boundary_recipes_not_global_KAOPU_standard','units':'metre','axis':'Y_UP_X_EAST_Z_SOUTH','buildings':[]}
    for model_id,label,shape in CASES:
        preserved=HERE/'original'/model_id/f'{model_id}.gltf'
        previous_receipt=json.loads((HERE/f'{model_id}.provenance.json').read_text()) if (HERE/f'{model_id}.provenance.json').exists() else None
        path=preserved if preserved.exists() and previous_receipt else next(SOURCE.glob(f'subsets/*/BUILDING/{model_id}/{model_id}.gltf'))
        tile=previous_receipt['sourceTile'] if path==preserved else path.parts[-4]
        doc,triangles,origin,hierarchy=load_source(path);recipes,report=extract(triangles)
        display=triangles[:,:,[0,2,1]]*np.array([1,1,-1]);bounds={'min':display.reshape(-1,3).min(0).tolist(),'max':display.reshape(-1,3).max(0).tolist(),'size':np.ptp(display.reshape(-1,3),axis=0).tolist()}
        source_files=[path]+[(path.parent/b['uri']) for b in doc['buffers']]
        original_folder=HERE/'original'/model_id;original_folder.mkdir(parents=True,exist_ok=True)
        for f in source_files:
            if f.resolve()!=(original_folder/f.name).resolve():shutil.copyfile(f,original_folder/f.name)
        receipt={'sourceModelId':model_id,'sourceTile':tile,'sourceRelativePaths':[f'original/{model_id}/{f.name}' for f in source_files],'sourceFileSha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in source_files},'sourceHierarchy':hierarchy,'sourceBytes':sum(f.stat().st_size for f in source_files),'attribution':'HKSAR Government, Lands Department / CSDI Portal','terms':'https://portal.csdi.gov.hk/csdi-webpage/doc/TNC','datasetUrl':'https://portal.csdi.gov.hk/geoportal/?datasetId=landsd_rcd_1742809441342_98380&lang=en','sourceModernGeometry':True,'sourceAppearanceIsNotHistoricalReconstruction':True}
        if previous_receipt:
            compressed=previous_receipt['existingZipCompressedMemberBytes']
        else:
            directory=json.loads((SOURCE/f'subsets/{tile}/source_zip_directory.json').read_text())
            relative=[str(f.relative_to(path.parents[2])) for f in source_files]
            compressed=sum(e['compressed_bytes'] for e in directory['entries'] if e['name'] in relative)
        receipt['existingZipCompressedMemberBytes']=compressed
        georef={'horizontalCrs':'EPSG:2326','verticalDatum':'Hong Kong Principal Datum','originEastingNorthingHeight':origin.tolist(),'originalGltfWorldAxes':['Easting','Height','-Northing'],'localRecipeAxes':['east','north','up'],'displayAxes':['east','up','south']}
        score={'adapter':'kaopu.hk.measured-plane-boundary/0.1-research','objectId':model_id,'seed':int(hashlib.sha256(model_id.encode()).hexdigest()[:8],16),'units':'metre','georeference':georef,'reconstruction':{'generator':'hk-measured-boundary','version':'0.1.0','planeMergeToleranceMetres':PLANE_TOLERANCE,'normalDotMin':NORMAL_DOT_MIN,'collinearToleranceMetres':BOUNDARY_COLLINEAR_TOLERANCE,'operations':recipes},'evidence':{'geometry':'observed_derived','buildingName':'unknown','address':'33 LA SALLE RD' if model_id==CASES[0][0] else 'unknown','floorCount':'unknown','windowsDoors':'not_inferred_from_geometry','historicalAppearance':'unknown','roofAndWallRole':'inferred_from_surface_orientation'},'edits':{'scaleEast':1,'scaleNorth':1,'scaleHeight':1,'status':'baseline_when_all_scales_equal_one'}}
        dump(HERE/f'{model_id}.score.json',score)
        # This intentionally separate source view is excluded from the recipe/runtime byte budget.
        dump(HERE/f'{model_id}.source-preview.json',{'positions':display.reshape(-1).tolist(),'indices':list(range(display.size//3)),'purpose':'raw_source_comparison_only_not_runtime_reconstruction'})
        dump(HERE/f'{model_id}.provenance.json',receipt)
        dump(HERE/f'{model_id}.extraction-audit.json',report)
        manifest['buildings'].append({'id':model_id,'label':label,'shapeClass':shape,'scoreUrl':f'geometry/{model_id}.score.json','sourcePreviewUrl':f'geometry/{model_id}.source-preview.json','sourceGltfUrl':f'geometry/original/{model_id}/{model_id}.gltf','provenanceUrl':f'geometry/{model_id}.provenance.json','bounds':bounds,'georeference':georef,'evidence':score['evidence'],'recipeSummary':dict(collections.Counter(o['kind'] for o in recipes)),'sourceTriangles':len(triangles),'sourceBytes':receipt['sourceBytes'],'sourceCompressedMemberBytes':compressed})
        print(model_id,len(triangles),'triangles ->',len(recipes),'recipes',manifest['buildings'][-1]['recipeSummary'],'max fit',report['maxPlaneFitErrorMetres'])
    dump(HERE/'buildings.json',manifest)

if __name__=='__main__':main()
