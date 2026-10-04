"""Pigment-only revision of approved Young R01; never edits its teacher shader."""
from pathlib import Path
import re,json,hashlib,sys,shutil,runpy
P=Path(__file__).resolve().parent
base=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
expected={'index.html':'1f4f6971dbd747b0185f341e8d320ab479bf942b2c18599fa26beff3bc106013','runtime.js':'96f6d7c4dc206774dccb2b4e17802d4a9a238c72a62d777c76980ec5ad3662b0','studio.css':'72d082d5240ec8c0e2ba115f727b624d9699fa4e0f067bd1ada09aa3151cae14','studio.js':'317a3a5f2de487d888ce6de954ff676fd95ae3b4b05510d7662f1a6af50546e5','young-coral-r01/index.html':'555c4986a0ef04bba12b36732fe696b37a90ea3b2b3edc1272742c760b608461'}
for n,h in expected.items():
 b=(base/n).read_bytes();assert hashlib.sha256(b).hexdigest()==h,('Concurrent baseline change; stop',n)
 (out/n).parent.mkdir(parents=True,exist_ok=True);(out/n).write_bytes(b)
A=runpy.run_path(str(P/'ui.py'));f=(P/'student-color.frag').read_text().strip();fs=hashlib.sha256(f.encode()).hexdigest()
assert fs=='a395ddf1ab5b5bfa6a24d4a98fb63fe087219c0c730a179b04e1d750043c024a','color source changed'
s=(base/'young-coral-r01/index.html').read_text();(out/'young-coral-r01/baseline-r01.html').write_text(s)
teacher=re.search(r'<script id="shader" type="text/plain">(.*?)</script>',s,re.S)[1].strip()
assert hashlib.sha256(teacher.encode()).hexdigest()=='60f2ed28f199c435ffac60a6f9fde0426ff64246e69d5016eaf7fe65b5f5da2f'
s=s.replace('young-study-r01-20261003','young-color-r02-20261004').replace('Coral Mother · 芽簇形态 R01','Coral Mother · 芽簇形态 色彩 R02').replace('YOUNG R01 · 20261003','COLOR R02 · 20261004').replace('<h1>芽簇形态 · 原码学习</h1>','<h1>芽簇形态 · 色彩研究</h1>')
s=s.replace('</style>',A['css']+'</style>',1)
s=s.replace('<div class="stage" id="stage">',A['ui']+'\n<div class="stage" id="stage">',1)
s=s.replace('<span class="code">B</span>学生 · 原码复演','<span class="code">B</span><span id="studentRole">学生 · 金棕 · 奶油</span>',1)
s=s.replace('老师 · 原码基线','老师 · R01 锚点',1).replace('同时刻','同一时刻')
s=s.replace('<details><summary>观察记录',A['notes']+'\n<details><summary>R01 观察记录',1)
s=s.replace("const S=window.YoungStudyState={","const S=window.YoungStudyState={palette:1,colorSettings:{},geometryChanged:false,colorShaderHash:'"+fs+"',",1)
s=s.replace("if(new URLSearchParams(location.search).has('embedded'))",A['controls']+"\nif(new URLSearchParams(location.search).has('embedded'))",1)
s=s.replace('<script id="shader" type="text/plain">','<script id="colorShader" type="text/plain">'+f+'</script>\n<script id="shader" type="text/plain">',1)
needle="return{key,c,gl,p,vao,u,fence:null}}";assert needle in s
extra=r"""let color=null;
if(key==='student'){
 const cp=gl.createProgram(),cv=comp(gl,gl.VERTEX_SHADER,'#version 300 es\nconst vec2 P[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));void main(){gl_Position=vec4(P[gl_VertexID],0.,1.);}'),cf=comp(gl,gl.FRAGMENT_SHADER,$('colorShader').textContent.trim());
 gl.attachShader(cp,cv);gl.attachShader(cp,cf);gl.linkProgram(cp);
 if(!gl.getProgramParameter(cp,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(cp));
 gl.deleteShader(cv);gl.deleteShader(cf);
 color={p:cp,u:[gl.getUniformLocation(cp,'iResolution'),gl.getUniformLocation(cp,'iTime')],palette:gl.getUniformLocation(cp,'uPalette'),strength:gl.getUniformLocation(cp,'uPigment'),mottle:gl.getUniformLocation(cp,'uMottle'),pale:gl.getUniformLocation(cp,'uPale')};
}
return{key,c,gl,p,vao,u,color,fence:null}}"""
s=s.replace(needle,extra)
needle="const{gl,p,vao,u,c,key}=v;";assert needle in s
s=s.replace(needle,"const{gl,vao,c,key}=v;const colored=key==='student'&&colorPref.palette!==0&&colorPref.strength>0;const pass=colored?v.color:v;const{p,u}=pass;")
s=s.replace('gl.uniform1f(u[1],phase+time);gl.drawArrays','gl.uniform1f(u[1],phase+time);if(colored){gl.uniform1i(pass.palette,colorPref.palette);gl.uniform1f(pass.strength,colorPref.strength);gl.uniform1f(pass.mottle,colorPref.mottle);gl.uniform1f(pass.pale,colorPref.pale)}gl.drawArrays')
s=s.replace("'同程序 / 同一时刻'","'R01 原码 / 同时刻'")
s=s.replace("views=[make('student'),make('teacher')];layout();","views=[make('student'),make('teacher')];applyColor();layout();")
s=s.replace('window.YoungStudy={state:S,','window.YoungStudy={setPalette(n){colorPref.palette=Math.max(0,Math.min(4,Math.round(n)));applyColor()},setColor(values){Object.assign(colorPref,values);applyColor()},state:S,')
assert re.search(r'<script id="shader" type="text/plain">(.*?)</script>',s,re.S)[1].strip()==teacher
(out/'young-coral-r01/index.html').write_text(s)
h=(base/'index.html').read_text().replace('<b>芽簇形态 R01</b>','<b>芽簇 · 色彩 R02</b>').replace('<small>原码学习 · 实时复演</small>','<small>R01 形态保留 · 四组试色</small>')
h=h.replace('R05 + YOUNG R01','R05 + YOUNG COLOR R02').replace('runtime.js?v=R05-young-r01-20261003','runtime.js?v=young-color-r02-20261004');(out/'index.html').write_text(h)
j=(base/'runtime.js').read_text().replace('young-coral-r01/?embedded=1&v=R01','young-coral-r01/?embedded=1&v=COLOR-R02-20261004')
old="young:['芽簇形态 R01','基于用户提供的 Yohei Nishitsuji 紧凑原码：98次外循环、12次反演折叠；只补确定初始化和不透明输出。老师小窗与学生主窗均实时运行该码。时间仅改变观察变换，不是生长模拟。']"
new="young:['芽簇色彩 R02','R01 老师原码冻结。学生新增金棕奶油、绿棕灰绿、棕底绿点、锈橙浅褐四套程序化试色；原色或0%强度直接回到原程序。形态与相机不变。NOAA/PICRC提供研究依据，不是官方色卡或幼体鉴定。']"
assert old in j
j=j.replace(old,new).replace('studio-r05-young-r01-20261003','studio-r05-young-color-r02-20261004');(out/'runtime.js').write_text(j)
m={'version':'YOUNG-COLOR-R02-20261004','base':expected,'files':{n:hashlib.sha256((out/n).read_bytes()).hexdigest() for n in expected},'teacher_shader_sha256':hashlib.sha256(teacher.encode()).hexdigest(),'student_color_sha256':fs,'geometry_changed':False,'palette_rgb_calibrated':False,'biological_identification':False,'student_color_names':['R01原色','金棕奶油','绿棕灰绿','棕底绿点','锈橙浅褐'],'blue_restored':False,'color_coral_r02_restored':False}
assert m['files']['young-coral-r01/index.html']=='ea5ec86ed6124b80a8c6dc3b363bb8ad49fcb36c0edac61212ecbd16fd5d6aa5',m
(out/'COLOR_R02_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(json.dumps(m,ensure_ascii=False,indent=2))
