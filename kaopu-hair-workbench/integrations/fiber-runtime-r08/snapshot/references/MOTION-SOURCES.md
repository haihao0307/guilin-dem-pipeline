# R06 动作来源

复用本机既有 `Human-Single-Motion-R04-20261014/kaopu-unified-human-workbench` 内的捕捉数据、原生权重绑定和重定向器。应用继续使用同一个人物网格与材质，保留所有原生骨骼影响和细化祖先，不导入另一个人物。

| 用途 | 数据 | 原始来源 | 采样 |
| --- | --- | --- | --- |
| 行走 | `16_15-SOURCE.json` | http://mocap.cs.cmu.edu/subjects/16/16_15.amc | 471 帧，120 Hz |
| 跑步 | `16_35-SOURCE.json` | http://mocap.cs.cmu.edu/subjects/16/16_35.amc | 162 帧，120 Hz |
| 跳跃 | `16_01-SOURCE.json` | http://mocap.cs.cmu.edu/subjects/16/16_01.amc | 322 帧，120 Hz |

原骨架为 `http://mocap.cs.cmu.edu/subjects/16/16.asf`。每份 JSON 保留原 AMC / ASF 的 SHA256、来源、接触候选与信用信息。项目已有的走跑剪辑截取连续步态循环；跳跃保留一次起跳/落地。展示中移除平面净位移以便检查，保留垂直起落，并把被移除的运动速度加入相对空气阻力。

署名：The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217. Carnegie Mellon University Graphics Lab Motion Capture Database. 原数据库说明与使用条件继续适用，见 https://mocap.cs.cmu.edu/ 。

`Core.mjs` 在已有模块上加入完整原生姿态缓存接口，其他本地化 import 指向同目录模块；未截断权重。冻结人物参考、既有模型/眼睛/皮肤/眉毛及 Three.js 的来源和许可沿用 `CHARACTER-SOURCES.md` 和原平台声明。新增程序化头发没有外部发型资产。
