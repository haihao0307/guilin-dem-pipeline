import bpy,json,math,sys
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
source=args[0] if args else "/tmp/r16-evaluated-geometry-proof.json"
output=args[1] if len(args)>1 else "/tmp/r16-offline-geometry-proof.png"
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
d=json.load(open(source))
for i,r in enumerate(d['batches']):
 me=bpy.data.meshes.new(r['name'] or 'mesh');p=r['positions'];me.from_pydata(list(zip(p[::3],p[1::3],p[2::3])),[],r['faces']);me.update();o=bpy.data.objects.new(r['name'] or 'mesh',me);bpy.context.collection.objects.link(o)
 m=bpy.data.materials.new('base-'+str(i));m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*r['color'],1);bs.inputs['Roughness'].default_value=r['roughness'];bs.inputs['Metallic'].default_value=r['metalness'];bs.inputs['Emission Color'].default_value=(*r['emissive'],1);bs.inputs['Emission Strength'].default_value=min(.7,r['emissiveIntensity']);o.data.materials.append(m)
 if r.get('colors'):
  attr=me.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT');attr.data.foreach_set('color',r['colors']);node=m.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Col';m.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
# Rail context is a procedural QA indicator, not an imported terrain or game asset.
for y in (-.7175,.7175):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(-7,y,.34));o=bpy.context.object;o.scale=(58,.07,.08)
for x in range(-35,27):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x*.7,0,.19));o=bpy.context.object;o.scale=(.2,2.6,.13)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.07));o=bpy.context.object;m=bpy.data.materials.new('qa-ground');m.diffuse_color=(.19,.20,.17,1);o.data.materials.append(m)
world=bpy.data.worlds.new('soft-overcast') if not bpy.data.worlds else bpy.data.worlds[0];bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.64,.69,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.light_add(type='AREA',location=(5,-10,28));key=bpy.context.object;key.data.energy=1700;key.data.shape='DISK';key.data.size=18;key.rotation_euler=(Vector((-7,7,5))-key.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(14,-27,14));cam=bpy.context.object;cam.rotation_euler=(Vector((-7,6,10.5))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=32;bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=False;s.render.resolution_x=1280;s.render.resolution_y=854;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=output;s.world.color=(.2,.2,.2);bpy.ops.wm.save_as_mainfile(filepath='/tmp/r16-geometry-proof.blend');bpy.ops.render.render(write_still=True)
