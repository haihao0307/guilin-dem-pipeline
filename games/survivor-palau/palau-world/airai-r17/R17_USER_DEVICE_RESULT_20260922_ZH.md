# R17 用户真实 iPhone 结果与当前状态

日期：2026-09-22

## 用户设备结果

用户在 iPhone 文件预览器中打开 `STONE_MONEY_ISLAND_R17_DIRECT_OPEN.html`：

- 封面可见；
- “进入故事”可进入第二页；
- 第二页显示 Rock Island、白沙醒来点、Turtle House、Power Tree 和西侧日军据点方向；
- 当前看到的是 SVG / CrossWave 派生的二维兼容关系图，不是真正 WebGL2 三维；
- Ocean Mother 动态海面、1944 潮位、自由旋转相机、真实遮挡和三维视差未在该预览器中运行。

因此 R17 的真实结论是：

`NATIVE_NAVIGATION_FIXED`

`2D_FALLBACK_WORKING_ON_REAL_IPHONE`

`IPHONE_QUICKLOOK_WEBGL3D_NOT_RUNNING`

`visualAcceptance=false`

`userAcceptance=false`

`productionReady=false`

## 已完成

- 修复 R16 只能停在第一页的问题；
- 不依赖 JavaScript 的原生锚点可进入第二页；
- CrossWave、1944 潮位和 Ocean Mother 的 WebGL2 路径在 Chromium 测试环境中可初始化；
- 单体 HTML、零外部请求、无 PNG/JPEG 运行依赖；
- 桌面和移动浏览器自动化中控制台错误 0、页面错误 0。

## 尚未完成

- iPhone 文件预览器中的真实三维运行；
- Safari / Home Screen Web App 正式运行入口；
- Rock Island 三维体波陡壁、岩脚内收、Arch、洞穴和负角结构；
- 潮位驱动白沙岸线、礁盘露出和浅泻湖面积变化；
- 可操作人物、任务、巡逻艇和敌情系统；
- 真实设备性能、内存和长时间稳定性验收。

## 下一生产门槛

后续不得继续把二维兼容图美化后称为三维成果。下一次有效视觉交付必须在真实浏览器运行环境中同时证明：

1. WebGL2 上下文创建成功；
2. 相机能够旋转、俯仰和缩放；
3. Rock Island 具有真实遮挡和视差；
4. 1944 潮位改变水位和岸线；
5. Ocean Mother 波场实际推进；
6. 控制台错误 0，并记录设备、浏览器、FPS 和内存边界。

iPhone 文件预览器仅保留为二维应急预览，不再作为三维游戏运行门禁。正式 iPhone 验收改在 Safari / Home Screen Web App 进行。
