from pathlib import Path
import hashlib
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
s=(OUT.parent/'landscape-surface-r8/index.html').read_text(encoding='utf-8')
assert hashlib.sha256(s.encode()).hexdigest()=='dbbe46a21d94b8e9cca0b50e96fa360a48fc788252b2a356f5aa64c88122c54c'
def change(a,b):
    global s
    assert a in s,a[:120]
    s=s.replace(a,b)
change('R8','R9')
change('SCULPTURE STUDY / 08','ROCK SURFACE / 09')
change("release:'limestone-water-surface-r8'","release:'limestone-water-surface-r9'")

# R8's rounded volume is retained; these finite, shallow chips add the missing
# mesoscopic band after the broad scalar regularization, before mesh extraction.
chip='''function chipRelief(x,y,z){
const X=x*.83,Y=y*.94,Z=z*.87,ix=Math.floor(X),iy=Math.floor(Y),iz=Math.floor(Z);let h=0;
for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++){
const i=ix+a,j=iy+b,k=iz+c,t=hash(i,j,k,941);if(t<.14)continue;
let u=X-i-(.25+.50*hash(i,j,k,947)),v=Y-j-(.25+.50*hash(i,j,k,953)),w=Z-k-(.25+.50*hash(i,j,k,967));
const co=Math.cos(t*6.283185),si=Math.sin(t*6.283185),A=co*u+si*w,C=-si*u+co*w;
const r=.34+.24*hash(i,j,k,971),B=v*(.88+.65*hash(i,j,k,977));
const d=Math.max(Math.abs(A)*.92+Math.abs(B)*.27,Math.abs(B)*.96+Math.abs(C)*.18,Math.abs(C)*.86+Math.abs(A)*.22,(Math.abs(A)+Math.abs(B)+Math.abs(C))*.53)/r;
h=Math.max(h,(.13+.19*hash(i,j,k,983))*smooth(1.,.16,d));
}
const area=smooth(.20,.44,noise(x*.14,y*.13,z*.15,991));return h*area;
}
'''
change('function joints(seed)',chip+'\nfunction joints(seed)')
change('parts=[],step=.4','parts=[],step=.32')
# Snap edge crossings within 1e-5 of a lattice endpoint to the shared endpoint.
# Otherwise Float32 conversion can collapse separate edge vertices into zero
# area faces. The shared lattice key welds them before connectivity is emitted.
change('if(values[a]===0||values[b]===0){let v=values[a]===0?a:b;key=-v-1;t=values[a]===0?0:1;', 'if(t<1e-5||t>1-1e-5){let v=t<1e-5?a:b;key=-v-1;t=t<1e-5?0:1;')
# Same physical sigma as R8 despite finer fixed sampling.
change('tmp[i]=.20*values[i-stride]+.60*values[i]+.20*values[i+stride]', 'tmp[i]=.3125*values[i-stride]+.375*values[i]+.3125*values[i+stride]')
change('}values.set(tmp);\n}}', '''}values.set(tmp);
}const shellBase=values.slice();for(let k=2;k<nz-2;k++)for(let j=2;j<ny-2;j++)for(let i=2;i<nx-2;i++){const id=i+j*nx+k*nx*ny;
if(Math.abs(values[id])<1.2){const x=lo[0]+i*step,y=lo[1]+j*step,z=lo[2]+k*step;
const interior=Math.min(shellBase[id-2],shellBase[id+2],shellBase[id-2*nx],shellBase[id+2*nx],shellBase[id-2*nx*ny],shellBase[id+2*nx*ny]);
const thickness=smooth(.24,.58,-interior);values[id]+=chipRelief(x,y,z)*thickness*(1-smooth(.7,1.2,Math.abs(values[id])));}}
}''')
change('sculpt:{version:8,','sculpt:{version:9,chipDepthBoundM:.32,')

# Sky exposure is evaluated on the final placed geometry, independently of sun.
# Pack it into the rock-only e.x slot previously used for unused soil thickness.
sky='''function skyExposure(x,y,z,n){let clear=0;const ax=x+n[0]*.22,ay=y+n[1]*.22,az=z+n[2]*.22;
for(const dir of [[0,1,0],[.42,.91,0],[-.21,.91,.36],[-.21,.91,-.36]]){let open=true;
for(const h of [.3,.65,1.3,2.6,5.2,10.4,20.8,41.6,75])if(sceneField(ax+dir[0]*h,ay+dir[1]*h,az+dir[2]*h)<-.035){open=false;break;}if(open)clear+=.25;}
return clear;}
'''
change('function shade(x,y,z,n)',sky+'function shade(x,y,z,n)')
habitat_cpu='''const habitatReports=[];
function habitatOnMesh(p,water){const P=p.positions,N=p.N,I=p.indices,count=P.length/3,src=new Float32Array(count*4);let sumSky=0;
for(let i=0;i<count;i++){const k=i*3,j=i*4,sky=skyExposure(P[k],P[k+1],P[k+2],[N[k],N[k+1],N[k+2]]);src.set([sky,N[k],N[k+1],N[k+2]],j);sumSky+=sky;}
// Average only connected surface neighbours; thin cavity walls never exchange.
for(let pass=0;pass<14;pass++){const dst=new Float32Array(src),weight=new Float32Array(count).fill(1);
for(let k=0;k<I.length;k+=3)for(let e=0;e<3;e++){let a=I[k+e],b=I[k+(e+1)%3];for(let j=0;j<4;j++){dst[a*4+j]+=src[b*4+j];dst[b*4+j]+=src[a*4+j];}weight[a]++;weight[b]++;}
for(let i=0;i<count;i++)for(let j=0;j<4;j++)src[i*4+j]=dst[i*4+j]/weight[i];}
const result=new Float32Array(count),zones={summit:{n:0,sum:0},roof:{n:0,sum:0},wall:{n:0,sum:0}};
for(let i=0;i<count;i++){const j=i*4,k=i*3,sky=src[j],ny=src[j+2]/(Math.hypot(src[j+1],src[j+2],src[j+3])||1),up=W.smooth(-.04,.72,ny),flow=water[i];
result[i]=W.clamp(.82*sky*up+.62*flow)*(.45+.55*up)*W.smooth(-.20,.35,ny)*W.smooth(.02,.15,sky+.28*flow);
const zone=ny<-.45?'roof':P[k+1]>32&&ny>.35?'summit':'wall';zones[zone].n++;zones[zone].sum+=result[i];}
for(const zone of Object.values(zones))zone.mean=zone.sum/Math.max(1,zone.n);habitatReports.push({part:p.name,meanSky:sumSky/count,zones});return result;
}
'''
change('for(let pi=0;pi<parts.length;pi++)',habitat_cpu+'for(let pi=0;pi<parts.length;pi++)')
change('water=p.kind<3?rainOnMesh(p):null;let over=0','water=p.kind<3?rainOnMesh(p):null,habitat=water?habitatOnMesh(p,water):null;let over=0')
change('p.pocket?.45:w.soilThickness(x,z),p.event,water?water[i]:0','p.kind<3?habitat[i]:(p.pocket?.45:w.soilThickness(x,z)),p.event,water?water[i]:0')

# A stable finite chipped surface band with crisp shoulders. It is independent
# of R7's preserved millimetre pore and analytic microscope normal functions.
glsl='''vec2 rockChips(vec3 q){
vec3 v=q*vec3(2.3,3.1,2.5)+vec3(11.3,7.1,-3.9),cell=floor(v),f=fract(v);float pit=0.,lip=0.;
for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
vec3 o=vec3(float(x),float(y),float(z)),id=cell+o;float seed=bmH(id+31.);if(seed<.16)continue;
vec3 d=f-o-(.25+.5*vec3(bmH(id+17.),bmH(id+41.),bmH(id+67.)));float a=seed*6.283185;
d.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*d.xz;d.y*=.85+.65*bmH(id+97.);
float r=.26+.26*bmH(id+101.),m=max(max(abs(d.x)*.92+abs(d.y)*.27,abs(d.y)*.96+abs(d.z)*.18),max(abs(d.z)*.86+abs(d.x)*.22,dot(abs(d),vec3(.53))))/r;
float cut=1.-smoothstep(.20,1.,m);pit=max(pit,cut*(.35+.65*bmH(id+131.)));lip=max(lip,(1.-smoothstep(.025,.15,abs(m-.78)))*cut);
}
float patchMask=smoothstep(.18,.44,bmN(q*.28+vec3(9.,3.,21.))),foot=max(length(dFdx(v)),length(dFdy(v))),integrated=exp(-1.2*foot*foot);return vec2(pit,lip)*patchMask*integrated;
}
'''
change('vec3 linearize(vec3 c)',glsl+'vec3 linearize(vec3 c)')
change('float height=field*.011+(grain-.5)*.0042;', '''vec2 chips=rockChips(q);float chipGain=d.x<1.5?1.:.25;
float height=field*.011+(grain-.5)*.0042-chipGain*chips.x*.018;
albedo*=1.-chipGain*chips.x*.13;albedo=mix(albedo,vec3(.64,.636,.595),chipGain*chips.y*.09);''')
change('float moss=smoothstep(.47,.66,habitat)*smoothstep(.20,.57,retention)*smoothstep(-.22,.38,n0.y)*clamp(uStage/4.,0.,1.);', '''float stableWet=clamp(e.x,0.,1.)*(1.-.14*sun);
float moss=smoothstep(.32,.60,habitat+.12*stableWet)*smoothstep(.10,.50,stableWet)*clamp(uStage/4.,0.,1.);''')
change('vec3(.13,.207,.061),vec3(.33,.375,.132)','vec3(.145,.20,.079),vec3(.275,.32,.145)')
change('vec3(.43,.44,.23)','vec3(.35,.37,.21)')
change("report.numericalDust=numericalDust;", "report.habitat={model:'final-surface four-direction sky visibility plus routed rain, surface neighbourhood slope retention, sun drying and fixed patch field',unmeasuredSeepage:false,parts:habitatReports};report.numericalDust=numericalDust;")
# Many small source-connected chips can separate at this fixed precision.
# Combine their draw buffers without removing a vertex, face or support record.
change("progress(1,'完成');return {parts,report};", '''const shards=parts.filter(p=>p.kind===2&&!p.brickSpecimen);if(shards.length>1){const V=new Float32Array(shards.reduce((s,p)=>s+p.vertices.length,0)),I=new Uint32Array(shards.reduce((s,p)=>s+p.indices.length,0));let v=0,t=0;
for(const p of shards){V.set(p.vertices,v);for(let j=0;j<p.indices.length;j++)I[t+j]=p.indices[j]+v/16;v+=p.vertices.length;t+=p.indices.length;}
const set=new Set(shards);for(let i=parts.length-1;i>=0;i--)if(set.has(parts[i]))parts.splice(i,1);parts.push({name:'同精度岩面碎屑',kind:2,event:0,stride:16,vertices:V,indices:I});}
report.renderBatches=parts.length;report.shardBatchSourceCount=shards.length;
progress(1,'完成');return {parts,report};''')
change('<button data-view="micro">显微</button>', '<button data-view="summit">山顶</button><button data-view="micro">显微</button>')
change('views={hero:', 'views={summit:[[27,73,36],[-5,34,0]],hero:')
change("['micro','cliff','cave','foot','back','stone','section']", "['summit','micro','cliff','cave','foot','back','stone','section']")
start=s.index('<div class="modal"');end=s.index('<div id="loading"',start)
s=s[:start]+'''<div class="modal" id="modal"><article><div class="row"><h2>水蚀石灰岩 · 来源与范围</h2><button id="closeinfo" aria-label="关闭说明">×</button></div><p>R9 在 R8 主形上增加浅的碎蚀坑和带棱角的表面肌理，保留少量平滑面及细孔。大小洞口继续保持圆滑厚实的交界。</p><p>苔藓外观读取最终表面的受雨方向、来水、坡度与日照。朝上的山顶和台阶增加斑块；没有来水的遮蔽面减少。未绑定真实渗水或物种资料，因此这是分布近似。</p><p>样板为有体积的三维数值资产，无图片贴图、无 LOD。视角和表面调节不改变几何；显微微法线不改变轮廓。本样板未绑定实测 DEM 或实测地质过程。</p><p id="details"></p></article></div>
'''+s[end:]
(OUT/'index.html').write_text(s,encoding='utf-8',newline='\n')
print('R9',len(s.encode()),hashlib.sha256(s.encode()).hexdigest())
