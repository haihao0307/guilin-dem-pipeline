# 同款鞋资源共享：原生几何保真实验

**已实测的是资源去重与数据一致性。** 四种原生 R14 鞋，各测试 1 / 4 / 8 / 16 人，每人左右两只鞋，16 个用例均通过。没有创建 GPU 上下文，没有测完整人物帧率。

## 16 人、32 只同配方鞋的结果

| 鞋款 | 几何数组缓冲：共享前 → 后（bytes） | Geometry 对象：前 → 后 | Mesh 对象（不变） |
|---|---:|---:|---:|
| penny | 60,479,104 → 3,779,944 | 272 → 17 | 544 |
| chelsea | 68,439,424 → 4,277,464 | 320 → 20 | 640 |
| monk | 59,335,040 → 3,708,440 | 576 → 36 | 1,152 |
| canvas | 45,117,568 → 2,819,848 | 624 → 39 | 1,248 |

以上是逐个遍历场景可达资源、按唯一 `ArrayBuffer` 累加的确切字节数。16 人均减少 **93.75%**；1 / 4 / 8 人分别减少 0% / 75% / 87.5%。这是几何数组有效载荷的减少，不是总堆内存、GPU 显存或帧耗时的减少。

原生 [R14 配对代码](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/4306b375404a40b7b9842f29cfa5e53fcde70278/shoe-workshop/r14/src/main.mjs) 已用 `foot.clone(true)` 共享一个人的左右鞋。因此主对照从 **N 份几何资源减少为 1 份**，没有把左右鞋重复计算成 2N。主对照同样使用一个原生材质管理器；材质、贴图数量本来共享，不再计一次材质节省。原始记录另保留“每人复制材质”的可选对照，但不能声称现有工作台这样实现。

## 验证范围

实验调用原生 `buildStyle` 和 `StyleMaterials`，比较顶点、法线、UV、自定义属性、indices、分组和 drawRange 的字节指纹；比较原生材质参数、纹理引用与内容指纹、着色器回调及生成的着色器源码。没有进行 GPU 着色器编译或图像比较。

每只鞋仍有独立 `Object3D` 和世界变换。只移动/旋转 A 的左鞋后，A 的右鞋和 B 人物保持原世界变换，共享几何和材质指纹保持不变。以上验证针对实验执行路径；共享对象自身仍可被 JavaScript 写入，接入代码必须遵守不可变资源约定。

只在款式、尺寸、厚度、弯曲参数和外观配方一致时复用资源。同一资源注册器下，每只鞋调用 `create()`，离场调用 `release()`；全部实例释放后才能 `disposeGeometry()`。原生材质管理器继续负责材质/纹理生命周期。若每人直接改顶点或材质参数，先分离相应资源。鞋部件、三角形、材质分组和预计绘制次数没有减少；本实验没有新增鞋力学或穿着适配。

## 目录与复现

把本目录完整复制为共同研究目录的 **`shoe-sharing/` 子目录**。同级 **`cloth/`** 目录放置衣物/鞋审计的 `fetch-sources.py`、`SOURCE_LOCK_AUDIT.json`、`shoe-counts.json` 和 `cloth-component-bench-r02.json`。原生依赖统一下载到 `cloth/mp05-r10/` 和 `cloth/shoe-workshop/`；本包不重复附带这些原文件。

从共同研究目录执行：

```bash
python3 cloth/fetch-sources.py
npm --prefix shoe-sharing install --ignore-scripts --no-audit --no-fund
node shoe-sharing/verify-evidence.mjs
node --expose-gc shoe-sharing/run.mjs
```

记录环境为 **Node 24.19.0、Three.js r170、`@napi-rs/canvas` 0.1.100**。npm 只用于安装固定版本的原生 WebP 解码器，不能省略平台匹配的 optional dependency。它读取锁定的原始扫描贴图；原生 R14 heritage 材质初始化无需 GPU 烘焙。本环境也支持从 `CODEX_PRIMARY_RUNTIME_NODE_MODULES` 解析同版本的预装解码器，此路径不是常规复现所必需。

`run.mjs` 先验证统一锁及全部鞋依赖哈希，再加载未经修改的 MP05 Three.js vendor；这与鞋资源共享原记录一致。衣物/单鞋计数的其他 runner 使用统一锁声明的另一份派生依赖，不能擅自互换。重放还须与归档的几何/材质指纹和 16 个资源清单完全一致。

`verify-evidence.mjs` 只重算归档统计，不运行计时或 GPU。它验证 R02 的 720 个原始计时样本、有效步数与鞋共享分母。原始鞋记录保存在 `evidence/recorded-shoe-sharing.json`，原始衣物记录复用 `cloth/` 的文件；请在衣物重新计时前保留归档原件。新鞋重放和复核输出写到忽略的 `results/`，不会覆盖归档记录。

## 本轮其他结果的口径

R02 的 1 / 2 / 4 人两轮均值分别为 **16.09–16.12 / 33.27–33.69 / 68.38–75.15 ms**。它们是独立衣物世界在单 JS 线程上顺序推进的 CPU wall time，含身体姿态、参考形变和接触处理。4 人逆序轮 p95 为 **115.71 ms**。每世界实际完成 180 步、3 秒模拟，无数值回滚；初始快照已有层间负距离，终态也有负距离，因此没有通过穿着质量验收。该夹具省略了发布工作台的 R07/GPU-WASM 穿着初始化，不能把问题归因成发布页面的确切缺陷，或将 ms 换算成完整 NPC FPS。[原始组件代码](https://github.com/haihao0307/guilin-dem-pipeline/blob/c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49/kaopu-tailor-workbench/material-products/mp05-studio-r10-3fc034fa91ef/reduced-cloth.mjs) 的精确版本记录在`cloth/` 统一锁。

F13 只作为已有密发与物理压力候选。最新结构线 [STATUS](https://github.com/haihao0307/guilin-dem-pipeline/blob/2175d53de12a44dbedb989d3e8b34837f6315dcb/kaopu-hair-workbench/foundation/structure-r01/review/STATUS.json) / [DELIVERY-R13](https://github.com/haihao0307/guilin-dem-pipeline/blob/2175d53de12a44dbedb989d3e8b34837f6315dcb/kaopu-hair-workbench/foundation/structure-r01/review/DELIVERY-R13.json) 仍未验收、`phaseTwo: locked`；不能写成“最新已验收头发已与衣鞋多人全物理合测”。详细核对依据见 `evidence/component-scope-review.json`。
