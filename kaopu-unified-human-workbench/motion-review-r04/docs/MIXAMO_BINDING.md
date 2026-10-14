# Mixamo 学习与本人物绑定

核对日期：2026-10-14。此文件记录官方流程、本项目的实现选择及尚未实测的边界。它不是已经获取完整 Mixamo 动作库的声明。

## 官方资料

- [Adobe：上传、绑定与映射人物](https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html)
- [Adobe：Mixamo 常见问题](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
- [Mixamo 官方入口](https://www.mixamo.com/)
- [Three.js：SkeletonUtils](https://threejs.org/docs/pages/module-SkeletonUtils.html)
- [Three.js：FBXLoader](https://threejs.org/docs/pages/FBXLoader.html)
- [Three.js 官方 Mixamo FBX 示例](https://threejs.org/examples/webgl_loader_fbx)

官方流程先建立人形骨架映射，再预览动作。我们采用其中的“动作与人物分离、先校准再播放”的方法；不使用自动绑定替换已有原生骨架，也不将网站演示人物放进我们的场景。动作库下载涉及 Adobe 登录；本轮用户确认没有现成文件，优先完成现有动作。

## 当前原生人体的事实

原生骨架有 104 个节点，Z 向上、米制、行主序矩阵。它的肩臂与腿部各包含中间节点，静止姿态并非标准 Mixamo T 姿势。每个身体顶点可能有多个关节条件化静止贡献；完整 CSR 权重及面部细分祖先关系必须保留。显示坐标为 Y 向上，转换为 `(x,z,-y)`。

直接按同名关节复制欧拉角，会混淆静止姿态、局部坐标轴与关节层级。只验证骨长也不能证明皮肤连续、关节体积或手形正确。

## 本版对接方式

`MixamoImport.mjs` 用固定版本官方 FBXLoader 读取本地文件，提取所选片段的全局骨架标志点，再由已有位置重定向和原生 FK/IK 生成本人物姿势。源人物不加入场景。

| 源语义 | 原生目标 / 用途 |
| --- | --- |
| Hips、左右 UpLeg | root、骨盆朝向与根移动 |
| Spine / Spine1 / Spine2、Neck、Head | 原生 spine05–spine01、neck 链、head |
| Arm、ForeArm、Hand | upperarm01、lowerarm01、wrist；中间骨随层级保留 |
| UpLeg、Leg、Foot、ToeBase | upperleg01、lowerleg01、foot、原生脚底支撑标志 |
| HandMiddle / Thumb（若存在） | 手部方向参考，不宣称已迁移独立指骨采集 |

源坐标先统一单位和初始朝向，整个片段及根路径使用同一个变换。目标骨段长度来自当前人物，不从源人物复制尺寸。上臂方向和肘部平面组成完整框架；手掌方向与前臂轴向单独处理。`RigidPoseSampler` 插值局部四元数，再用不可变局部平移做 FK，不线性混合蒙皮矩阵。

## 已检查与未检查

已准备不带网格的真实 ASCII FBX 夹具，检查解析、根位移、厘米/米尺度一致、缺骨拒绝、长度限制及完整目标骨架。浏览器实际通过文件控件导入并播放，仍只有一个原人物。这些是接口与数值证据，不是 Mixamo 动作库的视觉认证。

尚未逐条验证用户从 Mixamo 下载的真实基础动作。没有迁移完整手指旋转、自动生成可靠足底力、任意地形适配或声称动作物理完成。默认基础练习继续保留其 CMU 或自有编排标签。

## 后续可复用的验收项

每个新源片段记录文件摘要、动作名称、帧率、单位换算、语义映射、静止姿态、接触估计和实际截图。检查源片段首尾、循环接缝、累计位移、膝肘方向、腕姿、脚底与地面、切换起点和用户实际帧率。初始目标是单人待机、走跑、停步、转向、蹲起与跳跃；不因一个循环通过而升级整个系统。
