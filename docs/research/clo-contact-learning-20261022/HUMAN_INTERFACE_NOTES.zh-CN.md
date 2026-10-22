# 服装与人物接口学习记录

本轮完成只读源码审查，没有修改人物、服装求解器或 R02 公网页面。具体来源、摘要、附件 SHA256、限定语和读回清单见同目录 `HUMAN_INTERFACE_REVIEW.json`。

## 新确认的事实

本次核对了 [Humanoid-Rig-Lab-Next 默认 main](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/tree/fda12bf2fe0262e4d02f1b08508128d17959e0c8)，观察到提交 `fda12bf2fe0262e4d02f1b08508128d17959e0c8`。完整递归树有 1,267 项，未截断，没有找到 `BUILD_MANIFEST`。这不是最新或已验收整合目标的确认；仓库还有其他研究分支。

三种来源必须区分：附件母本提出 SMPL24 映射与 28 控制节点；当前 main 的 [rig-reference.json](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/fda12bf2fe0262e4d02f1b08508128d17959e0c8/reconstruction/rig-reference.json) 实际有 128 个节点；R02 冻结人物原包的 boneOrder 有 104 项。节点数量与显示相似都不能证明协议兼容，数量不同也不能单独证明不可适配。当前 main 的姿势权威在 [CharacterActivity.js](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/fda12bf2fe0262e4d02f1b08508128d17959e0c8/control/CharacterActivity.js) 声明为 `MotionLabPose.commit`；R02 页面实际仍使用静态 `THREE.Mesh`，不因原包包含 rig 字段而成为动画蒙皮实现。

当前人物 [草裙说明](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/fda12bf2fe0262e4d02f1b08508128d17959e0c8/docs/PROCEDURAL_GRASS_SKIRT_R1.md) 明确是骨盆／大腿蒙皮和程序摆动近似，不能替代布料碰撞。当前 `CharacterShape.js` 的活动碰撞余量也明确是人工设定，未测得最终皮肤包络。它们的存在不等于精确服装碰撞已接通。

## 可以沉淀的规则

附件 01 §23.4、§23.21 要求表皮、碰撞体、骨架显示使用同一份最终姿势。服装最小接入点因此可以是**不可变的最终人体表面快照**：同时说明来源、人物身份、绑定版本、最终姿势／采样时刻、实际顶点与三角形身份、单位／轴向／变换，以及碰撞表示如何对应这份表面。字段名称在 JSON 中均标记为提案，不是当前人物系统已存在的接口。

比例变化与姿势变化要分别处理。比例或绑定改变时，需要重建相依的绑定、表皮和碰撞，旧人物上的服装结果失效；普通姿势更新可以保留绑定结构，但新的最终表面、碰撞和服装验收必须属于同一姿势／时间采样。相机和布局只属于观察状态，不应因此使物理解算失效。相关依据为附件 01 §2.1、§8、§11、§28.14，以及附件 02 的永久技术规则。

R02 已有 request/revision、人物四哈希、纸样／材料绑定、独立 Worker、取消与上次完整结果保留，可以继承这些机制。其页面内 revision 不等于全局 ProjectState revision；不可删除现有人物锁来伪装兼容。先进行静态快照适配，不必让服装直接理解全部人体骨骼编号。动态阶段还需独立实现前后采样、时间语义与连续碰撞，不能把新姿势塞入旧静态 SDF 后宣称完成。

## 保留的未知与限制

当前默认 main 没有找到 BUILD_MANIFEST，尚未确定最终人物接入分支，也未验证原子人体／碰撞导出。母本的 HRL-M02/M03 明确有“设计”状态，60 FPS 和 16.7 ms 是目标预算。当前 README 描述的局部历史测试不构成本轮运行、完整人物、动态服装或手机实机验收。本记录是接口研究与证据整理，接口尚未实现。

