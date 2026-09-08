from pathlib import Path
import hashlib, re

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
base=(ROOT/'workbenches/landscape-surface-r6/index.html').read_text(encoding='utf-8')
assert hashlib.sha256(base.encode()).hexdigest()=='44bb0301869dc572dc3c9cab8924e16e115b453987576926706a48e538610e46'
s=base
def change(a,b,count=None):
    global s
    assert a in s,a[:120]
    s=s.replace(a,b) if count is None else s.replace(a,b,count)

change('R6','R7')
change('LANDSCAPE STUDY / 06','SURFACE STUDY / 07')
change("release:'limestone-water-surface-r6'","release:'limestone-water-surface-r7'")
change('scope:.58,micro:.72','scope:1.00,micro:.55')
change('<button data-view="cave">洞壁</button>', '<button data-view="micro">显微</button><button data-view="cave">洞壁</button>')
change("function toast(s)", (OUT/'inspection.js').read_text(encoding='utf-8')+'\nfunction toast(s)')
change("function goView(v){if(!views[v])", "function goView(v){if(v==='micro'){if(!report||busy)return;setCamera(...views.cliff);focusSurface(innerWidth*.60,innerHeight*.52,2.6);return;}activeFocus=null;if(!views[v])")
change('function sync(){', "function sync(){$$('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===viewName));")
change("function controls(){", "function controls(){canvas.ondblclick=e=>{if(!busy)focusSurface(e.clientX,e.clientY,1.2)};")
change('state.phi-dy*.004,.04,3.10)}dirty=true', 'state.phi-dy*.004,.04,3.10);guardFocus()}dirty=true')
change('state.radius*last.d/m.d,2,1000', 'state.radius*last.d/m.d,.12,1000')
change('state.radius*Math.exp(e.deltaY*.0013),2,1000', 'state.radius*Math.exp(e.deltaY*.0013),.12,1000')
change('v.radius<2||v.radius>1000', 'v.radius<.12||v.radius>1000')
change('recipe={...newRecipe};sync();', "activeFocus=null;recipe={...newRecipe};sync();")
change("state={...state,...v,target:v.target.slice()};sync();toast", "state={...state,...v,target:v.target.slice()};activeFocus=null;viewName='custom';if(state.radius<10&&!state.section){const hit=surfaceHit(innerWidth/2,innerHeight/2);if(hit&&Math.abs(hit.rayDistance-state.radius)<.1){activeFocus=hit;viewName='micro';}}sync();toast")
change('canvas.width/canvas.height,.15,1400', 'canvas.width/canvas.height,Math.max(.004,Math.min(.15,state.radius*.015)),1400')
change('bufferFingerprint,getState', 'bufferFingerprint,focusSurface,surfaceHit,get focus(){return activeFocus},getState')
change("'拖动旋转 · 滚轮靠近 · 右键平移'", "'拖动旋转 · 双击岩面贴近 · 滚轮继续放大'")
change('手机单指旋转，双指缩放与平移。','手机单指旋转，双指缩放与平移。点击“显微”可直接贴近岩面；桌面也可双击任意可见岩面。')
change('build(recipe).catch(fail)', "build(recipe).then(()=>{const requested=location.hash.slice(1);if(['micro','cliff','cave','foot','back','stone','section'].includes(requested))goView(requested);}).catch(fail)")
change('float bmCell(vec3 p)', (OUT/'microscope.glsl').read_text(encoding='utf-8')+'\nfloat bmCell(vec3 p)')
# Evaluate material coordinates and mineral noise at the actual fragment position.
# Interpolating the vertex-evaluated nonlinear field blurred close views and exposed triangles.
vs=base[base.index('const VS='):base.index('const FS=')]
coordinate_functions=vs[vs.index('vec3 bmTwist'):vs.index('void main()')]
change('float bmCell(vec3 p)', coordinate_functions+'\nfloat bmCell(vec3 p)')
change('vec3 mq=bmQ+vec3(.329,-.217,.133);float a=bmData.x,b=bmData.y,c=bmData.z;', '''vec3 localQ=q*.13,mq=bmCoordinates(localQ)+vec3(.329,-.217,.133);
uint materialSeed=bmColorSeed(family==2?9298u:family==5?10365u:family==6?7179u:8231u);
float a=bmSeedNoise(localQ*2.2,materialSeed),b=bmSeedNoise(localQ*7.5,materialSeed+88u),c=bmSeedNoise(localQ*26.,materialSeed+19u);''')
old='float mmv=mmSurface(q),mmLo=tanh(mmv*.70),mmFine=tanh(mmSurface(q*1.73+vec3(2.9,-1.7,4.1))*.62);float shell=(d.x<2.5?1.:0.)*uScope;float height=field*.011+(grain-.5)*.0042+shell*(mmLo*.0085+mmFine*.0038);'
change(old,'''vec4 microscope=mmRelief(q);vec3 pores=mmPoreLayers(q),crystals=mmGrainBoundary(q);
float shell=(d.x<2.5?1.:0.)*uScope,mmTone=clamp(microscope.x/.008,-1.,1.);
float height=field*.011+(grain-.5)*.0042;
float shellHeight=-pores.x*.006-crystals.x*.0009+(pores.y-.5)*.002+(pores.z-.5)*.004;
vec2 shellSlope=vec2(dFdx(shellHeight),dFdy(shellHeight));''')
change('shell*.055*mmFine','shell*(.07*mmTone+.12*pores.x-.14*crystals.y-.08*smoothstep(.65,.83,pores.y))')
change('albedo*=1.+shell*.035*mmLo;', '''albedo*=1.+shell*(.065*mmTone-.24*pores.x-.12*crystals.x+.14*crystals.z+.16*(pores.z-.5));
albedo=mix(albedo,vec3(.71,.70,.66),shell*.10*crystals.y*(1.-pores.x));''')
start=s.index('if(uMicro>0.&&uMode==0&&!cap){')
end=s.index('float moisture=uWet',start)
s=s[:start]+'''if((uMicro>0.||shell>0.)&&uMode==0&&!cap){
vec3 dx=dFdx(p),dy=dFdy(p),rx=dFdx(q),ry=dFdy(q);
vec3 pT=normalize(dx),pN=normalize(cross(dx,dy)),pB=cross(pN,pT);
vec3 qT=normalize(rx),qN=normalize(cross(rx,ry)),qB=cross(qN,qT);
mat3 restToWorld=mat3(pT,pB,pN)*transpose(mat3(qT,qB,qN));
vec3 microscopeWorld=restToWorld*microscope.yzw*(length(rx)/max(length(dx),1e-10));
vec3 r1=cross(dy,pN),r2=cross(pN,dx);float det=dot(dx,r1);
if(abs(det)>1e-12){
vec2 dh=uMicro*(.42/.13)*vec2(dFdx(height),dFdy(height))+shell*shellSlope;
vec3 grad=(r1*dh.x+r2*dh.y)/det+shell*microscopeWorld;
grad-=N*dot(grad,N);grad*=min(1.,1.35/max(length(grad),.001));
N=normalize(N-grad);
}
}
''' + s[end:]
# Diagnostics should expose the actual new high-band surface, not the old low-frequency scalar.
change('float v=.5+.34*tanh(mmSurface(q)*.70);','float v=.5+18.*mmRelief(q).x;')
change('17级倍频组织尺度，并用位置相关连续空间弯折降低明显重复。', '17级倍频组织尺度，并用位置相关连续空间弯折降低明显重复。R7 分离近表面频段，逐层计算导数，驱动蚀孔、晶粒、粗糙度与微法线；屏幕采样只负责抗锯齿。')
change('调节显微壳层时，顶点、索引和结构字段均保持。','调节显微壳层时，顶点、索引和结构字段均保持。毫米级起伏是表面着色近似，不改变轮廓、洞口或接触几何。显微入口锚定当前岩体的真实三角面。')
change('</style>', '\n@media(max-width:640px){nav.views{overflow-x:auto;justify-content:flex-start;scrollbar-width:none}nav.views button{flex:0 0 44px}.brand h1{font-size:14px}.subline{letter-spacing:.5px}}\n</style>')
for ident in ['worldSource','generateSource']:
    pattern=r'<script id="'+ident+r'" type="text/plain">(.*?)</script>'
    assert re.search(pattern,base,re.S)[1]==re.search(pattern,s,re.S)[1]
assert 'uMicro*grad' not in s
(OUT/'index.html').write_bytes(s.encode())
print(len(s.encode()),hashlib.sha256(s.encode()).hexdigest())
