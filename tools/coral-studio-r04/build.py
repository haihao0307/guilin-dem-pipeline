from pathlib import Path
import hashlib,json,sys,shutil
ROOT=Path(__file__).resolve().parent
B=Path(sys.argv[1]);S=Path(sys.argv[2]);S.mkdir(parents=True,exist_ok=True)
expected={'index.html':'4faa56edfc793f00d8ced91a657f5a8b74675ab0ea7f1660d3d8149bf6f6afac','runtime.js':'a619ea4154349bcd810d43d97974ab997d3ba9b662682e8d68acfcf7ad746890'}
for n,h in expected.items():assert hashlib.sha256((B/n).read_bytes()).hexdigest()==h,('baseline changed; stop',n)
html=(B/'index.html').read_text();js=(B/'runtime.js').read_text()
html=html.replace('<title>Coral Mother · 原程序恢复</title>','<title>Coral Mother · 珊瑚研究工作台 R04</title>')
html=html.replace('</head>','<link rel="stylesheet" href="studio.css?v=R04-20261003"></head>')
html=html.replace('原程序恢复 · 一个总台 · 不以图片代替运行','CORAL RESEARCH STUDIO / R04')
html=html.replace('<div class="headtools">','<div class="headtools"><span class="studio-build">R04 · REFERENCE / WORKING COPY</span>')
html=html.replace('<div class="nav-title">CORAL WORKBENCHES</div>','<div class="nav-title">珊瑚档案 <span>COLLECTION</span></div>')
html=html.replace('<b>Coral Mother · Core Mothers</b>','<b>Coral Mother<span class="brand-dot">.</span></b>')
start=html.index('<section class="view" id="view-rosette">');end=html.index('<section class="view" id="view-tree">')
html=html[:start]+(ROOT/'rosette.html').read_text()+html[end:]
html=html.replace('<script src="runtime.js?v=original-20261003"></script>','<script src="studio.js?v=R04-20261003"></script><script src="runtime.js?v=R04-20261003"></script>')
js=js.replace("version:'original-runtime-20261003'","version:'studio-r04-20261003'")
js=js.replace("draws:0,current:","draws:0,drawByRole:{A:0,B:0},current:")
js=js.replace("for(const v of viewsGL){const {gl,prog,vao,u}=v;","for(const v of viewsGL){if(v.label==='A'&&window.CoralStudio?.referenceHidden)continue;const {gl,prog,vao,u}=v;")
js=js.replace("gl.drawArrays(gl.TRIANGLES,0,3);const e=gl.getError();","gl.drawArrays(gl.TRIANGLES,0,3);state.drawByRole[v.label]++;const e=gl.getError();")
js=js.replace("'原程序实时绘制 · '+state.draws+' 帧'","'帧 '+String(state.draws).padStart(4,'0')")
js=js.replace("'原程序已恢复 · 真实 WebGL2'","'基线通过 · 实时运行'")
js=js.replace("window.CoralRecovery={select,seek,stop,state,pixelSignature", "window.CoralRecovery={select,seek,stop,state,redraw(){dirty=true;request()},pixelSignature")
js=js.replace("setHash();document.querySelector('main')", "setHash();window.dispatchEvent(new CustomEvent('coral:view',{detail:{id}}));document.querySelector('main')")
assert "if(v.label==='A'&&window.CoralStudio?.referenceHidden)continue" in js
for n,t in [('index.html',html),('runtime.js',js)]: (S/n).write_text(t,encoding='utf-8')
for n in ['studio.css','studio.js']:shutil.copyfile(ROOT/n,S/n)
manifest={n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in ['index.html','runtime.js','studio.css','studio.js']}
assert manifest['index.html']=='a4a7bb7bbe35f59b8dec1126d748f9128c3001f6ff2075e48a944b7d4ab4cee3',manifest
assert manifest['runtime.js']=='4a0e5511875459705703cda31e355fd75d87e928c62b48607923a58e6c758587',manifest
(S/'STUDIO_MANIFEST.json').write_text(json.dumps({'version':'R04-20261003','base':expected,'files':manifest,'shaderBundled':False,'shaderModification':False,'blueRestored':False,'colorRestored':False},indent=2))
print(json.dumps(manifest,indent=2))
