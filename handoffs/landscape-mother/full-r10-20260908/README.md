# Landscape Mother R10 全量冻结包 · 2026-09-08

用户要求先停止制作，打包并推送 GitHub，等待新的学习资料。本包冻结当前 R10，不包含新的造型修改。后续收到资料再继续。

下载同目录 `LandscapeMother_Full_R10_20260908.zip`，解压后先读 `START_HERE.md`。`SOURCE/` 保存源提交 **4899a5bfbcb252fe55aad6d412a28c76a582c739** 的全部 264 个 Git 跟踪文件，包含 R10、全部现存历版、构建依赖、核心规则、知识和验证记录。目录内历史说明保留原文，以本文件和 R10 README 确认当前入口；历史包不代表当前制作指令。区域资料仅按原提交归档，不绑定到 R10 场景。

在线入口：[R10 交互式三维](https://raw.githack.com/haihao0307/guilin-dem-pipeline/4899a5bfbcb252fe55aad6d412a28c76a582c739/workbenches/landscape-surface-r10/index.html)。本地入口：`SOURCE/workbenches/landscape-surface-r10/index.html`。可在 `SOURCE` 目录运行 `python -m http.server 8080`，浏览器打开 `http://localhost:8080/workbenches/landscape-surface-r10/`。

当前保留 R7 显微细孔、R8 圆润大形、R9 碎蚀与环境苔藓，以及 R10 全域多轴旋转、多平面断面和薄壁保护。固定几何、零 LOD、零贴图。R10 已完成 28 项浏览器检查、几何封闭性检查和核心策略校验；完整结果见对应版本的 QA 文件。最终美术批准和生产就绪仍为 false。

运行页面自包含，不需要安装前端依赖。重建 R10 需要 Python；运行开发 QA 需要 Node.js，浏览器 QA 另需 Playwright 与 Chromium。软件运行环境不封装进源码包。用户参考照片、原始 GLB、内部截图、凭据、本地临时文件和 Git 历史不在公开包内；既有来源身份记录保留。

`MANIFEST.json` 为包内每个有效载荷列出大小与 SHA256；`PACKAGE.json` 记录 ZIP 哈希、源提交和解压重建验证。`package.py` 可从上述源提交重新生成相同 ZIP。
