import os
"""Private R10 study: retarget retained teacher guides onto full TEN24 scalp.

No original mesh/material edits. Original files are never overwritten.
Guide shapes are the existing GNM adaptation of Daniel Bystedt, then retargeted
again here; this is not a literal original Geometry Nodes reproduction.
"""
import bpy, bisect, hashlib, json, math, pathlib, random, time
from array import array
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT=pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])
PRIVATE=pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])
OUT=PRIVATE/'work-r10'
SOURCE=pathlib.Path(os.environ['TEN24_GROOM_DATA'])
REPORT=ROOT/'reports/ten24-groom-r10.json'
COUNT=14000
SCALE=Vector((1.13,1.0,1.05))
SHIFT=Vector((0,-0.011,-0.006))
RADIUS=0.000037*1.13

def mapped(point): return Vector([point[k]*SCALE[k]+SHIFT[k] for k in range(3)])
def safe(point):
    x,y,z=[(point[k]-SHIFT[k])/SCALE[k] for k in range(3)]
    front=max(0,min(1,(z-.025)/.08))
    line=.273+front*.074+max(0,abs(x)-.05)*.2+.0025*math.sin(abs(x)*52)*front
    return min(y-line,max(.073-abs(x),y-.316,-.022-z))>.00015

def node_group(name):
    group=bpy.data.node_groups.new(name,'GeometryNodeTree')
    group.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry')
    group.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
    return group,group.nodes.new('NodeGroupInput'),group.nodes.new('NodeGroupOutput')

def build():
    started=time.time()
    for im in bpy.data.images:
        if im.source=="FILE": im.filepath=str((PRIVATE/"original"/"Blender"/im.filepath.replace("\\","/").removeprefix("//")).resolve())
    if bpy.data.objects.get('TEN24_R10_Hair'): raise ValueError('R10 already exists; refusing duplicate build')
    if 'original/Blender/Blender Scene.blend' not in bpy.data.filepath.replace('\\','/'):
        raise ValueError('Run only in verified original isolated scene')
    OUT.mkdir(exist_ok=True)
    destination=OUT/'TEN24_Groom_R10.blend'
    if destination.exists(): raise ValueError('Refusing to overwrite a study')
    head=bpy.data.objects['Head']
    original_signature=[(obj.name,len(obj.data.vertices),len(obj.data.polygons),[(m.name,getattr(m,'levels',None),getattr(m,'render_levels',None)) for m in obj.modifiers]) for obj in bpy.context.scene.objects if obj.type=='MESH']
    original_render={'samples':bpy.context.scene.cycles.samples,'resolution':[bpy.context.scene.render.resolution_x,bpy.context.scene.render.resolution_y,bpy.context.scene.render.resolution_percentage]}
    data=json.loads(SOURCE.read_text(encoding='utf-8').split('export default ',1)[1].strip().rstrip(';'))
    # Use the complete evaluated Head at its unchanged original subdivision 2.
    bpy.context.view_layer.update()
    evaluated=head.evaluated_get(bpy.context.evaluated_depsgraph_get())
    skin=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
    skin.calc_loop_triangles()
    vertices=[v.co.copy() for v in skin.vertices]
    tris=[tuple(t.vertices) for t in skin.loop_triangles]
    uv_data=skin.uv_layers['DiffuseUV'].data
    all_bvh=BVHTree.FromPolygons(vertices,tris,all_triangles=True)
    selected=[]; areas=[]; cumulative=0
    for index,tri in enumerate(tris):
        a,b,c=[vertices[i] for i in tri]
        center=(a+b+c)/3
        if not safe(center): continue
        area=(b-a).cross(c-a).length/2
        if area<1e-14: continue
        selected.append(index); cumulative+=area; areas.append(cumulative)
    scalp_bvh=BVHTree.FromPolygons(vertices,[tris[i] for i in selected],all_triangles=True)
    guides=[]
    for family in ('main','independent'):
        for source in data['groups'][family]:
            root,normal,face,distance=scalp_bvh.find_nearest(mapped(source['root']))
            if root is None: raise ValueError('Root projection failed')
            shift=root-mapped(source['root'])
            points=[mapped(p)+shift for p in source['points']]
            guides.append({'family':family,'island':source['island'],'root':root,'points':points,'distance':distance,'sourceId':source['sourceId']})
    trees={}
    for key in {(g['family'],g['island']) for g in guides}:
        ids=[i for i,g in enumerate(guides) if (g['family'],g['island'])==key]
        tree=KDTree(len(ids))
        for i in ids: tree.insert(guides[i]['root'],i)
        tree.balance(); trees[key]=tree
    nearest_tree=KDTree(len(guides))
    for i,g in enumerate(guides): nearest_tree.insert(g['root'],i)
    nearest_tree.balance()
    rng=random.Random(724); positions=array('f'); radii=array('f'); attachment_uv=array('f'); random_values=array('f'); source_ids=array('i')
    root_distances=[]; correction_max=0; correction_count=0; residual_inside=0
    sizes=[]
    for strand in range(COUNT):
        if strand<len(guides):
            primary=strand; root=guides[primary]['root']; neighbors=[(primary,1.0)]
            _,normal,_,_=all_bvh.find_nearest(root)
        else:
            for attempt in range(100):
                face=selected[min(len(selected)-1,bisect.bisect_left(areas,rng.random()*cumulative))]
                tri=tris[face]; u=math.sqrt(rng.random()); v=rng.random()
                root=vertices[tri[0]]*(1-u)+vertices[tri[1]]*(u*(1-v))+vertices[tri[2]]*(u*v)
                if safe(root): break
            else: raise ValueError('Safe scalp sampling failed')
            _,primary,_=nearest_tree.find(root)
            g=guides[primary]
            nearest=trees[(g['family'],g['island'])].find_n(root,3)
            weights=[1/max(item[2]**2,2e-8) for item in nearest]; total=sum(weights)
            neighbors=[(item[1],w/total) for item,w in zip(nearest,weights)]
            _,normal,_,_=all_bvh.find_nearest(root)
        # UV is computed on the complete evaluated mesh; it is also the rest
        # surface for the native Deform Curves node, so original UV smoothing
        # on Head remains unchanged.
        nearest,_,face,dist=all_bvh.find_nearest(root)
        tri=tris[face]; a,b,c=[vertices[i] for i in tri]
        e0=b-a; e1=c-a; ep=nearest-a
        d00=e0.dot(e0); d01=e0.dot(e1); d11=e1.dot(e1); d20=ep.dot(e0); d21=ep.dot(e1)
        denom=d00*d11-d01*d01
        if abs(denom)<1e-20: raise ValueError('Degenerate UV attachment triangle')
        bv=(d11*d20-d01*d21)/denom; bw=(d00*d21-d01*d20)/denom; ba=1-bv-bw
        loops=skin.loop_triangles[face].loops
        uv=uv_data[loops[0]].uv*ba+uv_data[loops[1]].uv*bv+uv_data[loops[2]].uv*bw
        attachment_uv.extend(uv); random_values.append(rng.random()); source_ids.append(primary)
        source_radius=RADIUS*(.78+.42*rng.random())
        point_count=33; sizes.append(point_count)
        for j in range(point_count):
            fraction=j/(point_count-1)
            point=root.copy()
            for guide_index,weight in neighbors:
                guide=guides[guide_index]
                point+=(guide['points'][j]-guide['root'])*weight
            # Initial child fibres follow the retained source islands. Very
            # small tapering offset is aesthetic variation, not source physics.
            if strand>=len(guides):
                phase=random_values[-1]*math.tau
                point+=Vector((math.cos(phase+j*.21),0,math.sin(phase+j*.21)))*(.00018*math.sin(fraction*math.pi))
            radius=source_radius*max(.06,1-fraction)
            for repair in range(3):
                closest,n,_,distance=all_bvh.find_nearest(point)
                gap=(point-closest).dot(n)
                if distance<.025 and gap<radius+.00006:
                    correction=n*(radius+.00006-gap)
                    point+=correction; correction_max=max(correction_max,correction.length); correction_count+=1
                else: break
            closest,n,_,distance=all_bvh.find_nearest(point)
            gap=(point-closest).dot(n)
            if distance<.025 and gap<radius-.00001: residual_inside+=1
            if j==0: root_distances.append(distance)
            positions.extend(point); radii.append(radius)
        if strand%3000==0: print('TEN24_R10_BUILD',strand,flush=True)
    collection=bpy.data.collections.new('TEN24_R10_Independent_Study')
    bpy.context.scene.collection.children.link(collection)
    attachment=bpy.data.objects.new('TEN24_R10_AttachmentSurface',skin)
    collection.objects.link(attachment); attachment.parent=head; attachment.hide_render=True; attachment.hide_set(True)
    group,input_node,output_node=node_group('TEN24_R10_Full_Head_Surface')
    info=group.nodes.new('GeometryNodeObjectInfo'); info.inputs['Object'].default_value=head; info.transform_space='RELATIVE'
    transform=group.nodes.new('GeometryNodeTransform'); transform.label='Attachment verification offset; keep zero'
    group.links.new(info.outputs['Geometry'],transform.inputs['Geometry'])
    # Feed stable rest coordinates from the full evaluated rest mesh by index.
    # This avoids changing any original Head modifiers, UV smoothing or data.
    rest=group.nodes.new('GeometryNodeSampleIndex'); rest.data_type='FLOAT_VECTOR'; rest.domain='POINT'
    rest_position=group.nodes.new('GeometryNodeInputPosition')
    index_node=group.nodes.new('GeometryNodeInputIndex')
    store=group.nodes.new('GeometryNodeStoreNamedAttribute'); store.data_type='FLOAT_VECTOR'; store.domain='POINT'; store.inputs['Name'].default_value='rest_position'
    group.links.new(input_node.outputs['Geometry'],rest.inputs['Geometry'])
    group.links.new(rest_position.outputs['Position'],rest.inputs['Value'])
    group.links.new(index_node.outputs['Index'],rest.inputs['Index'])
    group.links.new(transform.outputs['Geometry'],store.inputs['Geometry'])
    group.links.new(rest.outputs['Value'],store.inputs['Value'])
    group.links.new(store.outputs['Geometry'],output_node.inputs['Geometry'])
    modifier=attachment.modifiers.new('Full original evaluated Head','NODES'); modifier.node_group=group
    curves=bpy.data.hair_curves.new('TEN24_R10_Teacher_Curves')
    curves.add_curves(sizes); curves.position_data.foreach_set('vector',positions) # Curves without curve_type attribute use native Catmull-Rom (0).
    curves.attributes.new('radius','FLOAT','POINT').data.foreach_set('value',radii)
    curves.attributes.new('surface_uv_coordinate','FLOAT2','CURVE').data.foreach_set('vector',attachment_uv)
    curves.attributes.new('r10_random','FLOAT','CURVE').data.foreach_set('value',random_values)
    curves.attributes.new('r10_source_guide','INT','CURVE').data.foreach_set('value',source_ids)
    curves.surface=attachment; curves.surface_uv_map='DiffuseUV'; curves.use_sculpt_collision=True
    if hasattr(curves,"surface_collision_distance"): curves.surface_collision_distance=.0001
    hair=bpy.data.objects.new('TEN24_R10_Hair',curves); collection.objects.link(hair); hair.parent=head
    hair['source']='Daniel Bystedt / existing GNM-adapted guides / new TEN24 retarget'
    hair['license']='CC BY-SA (source version unspecified); restricted TEN24 host, private study'
    hair['state']='R10 private binding study; visual acceptance and full physics pending'
    material=bpy.data.materials.new('TEN24_R10_Hair_Material'); material.use_nodes=True
    hair_shader=material.node_tree.nodes.new('ShaderNodeBsdfHairPrincipled'); hair_shader.parametrization='COLOR'; hair_shader.inputs['Color'].default_value=(.038,.020,.009,1); hair_shader.inputs['Roughness'].default_value=.36
    material_output=next((n for n in material.node_tree.nodes if n.type=='OUTPUT_MATERIAL'),None)
    if material_output is None: material_output=material.node_tree.nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(hair_shader.outputs[0],material_output.inputs['Surface'])
    curves.materials.append(material)
    group,input_node,output_node=node_group('TEN24_R10_Groom_Controls')
    sockets={}
    for name,value,lo,hi in [('Length',1.0,.05,1.0),('Density',1.0,.01,1.0),('Width',1.0,.25,3.0)]:
        socket=group.interface.new_socket(name=name,in_out='INPUT',socket_type='NodeSocketFloat'); socket.default_value=value; socket.min_value=lo; socket.max_value=hi; sockets[name]=socket.identifier
    deform=group.nodes.new('GeometryNodeDeformCurvesOnSurface')
    trim=group.nodes.new('GeometryNodeTrimCurve'); trim.mode='FACTOR'
    delete=group.nodes.new('GeometryNodeDeleteGeometry'); delete.domain='CURVE'
    attr=group.nodes.new('GeometryNodeInputNamedAttribute'); attr.data_type='FLOAT'; attr.inputs['Name'].default_value='r10_random'
    compare=group.nodes.new('FunctionNodeCompare'); compare.data_type='FLOAT'; compare.operation='GREATER_THAN'
    radius_attr=group.nodes.new('GeometryNodeInputNamedAttribute'); radius_attr.data_type='FLOAT'; radius_attr.inputs['Name'].default_value='radius'
    multiply=group.nodes.new('ShaderNodeMath'); multiply.operation='MULTIPLY'
    set_radius=group.nodes.new('GeometryNodeSetCurveRadius')
    link=group.links.new
    link(input_node.outputs['Geometry'],deform.inputs['Curves']); link(deform.outputs['Curves'],trim.inputs['Curve']); link(input_node.outputs['Length'],trim.inputs['End'])
    link(trim.outputs['Curve'],delete.inputs['Geometry']); link(attr.outputs['Attribute'],compare.inputs[0]); link(input_node.outputs['Density'],compare.inputs[1]); link(compare.outputs['Result'],delete.inputs['Selection'])
    link(delete.outputs['Geometry'],set_radius.inputs['Curve']); link(radius_attr.outputs['Attribute'],multiply.inputs[0]); link(input_node.outputs['Width'],multiply.inputs[1]); link(multiply.outputs[0],set_radius.inputs['Radius']); link(set_radius.outputs['Curve'],output_node.inputs['Geometry'])
    modifier=hair.modifiers.new('R10 Length Density Width','NODES'); modifier.node_group=group
    # 5.2 exposes Geometry Nodes modifier inputs through RNA, rather than the
    # legacy modifier ID-property mapping. New inputs inherit socket defaults.
    for i,node in enumerate(group.nodes): node.location=(i*180,0)
    # Equivalent absolute relocation only; original image bytes and color spaces
    # remain untouched when saving the private work copy elsewhere.
    paths=[]
    for image in bpy.data.images:
        if image.source=='FILE':
            absolute=bpy.path.abspath(image.filepath); paths.append({'name':image.name,'original':image.filepath,'absolute':absolute}); image.filepath=absolute
    for obj in bpy.context.selected_objects: obj.select_set(False)
    hair.select_set(True); bpy.context.view_layer.objects.active=hair
    bpy.context.view_layer.update()
    evaluated_hair=hair.evaluated_get(bpy.context.evaluated_depsgraph_get())
    record={'version':'TEN24 Groom R10 private study','blender':bpy.app.version_string,'file':str(destination),'source_guides':len(guides),'curves':len(curves.curves),'points':len(curves.points),
        'evaluated_curves':len(evaluated_hair.data.curves),'evaluated_points':len(evaluated_hair.data.points),
        'registration':{'scale':list(SCALE),'shift':list(SHIFT),'status':'heuristic cranium registration; scalp mask adapted from R9, not accepted female anatomy'},
        'original_signature':original_signature,'original_render':original_render,'surface_vertices':len(vertices),'surface_triangles':len(tris),'scalp_triangles':len(selected),
        'root_projection_mean':sum(g['distance'] for g in guides)/len(guides),'root_projection_max':max(g['distance'] for g in guides),
        'root_gap_max':max(root_distances),'point_collision_repairs':correction_count,'max_collision_correction':correction_max,'residual_point_contacts':residual_inside,
        'controls':sockets,'texture_relocation':paths,'source_guides_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'original_file_overwritten':False,'original_male_cases_modified':False,'uploaded':False,'visual_accepted':False,'continuous_capsule_collision_verified':False,'dynamics_implemented':False,'seconds':time.time()-started}
    REPORT.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(destination),relative_remap=False,check_existing=False)
    print('TEN24_R10_PRIVATE_STUDY_SAVED',str(destination),flush=True)
    return {'file':str(destination),'curves':len(curves.curves),'seconds':time.time()-started}

result=build()
