# 人物整合性能初筛 R01

本目录是 2026-10-20 的独立研究与可复跑测试。**完整多人、衣发鞋同场全部物理尚未接通；这里不提供 NPC 容量保证。**

- [中文报告与优化顺序](REPORT_ZH.md)
- [衣物 1／2／4 人原始 CPU 结果](cloth/cloth-component-bench-r02.json) 与 [复现方法](cloth/REPRODUCE.md)
- [同款鞋共享适配器、16 用例及复现](shoe-sharing/README.md)
- [原生身体＋密发固定浏览器入口](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/a84f9af011bc346e5357b0e9aca8864400856f48/kaopu-unified-human-workbench/crowd-performance-r01/public.html)
- [浏览器本轮实际结果](BROWSER_EVIDENCE.json)、[独立复核](BROWSER_REVIEW.json)、[探针代码复核](PROBE_SOURCE_REVIEW.json)

## 复跑衣物与鞋

使用 Node 24.19.0。从本目录执行：

```bash
python3 cloth/fetch-sources.py
node cloth/run-cloth.mjs
node cloth/run-shoes.mjs
npm --prefix shoe-sharing install --ignore-scripts --no-audit --no-fund
node shoe-sharing/verify-evidence.mjs
node --expose-gc shoe-sharing/run.mjs
```

共同依赖锁包含固定 GitHub URL、字节数、SHA-256、Git blob SHA；校验失败即停止。鞋实验还检查完整原生几何／材质指纹。衣物计时输出会更新其同名结果文件，复跑前应保留归档结果，以便独立统计复核。具体环境与初始化差异见各子目录说明。

## 复跑原生身体与密发探针

固定入口使用完整原 F13 候选，加载和动作首次准备需要时间。保持测试标签页在前台，点“测身体＋头发 120 帧”，等待“测量完成”，再展开结果。保存环境、样本数、模拟时长、wall time、errors、GPU disjoint／pending；不能把仅显示 ready 当作测量完成。当前探针的 GPU 排空阶段仍等待 rAF，需在排空完成前保持标签页前台。

原小加载器保存在 `hair/F13_ORIGINAL_PUBLIC.html`。它先校验原固定分片和解压后的 8,590,615-byte 运行时，随后本构建器加入两个严格单次命中的探针接口和 DOM 控件。

```bash
python3 build-public.py hair/F13_ORIGINAL_PUBLIC.html --out public.html
node --check inspector.js
```

本轮测量版 `public.html` SHA-256 为 `d99ac6e4fbe78f7e2c19959109434f532729d236e74f2fef03170cde01b5a62a`。原动作／物理／渲染 step 仅在探针副本中省略末尾诊断 snapshot；原生产方法、几何、物理参数和工作台没有改动。运行页仍需读取固定模型资源，不能当成离线自包含文件。

本轮单人浏览器采样确实完成，但出现尚未解释的约一秒 rAF 调度间隔。CPU 更新区间、GPU 查询区间与整帧调度含义不同，不相加，也不与另一环境下的衣物 CPU 时间相加。完整边界和数值以报告为准。

## 文件与变更边界

`ARTIFACT_MANIFEST.json` 记录本目录交付文件的 SHA-256。来源锁锁定原依赖；manifest 锁定本次研究代码和证据。原工作台、原分支与原资产保持各自身份；本目录的资源共享适配器尚未合入生产 NPC。
