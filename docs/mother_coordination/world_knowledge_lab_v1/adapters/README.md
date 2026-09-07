# 世界知识生产适配卡

日期：2026年9月7日

这里保存从长期知识蒸馏进入各生产线之前的接口设计和最小实验。适配卡仍属于协调知识，不是生产基线。

## Weather 与 Cloud

[WEATHER_CLOUD_ADAPTER_R1.md](WEATHER_CLOUD_ADAPTER_R1.md)

职责顺序：云包络、粗状态、多尺度细节、真实输运、体积光学、对外环境查询。

第一项实验：一团固定云、一个局部区域、一个细节强度 A。A 等于零时严格恢复粗密度和大形。

## Ocean 与 Coast

[OCEAN_COAST_ADAPTER_R1.md](OCEAN_COAST_ADAPTER_R1.md)

职责顺序：自由表面状态、水面光学、水下介质、岸体边界、连续烟状态、烟体积光学。

第一项 Ocean 实验：一块固定海面，只改变来自 Weather 的云光学厚度乘数。

第一项 Coast 实验：一个有限烟域，只改变受输运约束的烟细节强度。

## 采用门禁

适配卡形成后，只记 `reviewed_candidate`。

进入生产前必须重新读取目标线当前分支、HEAD、最后有效用户任务和已接受版本。

生产线中的单对象隔离实验通过后记 `implementation_probe_passed`。

真实对象的固定条件证据提交后记 `product_evidence_submitted`。

视觉接受只由用户决定。
