import bpy,json,math,os,sys
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data=json.load(open(root+'/evidence/geometry.json'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=64;s.cycles.use_denoising=False;s.cycles.max_bounces=5
s.render.resolution_x=1600;s.render.resolution_y=1100;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.73,.80,.85,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
s.view_settings.view_transform='AgX'
def cv(p):return(p[0],-p[2],p[1])
for m in data['meshes']:
 p=m['positions'];v=[cv(p[i:i+3]) for i in range(0,len(p),3)];f=[(i,i+1,i+2) for i in range(0,len(v),3)];mesh=bpy.data.meshes.new(m['name']);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(m['name'],mesh);bpy.context.collection.objects.link(o);o['layer']=m['layer']
 color=m['color'];rgb=tuple((((color>>b)&255)/255/12.92 if ((color>>b)&255)/255<=0.04045 else ((((color>>b)&255)/255+0.055)/1.055)**2.4) for b in (16,8,0));mat=bpy.data.materials.new(m['material']);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.83
 if m['material'] in ('iron','darkIron','brass'):bs.inputs['Metallic'].default_value=.25
 if m['material']=='glass':bs.inputs['Transmission Weight'].default_value=.85;bs.inputs['Roughness'].default_value=.18;bs.inputs['Alpha'].default_value=.22
 o.data.materials.append(mat)
bpy.ops.object.light_add(type='SUN',location=(0,0,60));sun=bpy.context.object;sun.rotation_euler=(math.radians(25),math.radians(-35),math.radians(-35));sun.data.energy=2.0;sun.data.angle=math.radians(6)
# Supplementary inspection lights illuminate the actual enclosed model, not a lighting simulation.
for name,loc,energy,size in [('Hall inspection',[0,9,-9],2000,24),('Warehouse inspection',[0,10,45],18000,60),('Office inspection',[15,4,-40],900,10)]:
 bpy.ops.object.light_add(type='AREA',location=cv(loc));o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(0,0,0)
bpy.ops.wm.save_as_mainfile(filepath=root+'/delivery/bureau-r03-editable.blend');
bpy.ops.object.camera_add();cam=bpy.context.object;s.camera=cam;cam.data.lens=42;cam.data.clip_end=1200
views={'overall':([-126,86,-148],[0,5,16]),'front':([-64,25,-102],[0,10,-36]),'hall':([0,2.5,-25.8],[0,7,6]),'counter':([2.6,2,-12],[9.2,1.4,-9]),'cloister':([-38.4,2,-27],[-38.3,3.4,12]),'court':([-24,3.1,-25],[-10,8,6]),'office':([8.5,2.4,-34.8],[16,1.6,-40.5]),'warehouse':([0,2.8,24],[0,6.3,65]),'steam':([50.4,2.3,21],[47.9,4.2,60]),'back':([117,70,135],[0,6,34]),'section':([-110,107,-115],[0,0,12])}
only=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['overall','hall','warehouse']
for name in only:
 if name not in views:continue
 for o in s.objects:
  if 'layer' in o:o.hide_render=o['layer']=='routes' or name=='section' and o['layer'] in ('roofs','upper-floors','vaults')
 eye,target=views[name];cam.location=cv(eye);cam.rotation_euler=(Vector(cv(target))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=root+'/evidence/inspection-'+name+'.png';bpy.ops.render.render(write_still=True)
