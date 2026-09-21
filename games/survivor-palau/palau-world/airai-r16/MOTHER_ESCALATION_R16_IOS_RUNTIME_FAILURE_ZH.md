# R16 iPhone 运行失败｜交给 Mother 的事故说明

日期：2026-09-22

## 用户真实设备结果

用户已在 iPhone 文件预览器中打开 `STONE_MONEY_ISLAND_R16_DIRECT_OPEN.html`。结果是：

- 首屏标题能够显示；
- “进入故事”无法点击进入；
- 完整帕劳、Rock Island、Ocean Mother、1944 潮位和故事标记均未进入实际运行；
- 因此 R16 不能视为 iPhone 运行版，也不能把首屏截图当作游戏运行验收。

`visualAcceptance=false`
`userAcceptance=false`
`productionReady=false`

## 根因

R16 的首屏是静态 HTML/CSS，所以文件预览器可以显示。

但以下部分全部依赖内联 JavaScript：

- `document.getElementById('title').onclick = enter`
- 2D 帕劳绘制 `draw2()`
- CrossWave 解算
- WebGL2 初始化
- 1944 潮位推进
- Ocean Mother 海面
- 相机进入故事区

当前首屏中的“进入故事”实际是 `<span>`，外层是 `<div role="button">`；没有原生 `<a href>` 或 `<button>` 的无脚本后备路径。用户截图同时显示背景未出现帕劳地图，说明该预览环境没有执行或没有可靠执行运行脚本，而不仅仅是按钮样式问题。

因此此前“首屏打开成功”只证明 HTML/CSS 静态壳能够显示，不能证明 JavaScript、WebGL2 或游戏运行链已经工作。

## 责任与纠偏

执行线在用户给出首屏截图后错误地把它记录为“iPhone 首屏通过”，随后继续宣称按钮后的系统可用。这一判断不成立。

R16 的数据蒸馏、CrossWave、潮汐和桌面浏览器 QA 可以保留为研发成果；但面向用户的 iPhone 交付属于失败。不得用桌面 `page.set_content` QA 替代用户设备上的真实点击和运行验收。

## 立即处理方式

1. 将 iPhone 文件预览器从正式运行门禁中移除；它只可作为静态封面预览，不再承担游戏运行。
2. 不再围绕该预览器继续修补 WebGL 游戏逻辑，避免停留在“标题页能开”的假进度。
3. 正式 iPhone 运行版改为 Safari / Home Screen Web App；完成 HTTPS 入口后由用户实际点击验收。
4. 电脑离线版继续使用单体 HTML，但必须在真实浏览器通过“进入故事”后的运行验收。
5. 下一生产增量直接继续 Rock Island 主场景：体波陡壁、岩脚内收、潮位作用下的白沙和浅泻湖；不再把标题页当作成果主体。
6. 下一次视觉交付必须至少包含：
   - 点击前封面；
   - 点击后完整帕劳或连续进入画面；
   - Rock Island 主场景；
   - 控制台 0 错误；
   - 真实运行时帧率和设备信息。

## 给 Mother 的结论

当前执行线没有完成可用的 iPhone 游戏运行版。问题不是故事方向或 CrossWave 数据本身，而是交付容器选择错误、验收标准被放松，并在只看到静态首屏后停止了可见主场景生产。

Mother 应把 R16 状态恢复为：

`DATA_FOUNDATION_BUILT / MOBILE_RUNTIME_FAILED / VISUAL_NOT_ACCEPTED`

下一步不重做整个体系，保留 CrossWave 与 1944 潮汐成果，立即恢复 Rock Island 主场景生产，并将 iPhone 运行验收延后到正式 Safari Web App 入口。