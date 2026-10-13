import pathlib,shutil,json,hashlib,sys
p=pathlib.Path(__file__).resolve().parent;r=pathlib.Path(sys.argv[1]).resolve()
for n in ['playback-clock.mjs','cloth-controller.mjs','motion-transport.mjs','qa-case.cjs','unit.mjs']:
 shutil.copyfile(p/n,r/n)
s=(r/'app.mjs').read_text();old="lighting?.pause();frame('whole','three');void physics?.playMotion"
new="lighting?.studio();viewer.mesh.visible=true;$('body-visible').checked=true;frame('whole','three');void physics?.playMotion"
assert s.count(old)==1,'Unexpected parent motion binding';s=s.replace(old,new).replace("version:'MP04.3'","version:'MP04.4'");(r/'app.mjs').write_text(s)
s=(r/'index.html').read_text().replace('MP04.3 · 原生材料 / 单层体积 / 画内动作播放','MP04.4 · 单层实体材料 / 动作时间轴 / 单灯特写')
s=s.replace('<script type="module" src="app.mjs"></script>','<script type="module" src="app.mjs"></script><script type="module" src="motion-transport.mjs"></script>')
s=s.replace('动作前恢复初始衣形，不自动拼接未验证的循环。','动作前恢复初始衣形，不自动拼接未验证的循环。时间轴可暂停、继续和逐帧定位；慢设备限制跨帧跳跃，播放可能慢于钟表时间，这不是在线物理帧率承诺。')
s=s.replace('<a href="SOURCE_LOCK.json">原来源锁</a>','<p>最新专项核对：皮革 R15 的材质文件与这里的 R13 原生核逐字相同；毛衣 R15 的完整毛羽和距离渲染尚未整体接入。本页不能冒称三类最新工作台的全部功能已移植。</p><a href="SOURCE_LOCK.json">原来源锁</a>')
(r/'index.html').write_text(s)
s=(r/'_build/publish-snapshot.py').read_text().replace('fix/tailor-mp04-visible-transport-20261013','fix/tailor-mp04-playback-finish-20261013').replace("prefix='kaopu-tailor-workbench/material-products/r04'","prefix='kaopu-tailor-workbench/material-products/r04-4'").replace('MP04.3','MP04.4').replace('mp04.3','mp04.4').replace('mp04-r3-','mp04-r4-').replace('optical frame and filtering only; unchanged original person and material metric','presentation clock and transport only; all physical states, original person, material metrics and geometry preserved')
(r/'_build/publish-snapshot.py').write_text(s)
(r/'RECOVERY_SCOPE.json').write_text(json.dumps({'version':'MP04.4','parentSource':'1bb663ce6a961d262292c7e4749aaf7a35d3410f','newChanges':['bounded-advance presentation clock','pause/resume/seek/speed controls','restore body and studio lights before motion'],'recoveredNotNew':['native material geometry','single-layer exterior knit','wallet-style sewing','body and garment contact','nine true solved motion clips','single lamp macro','original twelve thumbnails'],'notCompleted':['full knit R15 fuzzy renderer migration','all garment/material combinations dynamic validation','full self collision and CCD','physical-device FPS certification'],'latestLeatherMaterialBlob':'a84543e00425ee9b8371bd9dbfa69a401931447a','leatherSameAsR15Source':'70883deb4659b601faacf5eb49277eee4774b824','originalFailedRun':38356384181,'userAccepted':False},ensure_ascii=False,indent=2))
(r/'README.md').write_text('# MP04.4 成衣接续候选\n\n本轮从已保存 MP04.3 接续。新增动作时间轴、暂停后继续、半速和四分之一速；限制慢设备每次展示最多跨三帧，避免动作瞬间跳完；动作开始恢复原人物可见及棚拍照明。原单层材料、自然断面、针织外侧方向、联合接触、钱包式缝线路径和九组实际求解缓存原样继承，不冒称重新实现。\n\n动作是原参数实算状态的回放，不是当前设备实时全约束 30 FPS。修改配方须重新实算，可能很慢。单层的视觉厚度不等于双层间滑移摩擦。\n\n皮革 R15 材质源码与本版 native/leather-r13.mjs 的 Git blob 同为 a84543e00425ee9b8371bd9dbfa69a401931447a；R15 更新为工作线程通信。毛衣已核查到 R15，但完整微毛羽/距离渲染系统尚未完整迁移；不能把旧线圈核改名充作新版全部效果。牛仔使用 R11 原生棉纤维/经纬核，尚未接入 R12 布样破口独立受力。\n\n本次新源在 r04-4 独立保存；旧 r04、MP03 和历史网页不改。PUBLIC_DELIVERY.json 仅在真实公网检查完成后写入，并区分本轮范围与仍未完成目标。\n')
print('Prepared MP04.4; no physical/material metrics changed')
