from pathlib import Path
import json,shutil,hashlib,sys,base64
P=Path(__file__).resolve().parent;B=Path(sys.argv[1]);O=Path(sys.argv[2]);O.mkdir(parents=True,exist_ok=True)
M=json.loads((B/'INSPECT_R03_MANIFEST.json').read_text())
for n,h in M['files'].items():
 assert hashlib.sha256((B/n).read_bytes()).hexdigest()==h,('Accepted Coral host changed',n)
 (O/n).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/n,O/n)
source={'app.js':'3218434fde809d8356d78488f04f50307ce40752b439e059c0ae95407932dfa7','growth.js':'0b4abc12efc81f55740e11b751896fe0edc4573e3277ba6736ddd5ae39bf65ce'}
for n,h in source.items():assert hashlib.sha256((P/'work'/n).read_bytes()).hexdigest()==h,('generator not original tested file',n)
d=O/'branch-reproduction-r01';shutil.copytree(P/'work',d,dirs_exist_ok=True)
(d/'refs').mkdir(exist_ok=True)
refsha={1:'dddaeea46c8d978fedc06c9dbaaa0322a771d951d2b286a25756e9d89cee7d78',2:'b3885f58190418afe47339920807dbabcc862fd003347aa1d0f040ff2d91da4b'}
for i,h in refsha.items():
 b=base64.b64decode((P/f'ref{i}.b64').read_text().strip(),validate=True)
 assert hashlib.sha256(b).hexdigest()==h,('thumbnail transport checksum',i)
 (d/f'refs/output-{i}.webp').write_bytes(b)
h=(B/'index.html').read_text();j=(B/'runtime.js').read_text()
assert '<button data-view="staghorn">' in h
h=h.replace('<button data-view="staghorn">','<button data-view="branch"><b>分叉仿作 R01</b><small>输出一 / 输出二 · 实际生成</small></button><button data-view="staghorn">',1)
h=h.replace('<section class="view" id="view-staghorn">','<section class="view" id="view-branch"><iframe id="branchFrame" title="分叉珊瑚仿作 R01" style="display:block;width:100%;height:calc(100dvh - 99px);min-height:560px;border:0;background:#0d1519" allow="fullscreen"></iframe></section><section class="view" id="view-staghorn">',1)
h=h.replace('runtime.js?v=young-inspect-r03-20261004','runtime.js?v=branch-reproduction-r01-20261004')
j=j.replace("'young','staghorn'","'young','branch','staghorn'")
j=j.replace("const K={young:","const K={branch:['分叉珊瑚仿作 R01','两段实际三维输出对应原片银白分叉与延展蓝白形态。学生从曲线分枝图、出生时间和连续场重新生成表面，不是播放原片。主/子枝连续生长；生成规则由本台按可见形态重建，不冒称获得作者最终C4D工程。'],young:")
needle="if(id==='tree'&&!$('treeFrame').src)";assert needle in j
j=j.replace(needle,"if(id==='branch'&&!$('branchFrame').getAttribute('src'))$('branchFrame').src='branch-reproduction-r01/?embedded=1&v=R01';if($('branchFrame').contentWindow)$('branchFrame').contentWindow.postMessage({type:'coral:active',active:id==='branch'},location.origin);"+needle)
needle='boot();\n})();';assert needle in j
j=j.replace(needle,"window.addEventListener('message',e=>{const f=$('branchFrame');if(e.origin!==location.origin||e.source!==f.contentWindow)return;if(e.data?.type==='coral:home')select('home');if(e.data?.type==='coral:branch-ready')f.contentWindow.postMessage({type:'coral:active',active:current==='branch'},location.origin);if(e.data?.type==='coral:branch-state')state.branch=e.data});\n"+needle)
assert '[\'home\',\'tree\',\'blue\',\'color\',\'rosette\',\'young\',\'branch\',\'staghorn\',\'ledger\']' in j
(O/'index.html').write_text(h);(O/'runtime.js').write_text(j)
m={'version':'BRANCH-REPRODUCTION-R01-PUBLIC-20261004','base':M['files'],'files':{str(p.relative_to(O)):hashlib.sha256(p.read_bytes()).hexdigest() for p in O.rglob('*') if p.is_file()},'source_video':'b5bd4cedda00c23e1018108e0a69348dfab9c711ee8c2b937792a1e367e6ae89','outputs':{'1':'source F0444 silver branching target; inferred recursive fan graph','2':'source F0682 blue branching target; observed curved main axes and fanlets'},'generator_sha256':source,'new_geometry_generator':True,'same_as_author_source':False,'source_match_approved':False,'young_changed':False,'referenceThumbnails':'Resized user-film reference images, only in teacher panel; never used as canvas fallback'}
(O/'BRANCH_R01_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(json.dumps(m,ensure_ascii=False,indent=2))
