# 桂林 DEM 在线交付规则

从 V0.7.9 起，面向用户交付的“HTML”必须满足以下条件：

1. 提供可直接点击访问的公开在线网址。
2. 页面必须运行真实 WebGL2 三维地形，支持旋转、平移和缩放。
3. 地形和水系必须读取真实运行资产，严禁把截图嵌入 HTML 冒充三维查看器。
4. 截图只能作为 QA 证据，不能作为用户观察入口。
5. 高精模式必须加载原生 12.5 米 DEM 数据，并公开显示当前顶点间距、瓦片身份和校验状态。
6. 发布前必须在公开网址上完成桌面端和移动端真实 Chromium QA，控制台及运行时错误均须为零。
7. 当前桂林项目继续保持湖泊资产为零，禁止 30 米替代、插值填洞和源高程修改。

当前在线入口：

https://haihao0307.github.io/guilin-dem-pipeline/guilin-v079-3d/

当前通过的公开浏览器验收运行：33243830758

当前门禁：

```text
publicReviewDeployment=true
visualAcceptance=false
productionReady=false
```
