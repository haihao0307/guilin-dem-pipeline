# 验证与证据

验证代码位于 `verification/`。从仓库根目录运行，所有实际渲染使用 headless 浏览器，不操作桌面鼠标。

1. `npm ci --prefix tooling`，非系统 Chrome 环境再安装 Playwright Chromium。
2. `node kaopu-unified-human-workbench/motion-review-r04/build.cjs`。
3. 启动 `node kaopu-unified-human-workbench/motion-review-r04/verification/serve.cjs`。
4. `node kaopu-unified-human-workbench/motion-review-r04/verification/inspect.cjs` 提取同一实际人物夹具；它不是新人物资产，输出仅保存在本机 `qa/`。
5. `node kaopu-unified-human-workbench/motion-review-r04/verification/test-import.mjs` 检查目标骨架与真实 ASCII FBX 解析。
6. `node kaopu-unified-human-workbench/motion-review-r04/verification/single-qa.cjs` 检查全部基础动作、循环、单人物、原形体/档案保留与实际渲染。
7. `node kaopu-unified-human-workbench/motion-review-r04/verification/smoke-import.cjs` 实际操作文件控件，并检查只有原人物进入场景。

可设置 `QA_URL` 指向固定公网链接，验证代码仍记录实际 URL。默认 `http://127.0.0.1:8894/`。浏览器优先使用 `CHROME_PATH`，Windows 默认系统 Chrome；其他平台使用 Playwright Chromium。

`acceptance/` 保存正式构建对应的报告和少量原始 WebGL PNG。完整本机逐动作多时刻截图保存在 `qa/single-r04/`。截图不经过生成式图像工具，不能替代交互工作台。

逐帧数值范围包括有限坐标、原生骨长、循环接缝、根位移、身份/档案不变和当前只有一位人物。脚底支撑误差与最终平滑偏移分开记录。浏览器帧率仅描述本机此次采样，不是跨设备保证；手机尺寸仅验证布局，非实机。

已观察的失败须保留：第一版转向在接触初始点锁脚，产生约 31–34 度的逐帧膝部变化，支撑误差达约 0.12–0.14 米，未作为交付。改为支撑中段锚点、可达性和有限平滑后重新测量。小跳取景初版裁切头顶，已改为整段骨架范围取景并重新截图。此前 R03 的双人问题不因本版单人检查而标记已解决。
