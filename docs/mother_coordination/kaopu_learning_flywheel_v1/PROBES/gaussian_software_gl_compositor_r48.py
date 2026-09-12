#!/usr/bin/env python3
import ctypes as C
import json
import math

SIZE = 33
KERNEL = 0.3
EIGEN_FLOOR = 1e-7
CUTOFF2 = 4.0

EGL_NONE = 0x3038
EGL_SURFACE_TYPE = 0x3033
EGL_PBUFFER_BIT = 0x0001
EGL_RENDERABLE_TYPE = 0x3040
EGL_OPENGL_BIT = 0x0008
EGL_RED_SIZE, EGL_GREEN_SIZE, EGL_BLUE_SIZE, EGL_ALPHA_SIZE = 0x3024, 0x3023, 0x3022, 0x3021
EGL_WIDTH, EGL_HEIGHT = 0x3057, 0x3056
EGL_OPENGL_API = 0x30A2
EGL_PLATFORM_SURFACELESS_MESA = 0x31DD

GL_VENDOR, GL_RENDERER, GL_VERSION, GL_SHADING_LANGUAGE_VERSION = 0x1F00, 0x1F01, 0x1F02, 0x8B8C
GL_VERTEX_SHADER, GL_FRAGMENT_SHADER = 0x8B31, 0x8B30
GL_COMPILE_STATUS, GL_LINK_STATUS = 0x8B81, 0x8B82
GL_COLOR_BUFFER_BIT = 0x4000
GL_BLEND, GL_DITHER = 0x0BE2, 0x0BD0
GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE = 0x0302, 0x0303, 1
GL_RGBA, GL_UNSIGNED_BYTE = 0x1908, 0x1401

egl = C.CDLL('libEGL.so.1')
gl = C.CDLL('libGL.so.1')

egl.eglGetProcAddress.argtypes = [C.c_char_p]
egl.eglGetProcAddress.restype = C.c_void_p
get_platform_addr = egl.eglGetProcAddress(b'eglGetPlatformDisplayEXT')
if not get_platform_addr:
    raise RuntimeError('eglGetPlatformDisplayEXT unavailable')
GetPlatformDisplay = C.CFUNCTYPE(C.c_void_p, C.c_uint, C.c_void_p, C.POINTER(C.c_int))(get_platform_addr)
display = GetPlatformDisplay(EGL_PLATFORM_SURFACELESS_MESA, None, None)
if not display:
    raise RuntimeError('surfaceless EGL display unavailable')

egl.eglInitialize.argtypes = [C.c_void_p, C.POINTER(C.c_int), C.POINTER(C.c_int)]
egl.eglInitialize.restype = C.c_uint
major, minor = C.c_int(), C.c_int()
if not egl.eglInitialize(display, C.byref(major), C.byref(minor)):
    raise RuntimeError('eglInitialize failed')
egl.eglBindAPI.argtypes = [C.c_uint]
egl.eglBindAPI.restype = C.c_uint
if not egl.eglBindAPI(EGL_OPENGL_API):
    raise RuntimeError('eglBindAPI failed')

attrs = (C.c_int * 15)(
    EGL_SURFACE_TYPE, EGL_PBUFFER_BIT,
    EGL_RENDERABLE_TYPE, EGL_OPENGL_BIT,
    EGL_RED_SIZE, 8, EGL_GREEN_SIZE, 8, EGL_BLUE_SIZE, 8, EGL_ALPHA_SIZE, 8,
    EGL_NONE, 0, 0,
)
config = C.c_void_p()
count = C.c_int()
egl.eglChooseConfig.argtypes = [C.c_void_p, C.POINTER(C.c_int), C.POINTER(C.c_void_p), C.c_int, C.POINTER(C.c_int)]
egl.eglChooseConfig.restype = C.c_uint
if not egl.eglChooseConfig(display, attrs, C.byref(config), 1, C.byref(count)) or count.value != 1:
    raise RuntimeError('eglChooseConfig failed')

pattrs = (C.c_int * 5)(EGL_WIDTH, SIZE, EGL_HEIGHT, SIZE, EGL_NONE)
egl.eglCreatePbufferSurface.argtypes = [C.c_void_p, C.c_void_p, C.POINTER(C.c_int)]
egl.eglCreatePbufferSurface.restype = C.c_void_p
surface = egl.eglCreatePbufferSurface(display, config, pattrs)
cattrs = (C.c_int * 1)(EGL_NONE)
egl.eglCreateContext.argtypes = [C.c_void_p, C.c_void_p, C.c_void_p, C.POINTER(C.c_int)]
egl.eglCreateContext.restype = C.c_void_p
context = egl.eglCreateContext(display, config, None, cattrs)
egl.eglMakeCurrent.argtypes = [C.c_void_p, C.c_void_p, C.c_void_p, C.c_void_p]
egl.eglMakeCurrent.restype = C.c_uint
if not surface or not context or not egl.eglMakeCurrent(display, surface, surface, context):
    raise RuntimeError('EGL context setup failed')

gl.glGetString.argtypes = [C.c_uint]
gl.glGetString.restype = C.c_char_p
identity = {
    'eglVersion': f'{major.value}.{minor.value}',
    'vendor': gl.glGetString(GL_VENDOR).decode(),
    'renderer': gl.glGetString(GL_RENDERER).decode(),
    'glVersion': gl.glGetString(GL_VERSION).decode(),
    'shaderVersion': gl.glGetString(GL_SHADING_LANGUAGE_VERSION).decode(),
}

VERTEX = b'''#version 330 core
const vec2 p[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() { gl_Position = vec4(p[gl_VertexID], 0.0, 1.0); }
'''
FRAGMENT = b'''#version 330 core
uniform vec2 uCenter;
uniform vec2 uScale;
uniform float uAngle;
uniform vec3 uColor;
uniform float uAlpha;
out vec4 outColor;
void main() {
  vec2 d = (gl_FragCoord.xy - vec2(16.5)) - uCenter;
  float ca = cos(uAngle), sa = sin(uAngle);
  vec2 q = vec2(d.x * ca + d.y * sa, -d.x * sa + d.y * ca) / uScale;
  float r2 = dot(q, q);
  if (r2 > 4.0) discard;
  outColor = vec4(uColor, exp(-0.5 * r2) * uAlpha);
}
'''

gl.glCreateShader.argtypes = [C.c_uint]
gl.glCreateShader.restype = C.c_uint
gl.glShaderSource.argtypes = [C.c_uint, C.c_int, C.POINTER(C.c_char_p), C.POINTER(C.c_int)]
gl.glCompileShader.argtypes = [C.c_uint]
gl.glGetShaderiv.argtypes = [C.c_uint, C.c_uint, C.POINTER(C.c_int)]
gl.glGetShaderInfoLog.argtypes = [C.c_uint, C.c_int, C.POINTER(C.c_int), C.c_char_p]
gl.glCreateProgram.restype = C.c_uint
gl.glAttachShader.argtypes = [C.c_uint, C.c_uint]
gl.glLinkProgram.argtypes = [C.c_uint]
gl.glGetProgramiv.argtypes = [C.c_uint, C.c_uint, C.POINTER(C.c_int)]
gl.glGetProgramInfoLog.argtypes = [C.c_uint, C.c_int, C.POINTER(C.c_int), C.c_char_p]

def shader(kind, source):
    handle = gl.glCreateShader(kind)
    src = C.c_char_p(source)
    gl.glShaderSource(handle, 1, C.byref(src), None)
    gl.glCompileShader(handle)
    ok = C.c_int()
    gl.glGetShaderiv(handle, GL_COMPILE_STATUS, C.byref(ok))
    if not ok.value:
        buf = C.create_string_buffer(4096)
        gl.glGetShaderInfoLog(handle, len(buf), None, buf)
        raise RuntimeError(buf.value.decode())
    return handle

program = gl.glCreateProgram()
gl.glAttachShader(program, shader(GL_VERTEX_SHADER, VERTEX))
gl.glAttachShader(program, shader(GL_FRAGMENT_SHADER, FRAGMENT))
gl.glLinkProgram(program)
ok = C.c_int()
gl.glGetProgramiv(program, GL_LINK_STATUS, C.byref(ok))
if not ok.value:
    buf = C.create_string_buffer(4096)
    gl.glGetProgramInfoLog(program, len(buf), None, buf)
    raise RuntimeError(buf.value.decode())

gl.glUseProgram.argtypes = [C.c_uint]
gl.glGetUniformLocation.argtypes = [C.c_uint, C.c_char_p]
gl.glGetUniformLocation.restype = C.c_int
gl.glUniform2f.argtypes = [C.c_int, C.c_float, C.c_float]
gl.glUniform3f.argtypes = [C.c_int, C.c_float, C.c_float, C.c_float]
gl.glUniform1f.argtypes = [C.c_int, C.c_float]
gl.glViewport.argtypes = [C.c_int, C.c_int, C.c_int, C.c_int]
gl.glClearColor.argtypes = [C.c_float, C.c_float, C.c_float, C.c_float]
gl.glBlendFuncSeparate.argtypes = [C.c_uint, C.c_uint, C.c_uint, C.c_uint]
gl.glDrawArrays.argtypes = [C.c_uint, C.c_int, C.c_int]
gl.glReadPixels.argtypes = [C.c_int, C.c_int, C.c_int, C.c_int, C.c_uint, C.c_uint, C.c_void_p]

loc = {name: gl.glGetUniformLocation(program, name.encode()) for name in ('uCenter','uScale','uAngle','uColor','uAlpha')}

def clamp01(x): return min(1.0, max(0.0, x))

def ellipse(base):
    a0, b, c0 = base
    a, c = a0 + KERNEL, c0 + KERNEL
    det0, det = a0*c0-b*b, a*c-b*b
    alpha = math.sqrt(max(det0/max(det, 1e-6), 0.0))
    ht = 0.5*(a+c)
    radius = math.sqrt(max((0.5*(a-c))**2+b*b, EIGEN_FLOOR))
    l1, l2 = max(ht+radius, EIGEN_FLOOR), max(ht-radius, EIGEN_FLOOR)
    return {'scale': (min(math.sqrt(l1),1024.0), min(math.sqrt(l2),1024.0)),
            'angle': 0.5*math.atan2(2*b,a-c), 'alphaScale': alpha}

splats = [
 {'center':(0,0),'dc':(-.2,.05,.05),'sh':(.8,0,0),'opacity':.5,
  'source':ellipse((16,0,4)),'decoded':ellipse((18,.8,3.2))},
 {'center':(.35,-.2),'dc':(1.2,.05,.05),'sh':(-.8,0,0),'opacity':.5,
  'source':ellipse((9,.4,2.25)),'decoded':ellipse((7.5,-.4,3))},
]
for s in splats:
    s['sourceColor'] = tuple(clamp01(a+b) for a,b in zip(s['dc'],s['sh']))
    s['viewerColor'] = tuple(clamp01(clamp01(a)+b) for a,b in zip(s['dc'],s['sh']))

def render_gl(order, decoded, viewer):
    gl.glViewport(0,0,SIZE,SIZE)
    gl.glDisable(GL_DITHER)
    gl.glEnable(GL_BLEND)
    gl.glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA)
    gl.glClearColor(0,0,0,0)
    gl.glClear(GL_COLOR_BUFFER_BIT)
    gl.glUseProgram(program)
    for i in order:
        s=splats[i]; e=s['decoded' if decoded else 'source']; color=s['viewerColor' if viewer else 'sourceColor']
        gl.glUniform2f(loc['uCenter'], *s['center'])
        gl.glUniform2f(loc['uScale'], *e['scale'])
        gl.glUniform1f(loc['uAngle'], e['angle'])
        gl.glUniform3f(loc['uColor'], *color)
        gl.glUniform1f(loc['uAlpha'], s['opacity']*e['alphaScale'])
        gl.glDrawArrays(0x0004, 0, 3)
    buf=(C.c_ubyte*(SIZE*SIZE*4))()
    gl.glReadPixels(0,0,SIZE,SIZE,GL_RGBA,GL_UNSIGNED_BYTE,buf)
    return list(buf)

def render_cpu(order, decoded, viewer, quantize_each_draw=False):
    out=[]
    for iy in range(SIZE):
      for ix in range(SIZE):
        dst=[0.,0.,0.,0.]
        x,y=ix-16,iy-16
        for i in order:
          s=splats[i]; e=s['decoded' if decoded else 'source']; color=s['viewerColor' if viewer else 'sourceColor']
          dx,dy=x-s['center'][0],y-s['center'][1]
          ca,sa=math.cos(e['angle']),math.sin(e['angle'])
          u=(dx*ca+dy*sa)/e['scale'][0]; v=(-dx*sa+dy*ca)/e['scale'][1]
          r2=u*u+v*v
          if r2>CUTOFF2: continue
          alpha=math.exp(-.5*r2)*s['opacity']*e['alphaScale']
          dst=[color[c]*alpha+dst[c]*(1-alpha) for c in range(3)]+[alpha+dst[3]*(1-alpha)]
          if quantize_each_draw: dst=[round(clamp01(v)*255)/255 for v in dst]
        out.extend(dst)
    return out

def metrics_float(gl_bytes, cpu):
    diffs=[abs(gl_bytes[i]/255-cpu[i]) for i in range(len(cpu))]
    return {'maxAbs':max(diffs),'rmse':math.sqrt(sum(d*d for d in diffs)/len(diffs)),
            'mismatchedChannelsOverOneCode':sum(d>1.000001/255 for d in diffs)}

def metrics_codes(a,b):
    diffs=[abs(x-y) for x,y in zip(a,b)]
    return {'maxCodeDifference':max(diffs),'mismatchedChannels':sum(d!=0 for d in diffs)}

def cpu_codes(cpu): return [round(clamp01(v)*255) for v in cpu]

reference_gl=render_gl((1,0),False,False)
candidate_gl=render_gl((0,1),True,True)
reference_cpu=render_cpu((1,0),False,False)
candidate_cpu=render_cpu((0,1),True,True)
reference_q=render_cpu((1,0),False,False,True)
candidate_q=render_cpu((0,1),True,True,True)

gl_cross=[abs(a-b)/255 for a,b in zip(reference_gl,candidate_gl)]
cpu_cross=[abs(a-b) for a,b in zip(reference_cpu,candidate_cpu)]
result={
 'schema':'kaopu-gaussian-software-gl-compositor-probe/r48',
 'status':'Candidate-pass',
 'source':{'threeRevision':'148ef33ecb6d2502ff796d4554abd1549c95d519','r47Commit':'9c6a86f9c3b1eb1ec463dc096947424c5072477e'},
 'backend':identity,
 'fixture':{'imagePixels':[SIZE,SIZE],'splats':2,'framebuffer':'RGBA8','dither':False,'srgb':False,'toneMapping':False,
            'blend':'RGB SRC_ALPHA,ONE_MINUS_SRC_ALPHA; A ONE,ONE_MINUS_SRC_ALPHA',
            'note':'Exact R47 analytic equations in an independent desktop OpenGL shader; not generated by Three.js TSL.'},
 'reference':{'glVsContinuousCpu':metrics_float(reference_gl,reference_cpu),'glVsPerDrawUnorm8Cpu':metrics_codes(reference_gl,cpu_codes(reference_q))},
 'candidate':{'glVsContinuousCpu':metrics_float(candidate_gl,candidate_cpu),'glVsPerDrawUnorm8Cpu':metrics_codes(candidate_gl,cpu_codes(candidate_q))},
 'crossImage':{'softwareGlMaxAbs':max(gl_cross),'continuousCpuMaxAbs':max(cpu_cross),
               'absoluteDifferenceBetweenReportedMaxima':abs(max(gl_cross)-max(cpu_cross))},
 'centerPixel':{'referenceGlCodes':reference_gl[(16*SIZE+16)*4:(16*SIZE+17)*4],
                'candidateGlCodes':candidate_gl[(16*SIZE+16)*4:(16*SIZE+17)*4]},
 'checks':{},
 'limits':{'directThreeTsl':False,'hardwareGpu':False,'browserOrTargetDevice':False,'realPhotoOrLearnedAsset':False,'humanAcceptance':False}
}
result['checks']={
 'eglSoftwareFramebufferReadbackExecuted':'llvmpipe' in identity['renderer'].lower() or 'softpipe' in identity['renderer'].lower(),
 'referenceMatchesPerDrawUnorm8WithinOneCode':result['reference']['glVsPerDrawUnorm8Cpu']['maxCodeDifference']<=1,
 'referenceMatchesNaivePerDrawUnorm8WithinTwoCodes':result['reference']['glVsPerDrawUnorm8Cpu']['maxCodeDifference']<=2,
 'candidateMatchesNaivePerDrawUnorm8WithinTwoCodes':result['candidate']['glVsPerDrawUnorm8Cpu']['maxCodeDifference']<=2,
 'oneCodeBackendEquivalenceIsRejected':result['candidate']['glVsPerDrawUnorm8Cpu']['maxCodeDifference']>1,
 'backendStillShowsMaterialCombinedDifference':result['crossImage']['softwareGlMaxAbs']>0.05,
 'rgba8ChangesContinuousResult':result['reference']['glVsContinuousCpu']['maxAbs']>0 or result['candidate']['glVsContinuousCpu']['maxAbs']>0,
}
assert all(result['checks'].values())
print(json.dumps(result,indent=2))
