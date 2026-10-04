from pathlib import Path
import json,shutil,hashlib,sys,base64,re
P=Path(__file__).resolve().parent;B=Path(sys.argv[1]);O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True)
M=json.loads((B/'BRANCH_R01_MANIFEST.json').read_text())
assert M['version']=='BRANCH-REPLAY-R01-20261004'
for n,h in M['files'].items():
 assert hashlib.sha256((B/n).read_bytes()).hexdigest()==h,('Current Coral host changed',n)
 (O/n).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/n,O/n)
source={'app.js':'3218434fde809d8356d78488f04f50307ce40752b439e059c0ae95407932dfa7','growth.js':'0b4abc12efc81f55740e11b751896fe0edc4573e3277ba6736ddd5ae39bf65ce'}
for n,h in source.items():assert hashlib.sha256((P/'work'/n).read_bytes()).hexdigest()==h,('generator transport mismatch',n)
d=O/'branch-reproduction-r01';shutil.copytree(P/'work',d,dirs_exist_ok=True);(d/'refs').mkdir(exist_ok=True)
for i,h in {1:'dddaeea46c8d978fedc06c9dbaaa0322a771d951d2b286a25756e9d89cee7d78',2:'b3885f58190418afe47339920807dbabcc862fd003347aa1d0f040ff2d91da4b'}.items():
 b=base64.b64decode((P/f'ref{i}.b64').read_text().strip(),validate=True)
 assert hashlib.sha256(b).hexdigest()==h,('reference thumbnail transport mismatch',i)
 (d/f'refs/output-{i}.webp').write_bytes(b)
h=(B/'index.html').read_text();j=(B/'runtime.js').read_text()
assert 'data-view="branch-repro"' not in h
assert '<button data-view="staghorn">' in h and '<section class="view" id="view-staghorn">' in h
h=h.replace('<button data-view="staghorn">','<button data-view="branch-repro"><b>分叉 · 双输出仿作</b><small>银白分叉 / 浅蓝延展</small></button><button data-view="staghorn">',1)
h=h.replace('<section class="view" id="view-staghorn">','<section class="view" id="view-branch-repro"><iframe id="branchReproFrame" title="分叉珊瑚双输出仿作 R01" style="display:block;width:100%;height:calc(100dvh - 99px);min-height:560px;border:0;background:#0d1519" allow="fullscreen"></iframe></section><section class="view" id="view-staghorn">',1)
h=re.sub(r'(<script src="runtime\.js\?)[^"]+',r'\1branch-reproduction-r01-public-20261004',h)
assert "'branch','staghorn'" in j and 'const K={' in j
j=j.replace("'branch','staghorn'","'branch','branch-repro','staghorn'",1)
j=j.replace("const K={","const K={'branch-repro':['分叉双输出仿作 R01','保留上轮银白分叉和浅蓝延展两套重建几何。学生由曲线分枝图、出生时间和连续场生成表面，不播放原片。当前代码是按视频可见形态重建，不冒称作者最终C4D工程。原网页和相关GitHub实现已记录在子台原始代码查找栏。'],",1)
needle="if(id==='tree'&&!$('treeFrame').src)";assert needle in j
j=j.replace(needle,"if(id==='branch-repro'&&!$('branchReproFrame').getAttribute('src'))$('branchReproFrame').src='branch-reproduction-r01/?embedded=1&v=PUBLIC-R01';if($('branchReproFrame').contentWindow)$('branchReproFrame').contentWindow.postMessage({type:'coral:active',active:id==='branch-repro'},location.origin);"+needle,1)
needle='boot();\n})();';assert needle in j
j=j.replace(needle,"window.addEventListener('message',e=>{const f=$('branchReproFrame');if(e.origin!==location.origin||e.source!==f.contentWindow)return;if(e.data?.type==='coral:home')select('home');if(e.data?.type==='coral:branch-ready')f.contentWindow.postMessage({type:'coral:active',active:current==='branch-repro'},location.origin);if(e.data?.type==='coral:branch-state')state.branchReconstruction=e.data});\n"+needle)
(O/'index.html').write_text(h);(O/'runtime.js').write_text(j)
child=(d/'index.html').read_text();child=child.replace('<p>原作者最终 .c4d 文件、完整规则与材质图仍未取得。','<p><a href="https://github.com/nicknikolov/pex-space-colonization" target="_blank" rel="noreferrer">GitHub · Space Colonization 算法实现</a><br><small>README 明确追溯 Marcin Ignac；与视频资料的引用链相关，但不是本片最终工程。已读取 index.js 与 MIT 声明，未用其替换当前生成器。</small></p><p>原作者最终 .c4d 文件、完整规则与材质图仍未取得。');(d/'index.html').write_text(child)
m={'version':'BRANCH-REPRODUCTION-R01-PUBLIC-20261004','base':M['files'],'files':{str(p.relative_to(O)):hashlib.sha256(p.read_bytes()).hexdigest() for p in O.rglob('*') if p.is_file()},'source_video':'b5bd4cedda00c23e1018108e0a69348dfab9c711ee8c2b937792a1e367e6ae89','generator_sha256':source,'source_author_engineering_file_found':False,'current_branch_replay_preserved':True,'young_changed':False,'referenceThumbnailOnly':True}
(O/'BRANCH_REPRODUCTION_R01_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
qa=(P/'qa.py').read_text().replace('#branchFrame','#branchReproFrame').replace('#view=branch','#view=branch-repro').replace("'rosette','branch'","'rosette','branch','branch-repro'").replace('[data-view=branch]','[data-view="branch-repro"]')
(O/'qa-current.py').write_text(qa)
print(json.dumps(m,ensure_ascii=False,indent=2))
