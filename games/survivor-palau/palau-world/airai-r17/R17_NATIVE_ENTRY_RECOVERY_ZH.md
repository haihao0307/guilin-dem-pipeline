# R17 原生进入修复与继续生产说明

日期：2026-09-22

## 修复目标

R16 在用户真实 iPhone 文件预览器中只能显示标题页，“进入故事”不可用。根因是入口依赖内联 JavaScript 和模拟按钮；当前预览容器能够显示 HTML/CSS，但不能可靠执行游戏脚本。

R17 不再让脚本成为进入第二页的前提：

- 标题入口改成原生 `<a href="#nativeStory">`；
- `#nativeStory:target` 提供不依赖 JavaScript 的故事区入口；
- 兼容场景由 CrossWave 高程、泻湖和故事锚点生成，不使用 PNG/JPEG 或卫星贴图；
- Safari／桌面浏览器若能够运行 WebGL2，则继续启动 R16 的 CrossWave、1944 潮位和 Ocean Mother 动态场；
- WebGL2 完成后自动隐藏兼容场景；
- 若脚本或 WebGL2 不可用，至少不再卡死在标题页。

## 当前 QA

- 移动端 JavaScript 关闭：原生链接进入 `#nativeStory`，通过；
- 移动端 JavaScript 开启：原生链接进入兼容故事区，通过；
- 桌面 JavaScript 开启：进入兼容故事区，通过；
- Chromium headed / Xvfb：WebGL2 上下文建立、动态场启动、兼容层自动隐藏，通过；
- 控制台错误 0；页面错误 0；运行时外部请求 0；
- PNG/JPEG 运行资源 0。

## 尚未冒充完成的内容

用户真实 iPhone Quick Look 仍需重新点击验证。该验证完成前：

`visualAcceptance=false`
`userAcceptance=false`
`productionReady=false`

R17 的无脚本场景属于证据派生的故事关系兼容视图，不是最终游戏画面。Rock Island 体波、白沙、植被、Turtle House 生态与日军据点实体仍需继续生产。
