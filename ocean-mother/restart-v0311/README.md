# Ocean Mother V0.3.11 全量重启包

先读 `START_HERE.md`。当前入口 `index.html` 原样保留 R018.11 故障修复候选。

校验：`python tools/verify_package.py`

从源码重建：`python tools/build_single_html.py`

重新压缩完整目录：`python tools/verify_package.py --repack /path/to/package.zip`

可选恢复复测：安装 Playwright 和 Chromium 后运行 `python tools/recovery_smoke.py --html index.html --output recovery_rerun.json`。该脚本为新提供的复跑工具，包内已有测试属于继承记录。

R018.11 尚未获得用户视觉、生产或硬件稳定性批准；本次未更新公开网站。历史目录中的启动说明不覆盖顶层入口。
