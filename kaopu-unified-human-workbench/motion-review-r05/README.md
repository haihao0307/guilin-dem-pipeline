# 单人动作连续性 R05

在 R04 同一个原生人物上，改进已有动作之间的衔接。基础动作仍为 14 项；没有替换人物、骨架、权重、材质或动作来源。

点击 **连续演示**，查看：自然站立 → 连续行走 → 左转 90° → 沿新方向继续行走 → 跑步 → 行走停步 → 站立。片段先准备到缓存中，播放时不重新造人。目录可随时切换动作；“衔接方式”提供普通混合对照。

默认衔接会保存世界位置与朝向，匹配循环步态的身体/速度/接触状态，预检查有问题的候选过渡，并使用包含初始速度的定时衰减偏移。停止目标包含制动位移，避免先前移再倒退回原位。原生足部代理与腿 IK 降低过渡中的穿地及支撑滑动。

暂停、慢放、逐帧与拖动时间轴都使用同一个动作时间；等待不会悄悄消耗过渡。切换后的时间 0 包含过渡起点，有限动作仍从源动作起点播放，循环动作可从匹配到的步态阶段开始。

## 学习来源与范围

已阅读 [Ubisoft LAFAN1](https://github.com/ubisoft/ubisoft-laforge-animation-dataset) 与 Harvey 等人的 [Robust Motion In-betweening](https://arxiv.org/html/2102.04942v1)。学习的是上下文、全局根速度、固定骨长 FK、剩余到达时间及接触辅助 IK 的工作方法。本页是独立解析实现，没有训练 Ubisoft 的递归网络，也没有发布其动作数据或改编 BVH。详细来源、推论、函数归属与失败做法见 [连续性知识记录](docs/CONTINUITY_KNOWLEDGE.md)。

## 复现

仓库根目录安装锁定依赖后运行：

```
node kaopu-unified-human-workbench/motion-review-r05/build.cjs
node kaopu-unified-human-workbench/motion-review-r05/verification/serve.cjs
```

默认预览：`http://127.0.0.1:8895/`。也可以运行本目录的 `启动连续动作.cmd`。

验证入口：`verification/continuity-qa.cjs`（切换、速度、地面、暂停、演示序列）及 `verification/single-qa.cjs`（14 项原动作、身份、循环、播放与窄屏布局）。使用系统 Chrome 的独立无头进程，不控制桌面鼠标。`QA_URL` 指定待测页面；`QA_NETWORK_ONLY=1` 禁止本地资产拦截，用于验证真正的公开预览。

`BUILD.json` 保存运行 HTML 和本轮源码哈希，另记录复用的 R04 源文件哈希。具体候选与公开验收记录见 `acceptance/` 和 `docs/QA.md`。

## 当前边界

单人、水平地面、现有小型动作库；短过渡的姿势/速度连续不等于物理平衡或任意动作都自然。空中、深蹲等动作的强制中断仍需语义决策。保留原人物肩腋与手指的形态问题，未开展双人接触、肌肉/软组织、地形或碰撞求解。尚无真实 Mixamo 下载动作；R04 本地 FBX 兼容入口继续可用。
