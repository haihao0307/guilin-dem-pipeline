import os
"""Refine only intersecting sampled spans in the private R10 study."""
import bpy, json, pathlib, time
from array import array
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])
head=bpy.data.objects['Head']; hair=bpy.data.objects['TEN24_R10_Hair']; data=hair.data
evaluated=head.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh=evaluated.to_mesh(); mesh.calc_loop_triangles()
bvh=BVHTree.FromPolygons([v.co.copy() for v in mesh.vertices],[tuple(t.vertices) for t in mesh.loop_triangles],all_triangles=True)
offsets=[x.value for x in data.curve_offset_data]
positions=array('f',[0])*(len(data.points)*3); data.position_data.foreach_get('vector',positions)
radii=array('f',[0])*len(data.points); data.attributes['radius'].data.foreach_get('value',radii)

def penetration(point,radius):
    close,normal,_,distance=bvh.find_nearest(point)
    gap=(point-close).dot(normal)-radius
    return (point.y>.20 or distance<.025) and gap<-.00001, close,normal,gap

def refine(p0,r0,p1,r1,depth=0):
    midpoint=(p0+p1)*.5; radius=(r0+r1)*.5
    inside,close,normal,gap=penetration(midpoint,radius)
    if not inside: return [(p1,r1)]
    if depth>=10: return [(p1,r1)]
    corrected=midpoint.copy()
    for i in range(6):
        inside,close,normal,gap=penetration(corrected,radius)
        if not inside: break
        corrected=close+normal*(radius+.000075)
    return refine(p0,r0,corrected,radius,depth+1)+refine(corrected,radius,p1,r1,depth+1)

out_positions=array('f'); out_radii=array('f'); sizes=[]; changed=0; deep_repaired=0; started=time.time()
for start,end in zip(offsets,offsets[1:]):
    points=[(Vector(positions[i*3:(i+1)*3]),radii[i]) for i in range(start,end)]
    for point,radius in points:
        for attempt in range(6):
            inside,close,normal,gap=penetration(point,radius)
            if not inside: break
            point[:]=close+normal*(radius+.000075)
            deep_repaired+=1
    new=[points[0]]
    for before,after in zip(points,points[1:]): new.extend(refine(*before,*after))
    if len(new)!=len(points): changed+=1
    sizes.append(len(new))
    for position,radius in new: out_positions.extend(position); out_radii.append(radius)
evaluated.to_mesh_clear()
data.resize_curves(sizes)
data.position_data.foreach_set('vector',out_positions)
data.attributes['radius'].data.foreach_set('value',out_radii)
# Native default curve type is Catmull-Rom
data.update_tag(); hair.update_tag(); bpy.context.view_layer.update()
record={'parent':'TEN24 Groom R10','revision':'R11 span refinement','before_points':len(positions)//3,'after_points':len(data.points),'changed_curves':changed,'deep_control_point_repairs':deep_repaired,'max_points':max(sizes),'seconds':time.time()-started,'scope':'all head points above local y=0.20 and near lower-skin points, adaptive midpoint sampling and one-way outward correction; not inter-hair physics or continuous spline collision proof'}
(ROOT/'reports/ten24-midpoint-repair-r11.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
result=record

"""Resolve remaining sampled point/span contacts without editing the head."""
import bpy,json,pathlib,time
from array import array
from mathutils import Vector
from mathutils.bvhtree import BVHTree

head=bpy.data.objects['Head']; hair=bpy.data.objects['TEN24_R10_Hair']; data=hair.data
evaluated=head.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh=evaluated.to_mesh(); mesh.calc_loop_triangles()
bvh=BVHTree.FromPolygons([v.co for v in mesh.vertices],[tuple(t.vertices) for t in mesh.loop_triangles],all_triangles=True)
offsets=[o.value for o in data.curve_offset_data]
positions=[p.vector.copy() for p in data.position_data]; radii=[r.value for r in data.attributes['radius'].data]

def contact(p,r):
    q,n,_,distance=bvh.find_nearest(p); gap=(p-q).dot(n)-r
    return (p.y>.20 or distance<.025) and gap<-.00001,q,n,gap

active=[]
def has_contact(start,end):
    return any(contact(positions[i],radii[i])[0] for i in range(start,end)) or any(contact((positions[i-1]+positions[i])*.5,(radii[i-1]+radii[i])*.5)[0] for i in range(start+1,end))
for strand,(start,end) in enumerate(zip(offsets,offsets[1:])):
    if has_contact(start,end): active.append(strand)
initial_count=len(active)
max_shift=0;changes=0;history=[]
for sweep in range(30):
    unresolved=[]
    for strand in active:
        start,end=offsets[strand:strand+2]
        for i in range(start+1,end):
            for point_index in (i-1,i):
                inside,q,n,gap=contact(positions[point_index],radii[point_index])
                if inside:
                    delta=n*(.00025-gap);positions[point_index]+=delta;max_shift=max(max_shift,delta.length);changes+=1
            mid=(positions[i-1]+positions[i])*.5;radius=(radii[i-1]+radii[i])*.5
            inside,q,n,gap=contact(mid,radius)
            if inside:
                delta=n*(.00025-gap);max_shift=max(max_shift,delta.length);changes+=1
                if i-1==start: positions[i]+=delta*2
                else: positions[i-1]+=delta; positions[i]+=delta
        if has_contact(start,end): unresolved.append(strand)
    history.append({'sweep':sweep,'remaining_curves':len(unresolved)})
    active=unresolved
    if not active:break
flat=array('f',(component for p in positions for component in p))
data.position_data.foreach_set('vector',flat); data.update_tag();hair.update_tag();bpy.context.view_layer.update(); evaluated.to_mesh_clear()
result={'affected_curves_initial':initial_count,'remaining_curves':len(active),'changes':changes,'max_local_shift':max_shift,'history':history,'scope':'independent R11 clearance relaxation; small endpoint corrections change adapted guide shape; no dynamics'}
(pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])/'reports'/'contact-relaxation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')

bpy.ops.wm.save_as_mainfile(filepath=str(pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])/'work-r10'/'TEN24_Groom_R11_Rebuilt.blend'),relative_remap=False,check_existing=False)
