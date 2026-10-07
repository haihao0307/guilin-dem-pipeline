import os
import bpy,json,pathlib
root=pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])/'original'
images=[]
for im in bpy.data.images:
 if im.source=='FILE':
  orig=im.filepath
  p=(root/'Blender'/orig.replace('\\','/').removeprefix('//')).resolve()
  im.filepath=str(p);images.append({'name':im.name,'path':str(p),'exists':p.exists(),'colorspace':im.colorspace_settings.name})
materials=[]
for m in bpy.data.materials:
 if not m.use_nodes:continue
 nodes=[]
 for n in m.node_tree.nodes:
  ins={}
  for i in n.inputs:
   if hasattr(i,'default_value'):
    try:ins[i.name]=list(i.default_value)
    except TypeError:ins[i.name]=i.default_value if isinstance(i.default_value,(int,float,str,bool)) else str(i.default_value)
  nodes.append({'name':n.name,'type':n.bl_idname,'inputs':ins,'image':getattr(getattr(n,'image',None),'name',None)})
 materials.append({'name':m.name,'nodes':nodes,'links':[[l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name]for l in m.node_tree.links]})
report={'version':bpy.app.version_string,'meshes':[{'name':o.name,'verts':len(o.data.vertices),'faces':len(o.data.polygons),'subs':[(m.levels,m.render_levels)for m in o.modifiers if m.type=='SUBSURF']}for o in bpy.data.objects if o.type=='MESH'],'images':images,'materials':materials,'cameras':[(o.name,list(o.location),list(o.rotation_euler))for o in bpy.data.objects if o.type=='CAMERA']}
(pathlib.Path(os.environ['TEN24_PRIVATE_ROOT'])/'reports'/'scene-inspection.json').write_text(json.dumps(report,indent=2))
print('INSPECTION_DONE',flush=True)
