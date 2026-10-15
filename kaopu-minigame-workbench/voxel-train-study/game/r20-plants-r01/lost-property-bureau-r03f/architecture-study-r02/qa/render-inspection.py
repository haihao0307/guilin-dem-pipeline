import bpy,json,math,os,sys
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data=json.load(open(root+'/evidence/geometry.json'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=False;s.cycles.max_bounces=5
s.render.resolution_x=1440;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.73,.80,.85,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
s.view_settings.view_transform='AgX'
def cv(p):return(p[0],-p[2],p[1])
for m in data['meshes']:
 p=m['positions'];v=[cv(p[i:i+3]) for i in range(0,len(p),3)];f=[(i,i+1,i+2) for i in range(0,len(v),3)];mesh=bpy.data.meshes.new(m['name']);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(m['name'],mesh);bpy.context.collection.objects.link(o);o['layer']=m['layer']
 color=m['color'];rgb=tuple(((color>>b)&255)/255 for b in (16,8,0));mat=bpy.data.materials.new(m['material']);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.83
 if m['material'] in ('iron','darkIron','brass'):bs.inputs['Metallic'].default_value=.25
 if m['material']=='glass':bs.inputs['Transmission Weight'].default_value=.85;bs.inputs['Roughness'].default_value=.18;bs.inputs['Alpha'].default_value=.22
 o.data.materials.append(mat)
bpy.ops.object.light_add(type='SUN',location=(0,0,60));sun=bpy.context.object;sun.rotation_euler=(math.radians(25),math.radians(-35),math.radians(-35));sun.data.energy=2.2;sun.data.angle=math.radians(6)
# Supplementary inspection lights illuminate the actual enclosed model, not a lighting simulation.
for name,loc,energy,size in [('Hall inspection',[-33,8,7],8500,18),('Warehouse inspection',[10,8,8],42000,45)]:
 bpy.ops.object.light_add(type='AREA',location=cv(loc));o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(0,0,0)
bpy.ops.object.camera_add();cam=bpy.context.object;s.camera=cam;cam.data.lens=42;cam.data.clip_end=1200
views={'overall':([-113,68,-120],[5,7,6]),'hall':([-36.5,2.4,-8],[-34,5,20]),'warehouse':([10,3.5,-24],[10,7,28]),'back':([102,64,109],[10,8,11]),'section':([-90,98,-100],[8,1,8])}
only=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['overall','hall','warehouse']
for name in only:
 if name not in views:continue
 for o in s.objects:
  if 'layer' in o:o.hide_render=name=='section' and o['layer'] in ('roofs','upper-floors')
 eye,target=views[name];cam.location=cv(eye);cam.rotation_euler=(Vector(cv(target))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=root+'/evidence/inspection-'+name+'.png';bpy.ops.render.render(write_still=True)
