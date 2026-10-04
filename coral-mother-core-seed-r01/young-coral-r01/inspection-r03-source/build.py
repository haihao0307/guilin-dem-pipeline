from pathlib import Path
import hashlib,re,json,shutil,sys,runpy
P=Path(__file__).resolve().parent;B=Path(sys.argv[1]);O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True)
manifest=json.loads((B/'COLOR_R02_MANIFEST.json').read_text())
for n,h in manifest['files'].items():
 assert hashlib.sha256((B/n).read_bytes()).hexdigest()==h,('changed accepted baseline',n)
 (O/n).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/n,O/n)
A=runpy.run_path(str(P/'ui.py'));s=(B/'young-coral-r01/index.html').read_text()
(O/'young-coral-r01/baseline-color-r02.html').write_text(s)
teacher=re.search(r'<script id="shader" type="text/plain">(.*?)</script>',s,re.S)[1].strip()
color=re.search(r'<script id="colorShader" type="text/plain">(.*?)</script>',s,re.S)[1].strip()
def replace(t,a,b):
 assert a in t,a[:120]
 return t.replace(a,b)
# New optional inspection path. Baseline programs remain present and byte-identical.
f=color.replace('void mainImage(out vec4 o, vec2 u) {',(P/'inspection.glsl').read_text()+'\nvoid mainImage(out vec4 o, vec2 u) {')
f=replace(f,'vec3 dyeSum=vec3(0.0); float dyeWeight=0.0;','vec3 dyeSum=vec3(0.0); float dyeWeight=0.0;vec3 lightPoint=vec3(0);float strongest=-1.;')
f=replace(f,'p = vec3( 2.* ( u+u - r.xy ) / r.y , g - 6. ),','p = vec3( (2.*(u+u-r.xy)/r.y)/uInspectZoom+uInspectPan, g-6.+uInspectDepth ),')
f=replace(f,'        p.y++;','        p=uInspectRotation*p;\n        p.y++;')
f=replace(f,'dyeWeight+=weight;','dyeWeight+=weight;if(weight>strongest){strongest=weight;lightPoint=tissuePoint;}')
f=replace(f,'o.rgb=mix(o.rgb,color,uPigment);','if(uPalette!=0)o.rgb=mix(o.rgb,color,uPigment);\n    o.rgb=studioLight(o.rgb,lightPoint);')
fhash=hashlib.sha256(f.encode()).hexdigest()
s=s.replace('young-color-r02-20261004','young-inspect-r03-20261004').replace('COLOR R02 · 20261004','INSPECT R03 · 20261004').replace('色彩研究</h1>','色彩 · 自由观察</h1>')
s=s.replace('<button id="equal">等大对照</button>','')
s=s.replace('</style>',A['css']+'</style>',1)
s=s.replace('<div class="stage" id="stage">',A['ui']+'\n<div class="stage" id="stage">',1)
s=s.replace('<div class="mask" id="studentError">','<span class="drag-help">拖转 · 滚轮微距 · Shift拖平移 · 双击对焦</span><div class="mask" id="studentError">',1)
s=s.replace('<details id="paletteEvidence">',A['settings']+A['branch']+'<details id="paletteEvidence">',1)
s=s.replace('<script id="colorShader" type="text/plain">','<script id="inspectionShader" type="text/plain">'+f+'</script>\n<script id="colorShader" type="text/plain">',1)
s=s.replace("const S=window.YoungStudyState={","const S=window.YoungStudyState={inspectionShaderHash:'"+fhash+"',inspection:{},viewRevision:0,lightingModel:'field-gradient-approximation',",1)
s=s.replace("if(new URLSearchParams(location.search).has('embedded'))",(P/'inspection.js').read_text()+"\nif(new URLSearchParams(location.search).has('embedded'))",1)
needle='return{key,c,gl,p,vao,u,color,fence:null}}'
compiled=r'''let inspection=null;
if(key==='student'){
 const ip=gl.createProgram(),iv=comp(gl,gl.VERTEX_SHADER,'#version 300 es\nconst vec2 P[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));void main(){gl_Position=vec4(P[gl_VertexID],0.,1.);}'),it=comp(gl,gl.FRAGMENT_SHADER,$('inspectionShader').textContent.trim());
 gl.attachShader(ip,iv);gl.attachShader(ip,it);gl.linkProgram(ip);if(!gl.getProgramParameter(ip,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(ip));gl.deleteShader(iv);gl.deleteShader(it);
 const U={};for(const n of ['uPalette','uPigment','uMottle','uPale','uInspectRotation','uInspectPan','uInspectZoom','uInspectDepth','uLightMode','uWarmPower','uCoolPower','uLightBlend'])U[n]=gl.getUniformLocation(ip,n);
 inspection={p:ip,u:[gl.getUniformLocation(ip,'iResolution'),gl.getUniformLocation(ip,'iTime')],U};
}
return{key,c,gl,p,vao,u,color,inspection,fence:null}}'''
s=replace(s,needle,compiled)
s=replace(s,"const pass=colored?v.color:v;","const inspecting=key==='student'&&isInspect();const pass=inspecting?v.inspection:colored?v.color:v;")
s=replace(s,'if(colored){gl.uniform1i(pass.palette,','if(colored&&!inspecting){gl.uniform1i(pass.palette,')
needle='gl.drawArrays(gl.TRIANGLES,0,3);'
s=replace(s,needle,"""if(inspecting){const u=pass.U;gl.uniformMatrix3fv(u.uInspectRotation,false,rotationMatrix());gl.uniform2fv(u.uInspectPan,inspect.pan);gl.uniform1f(u.uInspectZoom,inspect.zoom);gl.uniform1f(u.uInspectDepth,inspect.depth);gl.uniform1i(u.uLightMode,inspect.light);gl.uniform1f(u.uWarmPower,inspect.warm);gl.uniform1f(u.uCoolPower,inspect.cool);gl.uniform1f(u.uLightBlend,inspect.blend);gl.uniform1i(u.uPalette,colorPref.palette);gl.uniform1f(u.uPigment,colorPref.strength);gl.uniform1f(u.uMottle,colorPref.mottle);gl.uniform1f(u.uPale,colorPref.pale)}"""+needle)
s=replace(s,'window.YoungStudy={','window.YoungStudy={setInspection,resetView,resetInspection,',)
s=replace(s,"applyColor();layout();report('coral:young-ready')","applyColor();layout();inspectChanged();report('coral:young-ready')")
branchscript='''\nconst branchSource=JSON.parse(document.getElementById('branchData').textContent);window.CoralBranchSource=branchSource;
function chapter(i){const c=branchSource.chapters[i];$('chapterTitle').textContent=c.title;$('chapterTime').textContent='F'+String(c.first).padStart(4,'0')+'–F'+String(c.last).padStart(4,'0')+' / '+(c.first/30).toFixed(3)+'–'+((c.last+1)/30).toFixed(3)+' s';$('chapterEvidence').textContent='原片可见：'+c.evidence;$('chapterLimit').textContent='边界：'+c.limit;document.querySelectorAll('[data-chapter]').forEach(b=>b.classList.toggle('on',Number(b.dataset.chapter)===i))}
branchSource.chapters.forEach((c,i)=>{const b=document.createElement('button');b.dataset.chapter=i;const t=document.createElement('span'),n=document.createElement('small');t.textContent=c.title;n.textContent='F'+c.first+'–'+c.last;b.append(t,n);b.onclick=()=>chapter(i);$('branchChapters').append(b)});chapter(0);
$('exportBranchNotes').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(branchSource,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='Coral_Branch_Source_Study.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
'''
s=s.replace("$('sourceText').textContent=",branchscript+"\n$('sourceText').textContent=")
s=s.replace('<script id="inspectionShader"','<script id="branchData" type="application/json">'+json.dumps(A['branchdata'],ensure_ascii=False)+'</script><script id="inspectionShader"')
# Every neutral path must retain old original/color shader bytes.
assert re.search(r'<script id="shader" type="text/plain">(.*?)</script>',s,re.S)[1].strip()==teacher
assert re.search(r'<script id="colorShader" type="text/plain">(.*?)</script>',s,re.S)[1].strip()==color
(O/'young-coral-r01/index.html').write_text(s)
h=(B/'index.html').read_text().replace('runtime.js?v=young-color-r02-20261004','runtime.js?v=young-inspect-r03-20261004').replace('芽簇 · 色彩 R02','芽簇 · 观察 R03').replace('R05 + YOUNG COLOR R02','R05 + INSPECT R03')
(O/'index.html').write_text(h)
j=(B/'runtime.js').read_text().replace('COLOR-R02-20261004','INSPECT-R03-20261004').replace('studio-r05-young-color-r02-20261004','studio-r05-young-inspect-r03-20261004')
j=j.replace("young:['芽簇色彩 R02','", "young:['芽簇观察 R03','播放时可拖转、滚轮微距、固定1–100倍、平移、双击定位；冷暖左右双光独立控制；R02基线回退。用户分叉短片732帧观察已入子台分叉资料。")
(O/'runtime.js').write_text(j)
M={'version':'YOUNG-INSPECT-R03-20261004','base':manifest['files'],'files':{n:hashlib.sha256((O/n).read_bytes()).hexdigest() for n in manifest['files']},'teacher_hash':hashlib.sha256(teacher.encode()).hexdigest(),'old_color_hash':hashlib.sha256(color.encode()).hexdigest(),'inspection_hash':fhash,'accepted_baselines_retained':True,'geometry_formula_replaced':False,'view_sampling_added':True,'lighting':'finite-difference original scalar field normal, approximate','video_study':A['branchdata'],'blue_restored':False,'old_color_restored':False}
(O/'INSPECT_R03_MANIFEST.json').write_text(json.dumps(M,ensure_ascii=False,indent=2))
(O/'young-coral-r01/BRANCH_SOURCE_STUDY.json').write_text(json.dumps(A['branchdata'],ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in M.items() if k!='video_study'},indent=2))
