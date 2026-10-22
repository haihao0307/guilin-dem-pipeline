from pathlib import Path
import re,json,hashlib,shutil,sys,ast
src=Path(sys.argv[1]).resolve()
out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
root=src/'kowloon-building-mother-r01';entry=root/'whole-building-facade-r01.html'
guards=next(ast.literal_eval(n.value) for n in ast.parse((Path(__file__).parent/'observed-glass-fixed-browser.py').read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='RUNTIME_GUARDS' for t in n.targets))
for name,sha in guards.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==sha,('Frozen c69 runtime changed',name)
print('Frozen runtime SHA guards:',len(guards),flush=True)
queue=[entry,root/'r07/evidence-ledger.json',root/'r07/README.md',root/'floor-materials-r01/README.md'];queue+=list((root/'whole-building-facade-r01/evidence').glob('*.json'));seen=set();edges=[];missing=[]
# Runtime profiles resolve these relative to r07/profiles.mjs, not the HTML.
profile=(root/'r07/profiles.mjs').read_text()
for name in re.findall(r"ROOT\+'([^']+)'",profile):queue.append(src/'hk-three-buildings-r01/geometry'/name)
assert len([p for p in queue if p.name.endswith('.score.json')])==3
# Preserve all linked provenance/permission records without bundling reference photographs.
for folder in [root/'floor-materials-r01/sources',root/'r07/sources']:
 for p in folder.rglob('*'):
  if p.is_file() and p.suffix.lower() in ['.json','.md','.txt','.mjs']:queue.append(p)
while queue:
 p=queue.pop().resolve()
 if p in seen:continue
 if not p.is_file():missing.append(str(p));continue
 if not p.is_relative_to(src):raise Exception('Dependency escapes candidate root: '+str(p))
 seen.add(p);text=p.read_text();refs=[]
 if p.suffix in ['.mjs','.js']:
  refs+=re.findall(r"(?:from\s*|import\s*\(|import\s*)['\"]([^'\"]+)['\"]",text)
  refs+=re.findall(r"new\s+URL\(\s*['\"]([^'\"]+)['\"]",text)
  refs+=re.findall(r"fetch\(\s*['\"]([^'\"]+)['\"]",text)
 elif p.suffix=='.css':refs+=re.findall(r"(?:url\(\s*['\"]?|@import\s+['\"])([^'\")\s;]+)",text)
 elif p.suffix=='.html':
  refs+=re.findall(r"(?:src|href)=[\"']([^\"']+)[\"']",text)
 for ref in refs:
  if ref.startswith(('http:','https:','data:','#')):continue
  q=(p.parent/ref.split('?')[0].split('#')[0]).resolve()
  # Link to the immutable old public ground page instead of embedding another application.
  if p==entry and ref=='whole-building-ground-r01.html':continue
  edges.append({'from':str(p.relative_to(src)),'reference':ref,'resolved':str(q.relative_to(src)) if q.is_relative_to(src) else str(q)})
  queue.append(q)
if missing:raise Exception(json.dumps(missing,indent=2))
files=[]
for p in sorted(seen):
 if p==entry:continue
 rel=p.relative_to(src);q=out/rel;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q);data=q.read_bytes();files.append({'path':str(rel),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
html=entry.read_text().replace('<head>','<head>')
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><base href="./kowloon-building-mother-r01/">',1)
html=html.replace('href="whole-building-ground-r01.html"','href="https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/whole-building-ground-r01.html"')
html=html.replace('<title>东侧四组观察开口 · 靠谱建筑母体 · 三案例整体关系</title>','<title>当前未完成检查版 · 三案例 / 四组观察开口 · c69a5f19</title>')
html=html.replace('<h2>低楼东侧四组观察</h2>','<h2>未完成检查版 c69a5f19</h2><p><strong>不是三栋成品。</strong>当前含已验三案例宿主接线、喇沙东侧四组照片观察开口和玻璃入口面修正。龙总内部仍为独立资料平面，未注册进真实外壳；其他立面窗门未齐。软件 GPU 首帧约50秒，普通画面约15–20秒，手机视口约6秒，未测您的设备。</p><h2>低楼东侧四组观察</h2>',1)
# The small UI-only guard uses the actual presented frame counter; asset load alone never marks success.
html=html.replace('<canvas id="view"></canvas>','<canvas id="view"></canvas><div id="inspectionLoad" role="status" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;z-index:20;background:#17212ce8;color:#f4f6f8;pointer-events:none;text-align:center">正在初始化实际函数场，首帧可能需要约50秒。不是空白图片；正在等待真实绘制。</div>')
html=html.replace('</body>','<script src="../inspection-status.js"></script></body>')
(out/'index.html').write_text(html)
(out/'inspection-status.js').write_text("""// Original UI-only reporting. Does not alter geometry, renderer or controls.
(()=>{const box=document.getElementById('inspectionLoad'),start=performance.now();let failed=false;const fail=e=>{failed=true;box.style.display='flex';box.textContent='实际绘制未完成：'+String(e||'未知错误')+'。没有改用静态图片或网格替代。';};addEventListener('error',e=>fail(e.message));addEventListener('unhandledrejection',e=>fail(e.reason?.message||e.reason));const timer=setInterval(()=>{const s=window.wholeBuilding;if(s?.error){fail(s.error);clearInterval(timer);return;}if(s?.presentedFrames>0&&!failed){box.style.display='none';clearInterval(timer);return;}if(!failed)box.textContent='正在等待真实首帧：'+Math.round((performance.now()-start)/1000)+'秒。软件 GPU 测试约50秒，您的设备可能不同。';},250);})();
""")
support=Path(__file__).parent/'inspection-support'
for name,dest in [('LICENSE_SCOPE.md','hk-three-buildings-r01/LICENSE_SCOPE.md'),('STONE_NOTICE.md','hk-three-buildings-r01/viewer/provenance/STONE_NOTICE.md'),('material-sources.json','hk-three-buildings-r01/viewer/provenance/material-sources.json')]:
 q=out/dest;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(support/name,q)
(out/'NOTICES.md').write_text("""# 当前未完成检查版 c69a5f19
公开学习检查版，不是三栋成品或正式产品。运行时冻结 c69a5f196aec6a0f383d30ad790bc86786cb0f50，完整原QA https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39765308173 。只增加独立入口包装/状态提示，原函数几何、渲染、材质、控制器保持逐文件原SHA，不启用缓存实验。
四组低楼东侧开口依据公开照片观察分格，隐藏下沿/洞深/6mm玻璃厚度属于设计。02/03仅称glazed-opening，不擅定阳台门/窗或开合机构。其余北南西和底层立面未完整识别。龙总plan-local仍未配准真实外壳，上层不是完整房间；三栋没有完成复原。灰暗、切面点纹、秒级渲染尚在；手机仅视口模拟。
官方外部形状源自香港特别行政区政府地政总署/CSDI，知识产权与TNC保留。见 hk-three-buildings-r01/LICENSE_SCOPE.md、kowloon-building-mother-r01/r07/evidence-ledger.json 及 https://portal.csdi.gov.hk/csdi-webpage/doc/TNC 。不冒称自有测绘或政府认可复原。
现有材质闭包保留来源：STONE_STUDY / LuthBird1 / Stone Brick / CC BY 4.0，见 hk-three-buildings-r01/viewer/provenance/STONE_NOTICE.md 和 material-sources.json。完整旧R06来源说明 https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/r06/README.md 。正式发行来源清理尚未完成，不能以删署名代替。
本包没有外部照片、户型原图、教师程序、第三方纹理或外部三角对象模型。全屏三角形仅发射屏幕射线。电梯R02原状态机/控制器未改；未知品牌/真实服务层仍unknown；不作施工或设备安全认证。原ed015入口和其他项目不变。
""")
# List includes every runtime, CSS, data and UI payload byte, no tests, private photos or external model meshes.
files=[]
for p in sorted(out.rglob('*')):
 if p.is_file():
  data=p.read_bytes();files.append({'path':str(p.relative_to(out)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
plan={'schema':'kaopu.isolated-preview-plan/1','candidate':'c69a5f196aec6a0f383d30ad790bc86786cb0f50','productionRoot':'kaopu-geography-workbench/kowloon-building-mother-r01/inspection-c69a5f19','files':files,'totalFiles':len(files),'totalBytes':sum(x['bytes'] for x in files),'css':[x for x in files if x['path'].endswith('.css')],'dependencyEdges':edges,'baselineRuntimeUnmodified':True,'containsPrivatePhotos':False,'containsExperimentalStaticCacheEnablement':False,'uiChanges':['HTML base path for nested original runtime','Current incomplete status and measured software-GPU limitations','Real first-presented-frame loading/error overlay','Old ground entry links to existing immutable public page']}
(out.parent/'PUBLISH_PLAN.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2));print(json.dumps({k:plan[k] for k in ['totalFiles','totalBytes','css']},ensure_ascii=False,indent=2))
