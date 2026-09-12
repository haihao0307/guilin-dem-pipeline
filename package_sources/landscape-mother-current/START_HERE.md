# Landscape Mother — 唯一全量交接入口

日期：2026-09-12

本包是 Landscape Mother 当前唯一有效的续作入口。历史包、后来走偏的形状实验和旧恢复线只作档案，不得作为新工作的母版。

## 唯一母版

- 仓库：`haihao0307/guilin-dem-pipeline`
- 固定源提交：`039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90`
- 唯一工作台：`workbenches/landscape-surface-r5/index.html`
- 工作台 SHA-256：`ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2`
- 固定公网入口：`https://raw.githack.com/haihao0307/guilin-dem-pipeline/039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90/workbenches/landscape-surface-r5/index.html`

用户已经确认这一版复杂异型的水蚀石灰岩形体。后续不得换形、不得重新造峰，也不得以后来的 KAOPU 简化形状覆盖它。

## 先读

1. `CURRENT_STATE.json`
2. `SOURCE_LOCKS.json`
3. `WORK_RULES.md`
4. `NEXT.md`
5. 运行 `python verify_package.py`

## 续作方式

其他人解压后在自己的功能分支继续工作；不要直接改写本包、固定源提交或 `handoff/landscape-mother-current`。任何成果回流前，必须提供与母版同机位的宏观形状回归对照。