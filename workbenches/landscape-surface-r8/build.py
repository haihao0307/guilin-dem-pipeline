from pathlib import Path
import hashlib, re

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
s=(ROOT/'workbenches/landscape-surface-r7/index.html').read_text(encoding='utf-8')
assert hashlib.sha256(s.encode()).hexdigest()=='c6e0d891dc6b1e48353ef2aa935bda956876525d135f2f64fb68d5cc771eafac'
def change(a,b,count=None):
    global s
    assert a in s,a[:150]
    s=s.replace(a,b) if count is None else s.replace(a,b,count)

change('R7','R8')
change('SURFACE STUDY / 07','SCULPTURE STUDY / 08')
change("release:'limestone-water-surface-r7'","release:'limestone-water-surface-r8'")

# Fixed, metric shape bands derived from the microscope cosine composition.
# No time, camera or radial-world replacement. Offset domain excludes its poles.
sculpt='''function microscopeShape(x,y,z,seed){
const a=x*.13+7.1,b=y*.13+9.3,c=z*.13+6.7;
const wx=noise(a*.61,b*.57,c*.59,seed+811)-.5,wy=noise(a*.49,b*.53,c*.47,seed+827)-.5,wz=noise(a*.57,b*.43,c*.51,seed+839)-.5;
const X=a+wx*.52,Y=b+wy*.52,Z=c+wz*.52,R=Math.hypot(X,Y,Z);
const u=Math.log2(R)-2.2+.17*(.36*x-.80*y+.48*z),v=-Z/R-1+.17*(.48*x+.60*y+.64*z),w=Math.atan2(X,Y)+.17*(-.80*x+.60*z);
let h=0,scale=1;for(let j=0;j<5;j++){const A=Math.cos(u*scale),B=Math.cos(v*scale),C=Math.cos(w*scale);h+=(Math.cos(C*A+B*B+B*A)-.45)/scale*Math.exp(-.5*(.4*.34*scale)**2);scale*=2;}
return .85*Math.tanh(h*.92);
}
// Donor interpretation: interrupted beds and anisotropic, finite chips become
// shallow limestone shelves. No box envelope or repeated chip stencil is copied.
function donorStructure(x,y,z,seed){
const bend=(noise(x*.09,y*.05,z*.08,seed+921)-.5)*2.8;
const bed=y*.83+x*.13+z*.09+bend;
const plate=noise(x*.29,bed*.71,z*.31,seed+929);
const breakage=noise(x*.63+3,bed*.21,z*.57-4,seed+937);
return .43*(plate-.5)+.22*smooth(.48,.79,breakage)*Math.tanh((plate-.52)*5);
}
'''
change('function joints(seed)',sculpt+'\nfunction joints(seed)')
change('1.1*detail(x*.44+3,y*.49,z*.48+7,4)', '.48*detail(x*.34+3,y*.39,z*.38+7,3)+c.relief*(microscopeShape(x,y,z,c.seed)+donorStructure(x,y,z,c.seed))')
change('for(let i=0;i<38;i++)','for(let i=0;i<86;i++)')
change("let big=i%3===0,r=[big?1.5+hash(i,1,3,seed)*2.3:.6+hash(i,1,3,seed)*1.1,big?1.7+hash(i,2,3,seed)*2.4:.75+hash(i,2,3,seed)*1.2,big?1.2+hash(i,3,3,seed)*2.3:.6+hash(i,3,3,seed)*.9];", "let size=hash(i,19,3,seed),big=size>.77,rad=.52+3.5*size**2.6,r=[rad*(.76+.48*hash(i,1,3,seed)),rad*(.82+.64*hash(i,2,3,seed)),rad*(.65+.61*hash(i,3,3,seed))];")
change('if(big)for(let j=0;j<4;j++)','if(big)for(let j=0;j<2+Math.floor(hash(i,17,6,seed)*4);j++)')
change('let a=j*1.8+hash(i,j,3,seed)','let a=hash(i,j,3,seed)*6.283185')
change("+.6),o={type:1", "+.95),o={type:1")
change("if(q<.7)hollow=Math.min(hollow,q+.12*(noise(x*1.13,y*1.08,z*.97,seed+819)-.5))", "if(q<.9)hollow=smin(hollow,q+.16*(noise(x*.71,y*.68,z*.67,seed+819)-.5),.32)")
change('Math.abs(U+wander)-width,ell,.17);d=Math.max(d,-slit)', 'Math.abs(U+wander)-Math.max(.18*jointFactor,width),ell,.32);d=smax(d,-slit,.40)')
change('d=Math.max(d,-fork)', 'd=smax(d,-fork,.44)')
change('.40*detail(x*1.3,y*.59,z*1.21,4)', '.16*detail(x*.81,y*.45,z*.77,3)')
change('d=Math.max(d,-cavity)', 'd=smax(d,-cavity,.62)')
change('d=Math.max(d,-cave)', 'd=smax(d,-cave,.66)')
change('d=Math.max(d,-notch)', 'd=smax(d,-notch,.66)')
change('d=Math.max(d,-cut(e,x,y,z))', 'd=smax(d,-cut(e,x,y,z),.48)')
change(".5*(fbm(x*.07,0,z*.07,c.seed+330)-.5)", ".5*(fbm(x*.07,0,z*.07,c.seed+330)-.5)+.72*microscopeShape(x,0,z,c.seed+330)+.20*donorStructure(x,0,z,c.seed+330)")

# Sample once at fixed resolution and regularize the scalar volume, not vertices.
# The same filtered scalar grid is used by collisions, shadows and the section.
# This removes sub-grid fins before extraction and keeps a watertight tetra mesh.
change('function mesh(field,lo,hi,step,progress){','function mesh(field,lo,hi,step,progress,rounding=0){')
blur='''if(rounding){const tmp=new Float32Array(NT);for(let pass=0;pass<2;pass++)for(let axis=0;axis<3;axis++){
const stride=[1,nx,nx*ny][axis],extent=[nx,ny,nz][axis];tmp.set(values);
for(let i=stride;i<NT-stride;i++){const j=Math.floor(i/stride)%extent;if(j===0||j===extent-1)continue;tmp[i]=.20*values[i-stride]+.60*values[i]+.20*values[i+stride];}values.set(tmp);
}}
'''
change('const pos=[],ind=[],edges=new Map()',blur+'const pos=[],ind=[],edges=new Map()')
change('parts=[],step=.5','parts=[],step=.4')
change("p=>progress(.02+p*.37,'由体积函数提取固定网格'))", "p=>progress(.02+p*.37,'由体积函数提取固定网格'),1)")
change('lo,hi,step),groups=W.splitComponents(full)', 'lo,hi,step,undefined,1),groups=W.splitComponents(full)')
change('w.perimeter(x,z)*40,-w.rock(x,y,z)', 'w.perimeter(x,z)*40,-grid.at(x,y,z)')
change('parts.push(capMesh(w.rock,', 'parts.push(capMesh(grid.at,')
change('Math.max(soilField(x,y,z),-w.rock(x,y,z))','Math.max(soilField(x,y,z),-grid.at(x,y,z))')
change('geometryGridM:step,','geometryGridM:step,sculpt:{version:8,scalarRegularizationSigmaM:.357771,geometryBands:5,microBands:17,donorBeds:true,groundSculpt:true},')

# Preserve R7 micro pores and analytic microscope derivative; slightly enrich
# only sparse broken grain boundaries, with stable pair and spatial interruption.
change('smoothstep(.86,.98,pair)','smoothstep(.81,.97,pair)*smoothstep(.26,.66,bmN(q*21.7+vec3(9.,3.,17.)))')
change('crystals.x*.0009','crystals.x*.0011')
change('inclusion*.30','inclusion*.10')
change('albedo*=mix(1.,.73,uWet);rough=.99;', '''vec3 soilQ=p*.24+vec3(8.,3.,17.);vec4 soilMicro=mmRelief(soilQ);
float clumps=bmSum(p*3.4+vec3(3.,7.,11.)),soilH=clumps*.018;
albedo*=1.+uScope*(.10*clumps+.035*clamp(soilMicro.x/.008,-1.,1.));
if(uMode==0&&!cap&&uScope>0.){vec3 dx=dFdx(p),dy=dFdy(p),gn=normalize(cross(dx,dy)),r1=cross(dy,gn),r2=cross(gn,dx);float det=dot(dx,r1);
if(abs(det)>1e-12){vec3 grad=(r1*dFdx(soilH)+r2*dFdy(soilH))/det+soilMicro.yzw*.72;grad-=N*dot(grad,N);grad*=min(1.,.8/max(length(grad),.001));N=normalize(N-uScope*grad);}}
albedo*=mix(1.,.73,uWet);rough=.99;''')
change('只在现有岩石表面采样并改变微法线与粗糙度，不参与峰体、洞口、峰脚、土体或落石位置。','调节岩石和地面的近表面质感；已经雕刻的三维起伏保持固定。')

start=s.index('<div class="modal"')
end=s.index('<div id="loading"',start)
s=s[:start]+'''<div class="modal" id="modal"><article><div class="row"><h2>水蚀石灰岩 · 来源与范围</h2><button id="closeinfo" aria-label="关闭说明">×</button></div><p>R8 保留 R7 的细孔与显微质感，重新雕刻洞口、裂隙边缘和地面起伏。大小错落的溶窝、缓和的洞唇、断续层状岩面都由真实三维体积承担。</p><p>Macroscopic microscope 的多尺度余弦组织分别用于固定形体和微表面；层状起伏参考已接入的 Brick Mother 毛石方法。调节表面强度、光照或视角不会改变几何。毫米级细节仍为数值微法线近似。</p><p>样板支持旋转、缩放、双击贴近岩面和剖面观察。没有图片贴图，也不按设备或距离切换几何精度。石块支承、遮蔽与来水读取本轮重建后的表面。</p><p>这是未绑定实测 DEM 的局部形态样板；孔洞尺度、风化过程和石块停留为构造假设，未代表实测地质或动力学模拟。</p><p id="details"></p></article></div>
'''+s[end:]
(OUT/'index.html').write_text(s,encoding='utf-8',newline='\n')
print('R8',len(s.encode()),hashlib.sha256(s.encode()).hexdigest())
