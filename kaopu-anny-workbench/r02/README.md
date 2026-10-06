# Anny R02

针对R01界面语义与功能完整性审计的独立修正版。R01保持原样；R02不是已完成所有官方拓扑/rig/自交诊断的全功能复刻，待完成项在首页和AUDIT.md明确列出。

复用 ../assets/ 原始全身模型六分片。R02仅追加约207KiB官方52表情张量，恢复旋转向量±180度输入、官方参数JSON、R01迁移、形态重置、骨骼轴与静态GLB。

运行 node tests/model.mjs 验证64组原生Python输出、档案互通和GLB结构。运行 tests/browser.cjs 要求真实Chromium/WebKit与静态HTTP服务。所有源码、数据、数值证据见 PROVENANCE.json、AUDIT.md 与 tests/parity-report.json。
