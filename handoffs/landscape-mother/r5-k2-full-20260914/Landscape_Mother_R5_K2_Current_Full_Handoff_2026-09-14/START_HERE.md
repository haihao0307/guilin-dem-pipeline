# Landscape Mother — R5.K2 当前全量交接

日期：2026-09-14

本包用于从当前最新有效 Landscape Mother 成果继续工作。

## 当前母版与候选

- 用户确认的宏观形体母版：`039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90`
- 母版工作台：`workbenches/landscape-surface-r5/index.html`
- 母版 SHA-256：`ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2`
- 当前最新细化提交：`e7e04ffab58d97edd4442443fcba682d3f2c9de5`
- 当前候选：`workbenches/landscape-surface-r5-k2/index.html`
- 当前候选 SHA-256：`919df1a9eff14a6d310d4aca93a2ccfcc9a59bb70a9b44b0bfe7d57aed335709`
- 当前候选大小：`84981 bytes`

固定公网候选：
`https://raw.githack.com/haihao0307/guilin-dem-pipeline/e7e04ffab58d97edd4442443fcba682d3f2c9de5/workbenches/landscape-surface-r5-k2/index.html`

## 绝对规则

R5.K2 只能从用户确认的 R5 复杂异型水蚀石灰岩继续。不得替换峰体、主洞口、峰脚、土体和落石关系，不得回到后来走偏的简化峰丛路线。

R5.K2 已完成有机 Microscope 表面层：稳定世界坐标、连续矿物区、连续局部方向框架，以及六个非整数尺度的嵌套孔腔、圆润孔缘、微孔和结节。它明确禁止方向性机械刻槽、周期正弦沟纹、外部模型运行时和外部贴图运行时。

当前仍未完成“活喀斯特”完整可视过程：外部渗水、裂隙/孔腔溶蚀、洞顶滴水、碳酸钙沉积、钟乳石/石笋生长仍是下一阶段任务。

## 接手顺序

1. 读 `CURRENT_STATE.json`
2. 读 `SOURCE_LOCKS.json`
3. 读 `WORK_RULES.md`
4. 读 `NEXT_WORK.md`
5. 运行 `python verify_package.py`
6. 从自己的功能分支继续，不直接覆盖本交接包
