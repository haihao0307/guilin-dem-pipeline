# R19｜R10 内嵌权威图派生物恢复记录

日期：2026-09-22

## 新发现

在用户 File Library 中重新定位到一个 2026-09-21 生成的 `index.html`（File Library ID：`file_00000000cd1c8230913243a01e11fac6`）。该文件是 R10 工作台归档，正文中实际内嵌了两份 PNG 数据：

- `FULL_IMAGE`：PNG，头部尺寸 180 × 390；
- `STORY_IMAGE`：PNG，头部尺寸 190 × 189。

两份数据均以 `data:image/png;base64,...` 存在于 HTML 中，说明 R10 当时至少保留了完整帕劳图和故事区域图的低分辨率派生内容，而不是只留下文字记录。

## 严格边界

这些 PNG 是缩小／转换后的派生图，不是 R07/R11 冻结的两张原始 JPEG 字节：

- `01_PALAU_FULL_FRAME_USER_ORIGINAL.jpeg`：109,929 bytes，581 × 1260，SHA-256 `5b6e1d716bfa66f204aac9240944fe5d1526444d981ccb8a3f23875633d73312`；
- `02_STONE_MONEY_YELLOW_AREA_USER_ORIGINAL.jpeg`：285,719 bytes，1284 × 2778，SHA-256 `4fad4cd637fd556044fec5cfd56f6ef29eb8859a72a543788feb7084c4daeb47`。

因此：

- 不得用内嵌 PNG 替代原始 JPEG 通过 authority gate；
- 不得把低分辨率派生图当作 DEM、岸线或地理测量真值；
- 不得基于它直接生成新的三维地形；
- 可以在精确源恢复后，用它做“是否为同一构图／同一故事框”的视觉交叉核对；
- 可以继续尝试从该 HTML 的完整字节中提取两个 PNG 并计算各自 SHA-256，作为派生链证据。

## 当前状态

- `authorityDerivativeLocated=true`
- `originalAuthorityJpegRecovered=false`
- `originalPalauDemRecovered=false`
- `visualBuildAllowed=false`
- `interactive3D=false`
- `productionReady=false`

本发现改善了来源追踪，但没有解除 R19 的源文件阻断。