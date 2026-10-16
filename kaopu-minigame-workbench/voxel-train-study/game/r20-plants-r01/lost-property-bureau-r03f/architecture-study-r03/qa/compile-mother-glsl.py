import ctypes as C,ctypes.util as U,sys
E=C.CDLL(U.find_library('EGL')); G=C.CDLL(U.find_library('GLESv2'))
E.eglGetProcAddress.restype=C.c_void_p;E.eglGetProcAddress.argtypes=[C.c_char_p]
p=E.eglGetProcAddress(b'eglGetPlatformDisplayEXT'); fn=C.CFUNCTYPE(C.c_void_p,C.c_uint,C.c_void_p,C.c_void_p)(p);d=fn(0x31DD,None,None)
E.eglInitialize.argtypes=[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_int)];ma=C.c_int();mi=C.c_int();assert E.eglInitialize(d,C.byref(ma),C.byref(mi)), 'EGL init';
E.eglBindAPI(0x30A0); E.eglChooseConfig.argtypes=[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_void_p),C.c_int,C.POINTER(C.c_int)];cfg=C.c_void_p();n=C.c_int();attrs=(C.c_int*11)(0x3024,8,0x3023,8,0x3022,8,0x3033,1,0x3040,0x40,0x3038);assert E.eglChooseConfig(d,attrs,C.byref(cfg),1,C.byref(n));
E.eglCreateContext.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_int)];E.eglCreateContext.restype=C.c_void_p;ca=(C.c_int*3)(0x3098,3,0x3038);ctx=E.eglCreateContext(d,cfg,None,ca);assert ctx,'context';E.eglMakeCurrent.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p];assert E.eglMakeCurrent(d,None,None,ctx),'current';
class GL:pass
G=GL()
def bind(n,ret,args):setattr(G,n,C.CFUNCTYPE(ret,*args)(E.eglGetProcAddress(n.encode())))
bind('glCreateShader',C.c_uint,[C.c_uint]);bind('glShaderSource',None,[C.c_uint,C.c_int,C.POINTER(C.c_char_p),C.POINTER(C.c_int)]);bind('glCompileShader',None,[C.c_uint]);bind('glGetShaderiv',None,[C.c_uint,C.c_uint,C.POINTER(C.c_int)]);bind('glGetShaderInfoLog',None,[C.c_uint,C.c_int,C.POINTER(C.c_int),C.c_char_p])

src=open(sys.argv[1]).read();prefix='#version 300 es\nprecision highp float;\n';suffix='\nout vec4 fragColor;void main(){KpWoodParams p=kpWoodDefaultParams();KpWoodSample s=kpWoodOriginalSample(vec3(1.,.2,.3),vec3(0.,1.,0.),0.,p,0.001,2.);fragColor=vec4(s.surface.albedo,1.);}\n';b=(src if len(sys.argv)>2 and sys.argv[2]=='full' else prefix+src+suffix).encode();shader=G.glCreateShader(0x8B31 if sys.argv[1].endswith('.vert') else 0x8B30);ss=C.c_char_p(b);G.glShaderSource(shader,1,C.byref(ss),None);G.glCompileShader(shader);ok=C.c_int();G.glGetShaderiv(shader,0x8B81,C.byref(ok));log=C.create_string_buffer(10000);G.glGetShaderInfoLog(shader,10000,None,log);print('COMPILE',bool(ok.value),log.value.decode());sys.exit(0 if ok.value else 1)
