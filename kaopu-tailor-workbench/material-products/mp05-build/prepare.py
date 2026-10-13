from pathlib import Path
import json,shutil,sys
here=Path(__file__).resolve().parent;p=Path(sys.argv[1]).resolve()
for f in here.rglob('*'):
 if f.is_file() and f.name!='prepare.py':
  target=p/f.relative_to(here);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
s=(p/'app.mjs').read_text().replace("import {buildSolid} from './solid-textiles.mjs';","import {buildAdaptiveSolid as buildSolid} from './adaptive-solid.mjs';").replace("import {ClothController} from './cloth-controller.mjs';","import {FastClothController as ClothController} from './fast-motion-controller.mjs';").replace("version:'MP04.4.2'","version:'MP05-R1'")
s="import {loadBytes} from './fast-assets.mjs';\n"+s
start=s.index('async function bytes(');end=s.index('async function json(',start);s=s[:start]+"async function bytes(url,expected){return loadBytes(new URL(url,import.meta.url),expected);}\n"+s[end:]
s=s.replace('async function boot(){try{','const bootStarted=performance.now();let bootReadyMS=null;\nasync function boot(){try{').replace('function audit(){return{ready,','function audit(){return{ready,bootReadyMS,fastRuntime:physics?.audit(),')
a=s.index('function frame(');b=s.index('{',a);s=s[:b+1]+"for(const it of items)void it.solid?.detail(false);"+s[b+1:]
s=s.replace("viewer.orbit.minDistance=.025;viewer.camera.updateProjectionMatrix();viewer.orbit.update();lighting?.dirty();viewer.render();}","viewer.orbit.minDistance=.025;viewer.camera.updateProjectionMatrix();viewer.orbit.update();lighting?.dirty();viewer.render();const it=items[role==='bottom'?1:0];void it.solid.detail(true).then(()=>{it.solid.update(viewer.camera);lighting?.dirty();viewer.render();}).catch(e=>message('特写载入失败，可重试：'+e.message,true));}")
s=s.replace("viewer.orbit.minDistance=.015;viewer.camera.updateProjectionMatrix();viewer.orbit.update();lighting?.dirty();viewer.render();}","viewer.orbit.minDistance=.015;viewer.camera.updateProjectionMatrix();viewer.orbit.update();lighting?.dirty();viewer.render();void items[0].solid.detail(true).then(()=>{lighting?.dirty();viewer.render();}).catch(e=>message('特写载入失败：'+e.message,true));}")
s=s.replace("message((phase||'原人物及上下装碰撞')+' · '+Math.round(p*100)+'%')","message((phase||'原人物及上下装碰撞')+(phase?.includes('已验证')?'':' · '+Math.round(p*100)+'%'))")
s=s.replace(" }catch(e){message('工作台初始化未完成：'"," bootReadyMS=performance.now()-bootStarted;\n }catch(e){message('工作台初始化未完成：'")
s=s.replace('远近均为三维结构 · 不使用材料图片','原衣形厚度保留 · 远景属性图 / 特写原纱线')
s=s.replace("message('MP04：原生材料、单层针织与衣物互碰撞。点击人物动作观看身体与衣服一起变化；点击单灯环扫检查材质阴影。')","message('MP05：已验证衣形直接载入。标准动作使用持久实算缓存；外观变化不触发整段重算。自由物理仍为慢速参考模式。')")
s=s.replace("{version:'MP04',person:identity,garments:proof,visibleCarrierSheets:0,appearanceImageMaps:0,physicalReSolved:true","{version:'MP05-R1',person:identity,garments:proof,displayLOD:'curved finite-thickness material aggregation; explicit native microscope',physicalReSolved:false,verifiedPhysicalStateReused:true")
s=s.replace("physics.running?physics.pause():physics.play();","physics.running?physics.pause():void physics.play().catch(e=>message(e.message,true));").replace("$('physics-play').textContent=physics.running?'暂停物理':'播放物理'","$('physics-play').textContent=physics.running?'暂停参考解算':'参考物理解算（慢速）'")
s=s.replace('window.__MP04__=','window.__MP05__=window.__MP04__=');(p/'app.mjs').write_text(s)
s=(p/'motion-transport.mjs').read_text().replace("version:'MP04.4.2'","version:'MP05-R1'").replace('maxPresentationAdvanceFrames:3','maxPresentationAdvanceFrames:null,wallTimePlayback:true')
s=s.replace("b.disabled=!!document.getElementById('top-material')?.disabled||!!c?.baking;","b.disabled=!!document.getElementById('top-material')?.disabled||!!c?.baking||(c?.availableMotions&&!c.availableMotions.includes(b.dataset.motion));")
(p/'motion-transport.mjs').write_text(s)
s=(p/'person/Viewer.mjs').read_text().replace("powerPreference:'low-power'","powerPreference:'high-performance'");(p/'person/Viewer.mjs').write_text(s)
s=(p/'render-backpressure.mjs').read_text().replace('Same geometry, shadows and material resolution.','Submission only; explicit material detail policy documented separately.').replace('unloweredQuality:true','submissionControlOnly:true').replace('poll(start),8','poll(start),2');(p/'render-backpressure.mjs').write_text(s)
s=(p/'index.html').read_text().replace('MP04.4.2 · 单层实体材料 / 动作时间轴 / 单灯特写','MP05-R1 · 快速启动 / 持久动作缓存 / 分尺度材质')
s=s.replace('默认动作回放真实求解的布料帧，不是把衣服蒙皮到人物。修改配方后，首次播放会重新实算并显示进度。动作前恢复初始衣形，不自动拼接未验证的循环。时间轴可暂停、继续和逐帧定位；慢设备限制跨帧跳跃，画面提交按完成状态节流，不积压绘制；播放可能慢于钟表时间，这不是在线物理帧率承诺。','标准动作读取已验证的物理解算数据，按正常时间播放，不在点击时重新计算整段动作。数据保存在当前浏览器，换灯光、镜头、外观不会清空。K04、L04、D01 和 D04 的三种动作可用；其他物理组合未预计算时明确禁用，不偷偷开启几分钟等待。此模式是准确实算回放，不是实时自由布料求解。')
s=s.replace('播放物理</button>','参考物理解算（慢速）</button>').replace('正在校验人物、服装与原碰撞数据…','载入原人物和已验证静态衣形…').replace('原人体接触场加载后，先执行一段真实重力松弛。','标准显示直接读取已验证衣形；自由物理工具按需载入原求解器。')
s=s.replace('远处保留实体截面与物理针距，简化亚像素屈曲和股线细分；近看恢复三股针织及经纬交织。','普通距离采用同一曲面和真实厚度的聚合材质，离开逐根纱线的百万三角形开销；这是显示近似，不是新增遮洞背板。点击纱线特写才按需建立原始三股针织及经纬交织，聚合曲面随即退出显示。');(p/'index.html').write_text(s)
for n in ['BUILD_MANIFEST.json','UNIT_REPORT.json','BATCH_UNIT_REPORT.json','RENDER_UNIT_REPORT.json']:(p/n).unlink(missing_ok=True)
s=(p/'_build/publish-snapshot.py').read_text().replace('fix/tailor-mp04-playback-finish-20261013','perf/tailor-mp05-fast-runtime-20261013').replace('kaopu-tailor-workbench/material-products/r04-4-2','kaopu-tailor-workbench/material-products/r05').replace('mp04-r4-2-','mp05-r1-').replace('MP04.4.2','MP05-R1').replace('mp04.4.2','mp05-r1').replace('same yarn primitives grouped by identical material/chart/LOD; physical states and material dimensions preserved','reference physics states and original garment mesh preserved; explicit screen-scale material aggregation and native microscope')
(p/'_build/publish-snapshot.py').write_text(s)
(p/'MP05_SCOPE.json').write_text(json.dumps({'version':'MP05-R1','parent':'4158ad94b0ac0a92ed67fcd770c3a4a8cf56dcb1','cachedMotionLooks':['K04','L04','D01','D04'],'fullUserTaskComplete':False,'livePhysicsRealtime':False,'normalMotionBakeDisabled':True,'microscopePreserved':True,'ordinaryViewIsAggregateApproximation':True,'userAccepted':False},indent=2))
print('prepared readable MP05 source; reference physics remains unchanged')
