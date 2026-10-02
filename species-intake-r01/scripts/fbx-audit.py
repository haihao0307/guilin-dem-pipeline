import bpy, json, pathlib, sys, hashlib, math, collections, traceback, zipfile, io
from io_scene_fbx import parse_fbx
ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMP = ROOT/'temporary'/'fbx-intake'
records = json.loads((TEMP/'discovered.json').read_text(encoding='utf-8'))
audits=[]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def components(mesh, welded=False):
    if welded:
        keys={}; vertex=[]
        for v in mesh.vertices:
            key=tuple(round(float(x),6) for x in v.co)
            if key not in keys: keys[key]=len(keys)
            vertex.append(keys[key])
        size=len(keys)
    else: vertex=list(range(len(mesh.vertices))); size=len(vertex)
    parent=list(range(size))
    def root(x):
        while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
        return x
    edges=collections.Counter()
    for p in mesh.polygons:
        vs=[vertex[x] for x in p.vertices]
        for a,b in zip(vs,vs[1:]+vs[:1]):
            if a==b: continue
            parent[root(b)]=root(a); edges[tuple(sorted((a,b)))]+=1
    counts=collections.Counter(root(i) for i in range(size))
    return {'componentCount':len(counts),'componentVertexCounts':sorted(counts.values(),reverse=True),
       'edgeCount':len(edges),'boundaryEdges':sum(n==1 for n in edges.values()),
       'nonManifoldEdges':sum(n>2 for n in edges.values()),'coordinateMergeTolerance':1e-6 if welded else 0}
def bounds(points):
    if not points:return None
    lo=[min(p[i] for p in points) for i in range(3)]; hi=[max(p[i] for p in points) for i in range(3)]
    return {'min':lo,'max':hi,'extent':[hi[i]-lo[i] for i in range(3)]}
def archive_evidence(rec):
    chain=rec['archiveChain']; data=pathlib.Path(chain[0]).read_bytes(); levels=[]
    companions=TEMP/('companions-'+rec['modelSha256'][:16]); companions.mkdir(exist_ok=True)
    for depth in range(len(chain)):
        z=zipfile.ZipFile(io.BytesIO(data)); licenses=[]; textures=[]
        for n in z.namelist():
            if n.lower().endswith(('.png','.jpg','.jpeg','.tga','.bmp')):
                b=z.read(n); dest=companions/str(depth)/pathlib.Path(n).name
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_bytes(b); textures.append({'entry':n,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'auditCopy':str(dest)})
            if 'license' in pathlib.Path(n).name.lower() and not n.endswith('/'):
                raw=z.read(n);licenses.append({'entry':n,'sha256':hashlib.sha256(raw).hexdigest(),'text':raw.decode('utf-8',errors='replace')[:16000]})
        levels.append({'archive':chain[depth],'sha256':hashlib.sha256(data).hexdigest(),'licenses':licenses,'textures':textures})
        if depth+1<len(chain):data=z.read(chain[depth+1])
    return levels
for rec in records:
    label=rec['archiveChain'][0]
    if any(x in label for x in ('Turtle','海龟','座头鲸','海牛')):
        audits.append(dict(rec,status='EXCLUDED_NON_FISH_DOMAIN',biologicalIdentity='UNVERIFIED_FILE_LABEL',license='NOT_REVIEWED',reason='Sea turtle / whale / manatee are outside current fish intake.'));continue
    a=dict(rec, status='AUDIT_RUNNING',biologicalIdentity='UNVERIFIED_FILE_LABEL',license='UNKNOWN',proceduralFishProduced=False)
    try:
        a['archives']=archive_evidence(rec)
        raw,version=parse_fbx.parse(rec['localAuditPath'])
        gs=next((e for e in raw.elems if e.id==b'GlobalSettings'),None)
        ps=next((e for e in gs.elems if e.id==b'Properties70'),None) if gs else None
        a['fbxBinaryVersion']=version
        a['fbxGlobalSettings']={e.props[0].decode('utf-8',errors='replace'):[p.decode('utf-8',errors='replace') if isinstance(p,bytes) else p for p in e.props[4:]] for e in ps.elems} if ps else {}
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=rec['localAuditPath'],use_image_search=True)
        a['sceneUnits']={'system':bpy.context.scene.unit_settings.system,'scaleLength':bpy.context.scene.unit_settings.scale_length,'physicalLengthCalibration':'UNKNOWN'}
        a['meshes']=[]
        for ob in bpy.data.objects:
            if ob.type!='MESH':continue
            mesh=ob.data; mesh.calc_loop_triangles()
            weights=[sum(g.weight for g in v.groups) for v in mesh.vertices]
            used=collections.Counter(g.group for v in mesh.vertices for g in v.groups if g.weight>0)
            mats=[]
            for material in mesh.materials:
                images=[]
                if material and material.node_tree:
                    for node in material.node_tree.nodes:
                        if node.type=='TEX_IMAGE' and node.image:
                            im=node.image; p=pathlib.Path(bpy.path.abspath(im.filepath))
                            match=[t for level in a['archives'] for t in level['textures'] if pathlib.Path(t['entry']).name==p.name]
                            images.append({'name':im.name,'path':str(p),'exists':p.is_file(),'size':list(im.size),'archiveTextureMatches':match,
                                'packed':bool(im.packed_file),'packedBytes':len(im.packed_file.data) if im.packed_file else 0,
                                'packedSha256':hashlib.sha256(im.packed_file.data).hexdigest() if im.packed_file else None,
                                'actualFileSha256':sha(p) if p.is_file() else None})
                mats.append({'name':material.name if material else None,'images':images})
            a['meshes'].append({'object':ob.name,'mesh':mesh.name,'vertices':len(mesh.vertices),'edges':len(mesh.edges),
                'polygons':len(mesh.polygons),'triangles':len(mesh.loop_triangles),'loops':len(mesh.loops),
                'uvLayers':[u.name for u in mesh.uv_layers],'hasCustomNormals':mesh.has_custom_normals,
                'materials':mats,'vertexGroups':[{ 'index':g.index,'name':g.name,'positiveVertexAssignments':used[g.index]} for g in ob.vertex_groups],
                'weightedVertices':sum(x>0 for x in weights),'weightSumRange':[min(weights),max(weights)] if weights else None,
                'shapeKeys':list(mesh.shape_keys.key_blocks.keys()) if mesh.shape_keys else [],
                'modifiers':[{'type':m.type,'name':m.name,'armature':m.object.name if m.type=='ARMATURE' and m.object else None} for m in ob.modifiers],
                'localBounds':bounds([list(v.co) for v in mesh.vertices]),'worldBindBounds':bounds([list(ob.matrix_world@v.co) for v in mesh.vertices]),
                'matrixWorld':[list(row) for row in ob.matrix_world],
                'topology':components(mesh),'positionWeldTopology':components(mesh,True),
                'continuityInterpretation':'Disconnected components and boundary edges may be fins, eyes, seams or open surfaces; this audit does not prove watertightness or motion continuity.'})
        a['armatures']=[]
        for ob in bpy.data.objects:
            if ob.type=='ARMATURE':
                a['armatures'].append({'object':ob.name,'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local),'length':b.length,'deform':b.use_deform,'connected':b.use_connect} for b in ob.data.bones]})
        a['animations']=[]
        for action in list(bpy.data.actions):
            channels=[]
            for layer in action.layers:
                for strip in layer.strips:
                    for cb in strip.channelbags:
                        for curve in cb.fcurves:
                            channels.append({'dataPath':curve.data_path,'arrayIndex':curve.array_index,'keys':len(curve.keyframe_points),
                                'keyValueRange':[min(k.co.y for k in curve.keyframe_points),max(k.co.y for k in curve.keyframe_points)] if len(curve.keyframe_points) else None})
            start,end=map(float,action.frame_range)
            a['animations'].append({'name':action.name,'frameRange':[start,end],'fps':bpy.context.scene.render.fps,
               'durationSeconds':(end-start)/bpy.context.scene.render.fps,'channelCount':len(channels),'channels':channels})
        a['sourcePoseSamples']=[]
        a['activeSourceActions']=[{'object':ob.name,'action':ob.animation_data.action.name if ob.animation_data.action else None} for ob in bpy.data.objects if ob.animation_data]
        a['poseSampleScope']='Evaluates imported active actions over union of clip frame ranges; not per-clip conversion fidelity or physiological validation.'
        start=min((x['frameRange'][0] for x in a['animations']),default=bpy.context.scene.frame_start)
        end=max((x['frameRange'][1] for x in a['animations']),default=bpy.context.scene.frame_end)
        for f in [start+(end-start)*i/8 for i in range(9)]:
            bpy.context.scene.frame_set(int(f),subframe=f-int(f)); dg=bpy.context.evaluated_depsgraph_get(); pts=[]
            for ob in bpy.data.objects:
                if ob.type!='MESH':continue
                eo=ob.evaluated_get(dg); me=eo.to_mesh()
                pts.extend(list(eo.matrix_world@v.co) for v in me.vertices);eo.to_mesh_clear()
            a['sourcePoseSamples'].append({'frame':f,'evaluatedWorldBounds':bounds(pts)})
        a['sourceRisks']=[]
        for mesh in a['meshes']:
            if mesh['topology']['boundaryEdges'] or mesh['topology']['nonManifoldEdges']:
                a['sourceRisks'].append({'object':mesh['object'],'risk':'SOURCE_OPEN_OR_NONMANIFOLD_TOPOLOGY','detail':mesh['topology'],'action':'Locate source boundaries before continuity acceptance; preserve source rather than filling or replacing.'})
            if mesh['weightSumRange'] and mesh['weightedVertices'] and (mesh['weightSumRange'][0]<.999 or mesh['weightSumRange'][1]>1.001):
                a['sourceRisks'].append({'object':mesh['object'],'risk':'ALL_GROUP_WEIGHT_SUM_NOT_ONE','detail':mesh['weightSumRange'],'action':'Separate actual deform groups from other rig groups and reproduce importer normalization; never truncate top-4 blindly.'})
            for mat in mesh['materials']:
                for im in mat['images']:
                    if not im['exists'] and not im['packed']:
                        a['sourceRisks'].append({'object':mesh['object'],'risk':'FBX_TEXTURE_PATH_UNRESOLVED','image':im['name'],'candidateMatches':len(im['archiveTextureMatches']),'action':'Relink only by hash-proven original texture; map semantics still require material fidelity check.'})
                    if len({t['sha256'] for t in im['archiveTextureMatches']})>1:
                        a['sourceRisks'].append({'object':mesh['object'],'risk':'SAME_TEXTURE_NAME_DIFFERENT_BYTES','image':im['name'],'actualImportedSha256':im['actualFileSha256'],'action':'Do not silently replace nested texture by outer download texture; record authoritative source lane.'})
        a['samplingEntryConditions']=['Biological species and license must be confirmed before public specimen naming or publication.',
           'Preserve all triangles, UVs, image identities, split normals, joint weights and rest transform in conversion receipt.',
           'Normalize measured longitudinal axis only after reference anatomy/rig inspection; do not guess from filename.',
           'Acquire exact bind surface and animation envelope before independent spine/fin parameterization.',
           'Verify converted source replay first; source replay is not a finished procedural body or gait.',
           'Manta requires ray-specific wing propulsion lane rather than barracuda axial-tail gait.' if 'manta' in label.lower() else 'Species-specific gait and schooling require separate research.']
        a['status']='SOURCE_AUDIT_COMPLETE_PENDING_CONVERSION_FIDELITY'
    except Exception as ex:a['status']='SPECIMEN_LOCAL_DECODER_BLOCKED';a['error']=str(ex);a['traceback']=traceback.format_exc()
    audits.append(a)
report={'taskId':'FISH_SPECIES_EXISTING_INTAKE_20261002','generatedAtUtc':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
 'blenderVersion':bpy.app.version_string,'mode':'HEADLESS_READ_ONLY_SOURCE_AUDIT','originalArchivesModified':False,
 'bluefinDiscovery':{'file':'G:/Three.js/sea/FISH2/bluefin-tuna.zip','actualNestedFormat':'glTF 2.0','nestedEntry':'source/animated_tuna__3d_animal_model.zip', 'contains':['license.txt','scene.gltf','scene.bin','textures/MI_FishEye_baseColor.png','textures/MI_Tuna_01_baseColor.png'],'handoff':'glTF intake lane'},
 'records':audits,'visualAcceptance':False,'motionAcceptance':False,'productionReady':False}
(ROOT/'evidence').mkdir(exist_ok=True)
(ROOT/'evidence'/'FBX_INTAKE_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('FBX_INTAKE_COMPLETE '+json.dumps([{'model':a['modelEntry'],'status':a['status'],'vertices':sum(m['vertices'] for m in a.get('meshes',[])),'triangles':sum(m['triangles'] for m in a.get('meshes',[])),'bones':sum(len(x['bones']) for x in a.get('armatures',[])),'actions':len(a.get('animations',[]))} for a in audits]))
