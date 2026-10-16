"""Compile and link supplied GLSL with local EGL. No browser or network."""
import ctypes as C
import ctypes.util as U
import json
import sys
E=C.CDLL(U.find_library('EGL'))
E.eglGetProcAddress.restype=C.c_void_p
E.eglGetProcAddress.argtypes=[C.c_char_p]
get_display=C.CFUNCTYPE(C.c_void_p,C.c_uint,C.c_void_p,C.c_void_p)(E.eglGetProcAddress(b'eglGetPlatformDisplayEXT'))
display=get_display(0x31DD,None,None)
E.eglInitialize.argtypes=[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_int)]
major,minor=C.c_int(),C.c_int()
assert E.eglInitialize(display,C.byref(major),C.byref(minor)), 'EGL initialization failed'
E.eglBindAPI(0x30A0)
E.eglChooseConfig.argtypes=[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_void_p),C.c_int,C.POINTER(C.c_int)]
config,count=C.c_void_p(),C.c_int()
attrs=(C.c_int*11)(0x3024,8,0x3023,8,0x3022,8,0x3033,1,0x3040,0x40,0x3038)
assert E.eglChooseConfig(display,attrs,C.byref(config),1,C.byref(count))
E.eglCreateContext.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_int)]
E.eglCreateContext.restype=C.c_void_p
context=E.eglCreateContext(display,config,None,(C.c_int*3)(0x3098,3,0x3038))
assert context, 'EGL context creation failed'
E.eglMakeCurrent.argtypes=[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p]
assert E.eglMakeCurrent(display,None,None,context)
class GL: pass
gl=GL()
def bind(name,ret,args): setattr(gl,name,C.CFUNCTYPE(ret,*args)(E.eglGetProcAddress(name.encode())))
bind('glCreateShader',C.c_uint,[C.c_uint])
bind('glShaderSource',None,[C.c_uint,C.c_int,C.POINTER(C.c_char_p),C.POINTER(C.c_int)])
bind('glCompileShader',None,[C.c_uint])
bind('glGetShaderiv',None,[C.c_uint,C.c_uint,C.POINTER(C.c_int)])
bind('glGetShaderInfoLog',None,[C.c_uint,C.c_int,C.POINTER(C.c_int),C.c_char_p])
bind('glCreateProgram',C.c_uint,[])
bind('glAttachShader',None,[C.c_uint,C.c_uint])
bind('glLinkProgram',None,[C.c_uint])
bind('glGetProgramiv',None,[C.c_uint,C.c_uint,C.POINTER(C.c_int)])
bind('glGetProgramInfoLog',None,[C.c_uint,C.c_int,C.POINTER(C.c_int),C.c_char_p])
sources=json.load(sys.stdin)
logs={}
program=gl.glCreateProgram()
passed=True
for name,kind in [('vertex',0x8B31),('fragment',0x8B30)]:
    shader=gl.glCreateShader(kind)
    source=C.c_char_p(sources[name].encode())
    gl.glShaderSource(shader,1,C.byref(source),None)
    gl.glCompileShader(shader)
    ok=C.c_int()
    gl.glGetShaderiv(shader,0x8B81,C.byref(ok))
    log=C.create_string_buffer(16384)
    gl.glGetShaderInfoLog(shader,16384,None,log)
    logs[name]={'compiled':bool(ok.value),'log':log.value.decode()}
    passed=passed and bool(ok.value)
    gl.glAttachShader(program,shader)
gl.glLinkProgram(program)
ok=C.c_int()
gl.glGetProgramiv(program,0x8B82,C.byref(ok))
log=C.create_string_buffer(16384)
gl.glGetProgramInfoLog(program,16384,None,log)
logs['link']={'linked':bool(ok.value),'log':log.value.decode()}
passed=passed and bool(ok.value)
print(json.dumps({'passed':passed,**logs}))
sys.exit(0 if passed else 1)
