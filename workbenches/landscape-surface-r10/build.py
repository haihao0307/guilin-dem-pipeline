from pathlib import Path
import hashlib
OUT=Path(__file__).resolve().parent
s=(OUT.parent/'landscape-surface-r9/index.html').read_text(encoding='utf-8')
assert hashlib.sha256(s.encode()).hexdigest()=='7183e44b746577c6887927a6dd62ae6ddd1dba7020aac662a148da508a5ce4be'
def change(a,b):
    global s
    assert a in s,a[:150]
    s=s.replace(a,b)
change('R9','R10')
change('ROCK SURFACE / 09','ROCK SCULPTURE / 10')
change("release:'limestone-water-surface-r9'","release:'limestone-water-surface-r10'")
start=s.index('function chipRelief(');end=s.index('function joints(',start)
s=s[:start]+'''const facetCells=new Map();
function facetCell(i,j,k,band){const key=i+512+1024*(j+512)+1048576*(k+512)+1073741824*band;if(facetCells.has(key))return facetCells.get(key);
const seed=941+band*101,u=hash(i,j,k,seed),v=hash(i,j,k,seed+7)*6.283185,w=hash(i,j,k,seed+13)*6.283185;
const a=Math.sqrt(1-u)*Math.sin(v),b=Math.sqrt(1-u)*Math.cos(v),c=Math.sqrt(u)*Math.sin(w),d=Math.sqrt(u)*Math.cos(w);
const R=[1-2*(b*b+c*c),2*(a*b-c*d),2*(a*c+b*d),2*(a*b+c*d),1-2*(a*a+c*c),2*(b*c-a*d),2*(a*c-b*d),2*(b*c+a*d),1-2*(a*a+b*b)];
const cell={C:[i+.18+.64*hash(i,j,k,seed+19),j+.18+.64*hash(i,j,k,seed+23),k+.18+.64*hash(i,j,k,seed+29)],R,r:.32+.34*hash(i,j,k,seed+31),aspect:[.72+.56*hash(i,j,k,seed+37),.66+.65*hash(i,j,k,seed+41),.78+.48*hash(i,j,k,seed+43)],depth:band===0?.22+.46*hash(i,j,k,seed+47):.05+.15*hash(i,j,k,seed+47),active:u>.21};facetCells.set(key,cell);return cell;}
function facetBand(x,y,z,band){const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z);let out=0;
for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){const o=facetCell(i+a,j+b,k+c,band);if(!o.active)continue;
const dx=x-o.C[0],dy=y-o.C[1],dz=z-o.C[2],R=o.R,u=(R[0]*dx+R[1]*dy+R[2]*dz)/o.aspect[0],v=(R[3]*dx+R[4]*dy+R[5]*dz)/o.aspect[1],w=(R[6]*dx+R[7]*dy+R[8]*dz)/o.aspect[2];
const d=Math.max(Math.abs(u)*.92+Math.abs(v)*.27,Math.abs(v)*.96+Math.abs(w)*.18,Math.abs(w)*.86+Math.abs(u)*.22,(Math.abs(u)+Math.abs(v)+Math.abs(w))*.53)/o.r;
// Piecewise planar shoulder and flat floor: not a rounded spherical dimple.
out=Math.max(out,o.depth*clamp((1-d)*(band===0?3.8:2.1)));}return out;}
function chipRelief(x,y,z){
const a=.36*x-.80*y+.48*z,b=.48*x+.60*y+.64*z,c=-.80*x+.60*z;
const wx=noise(x*.061+7,y*.057,z*.063,1031)-.5,wy=noise(x*.053,y*.067+11,z*.059,1033)-.5,wz=noise(x*.069,y*.051,z*.061+19,1039)-.5;
const coarse=facetBand(a*.31+wx*.85+7.7,b*.31+wy*.85-4.3,c*.31+wz*.85+2.1,0);
const fine=facetBand((.80*a+.60*c)*.83+wz*.62-13.1,b*.83+wx*.62+8.7,(-.60*a+.80*c)*.83+wy*.62+3.4,1);
return Math.min(.72,coarse+fine)*smooth(.17,.43,noise(x*.11,y*.12,z*.10,991));
}

'''+s[end:]
change('chipDepthBoundM:.32',"chipScalarBoundM:.72,rotation:'full quaternion per cell; independent rotated warped bands'")
change('sculpt:{version:9,','sculpt:{version:10,')
change('const shellBase=values.slice();for(let k=2;', '''const shellBase=values.slice();
function solidAt(x,y,z){const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z);if(i<0||j<0||k<0||i>=nx-1||j>=ny-1||k>=nz-1)return 0;const a=i+j*nx+k*nx*ny,u=x-i,v=y-j,w=z-k,sy=nx,sz=nx*ny;return mix(mix(mix(shellBase[a],shellBase[a+1],u),mix(shellBase[a+sy],shellBase[a+sy+1],u),v),mix(mix(shellBase[a+sz],shellBase[a+sz+1],u),mix(shellBase[a+sz+sy],shellBase[a+sz+sy+1],u),v),w);}
for(let k=2;''')
change('const thickness=smooth(.24,.58,-interior);values[id]+=chipRelief(x,y,z)*thickness*(1-smooth(.7,1.2,Math.abs(values[id])));', '''const gx=(shellBase[id+1]-shellBase[id-1])/(2*step),gy=(shellBase[id+nx]-shellBase[id-nx])/(2*step),gz=(shellBase[id+nx*ny]-shellBase[id-nx*ny])/(2*step),g=Math.hypot(gx,gy,gz);
const behind=g>1e-7?solidAt(i-.8/step*gx/g,j-.8/step*gy/g,k-.8/step*gz/g):0;
const thickness=smooth(.24,.58,-interior)*smooth(.25,.62,-behind);values[id]+=.60*chipRelief(x,y,z)*Math.min(1.,g)*thickness*(1-smooth(.7,1.2,Math.abs(values[id])));''')

# World-wide, bounded-gradient shears with full 3D rotations. Unlike the donor's
# small object-centred twists, these do not disappear on the top of a large rock.
frame='''vec3 rockRotate(vec3 p,vec3 axis,float angle){axis=normalize(axis);float c=cos(angle),s=sin(angle);return c*p+s*cross(axis,p)+(1.-c)*axis*dot(axis,p);}
vec3 rockFrame(vec3 p){
p=rockRotate(p,vec3(.37,.81,-.46),.73);
p+=.19*(vec3(bmN(p*.73+vec3(7.,3.,19.)),bmN(p*.69+vec3(13.,23.,5.)),bmN(p*.77+vec3(29.,11.,17.)))-.5);
p=rockRotate(p,vec3(-.71,.23,.67),-.91);
p+=.07*(vec3(bmN(p*2.13+17.),bmN(p*1.97+31.),bmN(p*2.07+47.))-.5);return p;}
float rockSum(vec3 p){float footprint=max(length(dFdx(p)),length(dFdy(p))),freq=1.,amp=1.,sum=0.;
for(int j=0;j<4;j++){float integrated=exp(-.8*footprint*footprint*freq*freq);sum+=integrated*(bmCell(p)-.6556965)*amp;
p=rockRotate(p,normalize(vec3(.31+.17*float(j),.79-.11*float(j),-.47+.29*float(j))),.81+float(j)*.37);
float ratio=1.91+.13*float(j);p=p*ratio+vec3(7.13+float(j)*2.7,-3.71-float(j)*1.9,5.47+float(j)*3.1);freq*=ratio;amp*=.43;}return sum;}
'''
change('vec2 rockChips(vec3 q)',frame+'vec2 rockChips(vec3 q)')
change('vec3 v=q*vec3(2.3,3.1,2.5)+vec3(11.3,7.1,-3.9)', 'vec3 v=rockFrame(q*.13)/.13*vec3(2.3,3.1,2.5)+vec3(11.3,7.1,-3.9)')
change('d.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*d.xz;', 'd=rockRotate(d,vec3(bmH(id+151.),bmH(id+173.),bmH(id+197.))-.5,a);')
change('float cut=1.-smoothstep(.20,1.,m)', 'float cut=clamp((1.-m)*1.65,0.,1.)')
change('vec3 localQ=q*.13,mq=bmCoordinates(localQ)+vec3(.329,-.217,.133);', 'vec3 localQ=d.x<1.5?rockFrame(q*.13):q*.13,mq=(d.x<1.5?localQ:bmCoordinates(localQ))+vec3(.329,-.217,.133);')
change('float field=bmSum(mq*(family==5?36.:family==6?38.4:33.6));', 'float field=d.x<1.5?rockSum(mq*33.6):bmSum(mq*(family==5?36.:family==6?38.4:33.6));')
change('chipGain*chips.x*.018','chipGain*chips.x*.022')
start=s.index('<div class="modal"');end=s.index('<div id="loading"',start)
s=s[:start]+'''<div class="modal" id="modal"><article><div class="row"><h2>水蚀石灰岩 · 来源与范围</h2><button id="closeinfo" aria-label="关闭说明">×</button></div><p>R10 保留圆润的岩体与大洞，在表面加入多方向的碎蚀断面。粗、细两层分别旋转、错开尺度并连续弯折，减弱成排与重复的视觉关系。</p><p>较大的浅切削带有平坦断面和清晰转折，由真实三维几何承担。显微细孔继续保留，微法线只补充近表面质感。苔藓继续读取受雨、来水和坡度。</p><p>样板无图片贴图、无 LOD，几何不随视角或设备改变。场景未绑定实测 DEM、地质过程或物种调查，属于局部形态与外观样板。</p><p id="details"></p></article></div>
'''+s[end:]
(OUT/'index.html').write_text(s,encoding='utf-8',newline='\n')
print('R10',len(s.encode()),hashlib.sha256(s.encode()).hexdigest())
