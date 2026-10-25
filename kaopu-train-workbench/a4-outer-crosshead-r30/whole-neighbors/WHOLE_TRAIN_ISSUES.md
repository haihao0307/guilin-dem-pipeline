# R27 中央叠层与整车邻件检查：不通过

结论：局部闭合和中央73件内部筛查不能推出整车可装配。候选中央杠杆穿入当前未建真实开口的两侧主车架函数；推定的水平中阀杆穿入中活塞与两端缸盖。暂停中央扩形，不挖车架、不改层厚、不移动安装来掩盖问题。应先取得可信中央安装图与整车安装约束。

| 问题 | 解析负场见证 | 解释 |
|---|---:|---|
| 两侧主车架 | 2对 | 两比一杠杆/右主车架；等臂杠杆/左主车架，当前模型已确认交叠；可能漏建真实开口 |
| 中活塞与压力缸盖 | 13对 | 中阀杆穿过活塞、前盖及带杆孔后盖；中央末端眼/短连杆/销/衬套/垫片/隔套/限位包络与前盖交叠 |
| 外侧连接处 | 8对 | 外阀杆与组合杆、横销、阀头芯存在交叠，可能是有意实体并合，不能自动算作意外碰撞，也不是装配成立证明 |
| 其余AABB候选 | 32对未决 | 搜索没有找到负场点，不等于已证明间隙 |

共同状态：Time=0，theta=0.4，候选中缸倾角beta=0.126。以下均为同一时刻的保留解析场，数值为场值，不宣称是机械穿透深度。

- stack_candidate/plate/two_to_one_lever × frame/frame_plate_right：点[0.54, 1.5475, 5.579465153731598]，两场值[-0.012, -0.015]。
- stack_candidate/plate/equal_lever × frame/frame_plate_left：点[-0.54, 1.484, 5.528485961507946]，两场值[-0.012, -0.015]。
- stack_candidate/spindle/M × actuation/middle_piston：点[约0, 1.48, 4.585428293842222]，两场值[-0.016, -0.024850704497227503]。
- stack_candidate/spindle/M × cylinder_pressure/middle_rear_cover_with_rod_hole：点[约0, 1.48, 4.307030043559724]，两场值[-0.016, -0.016195474468399418]。
- stack_candidate/spindle/M × cylinder_pressure/middle_front_cover：精确点见CORE_FAILURE_WITNESSES.json，两场值约[-0.01389008905, -0.01389008905]。

## 官方史料限定：模型交叠不等于真实A4冲突

[SNGLT 2021检修报告](https://sirnigelgresley.org.uk/overhaul-1522/overhaul-19.shtml)明确记载：2:1和1:1杠杆都穿过车架槽口；二战增加阀行程时曾延长槽口；2021对中后清理了槽口局部凸起，以免杠杆碰槽边。因此，当前完整实心车架函数的负场交叠可能暴露的是模型漏真实开口，不能据此推断真实结构冲突，也不能认定必须迁移机构。此处没有槽口的可信尺寸与位置，不据此猜孔或改几何。中阀杆与活塞/缸盖的独立负场见证仍保留。

## 范围与保留失败

- 加载全部8个R27运行时文件。519原场中候选隐藏18个，保留501个邻件场，另有73个中央候选场，共574个可见场。
- 72个等间隔相位，Time∈[0,2π)，先检查73×501的变换后保守AABB，得到55对可能邻接。
- 初次有21对负场见证/34对未决。停止指示到达前，两只薄壁M衬套的同姿态解析中壁点复核已结束，最终23/32；没有新增相位或网格。
- 全部23对负场点已重放；活塞结果另外通过原始Python参考场复核。verify_witnesses.py默认以退出码1保留整车间隙失败，不伪装绿灯。
- 未做连续时间区间证明、原场之间全部配对、受力/材料/制造/历史真实性验收。72相位和局部优化都不是清空其余风险的证书。真实中央安装图、固定支承、中央导向/阀室、限位锁止仍缺验证。
- 不使用网格或光栅作为模型，不更改R27、R28、Git、安装、层厚和任何零件。

## 可复现文件

- BROADPHASE.json：55对及出现相位。
- WITNESSES.json：每对状态、精确坐标、两场值、实际尝试相位及分类。
- CORE_FAILURE_WITNESSES.json：主车架、中活塞、缸盖核心反例。
- WHOLE_TRAIN_ISSUES.json：简短整体问题表。
- REPLAY_QA.json、FAILING_REGRESSION_RUN.txt：重放与预期失败。
- INPUT_SHA256.json：八份R27输入代码哈希。

重放已有证据：python verify_witnesses.py（预期退出1）；仅验证证据一致性：python verify_witnesses.py --verify-only（预期退出0）。

完整复现既有检查，不扩大参数域：node broadphase.js；node export_frames.js；python check_witnesses.py；python package_report.py；python verify_witnesses.py。
