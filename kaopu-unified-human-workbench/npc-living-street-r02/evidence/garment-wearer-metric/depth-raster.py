"""Actual D24/4x-MSAA EGL diagnostic of full original body/cloth triangles.
Flat diagnostic pigments, not the website textile shader or visual acceptance.
"""
import os,sys,json,ctypes as C,ctypes.util,pathlib
os.environ.setdefault('EGL_PLATFORM','surfaceless')
import numpy as np
from PIL import Image,ImageDraw
E=C.CDLL(ctypes.util.find_library('EGL'));G=C.CDLL(ctypes.util.find_library('GL'))
def ef(name,restype,args):
 f=getattr(E,name);f.restype=restype;f.argtypes=args;return f
get_display=ef('eglGetDisplay',C.c_void_p,[C.c_void_p]);initialize=ef('eglInitialize',C.c_uint,[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_int)])
choose=ef('eglChooseConfig',C.c_uint,[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_void_p),C.c_int,C.POINTER(C.c_int)])
bind_api=ef('eglBindAPI',C.c_uint,[C.c_uint]);create_surface=ef('eglCreatePbufferSurface',C.c_void_p,[C.c_void_p,C.c_void_p,C.POINTER(C.c_int)])
create_context=ef('eglCreateContext',C.c_void_p,[C.c_void_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_int)])
make_current=ef('eglMakeCurrent',C.c_uint,[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p])
display=get_display(None);major=C.c_int();minor=C.c_int();assert initialize(display,C.byref(major),C.byref(minor))
attrs=(C.c_int*15)(0x3033,1,0x3040,8,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3038)
config=C.c_void_p();count=C.c_int();assert choose(display,attrs,C.byref(config),1,C.byref(count)) and count.value
assert bind_api(0x30A2)
W,H=720,900
surface=create_surface(display,config,(C.c_int*5)(0x3057,W,0x3056,H,0x3038))
context=create_context(display,config,None,(C.c_int*7)(0x3098,3,0x30FB,3,0x30FD,1,0x3038));assert context
assert make_current(display,surface,surface,context)
def gf(name,restype,args):
 f=getattr(G,name);f.restype=restype;f.argtypes=args;return f
U=C.c_uint;I=C.c_int;P=C.c_void_p;F=C.c_float
get_string=gf('glGetString',C.c_char_p,[U]);shader_new=gf('glCreateShader',U,[U]);shader_source=gf('glShaderSource',None,[U,I,C.POINTER(C.c_char_p),C.POINTER(I)])
shader_compile=gf('glCompileShader',None,[U]);shader_iv=gf('glGetShaderiv',None,[U,U,C.POINTER(I)]);shader_log=gf('glGetShaderInfoLog',None,[U,I,C.POINTER(I),C.c_char_p])
program_new=gf('glCreateProgram',U,[]);attach=gf('glAttachShader',None,[U,U]);link=gf('glLinkProgram',None,[U]);use=gf('glUseProgram',None,[U])
program_iv=gf('glGetProgramiv',None,[U,U,C.POINTER(I)]);program_log=gf('glGetProgramInfoLog',None,[U,I,C.POINTER(I),C.c_char_p])
uniform_location=gf('glGetUniformLocation',I,[U,C.c_char_p]);uniform_matrix=gf('glUniformMatrix4fv',None,[I,I,C.c_ubyte,C.POINTER(F)]);uniform3=gf('glUniform3f',None,[I,F,F,F])
gen_vao=gf('glGenVertexArrays',None,[I,C.POINTER(U)]);bind_vao=gf('glBindVertexArray',None,[U]);gen_buffer=gf('glGenBuffers',None,[I,C.POINTER(U)]);bind_buffer=gf('glBindBuffer',None,[U,U]);buffer_data=gf('glBufferData',None,[U,C.c_ssize_t,P,U])
enable_attr=gf('glEnableVertexAttribArray',None,[U]);attribute=gf('glVertexAttribPointer',None,[U,I,U,C.c_ubyte,I,P]);draw=gf('glDrawElements',None,[U,I,U,P])
gen_fbo=gf('glGenFramebuffers',None,[I,C.POINTER(U)]);bind_fbo=gf('glBindFramebuffer',None,[U,U]);gen_rbo=gf('glGenRenderbuffers',None,[I,C.POINTER(U)]);bind_rbo=gf('glBindRenderbuffer',None,[U,U]);storage_ms=gf('glRenderbufferStorageMultisample',None,[U,I,U,I,I]);storage=gf('glRenderbufferStorage',None,[U,U,I,I]);attach_rbo=gf('glFramebufferRenderbuffer',None,[U,U,U,U]);fbo_status=gf('glCheckFramebufferStatus',U,[U]);blit=gf('glBlitFramebuffer',None,[I,I,I,I,I,I,I,I,U,U])
viewport=gf('glViewport',None,[I,I,I,I]);enable=gf('glEnable',None,[U]);depth_func=gf('glDepthFunc',None,[U]);clear_color=gf('glClearColor',None,[F,F,F,F]);clear=gf('glClear',None,[U]);read_pixels=gf('glReadPixels',None,[I,I,I,I,U,U,P]);finish=gf('glFinish',None,[])
def compile_shader(kind,source):
 s=shader_new(kind);p=C.c_char_p(source.encode());shader_source(s,1,C.byref(p),None);shader_compile(s);ok=I();shader_iv(s,0x8B81,C.byref(ok))
 if not ok.value:
  b=C.create_string_buffer(4096);shader_log(s,len(b),None,b);raise RuntimeError(b.value)
 return s
program=program_new()
attach(program,compile_shader(0x8B31,'#version 330 core\nlayout(location=0) in vec3 p;layout(location=1) in vec3 normal;uniform mat4 mvp;out vec3 n;void main(){n=normal;gl_Position=mvp*vec4(p,1.);}'))
attach(program,compile_shader(0x8B30,'#version 330 core\nin vec3 n;uniform vec3 pigment;out vec4 color;void main(){vec3 N=normalize(n);if(!gl_FrontFacing)N=-N;float l=.4+.6*max(0.,dot(N,normalize(vec3(.3,-.45,.8))));color=vec4(pigment*l,1.);}'))
link(program);ok=I();program_iv(program,0x8B82,C.byref(ok))
if not ok.value:
 b=C.create_string_buffer(4096);program_log(program,len(b),None,b);raise RuntimeError(b.value)
use(program);MVP=uniform_location(program,b'mvp');PIGMENT=uniform_location(program,b'pigment')
def framebuffer(samples):
 f=U();gen_fbo(1,C.byref(f));bind_fbo(0x8D40,f.value)
 for internal,attachment in [(0x8058,0x8CE0),(0x81A6,0x8D00)]:
  r=U();gen_rbo(1,C.byref(r));bind_rbo(0x8D41,r.value)
  if samples:storage_ms(0x8D41,samples,internal,W,H)
  else:storage(0x8D41,internal,W,H)
  attach_rbo(0x8D40,attachment,0x8D41,r.value)
 assert fbo_status(0x8D40)==0x8CD5
 return f.value
MS=framebuffer(4);RESOLVE=framebuffer(0)
def mesh(data,pigment):
 p=np.asarray(data['positions'],dtype=np.float32).reshape(-1,3);faces=np.asarray(data['faces'],dtype=np.uint32).reshape(-1,3);normal=np.zeros_like(p)
 fn=np.cross(p[faces[:,1]]-p[faces[:,0]],p[faces[:,2]]-p[faces[:,0]])
 for k in range(3):np.add.at(normal,faces[:,k],fn)
 normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-20)
 vertices=np.ascontiguousarray(np.concatenate([p,normal],axis=1));indices=np.ascontiguousarray(faces)
 vao=U();gen_vao(1,C.byref(vao));bind_vao(vao.value);v=U();gen_buffer(1,C.byref(v));bind_buffer(0x8892,v.value);buffer_data(0x8892,vertices.nbytes,vertices.ctypes.data,0x88E4)
 e=U();gen_buffer(1,C.byref(e));bind_buffer(0x8893,e.value);buffer_data(0x8893,indices.nbytes,indices.ctypes.data,0x88E4)
 enable_attr(0);attribute(0,3,0x1406,0,24,None);enable_attr(1);attribute(1,3,0x1406,0,24,C.c_void_p(12))
 return vao.value,indices.size,pigment
def look_at(eye,target):
 f=target-eye;f/=np.linalg.norm(f);s=np.cross(f,np.array([0,0,1.]));s/=np.linalg.norm(s);u=np.cross(s,f);m=np.eye(4);m[:3,:3]=[s,u,-f];m[:3,3]=-m[:3,:3]@eye;return m
def camera(body,direction):
 p=np.asarray(body['positions']).reshape(-1,3);lo=p.min(axis=0);hi=p.max(axis=0);target=(lo+hi)/2;eye=target+np.asarray(direction)*3
 v=look_at(eye,target);projected=p@v[:3,:3].T;extent=projected.max(axis=0)-projected.min(axis=0)
 height=max(extent[1],extent[0]*H/W)*1.14;width=height*W/H;o=np.eye(4);o[0,0]=2/width;o[1,1]=2/height;o[2,2]=-2/10;o[2,3]=-1
 return np.ascontiguousarray((o@v).T,dtype=np.float32)
enable(0x0B71);depth_func(0x0203);enable(0x809D);viewport(0,0,W,H)
meta={'renderer':get_string(0x1F01).decode(),'version':get_string(0x1F02).decode(),'depth':'GL_DEPTH_COMPONENT24','samples':4,'indices':'all original body and garment indices','camera':'same full body per pose; both projected width and height fit with 14 percent margin','flatDiagnosticPigments':True,'websiteMaterialAcceptance':False,'files':[]}
for source in sys.argv[1:]:
 path=pathlib.Path(source);data=json.loads(path.read_text());objects=[mesh(data['body'],(.73,.43,.29))]
 for g in data['garments']:objects.append(mesh(g,(.19,.31,.46) if g['id'].startswith('P') else (.42,.55,.60)))
 out=path.parent/'depth-raster';out.mkdir(exist_ok=True);images=[]
 # A captured actor can turn within native coordinates. Use the actual
 # posed hip axis supplied by the fixture, never label fixed axes as anatomy.
 views=[(name,data['viewBasis'][name]) for name in ('front','side','back')] if 'viewBasis' in data else [('native-y-negative',[0,-1,0]),('native-x-positive',[1,0,0]),('native-y-positive',[0,1,0])]
 for name,direction in views:
  bind_fbo(0x8D40,MS);clear_color(.94,.95,.96,1);clear(0x4000|0x0100);m=camera(data['body'],direction);uniform_matrix(MVP,1,0,m.ctypes.data_as(C.POINTER(F)))
  for vao,count,color in objects:uniform3(PIGMENT,*color);bind_vao(vao);draw(4,count,0x1405,None)
  bind_fbo(0x8CA8,MS);bind_fbo(0x8CA9,RESOLVE);blit(0,0,W,H,0,0,W,H,0x4000,0x2600);bind_fbo(0x8D40,RESOLVE);finish();pixels=np.empty((H,W,4),np.uint8);read_pixels(0,0,W,H,0x1908,0x1401,pixels.ctypes.data);img=Image.fromarray(pixels[::-1].copy(),'RGBA').convert('RGB');namepath=out/(path.stem+'-'+name+'.png');img.save(namepath);images.append(img);meta['files'].append(str(namepath))
 combined=Image.new('RGB',(W*3,H+36),(240,242,244));drawtext=ImageDraw.Draw(combined)
 for i,img in enumerate(images):combined.paste(img,(i*W,36));drawtext.text((i*W+16,10),['FRONT','SIDE','BACK'][i],fill=(30,40,50))
 combined.save(out/(path.stem+'-three.png'));meta['files'].append(str(out/(path.stem+'-three.png')))
 (out/'RASTER.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta))
