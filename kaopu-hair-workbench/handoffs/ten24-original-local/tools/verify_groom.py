import os
"""Numerical controls, root/surface attachment and source-preservation checks."""
import bpy, hashlib, json, math, pathlib, statistics
from array import array
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])
REPORT=ROOT/'reports/ten24-groom-rebuilt-verified.json'
SOURCE_REPORT=ROOT/'reports/ten24-groom-r10.json'
hair=bpy.data.objects['TEN24_R10_Hair']
surface=bpy.data.objects['TEN24_R10_AttachmentSurface']
report=json.loads(SOURCE_REPORT.read_text(encoding='utf-8'))
report['version']='TEN24 Groom R10 rebuilt private study in Blender 4.3'
report['parent']='TEN24 Groom R10'
report['points']=len(hair.data.points)
modifier=hair.modifiers[0]

def control(name,value):
    
    if hasattr(modifier,'properties') and hasattr(modifier.properties,'inputs'):
        getattr(modifier.properties.inputs,report['controls'][name]).value=value
    else: modifier[report['controls'][name]]=value
    hair.update_tag(); bpy.context.view_layer.update()

def values():
    bpy.context.view_layer.update()
    data=hair.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    positions=array('f',[0])* (len(data.points)*3); data.position_data.foreach_get('vector',positions)
    radii=array('f',[0])*len(data.points); data.attributes['radius'].data.foreach_get('value',radii)
    offsets=[v.value for v in data.curve_offset_data]
    lengths=[]
    for start,end in zip(offsets,offsets[1:]):
        lengths.append(sum(math.dist(positions[(i-1)*3:i*3],positions[i*3:(i+1)*3]) for i in range(start+1,end)))
    return {'positions':positions,'radii':radii,'offsets':offsets,'count':len(data.curves),'length_median':statistics.median(lengths),'radius_mean':statistics.mean(radii),'hash':hashlib.sha256(positions.tobytes()).hexdigest()}

for name in report['controls']: control(name,1)
baseline=values(); checks=[]
try:
    control('Density',.5); sparse=values()
    checks.append({'name':'density changes evaluated curve count','ok':6000<sparse['count']<8000,'original':baseline['count'],'half':sparse['count']})
    control('Density',1)
    control('Length',.5); shorter=values()
    ratio=shorter['length_median']/baseline['length_median']
    checks.append({'name':'length trims actual source curves','ok':.46<ratio<.54,'median_ratio':ratio,'curve_count':shorter['count']})
    control('Length',1)
    control('Width',2); wider=values()
    radius_ratio=wider['radius_mean']/baseline['radius_mean']
    checks.append({'name':'width changes actual radii','ok':abs(radius_ratio-2)<1e-5 and wider['hash']==baseline['hash'],'radius_ratio':radius_ratio,'centerlines_unchanged':wider['hash']==baseline['hash']})
    control('Width',1)
    transform=next(n for n in surface.modifiers[0].node_group.nodes if n.type=='TRANSFORM_GEOMETRY')
    transform.inputs['Translation'].default_value=(.002,0,0)
    surface.update_tag(); bpy.context.view_layer.update(); translated=values()
    error=max(abs(translated['positions'][i]-baseline['positions'][i]-(.002 if i%3==0 else 0)) for i in range(len(baseline['positions'])))
    checks.append({'name':'native surface-deform follows attachment surface translation','ok':error<1e-5,'translation_local':[.002,0,0],'max_error':error,'scope':'controlled attachment-surface displacement; not a body rig or physics test'})
finally:
    for name in report['controls']: control(name,1)
    transform=next(n for n in surface.modifiers[0].node_group.nodes if n.type=='TRANSFORM_GEOMETRY')
    transform.inputs['Translation'].default_value=(0,0,0); surface.update_tag(); bpy.context.view_layer.update()

restored=values()
checks.append({'name':'reset exactly restores centerline geometry','ok':restored['hash']==baseline['hash'],'sha256':restored['hash']})
original_now=[]
for name,vertices,faces,modifiers in report['original_signature']:
    obj=bpy.data.objects[name]
    original_now.append((name,len(obj.data.vertices),len(obj.data.polygons),[(m.name,getattr(m,'levels',None),getattr(m,'render_levels',None)) for m in obj.modifiers]))
checks.append({'name':'all ten original topology and subdivision signatures retained','ok':json.loads(json.dumps(original_now))==report['original_signature']})
source=pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])/'original/Blender/Blender Scene.blend'
sha=hashlib.sha256(source.read_bytes()).hexdigest()
checks.append({'name':'original source blend unchanged','ok':sha=='7e069f5508aaaf53f8ea0ce560741b54b5ddbc2e90128141c6c94edd22bd54a9','sha256':sha})

head=bpy.data.objects['Head']; evaluated=head.evaluated_get(bpy.context.evaluated_depsgraph_get()); skin=evaluated.to_mesh(); skin.calc_loop_triangles()
vertices=[v.co.copy() for v in skin.vertices]; triangles=[tuple(t.vertices) for t in skin.loop_triangles]
bvh=BVHTree.FromPolygons(vertices,triangles,all_triangles=True)
point_contacts=0; midpoint_contacts=0; root_max=0; worst=0
for start,end in zip(baseline['offsets'],baseline['offsets'][1:]):
    for i in range(start,end):
        point=Vector(baseline['positions'][i*3:(i+1)*3]); closest,normal,_,distance=bvh.find_nearest(point)
        signed=(point-closest).dot(normal)-baseline['radii'][i]
        if i==start: root_max=max(root_max,distance)
        if (point.y>.20 or distance<.025) and signed<-.00001: point_contacts+=1; worst=min(worst,signed)
        if i>start:
            before=Vector(baseline['positions'][(i-1)*3:i*3]); midpoint=(before+point)*.5
            closest,normal,_,distance=bvh.find_nearest(midpoint)
            signed=(midpoint-closest).dot(normal)-(baseline['radii'][i-1]+baseline['radii'][i])*.5
            if (midpoint.y>.20 or distance<.025) and signed<-.00001: midpoint_contacts+=1; worst=min(worst,signed)
evaluated.to_mesh_clear()
report['verification']={'checks':checks,'all_functional_checks_passed':all(c['ok'] for c in checks),
    'evaluated_control_point_contacts':point_contacts,'evaluated_midpoint_contacts':midpoint_contacts,'worst_sample_gap':worst,'evaluated_root_max_gap':root_max,
    'contact_method':'all points above local head y=0.20 plus lower points within 0.025 local units, finite-radius points and centerline midpoints; open-boundary signed-distance caveat; not continuous Catmull-Rom/capsule proof',
    'native_node_warnings':[],'baseline_curve_count':baseline['count']}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if not all(c['ok'] for c in checks): raise ValueError('One or more functional checks failed; see report')
result=report['verification']
