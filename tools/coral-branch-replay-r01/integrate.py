from pathlib import Path
import json,hashlib,sys,shutil,base64
SRC=Path(__file__).resolve().parent;B=Path(sys.argv[1]);O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True)
M=json.loads((B/'INSPECT_R03_MANIFEST.json').read_text());expected=M['files']
for n,h in expected.items():
 assert hashlib.sha256((B/n).read_bytes()).hexdigest()==h,('coral baseline changed: stop instead of overwriting',n)
 (O/n).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/n,O/n)
shutil.copytree(SRC/'branch-growth-r01',O/'branch-growth-r01',dirs_exist_ok=True)
refs=json.loads((SRC/'teacher-images.json').read_text())
for n,v in refs.items():
 assert n in ['teacher-blue.webp','teacher-clear.webp','teacher-early.webp']
 b=base64.b64decode(v['data'],validate=True)
 sha=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 assert sha==v['git_blob'],('reference asset damaged; stop',n,sha)
 (O/'branch-growth-r01'/n).write_bytes(b)
h=(O/'index.html').read_text();j=(O/'runtime.js').read_text()
assert '<button data-view="staghorn">' in h and '<section class="view" id="view-staghorn">' in h
h=h.replace('<button data-view="staghorn">','<button data-view="branch"><b>分叉 · 复演 R01</b><small>蓝白实体 / 透明延展</small></button><button data-view="staghorn">',1)
h=h.replace('<section class="view" id="view-staghorn">','<section class="view" id="view-branch"><iframe id="branchFrame" title="分叉珊瑚实际生成 R01" style="width:100%;height:calc(100dvh - 99px);min-height:560px;display:block;border:0;background:#101619" allow="fullscreen"></iframe></section><section class="view" id="view-staghorn">',1)
h=h.replace('runtime.js?v=young-inspect-r03-20261004','runtime.js?v=branch-replay-r01-20261004')
assert "'young','staghorn'" in j
j=j.replace("'young','staghorn'","'young','branch','staghorn'",1)
j=j.replace("const K={young:","const K={branch:['分叉复演 R01','已实际实现原片资料页 F 规则的逐级复演；三颗初芽到多级分叉、融合网格，再输出蓝白实体和透明高光两个版本。录像没有附原工程，本轮为按画面拟合的生成实现；不冒充原工程逐字恢复或真实生长模型。'],young:",1)
assert "branch:['分叉复演 R01'" in j
needle="if(id==='young'&&!$('youngFrame').getAttribute('src'))";assert needle in j
j=j.replace(needle,"if(id==='branch'&&!$('branchFrame').getAttribute('src'))$('branchFrame').src='branch-growth-r01/?embedded=1&v=branch-r01-20261004';if($('branchFrame').contentWindow)$('branchFrame').contentWindow.postMessage({type:'coral:active',active:id==='branch'},location.origin);"+needle,1)
needle='boot();\n})();';assert needle in j
j=j.replace(needle,"window.addEventListener('message',e=>{const f=$('branchFrame');if(e.origin!==location.origin||e.source!==f.contentWindow)return;if(e.data?.type==='coral:home')select('home');if(e.data?.type==='coral:branch-state')state.branch=e.data});\n"+needle,1)
(O/'index.html').write_text(h);(O/'runtime.js').write_text(j)
report={'version':'BRANCH-REPLAY-R01-20261004','base':expected,'files':{p.relative_to(O).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in O.rglob('*') if p.is_file()},'accepted_young_shader_changed':False,'source_video_sha256':'b5bd4cedda00c23e1018108e0a69348dfab9c711ee8c2b937792a1e367e6ae89','reference_frames':[655,682,620],'source_rule':'F -> F[+F][-F[-F]F]F[+F][-F]','rule_counts':[8,64,512],'geometry':'procedural three-root branch tree, smooth-unioned tapered capsules, marching tetrahedra','source_scene_recovered':False,'mode_switch':'material only; same mesh','blue_R41_restored':False,'old_color_R02_restored':False}
(O/'BRANCH_R01_MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
