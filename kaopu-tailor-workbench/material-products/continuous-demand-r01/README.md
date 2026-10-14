# MP05 服装优化 R01

这是从固定 MP05-R2 部署快照恢复的独立候选，没有改动此前服装鞋帽集合或其他工作树。

完整开发要求保留在 docs/DEVELOPMENT_HANDOFF.zh-CN.md。实施与限制见 candidate/README.md。baseline/ 保留原运行时；candidate/ 为修改后的真实运行时。qa/ 保留当前截图、数值对照、求解基准与浏览器回归。

严格实时目标未完成。当前保留原物理方程、子步、完整迭代与碰撞样本，以减少重复输出与查询工作；不会把回放、冻结或慢动作记成成功。

复现：在本目录提供 HTTP 静态服务，用后台 Chrome 打开 candidate/index.html。依次运行 qa/baseline.cjs、qa/equivalence.mjs、qa/demand.mjs、qa/solver-benchmark.mjs 60 3、qa/visual-regression.cjs。Playwright 与 Chrome 路径按当前 Windows 测试环境写在 QA 工具中，换机器需调整。

WASM 使用固定 Zig 0.13.0、LLVM 18、Float64 与 -fno-fast-math 编译。构建命令为 tools/build-kernel.ps1；工具链下载地址为 https://ziglang.org/download/0.13.0/zig-windows-x86_64-0.13.0.zip。工具链本体不入库。源码生成工具仅用于初始修订，最终生产源码以 candidate/ 提交的版本为准。
