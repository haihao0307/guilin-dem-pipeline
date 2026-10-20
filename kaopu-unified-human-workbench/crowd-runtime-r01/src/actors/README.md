# 原生人物与鞋绑定

这组模块实例化锁定 F13 页面里的完整 P01/R07 人物，复用其原 `NativeMotion` 构造器、104 骨骼、完整权重和 walk/run/jump。实际网页的身体几何直接引用原 viewer 的完整显示几何；这里没有替换人物或降低网格精度。

原始文件均只读，未修改另一活动 NPC 工作台。已参考只读 NPC observation R01 的材质冻结方式，当前运动来源仍是原 F13 捕捉动作，未复制另一任务的自主行为逻辑。

## 主线程接入

```js
import {createNativeActorFactory, createNativeShoeFactory} from './actors/index.mjs';

const bodies = await createNativeActorFactory({THREE, raw, renderer, scene, onProgress});
bodies.detachSource(); // 移出原身体及眉睫；保留donor.visible供原faceDiffusion控制
const shoes = await createNativeShoeFactory({
  THREE, renderer, buildStyle, StyleMaterials, scanData, styles: STYLES,
});
const actor = await bodies.create({
  id: 'npc-1', position: [-.65, 0, 0], rotationY: 0,
  mode: 'walk', phaseSeconds: .2,
});
shoes.bind(actor); // 原 canvas；鞋底抬高在衣发初始化前完成
const hair = hairFactory.create(actor);
const cloth = await createClothActor({
  THREE, renderer, actorPacket: actor.actorPacket, model: actor.model,
  parent: actor.worldRoot, baseMeshMatrix: actor.baseMeshMatrix,
});

// scene coordinator is the sole clock; fixed dt, no concurrent in-flight tick
actor.advance(dt, tickId);
await cloth.update({dt, skinMatrices: actor.finalSkinMatrices,
  frameSequence: tickId, timeSeconds: actor.timeSeconds});
hair.update(dt, tickId);
actor.prepareRender();
cloth.renderUpdate(camera);
renderer.render(scene, camera);
```

`raw` 是原页的 `{viewer, model, motion, fibers, dynamics}`。身体 factory 不创建 renderer，不接管页面 rAF，也不销毁原 donor。入口负责暂停原循环、隐藏 donor，以及统一帧提交和错误处理。`THREE` 必须来自选定的共同模块，额外导出 `ShaderLib` 和 `UniformsUtils`。所有 bare `three` 导入同样指向该模块。

历史 F13 页面内部已包含 R07 与后加 F13 的两个 Three 命名空间。此适配器将所有新人物 Mesh/Group/Material 都用共同 `THREE` 构造，旧 donor 的完整 geometry/固定纹理按只读资产引用，并报告旧来源构造器是否一致。可传入 `NativeMotion` 参数，将未改的原源码重新打包到同一 Three 别名；默认保留 `raw.motion.constructor`。这不会新增第三套 Three。

顺序为 **body → shoe binding → hair/cloth**。鞋底抬高可能改变 actor 根位置，头发须在最终初始位置建立自己的动力学参考。

## 坐标与所有权

| 数据/对象 | 语义与所有者 |
|---|---|
| `actor.model` | 原 P01 rest model，Z-up 米，按只读共享。 |
| `actor.actorPacket` | 衣物静态适配包：25,417 控制顶点、50,624 三角、104 骨骼、完整 CSR、head skin、NativeBinding 控制点 range/packed；skinMatrices 为 neutral identity。 |
| `actor.finalSkinMatrices` | 每人独立的 104 行主序 4×4 Float32 视图；每次 `advance` 后拷入原 GPU boneData；消费者只读且不得 transfer 其 buffer。 |
| `actor.motion` | 每人原 `NativeMotion`；`skinMatrix` 与 `sampleDisplay` 保持原角色局部语义。衣发不得再次 `advance`。 |
| `worldRoot` | NPC 场地位置、转向，以及鞋底抬高。 |
| `baseMeshMatrix` | 原 donor 的 mesh.matrixWorld 基准，包含其原身体显示原点/落地偏移。身体、鞋和衣物需使用同一个基准。 |
| 完整身体 geometry | 同一 P01 静态 attributes、index、groups 共享，工厂不写、不释放原资源。 |
| 身体材质 | 每人独立，保留原 shader/材质组；原 P01 光学/形体 uniform wrapper 共享且保持 live，以便 faceDiffusion 的 `uFPass` 与 cineRig 的 `uC*` 原样更新；native bones/pose render target 与 `native.U` 每人独立。 |
| 原 R14 鞋资源 | 相同完整 recipe 共享 geometry/material/textures；每只鞋独立 Group/Mesh 变换。 |

原鞋使用 mm、Y-up、+Z 指向鞋尖；鞋子局部比例为 `[.001,.001,.001]`，右脚为 `[-.001,.001,.001]`。两边从真实 `foot.L/R` 骨骼、原 toe1/3/5-1 关节和完整足部 CSR 顶点测量位置和朝向。原 length/width 参数只在其允许范围内调节。默认原 canvas 的平底更直接匹配原平地动作。

当前鞋是 **真实 foot 矩阵驱动的刚性绑定**：toe 关节用于中性轴校准并持续记录世界位置；没有另外制造足部压力、鞋材质力学或动态鞋头弯曲解算器。保留的 R14 `bend` 仍属于原几何设计参数。穿着适配、脚趾穿透和视觉外观待网页验收。

`advance(dt, tickId)` 拒绝回退 tick，重复同 tick 返回 false。它仅推进一次原动作，更新附件，发布矩阵并更新鞋。暂停后重启或重置时仍要保持调度 tick 单调。`setMotion('idle')` 明确将当前矩阵重置为中性，不残留之前 jump 的骨矩阵。动作生成及帧采样算法均来自原 F13，没有新增动作结果重播缓存。

## 复现本地 CPU 验证

从 crowd-runtime-r01 的上级目录运行：

```sh
node --loader ./crowd-runtime-r01/src/actors/test-loader.mjs ./crowd-runtime-r01/src/actors/verify.mjs
```

依赖相邻只读审计源 `perf-audit/hair/f13` 与 `perf-audit/garments`。`verification.json` 记录 12 项检查：原动作构造器/clip、双角色骨与 pose cache 隔离、全部材质组 shader 仅包一层、原光学 pass/灯位 wrapper 随原控制器同步、移出donor保留控制柄、单 tick 推进、rest packet、鞋单位/镜像、脚动态与转向互不干扰、buffer 字节不变、中性恢复及共享资源释放。该测试直接运行原 native 运动代码、原鞋几何，使用旧 MP05 原 104 骨骼人物控制拓扑作接口夹具，未生成新的简化模型供网页使用。

这份 CPU 证据不包含 P01 完整显示网格的实际渲染，不包含原 R14 材质的本轮浏览器验收，也不包含 GPU 帧率。原鞋材质和几何精确共享验证仍见前一轮 shoe-sharing 归档。本轮网页结果应另行记录。

## 来源

- F13 原 runtime/source：`haihao0307/guilin-dem-pipeline@64cd31324f1a7c4762c21531fe5559b14face2fe`，完整 runtime SHA256 `cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790`。
- R14 鞋：`haihao0307/Humanoid-Rig-Lab-Next@4306b375404a40b7b9842f29cfa5e53fcde70278`，原 scan SHA256 `72a9b6f1075edb2f6b929bf4ad3b02cb603f80f71af3b809594df5fea0095055`。
- `SharedNativeShoes.mjs` 与前次验证适配器逐字一致：SHA256 `0df1f2f0375aab318779f26fa325a32e0056fed4c574c8bd7b49c70cfeab1ba8`。

F13 头发属于已发布密发候选，不代表更新结构线已验收。这里的 body 工厂不会更改该状态。
