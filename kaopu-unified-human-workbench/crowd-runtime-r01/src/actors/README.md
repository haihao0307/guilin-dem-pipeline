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
  parent: actor.worldRoot,
});
cloth.group.matrixAutoUpdate = false;
cloth.group.matrix.copy(actor.baseMeshMatrix);
cloth.group.updateWorldMatrix(true, true);

// scene coordinator is the sole clock; fixed dt, no concurrent in-flight tick
actor.advance(dt, tickId);
await cloth.update({dt, skinMatrices: actor.finalSkinMatrices,
  frameSequence: tickId, timeSeconds: actor.timeSeconds});
hair.update(dt, tickId);
actor.prepareRender();
cloth.renderUpdate(camera);
viewer.render(); // 保留原皮肤多pass以及已安装的衣发路由
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
| `actor.viewer.geometry` / `motion.native.geometry` | 原完整谱系几何，供原 NativeBinding 与 pose cache；保留 ear/ocular 等对象身份。 |
| `actor.mesh.geometry` | 原 renderer 已生成的程序皮肤显示几何：attributes 与谱系几何共享，原 sorted index 和两个材质组完整保留。`setMotion` / `prepareRender` 恢复这份显示几何。 |
| 身体材质 | 每人独立，保留原 shader/材质组；原 P01 光学/形体 uniform wrapper 共享且保持 live，以便 faceDiffusion 的 `uFPass` 与 cineRig 的 `uC*` 原样更新；native bones/pose render target 与 `native.U` 每人独立。 |
| 原 R14 鞋资源 | 相同完整 recipe 共享 geometry/material/textures；每只鞋独立 Group/Mesh 变换。 |

原鞋使用 mm、Y-up、+Z 指向鞋尖；鞋子局部单位比例为 `[.001,.001,.001]`，右脚为 `[-.001,.001,.001]`。两边从真实 `foot.L/R` 骨骼、原 toe1/3/5-1 关节和完整足部 CSR 顶点测量位置和朝向。原 length/width 参数只在其允许范围内调节，默认 instep 为原范围内的 8。绑定父 frame 另有显式 `fitScale`，因此单位转换保持 .001，并不表示完整鞋实际尺寸没有变化。

当前鞋是 **真实 foot 矩阵驱动的刚性绑定**：toe 关节用于中性轴校准并持续记录世界位置；没有另外制造足部压力、鞋材质力学或动态鞋头弯曲解算器。本次截面适配只支持未弯曲的原 canvas，`bend` 仍是上游几何设计参数。

### 原鞋穿着尺寸修复

首次实际网页暴露了总长/总宽选尺的不足：即使总 bounds 能放下脚，原楦的前端、后腰和鞋垫上翘仍可能与实际足部相交。`NativeShoeFit.mjs` 按当前人物的完整足部 CSR 控制顶点计算静态三轴尺寸、脚轴微调和摆位，检查原 `soleTop(s)+1.3 mm` 鞋垫曲线；绑定保留 39 个原鞋部件、所有原 geometry/material，额外尺寸只写入独立 Object3D frame。右脚镜像只应用一次。鞋底也会随 Y 比例变厚，没有隐藏这一变化。

每脚报告输出 `fitScale`、`fitYawDegrees`、原鞋外部实际 bounds、鞋底/鞋垫的实际高度，以及 `sampledRestSections` / `sampledCurrentPoseSections`。后两者使用原帮面、鞋舌、前帮内层的 19,200 个三角面建立 XZ 索引，测当前原生控制顶点与内层的竖向间隙。鞋口只根据原实际开放区域记录；没有隐藏身体足部。它们是点与截面的采样证据，不能当作连续全表面碰撞、舒适度或鞋材力学验收。

旧 MP05 人物夹具的原规则每脚前掌 898 点中有 150 点高于内层、32 点没有上盖截面，最多高出 19.26 mm。修复后静态每脚 1,067 点全部通过；额外比例约 `[1.375,1.56565,1.075]`，外部 bounds 约宽 172.5 × 高 146.8 × 长 313.5 mm，原 14 mm 鞋底设计高度变为约 21.9 mm。尺寸偏宽厚是完整原鞋缩放的实际代价，当前浏览器 P01 会重新计算自己的数值，不能套用这组旧夹具结果。

使用原 walk/run/jump 各 25 个相位，150 个单脚快照的前掌和脚趾均未检出包头、鞋垫穿出；前掌最小竖向上盖净空约 7.00 mm。walk/run 的整脚也通过；jump 有 4/50 单脚快照在后踝/鞋口附近出现最多 4.49 mm 上盖穿出，完整原始结果保留在 JSON 中。这是刚性鞋跟随 foot 骨、后踝仍受其他骨混合影响的边界。没有为消除结果而修改动作、隐藏脚或缓存动作输出。真正的 P01 完整显示网格和实际网页外观另由浏览器验收。

`advance(dt, tickId)` 拒绝回退 tick，重复同 tick 返回 false。它仅推进一次原动作，更新附件，发布矩阵并更新鞋。暂停后重启或重置时仍要保持调度 tick 单调。`setMotion('idle')` 明确将当前矩阵重置为中性，不残留之前 jump 的骨矩阵。动作生成及帧采样算法均来自原 F13，没有新增动作结果重播缓存。

原程序皮肤次材质会动态调用主皮肤的 `onBeforeCompile`。冻结原外观时，适配器在一个同步事务内临时恢复 `raw.motion.savedMaterial` 的原主编译器和 key，捕获全部身体/附件程序后在 `finally` 恢复原动作包装。没有删除 shader 中的蒙皮代码；残留 `mrRanges` / `mrCache0` 仍直接拒绝。每人随后由其独立 NativeBinding 包装一次。

## 复现本地 CPU 验证

从本 `crowd-runtime-r01` 目录运行；可将整个目录复制到别处，命令不依赖会话工作区：

```sh
python3 build/prepare-sources.py
python3 src/cloth/prepare-upstream.py
node --loader ./src/actors/test-loader.mjs ./src/actors/verify.mjs
node --loader ./src/actors/test-loader.mjs ./src/actors/shoe-fit-verify.mjs
node src/render/verify.mjs
node src/render/scheduler-verify.mjs
```

原 F13 的 10 个模块和 3 份动作 JSON 位于 `vendor/f13/vendor/`，原 R14 鞋位于 `vendor/shoe-workshop/`，均由 `build/sources.lock.json` 锁定固定 commit、长度和 SHA-256。原 MP05 的 104 骨骼人物夹具与 Three r170 复用 `src/cloth/upstream/` 及其独立 source lock，不重复保存大文件。加载器把 bare `three`、原生模块内的相对 Three 路径和绝对 file URL 都指向同一份原 MP05 Three，原 ID 偏移保持。JSON 只在 Node 加载时转为默认导出，磁盘原字节不变。已保留依赖时，两个 prepare 命令都可加 `--verify-only` 离线核验。

`verification.json` 记录 14 项身体/鞋接口检查，包含原动作构造器/clip、双角色骨与 pose cache 隔离、全部材质组仅一层蒙皮、次材质动态委托与异常恢复、原程序皮肤显示分组、原光学 pass/灯位 wrapper 同步、单 tick 推进、rest packet、鞋单位/镜像、骨跟随与转向互不干扰、buffer 字节不变、中性恢复及共享资源释放。`src/render/verification.json` 为 6 项路由恢复检查，`scheduler-verification.json` 为 4 项实际调度控制流检查。人物接口测试使用旧 MP05 原 104 骨骼控制拓扑；并未生成新的简化模型供网页使用。

`shoe-fit-verification.json` 记录本次旧规则对照、静态拟合和三动作全部相位的原始截面统计；实际 `shoe.matrixWorld` 逆变换与检测坐标（包含人物位移、转向、右镜像、非均匀尺寸、落地抬高）最大差约 `7.38e-13 mm`，原身体/原鞋 buffers 的前后 SHA-256 一致。没有 GPU 操作或 FPS 指标。

实际 P01 的首轮截面候选曾检出 3 个缺少内层上盖的足部点，其中 1 个属于前掌；原连续 last 的拟合目标不能代替原分片/鞋眼几何。当前选择器在接受任何候选前都强制检查原实际内层，整脚、前掌和脚趾均通过后才保留，不放宽原门槛。旧原夹具每脚的 19 个可竞争候选中实际拒绝了 9 个；回归直接断言原内层检查确实拒绝过候选。报告为异常保留最多 8 个顶点 ID 和局部坐标。

这份 CPU 证据不包含 P01 完整显示网格的实际渲染，不包含原 R14 材质的本轮浏览器验收，也不包含 GPU 帧率。原鞋材质和几何精确共享验证仍见前一轮 shoe-sharing 归档。本轮网页结果应另行记录。

## 来源

- F13 原 runtime/source：`haihao0307/guilin-dem-pipeline@64cd31324f1a7c4762c21531fe5559b14face2fe`，完整 runtime SHA256 `cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790`。
- R14 鞋：`haihao0307/Humanoid-Rig-Lab-Next@4306b375404a40b7b9842f29cfa5e53fcde70278`，原 scan SHA256 `72a9b6f1075edb2f6b929bf4ad3b02cb603f80f71af3b809594df5fea0095055`。
- `SharedNativeShoes.mjs` 与前次验证适配器逐字一致：SHA256 `0df1f2f0375aab318779f26fa325a32e0056fed4c574c8bd7b49c70cfeab1ba8`。

F13 头发属于已发布密发候选，不代表更新结构线已验收。这里的 body 工厂不会更改该状态。
