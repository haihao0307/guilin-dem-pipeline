# 发型工作台 · R08 运行成果

本目录是本地 R08 物理/性能成果向发型工作台的增量合入。保留目标已有的正确造型程序和静态结构验收顺序。

## 已合入的内容

- `snapshot/src/`：36 个来源文件组成的完整源码/依赖/证据快照，包括 FineFiberCache、RestFiberCache、DistanceHair、NativePoseCache、SurfaceContactField、GuideDynamics、BundleFriction、HairPassCache、HairRenderer。来源和逐文件 SHA256 在 `MERGE_MANIFEST.json`。
- `RuntimeController.mjs`：动作时钟与求解频率分开；每帧最多一次有界求解；近处最多 60 Hz、远处保留 15 Hz 求解；预算迟滞；接触离屏准备后重新标记阴影更新。没有自建 RAF。
- `F14Backend.mjs`：复用目标 F14 的实际 PhotoDynamics、43 条 Guide 和区域约束。临时隔离旧求解钩子中的重复动作推进，调用结束和异常时都恢复钩子；不修改原文件。
- `index.mjs`：显式第二阶段门禁。导入不加载快照中的 app、Groom、Three.js 或密集渲染器。
- 目标入口：`foundation/structure-r01/integrations/R08Runtime.mjs`，只导出接口；当前结构页面没有启用物理。

F14 的 `DONOR_SNAPSHOT.json` 中已有 23 项 R08 源文件散列与本次来源一致。未用原始 R08 文件覆盖 F14 已有的导入、43 条 Guide、区域活动度等适配。

## 所有权和接入方式

`HairStyleProfile`、原生毛囊、完整 Guide、运输坐标、束群、静止形态、子发丝与材质仍由发型工作台拥有。快照的 `Groom.mjs` 和 `app.mjs` 是旧演示的参考入口，不属于新结构发型的入口。`FineFiberCache` 等旧 GPU 模块依赖原来的 Guide/纹理布局；未来接入新结构需要按其运输局部坐标接口适配，不能直接替换现有结构生成器。

接入已经验收的 F14 风格后端时：

```js
import {connectHairRuntime,photoRuntimePorts} from './integrations/R08Runtime.mjs';
const runtime=connectHairRuntime({
  profile, receipt, structureSHA256,
  ports:photoRuntimePorts(photoDynamics)
});
// 用这一调用替代该人物原有的 PhotoDynamics.update；每帧只调用一次。
runtime.advance(dt,{speed,paused});
motion.updateAttachments();
runtime.prepareRender();
viewer.render();
runtime.observeFrame(measuredFrameMS);
// projectedPixels 由相机投影计算；不切换发型资产或毛囊身份。
runtime.setProjectedPixels(projectedPixels);
```

`receipt` 必须对应 `profile.id`、结构 SHA256、人工验收者和验收时间。这里没有制造当前结构的验收记录。门禁不会把测试通过当成视觉验收。新结构实验台尚无第二轮后端，不能把 F14 的固定 43 条 Guide 套上去。

本次控制器按距离改变求解频率，远处仍求解相同 Guide；快照另外保存了 R08 的四方向远处惯性模式和渐进显示预算实现。没有把旧显示预算强塞进当前按区域组织的子发丝数组，避免远处丢失局部发区。

## 验证与限制

执行 `node kaopu-hair-workbench/integrations/fiber-runtime-r08/tools/check-merge.mjs`。结果记录于 `CHECK_REPORT.json`：来源散列、静态门禁、帧率不同时的动作时钟、远处物理保留、半速/暂停、有界工作量、阴影更新顺序、异常后的目标钩子恢复、输入不变。

这是合入与接口检查，没有改变当前页面外观，也没有声称新结构已经通过物理或视觉验收。目标工作台正由另一项工作并行更新；`PROTECTED_BEFORE.json` 及检查报告记录当时现有文件的散列和并行变化。本次只新增本目录及目标入口、交接文档。

R08 性能报告匹配快照源码，但其 `passed` 是 **false**：4 倍 CPU 压力下约 22–23 FPS，未达到原门槛。普通测试和 2 倍 CPU 压力结果保存在原报告内，不代表所有低配硬件。旧行为/单元报告包含后续已变化的源码，清单明确标记，不能作为当前快照的完整认证。此次没有修改性能门槛，也没有宣称“零消耗”。

原工作台的发布记录仍指向 R07；本次没有沿用该记录发布为 R08，也没有替换发型工作台现有的预览页面。
