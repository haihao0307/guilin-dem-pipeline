import os
import bpy,pathlib,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
h=bpy.data.objects['TEN24_R10_Hair'];d=h.data;o=bpy.data.objects['Head'];ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();m.calc_loop_triangles();tree=BVHTree.FromPolygons([v.co for v in m.vertices],[tuple(t.vertices)for t in m.loop_triangles],all_triangles=True)
points=[p.vector.copy()for p in d.position_data];radii=[p.value for p in d.attributes['radius'].data];off=[x.value for x in d.curve_offset_data];reject=[]
for c,(s,e)in enumerate(zip(off,off[1:])):
 bad=[]
 for i in range(s+1,e):
  mid=(points[i-1]+points[i])*.5;q,n,_,dist=tree.find_nearest(mid);gap=(mid-q).dot(n)-(radii[i-1]+radii[i])*.5
  if (mid.y>.2 or dist<.025) and gap<-.00001:bad.append({'segment':i-s,'gap':gap})
 if bad:reject.append({'curve':c,'contacts':bad,'generated_child':c>=376})
if any(not x['generated_child']for x in reject):raise RuntimeError('Original guide affected; refusing removal')
if len(reject)>2:raise RuntimeError('Unexpected rejection count')
d.remove_curves(indices=[x['curve']for x in reject]);h.update_tag();bpy.context.view_layer.update();(pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])/'reports'/'root-rejections.json').write_text(json.dumps(reject,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])/'work-r10'/'TEN24_Groom_R11_Verified.blend'),relative_remap=False,check_existing=False)
