import os
"""Export evaluated original geometry into a PRIVATE runtime folder. No decimation."""
import bpy,numpy as np,pathlib,json,hashlib,shutil,gc
OUT=pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])/'runtime';OUT.mkdir(exist_ok=True)
DG=bpy.context.evaluated_depsgraph_get();records=[]
for name in ['Head','Eye Wet','Lens Left','Lens Right','Realtime Eyeball Left','Realtime Eyeball Right','Teeth','Tongue','Lashes','Brows']:
 o=bpy.data.objects[name];ev=o.evaluated_get(DG);m=ev.to_mesh(preserve_all_data_layers=True,depsgraph=DG);m.calc_loop_triangles()
 p=np.empty(len(m.vertices)*3,np.float32);m.vertices.foreach_get('co',p);p=p.reshape(-1,3)
 v=np.empty(len(m.loops),np.int32);m.loops.foreach_get('vertex_index',v)
 n=np.empty(len(m.corner_normals)*3,np.float32);m.corner_normals.foreach_get('vector',n);n=n.reshape(-1,3)
 uv=np.zeros((len(m.loops),2),np.float32)
 if m.uv_layers.active:m.uv_layers.active.data.foreach_get('uv',uv.reshape(-1))
 # Unique only byte-identical position, normal and UV tuples; no changed vertex positions.
 a=np.concatenate((p[v],n,uv),axis=1);unique,index=np.unique(a.view(np.dtype((np.void,a.dtype.itemsize*8))).ravel(),return_inverse=True);vertex=unique.view(np.float32).reshape(-1,8)
 loops=np.empty(len(m.loop_triangles)*3,np.int32);m.loop_triangles.foreach_get('loops',loops);indices=index[loops].astype(np.uint32)
 file=name.replace(' ','_')+'.bin';dest=OUT/file
 with dest.open('wb')as f:f.write(vertex.tobytes());f.write(indices.tobytes())
 records.append({'name':name,'file':file,'vertices':len(vertex),'triangles':len(indices)//3,'vertexBytes':int(vertex.nbytes),'indexCount':int(indices.size),'matrix':[list(r)for r in o.matrix_world],'materials':[x.name for x in o.data.materials],'source_vertices':len(o.data.vertices),'source_faces':len(o.data.polygons),'subdivision':[(x.levels,x.render_levels)for x in o.modifiers if x.type=='SUBSURF'],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
 print('EXPORTED',name,records[-1]['vertices'],records[-1]['triangles'],dest.stat().st_size,flush=True)
 ev.to_mesh_clear();del p,v,n,uv,a,unique,index,vertex,indices,loops;gc.collect()
hair=bpy.data.objects.get('TEN24_R10_Hair')
if hair:
 c=hair.evaluated_get(DG).data;points=np.empty(len(c.points)*3,np.float32);c.position_data.foreach_get('vector',points);r=np.empty(len(c.points),np.float32);c.attributes['radius'].data.foreach_get('value',r);offset=np.array([x.value for x in c.curve_offset_data],np.uint32)
 with (OUT/'groom.bin').open('wb')as f:f.write(points.tobytes());f.write(r.tobytes());f.write(offset.tobytes())
 groom={'file':'groom.bin','sha256':hashlib.sha256((OUT/'groom.bin').read_bytes()).hexdigest(),'points':len(c.points),'curves':len(c.curves),'matrix':[list(row)for row in hair.matrix_world],'source':'Private R11 rebuilt from historical teacher retarget; finite-radius points/midpoints checked, not continuous spline collision'}
else:groom=None
meta={'schema':'kaopu-private-original-v1','sourceBlendSHA256':'7e069f5508aaaf53f8ea0ce560741b54b5ddbc2e90128141c6c94edd22bd54a9','geometry':'evaluated original subdivision 2, byte-exact tuple merge only, no decimation','blender':bpy.app.version_string,'meshes':records,'groom':groom,'redistribution':False,'appearance_equivalent':False}
(OUT/'runtime.json').write_text(json.dumps(meta,indent=2))
print('EXPORT_DONE',flush=True)
