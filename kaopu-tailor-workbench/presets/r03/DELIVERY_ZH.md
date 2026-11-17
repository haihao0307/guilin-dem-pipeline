# R03.4 三维服装橱柜：本轮公网交付记录

## 打开实际工作台

固定版本（默认 J06）：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r034-ae2332f583e1/?preset=J06

本线入口：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r03/?preset=J06

原 R02 保留不变：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r02/?preset=J06

## 本轮实际完成

在用户指定 R02 上继承原始数据和来源身份，新增独立 R03 运行目录，不用生成图片代替程序。

完整展示模特继承项目现有 Anny 原始拓扑，13,718 个顶点、27,420 个三角形；104 骨与每顶点 9 影响用于离线求得独立静态展示姿态。没有改写、缩放原人体或绑定文件。

衣服使用连续衣壳、实际领口与袖口裁切、折回边缘、腰头、领帽、裙片/层叠/开衩等显示曲面。R03.4 增加衣服曲面细分与局部平滑，调整胸前曲面过渡及收腰/外罩的层次关系。曾通过功能测试但出现裙面/翻领阴影伪影的 VSM 候选被拒绝发布；最终保留干净的 PCF 阴影路线。

60 个原设计 ID、名称、配方与纸样身份完整保留。18 套上装与 24 套裙裤形成 432 种可选择的独立来源搭配，不算 432 套新纸样，也不等于所有可能的服装类型。上下装搭配采用上衣收进腰头的静态展示方式；源纸样衣长不改写。

详情和缩略图来自同一真实 WebGL 渲染器与服装几何，不是概念插画。包含搜索、分类、搭配选择、收藏、旋转/缩放、前后侧面/细节视角、模特/结构线显示，以及原始毫米纸样查看。搭配的两份源纸样仍能分别查看。专业参数保留在配方源文件，不要求用户自己调整全部字段；没有后台自主调参服务。

## 已取回并检查的公网证据

候选检查：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37908255289

最终公网发布与浏览器检查：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37909309435

GitHub Pages 激活与部署：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37909744414

PUBLIC_REPORT.json：public=true、passed=true，21 项检查通过；页面异常、失败 HTTP 和浏览器/着色器错误均为 0。实测 60 张真实三维缩略图、492 个显示组合几何，以及搜索、搭配、原纸样身份和主要控制。60 个原设计的几何指纹不同，不仅靠换色区分。

PUBLIC_BYTES.json：90 个公网路径 SHA256 全部匹配。包含 R03 和固定快照各 13 个运行文件、4 项继承依赖，以及全部 60 份原纸样。ALIAS_REPORT.json 确认本线入口也真正渲染 J06，并能切换侧面。

桌面为 Chromium 1440×1080；移动为 Chromium 390×844 视口，无横向溢出。不是手机实机测试。已取回公网证据 ZIP、核对哈希、读取报告并查看实际 HTTPS 桌面与移动截图。

证据 artifact：11605879723；ZIP SHA256：b07e738f402536b5b35aa57d4cb0e0b5a6b43a4739e468da0787ecd80b229092。报告和截图也已持久提交，不仅依赖临时 artifact。

## 固定提交

原 R02 基线：a9148f6860b9fa9f892b97456f4601c34ea95e04。

最终运行源码构建触发：ae2332f583e1bd756ea0083088796c327854e05b。

已检查运行资产：6555abbffe719f741b032e96545ad54f92f6c64e。

Pages 发布：ce1461f57d4429d9af7cc6f6d6787644c11c6570。

Pages 激活：a7296bb354ea620befe3be56a9dfb488dd419de7。

最终公网证据：666724628b76ff0f81c609dd349edea1469f4d0b。

RELEASE_STATE.json 确认 publicVerified=true；发布前后 R01、R02、garments-r04、R07、catalogue 五个既有目录的 Git tree 哈希一致。PR #181 保持 Draft，未合并，未强推。

## 不能省略的边界

本轮完成的是可实际操作的三维选款橱柜与公网交付，不是最终写实成衣质量认证。材质、局部衣服形态与工艺细节仍需精修；不能称已经达到影视级真实布料。

当前显示曲面按设计参数关联原纸样，不是原裁片逐顶点缝合求解结果。展示褶皱不等于真实材料模拟；任意组合无穿模、布料自碰撞、动态穿着、材料应变、缝份与制造可行性均未认证。原 R07.4 真实制版/缝合及其失败记录未被替换。

physicalFitAccepted=false；dynamicWearCertified=false；finalUserAccepted=false。功能测试与公网可用性通过，不替代用户对视觉效果的判断。
