# 独立衣物叠穿 R02：持续接触与按需显示

本轮针对 R01 持续模拟后的领口、肩部穿模，以及重复显示计算。**当前为验证中的修复分支；预检通过不等于物理验收通过。** R01 固定网页保留，R02 不覆盖它，不合并主分支。

Draft PR：<https://github.com/haihao0307/guilin-dem-pipeline/pull/315>

## 来源与保留内容

- 原生人物：`d413d108704af47cf531ee8c25d93f682c3176e3`。人物、皮肤、原生 viewer 和画布保持身份。
- 原材料总台：`c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49`，目录 `kaopu-tailor-workbench/material-products/mp05-studio-r10-3fc034fa91ef`。
- R01 源码基线：`eb5a7c841a0db69fdccb215384927d3a03998c2f`。
- 独立衣物：T08 高领内搭、T03 V 领外层、P02 原款短裤。各自保留对象、纸样、材料、质量和形变；相互接触共同求解。
- 保留原实体封闭纱线、缝边、连续采样和材质。没有融合衣物，没有改成不透明布片，没有固定距离档位或预录动画。
- 人物静止；没有把摄像机看不见的内层衣服冻结为碰撞壳。

## 已复现的问题

R01 的一次步进和静态截图不足以验收持续叠穿。本轮只读捕获实际网页发给 Worker 的完整初始化数据，验证人物坐标、面索引和输入字节一致后，用同一输入复现。

1. 内部三角剖分边被当作开边，接触侧别可在内部边或相邻面之间丢失。
2. 未解决接触的历史被已经穿过去的新位置覆盖，可能出现“仍在错误侧，但残余为零”。
3. 身体碰撞直接重用旧最近三角形；衣间修正移动顶点后，旧面未必仍然最近。
4. 身体、布片拉伸和层间接触相互影响，最后一次碰撞投影可再次拉长布片。
5. 旧显示坐标在顶点减去法线偏移、在三角形内部沿归一化插值法线加回来，曲面上不能抵消，导致物理中面与实体纱线中心不一致。
6. 暂停、设置变化和操作结束会再次应用相同几何，重复使纱线缓存和阴影失效。

旧网页在实际连接的 Chrome 中运行 41 步、约 0.342 秒模拟时间后，其自身诊断仍报 1.5885 mm 衣间残余和 1.6736 最大边长比。这是原求解器自检，不替代完整三角形相交检查。截图和读数见 `evidence/browser-baseline/`。

## 哪些工作可以省

| 情况 | 显示工作 | 物理工作 |
| --- | --- | --- |
| 相同位置、法线和拓扑重复到达 | 不重复变形、不使纱线 atlas 失效；无其他画面变化时不请求完整帧 | 按实际操作处理设置或读数 |
| 多个新状态在前一帧完成前到达 | 保留将要显示的最新几何 | 已完成的物理步完整保留 |
| “单独查看”显式隐藏衣物 | 暂缓其 carrier 与纱线更新；恢复前提交最新状态 | 继续接触、摩擦和结构约束 |
| 完整穿着里被外层挡住的区域 | 目前保守保留；不能用粗布片遮掉针织孔隙 | 有接触或力传递时必须保留 |
| 卸下衣物 | 释放显示对象和待提交几何 | 从求解器移除并回收可复用内存 |
| 布料、视角采样或渐变改变几何 | 更新实际需要的阴影 | 不因视角改变物理参数 |
| 只改变颜色、摩擦或风力且位置未变 | 不重复更新几何与几何阴影 | 后续模拟使用新设置 |

`render-demand.mjs` 精确比较位置、法线、索引字节，位移容差为零。它不改变物理状态、可见性规则、材料或采样质量。诊断中的 `uploadedRows` 表示真实调用变形路径的次数；GPU 完成由原 frame gate 证明。

“按需更新画面”提供同一场景 A/B：关闭时恢复每次快照都使显示几何失效的行为，开关本身不向 Worker 发送物理参数。

目前**没有宣称实现自动遮挡分区裁剪**。纱线存在真实孔隙，领口、袖口和衣摆也会露出内层。未来细分空间纱线批次时，应分别判断主画面与阴影需要，并在视角、几何或材料变化后失效；未知结果继续绘制。不能把看不见等同于不接触。

## 碰撞与中面修正

接触区分真实开边与内部拓扑，保留跨面未解侧别，检查超出普通近邻半径的部分线性顶点—三角形终点穿越。候选缓存用双方位移上界证明有效性；超过界限立即重建。

身体碰撞重新证明缓存的最近面仍有效；结构、身体和衣间约束交替收敛，最后身体修正后重新测量残余。当前真实人物仍暴露边与面内部的相交及拉伸问题，这部分仍在修复。

显示 carrier 直接使用物理纱线包络中面。构建从固定原实现派生仅调整坐标约定的构造器，让原纱线和缝边取消旧 carrier 放置平移。原局部纱线形状、着色器、atlas 算法和采样器保留；原上游文件保留原字节。构建清单记录派生模块、原始散列、精确替换与结果散列。

这仍不是完整连续碰撞。不得把线性点面终点保护描述为完整 CCD，不得据此声称覆盖同一步穿过又返回、自碰撞、共面退化或任意高速动作。

## 验证

预检只检查真实显示与按需更新。完整验收还需通过当次实际人物输入、持续模拟，以及卸下重穿后继续模拟。

- `capture-native-ci.mjs`：只读捕获真实 Worker 初始化，校验当前原生人物，保留原 typed-array 字节。
- `native-replay.mjs`：同一实际输入，240 步、2 秒物理时间；分别静置与轻推/轻拉，记录所有步与指定检查点的完整三角形相交。
- `browser-ci.mjs`：真实按钮开始与暂停，证明模拟时间推进；观察原始 Worker 数据，保存真实 PNG。
- `mesh-intersections.mjs`：独立 BVH 和双向边—三角形检查，计入穿越、共面正面积重叠及非共面边界交线，单列退化面。
- `render-demand.test.mjs`：精确变化、最新状态合并、隐藏恢复、阴影需求、失败重试与卸下重加。
- A/B 保持人物、几何、相机和采样策略一致，分别报告显示工作量与求解耗时。软件 WebGL CI 不冒充用户设备帧率。

动态门槛：最大边长比不超过 1.45、接缝分离不超过 0.01 mm、衣间残余不超过 0.5 mm；检查点不得有报告的衣间或衣身交线、退化面或人体半厚度重叠。初始化伸长单列。失败必须记录并修复，不能以放宽门槛、冻结内层或静默改纸样通过。

### 复现

```bash
python tools/download-reference.py
python tools/build.py
node --test tests/contact.test.mjs tests/world.test.mjs tests/render-demand.test.mjs tests/mesh-intersections.test.mjs tests/cloth-observer.test.mjs
node tests/native-replay.mjs --input evidence/native-world-input.json --output evidence/native-replay --steps 240 --mode both
```

浏览器测试仅由项目 CI 启动 Chromium。完整输入由当次捕获脚本产生，不用冻结旧人物代替当前网页人物。完整输入和中间证据保存在 CI artifact；最终公开报告引用已完成的结果。

## 研究依据

- [Bridson、Fedkiw、Anderson：Robust Treatment of Collisions, Contact and Friction for Cloth Animation](https://www.graphics.stanford.edu/papers/cloth-sig02/)：厚度、接触与碰撞感知的显示细化。
- [SideFX Vellum Solver](https://www.sidefx.com/docs/houdini/nodes/sop/vellumsolver.html)：结构、碰撞与子步联合处理。
- [NVIDIA：Hardware Occlusion Queries Made Useful](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-6-hardware-occlusion-queries-made-useful)：保守边界、层级查询及查询等待开销。
- [Khronos WebGL 2 规范](https://registry.khronos.org/webgl/specs/latest/2.0/)：查询接口与结果可用性。

这些资料用于判断系统结构与边界，不表示本页实现了文献中的完整算法。没有引用中文网站。
