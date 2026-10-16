import bpy,json,os,sys
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=root+'/delivery/bureau-r03-inspection.glb')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];verts=sum(len(o.data.vertices) for o in meshes);faces=sum(len(o.data.polygons) for o in meshes)
assert len(meshes)>200 and verts>100000 and faces>300000
receipt={'format':'glTF 2.0 binary','importer':'Blender built-in glTF','success':True,'objects':len(bpy.context.scene.objects),'meshObjects':len(meshes),'vertices':verts,'faces':faces,'boundary':'GLB uses inspection PBR factors, not runtime procedural shader leaves'}
json.dump(receipt,open(root+'/evidence/glb-import-receipt.json','w'),indent=2);print(receipt)
