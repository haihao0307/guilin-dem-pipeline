"""Create only F02.1 files from the frozen F02 source; old directories stay read-only."""
from pathlib import Path
import hashlib,json,shutil
p=Path(__file__).resolve().parent
old=p.parent/'f02'
manifest=json.loads((old/'BUILD_MANIFEST.json').read_text())
assert manifest['htmlSHA256']=='090800937280c00b1ad7aba386acba01c203080f98aaea46a623c747e46f550b'
for name,expected in manifest['sources'].items():
    assert hashlib.sha256((old/name).read_bytes()).hexdigest()==expected,name
(p/'src').mkdir(exist_ok=True)
(p/'tests').mkdir(exist_ok=True)
def replace(s,a,b):
    assert s.count(a)==1,a[:90]
    return s.replace(a,b)
k=(old/'src/BoundaryKernel.mjs').read_text()
shutil.copy2(old/'src/BoundaryKernel.mjs',p/'src/F02Boundary.mjs')
k=replace(k,'export {point,V,normalArray,signature,oldGrowth};',"""import {rootBank as frozenRootBank, domain as frozenDomain, growth as frozenGrowth} from './F02Boundary.mjs';
import {subtractEar,earClearance} from './EarClearance.mjs';
export {point,V,normalArray,signature,oldGrowth,earClearance,frozenGrowth};""")
k=replace(k,'return f+(s-f)*w;}','return subtractEar(p,f+(s-f)*w);}')
k=replace(k,"variant==='old'?oldGrowth(r.p,LEGACY):growth(r.p,settings)","variant==='old'?frozenGrowth(r.p,SETTINGS):growth(r.p,settings)")
a=k.index('export function rootBank(head)')
b=k.index('export function summary(',a)
k=k[:a]+'export function rootBank(head){return frozenRootBank(head);}\n'+k[b:]
k=k.replace("version:'F02'","version:'F02.1'")
k=replace(k,'oldDomain:oldDomain(head,LEGACY)','oldDomain:frozenDomain(head,SETTINGS)')
k=replace(k,'physicsAdvanced:false,photoStatus','physicsAdvanced:false,diagnosticOnly:true,finalHairCount:null,earPatchRemoved:roots.filter(r=>frozenGrowth(r.p,settings)>=-1e-8&&growth(r.p,settings)<-1e-8).length,photoStatus')
(p/'src/BoundaryKernel.mjs').write_text(k)
shutil.copy2(old/'src/Worker.mjs',p/'src/Worker.mjs')
shutil.copy2(old/'src/LegacyFoundation.mjs',p/'src/LegacyFoundation.mjs')
s=(old/'src/App.mjs').read_text().replace('F02','F02.1').replace('scalpF02.1','scalpF021')
s=replace(s,"'F01 / 原边界对照'","'F02 / 修剪前对照'")
s=replace(s,'鬓角下延，耳上收窄留白，耳后接入后颈。额头发际线锁定原版。','只剔除耳廓上多出的局部范围；边界沿耳前接回鬓角，其余保持 F02。')
s=replace(s,'已显示 F02.1 校准范围。','已显示 F02.1 耳前修剪；其余沿用 F02。')
s=replace(s,'已切到 F01 原范围；原版文件没有修改。','已切到修剪前 F02；原版文件没有修改。')
s=replace(s,'function setCamera(name){[yaw,pitch,distance]=',"""function setCamera(name){target.set(0,.312,.022);if(name==='ear'||name==='earOther'){const side=name==='ear'?1:-1;target.set(side*.074,.300,.026);yaw=side*.72;pitch=.27;distance=.19;view();draw();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===name));return;}[yaw,pitch,distance]=""" )
s=replace(s,'camera.position.set(Math.sin(yaw)','camera.position.set(target.x+Math.sin(yaw)')
s=replace(s,'),.27,.95)', '),.12,.95)')
(p/'src/App.mjs').write_text(s)
s=(old/'index.template.html').read_text().replace('F02','F02.1')
for a,b in [
 ('照片校准 · 毛发生长范围','耳前修剪 · 毛发生长范围'),
 ('F02.1 · 只修鬓角、耳周与后脑，不推进长发','F02.1 · 只剔除耳廓局部，其余范围保持不变'),
 ('点：稳定毛根','黑点：稀疏诊断根点，非最终发量'),
 ('这次只校准“长到哪里”','只去掉耳廓上的这一小片'),
 ('依据你给的原始侧面照片。侧面向下接到鬓角，耳上不留大块空白，耳后连续接入后颈。','沿用你已确认的 F02 范围。只剔除贴到耳廓上的局部，边界沿耳前直接接回鬓角。'),
 ('当前激活诊断根点','激活的稀疏诊断根点'),
 ('F02.1 照片修正','F02.1 耳前修剪'),
 ('F01 原范围','F02 修剪前'),
 ('显示毛根','显示诊断点'),
 ('诊断根点比例','诊断点显示比例'),
 ('短桩探针长度','诊断短桩长度'),
 ('<p id="pick">','<p class="note" id="sampleNote"><strong>黑点只是稀疏的根点采样，用于验收边界和表面绑定。</strong>这批点不是完整生物毛囊图，也不是最终发量。完整密发尚未生成，不以这几千个点作为发量上限。</p><p id="pick">'),
 ('<button data-view="photo">','<button data-view="ear">耳前近看</button><button data-view="earOther">另一耳近看</button><button data-view="photo">')
]:s=replace(s,a,b)
(p/'index.template.html').write_text(s)
s=(old/'build.py').read_text().replace("'F02'","'F02.1'").replace('local-F02','local-F02.1').replace('4a745de3d7818df8c1ee8e8f083d91956275152a','f60955a2a59cdd7a5ce83076d6e68192bcbe3e1c')
(p/'build.py').write_text(s)
s=(old/'tests/browser.mjs').read_text().replace('scalpF02','scalpF021').replace("diag.version==='F02'","diag.version==='F02.1'")
s=replace(s,'old.visibleRoots<before.visibleRoots','old.visibleRoots>before.visibleRoots')
s=replace(s,"const before=diag;","""check('diagnostic samples explicitly not final hair count',diag.summary.diagnosticOnly===true&&diag.summary.finalHairCount===null&&await page.locator('#sampleNote').textContent().then(s=>s.includes('最终发量')));const before=diag;""")
s=replace(s,"for(const v of['photo','other','back','front','top'])","for(const v of['ear','earOther','photo','other','back','front','top'])")
s=replace(s,"await page.click('[data-view=\"side\"]');await page.click('[data-mode=\"stubble\"]');","""await page.click('[data-view="ear"]');await page.click('#old');await page.screenshot({path:out+'/ear-before.png'});await page.click('#new');await page.screenshot({path:out+'/ear-after.png'});check('ear subtraction removes only local original samples',before.summary.earPatchRemoved>0&&before.summary.earPatchRemoved<66&&before.summary.bankSignature==='a624b76f');await page.click('[data-view="side"]');await page.click('[data-mode="stubble"]');""")
(p/'tests/browser.mjs').write_text(s)
print('F02.1 readable sources created, frozen F02 files were read only.')
