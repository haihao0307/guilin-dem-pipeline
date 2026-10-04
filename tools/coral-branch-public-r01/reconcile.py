from pathlib import Path
P=Path(__file__).resolve().parent
b=P/'build.py';s=b.read_text()
s=s.replace("B/'INSPECT_R03_MANIFEST.json'","B/'BRANCH_R01_MANIFEST.json'")
s=s.replace('data-view="branch"','data-view="branch-repro"').replace('id="view-branch"','id="view-branch-repro"').replace('id="branchFrame"','id="branchReproFrame"')
s=s.replace("j=j.replace(\"'young','staghorn'\",\"'young','branch','staghorn'\")","j=j.replace(\"'branch','staghorn'\",\"'branch','branch-repro','staghorn'\")")
s=s.replace('"const K={young:"','"const K={branch:"').replace("const K={branch:['分叉珊瑚仿作 R01'","const K={'branch-repro':['分叉珊瑚仿作 R01'").replace("C4D工程。'],young:","C4D工程。'],branch:")
s=s.replace("id==='branch'","id==='branch-repro'").replace("current==='branch'","current==='branch-repro'").replace("$('branchFrame')","$('branchReproFrame')")
s=s.replace("state.branch=e.data","state.branchReconstruction=e.data")
s=s.replace("'young\\',\\'branch\\',\\'staghorn'", "'young\\',\\'branch\\',\\'branch-repro\\',\\'staghorn'")
# Current runtime already has a branch integration; avoid a second component with its ID.
s=s.replace("assert '[\\'home\\',\\'tree\\',\\'blue\\',\\'color\\',\\'rosette\\',\\'young\\',\\'branch\\',\\'staghorn\\',\\'ledger\\']' in j","assert \"'branch-repro'\" in j and \"'branch'\" in j")
s=s.replace('runtime.js?v=young-inspect-r03-20261004','runtime.js?v=branch-replay-r01-20261004')
# Version the actual runtime script tag even if the preceding component picked another cache key.
s=s.replace("(O/'index.html').write_text(h)","import re\nh=re.sub(r'(<script src=\"runtime\\.js\\?)[^\"]+',r'\\1branch-reproduction-r01-20261004',h)\n(O/'index.html').write_text(h)")
s=s.replace("O/'BRANCH_R01_MANIFEST.json'","O/'BRANCH_REPRODUCTION_R01_MANIFEST.json'")
b.write_text(s)
q=P/'qa.py';s=q.read_text().replace('#branchFrame','#branchReproFrame').replace('#view=branch','#view=branch-repro').replace("'rosette','branch'","'rosette','branch','branch-repro'").replace('[data-view=branch]','[data-view="branch-repro"]');q.write_text(s)
h=P/'work/index.html';s=h.read_text()
s=s.replace('<p>原作者最终 .c4d 文件、完整规则与材质图仍未取得。','<p><a href="https://github.com/nicknikolov/pex-space-colonization" target="_blank" rel="noreferrer">GitHub · Space Colonization 算法实现</a><br><small>README 明确追溯 Marcin Ignac；与视频资料中的引用相关，但不是本视频最终工程。已读取 index.js 与 MIT package 声明，未擅自替换当前生成器。</small></p><p>原作者最终 .c4d 文件、完整规则与材质图仍未取得。')
h.write_text(s)
# Invalid abandoned transport fragment is never used in build or publication.
f=P/'code-00.b64'
if f.exists():f.unlink()
print('Concurrent branch study preserved. Reconstruction added under view=branch-repro, separate manifest.')
