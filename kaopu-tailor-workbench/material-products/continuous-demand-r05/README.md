# MP05 R05 · 穿衣走、跑、跳的分区实时动力学

当前活动候选是 `candidate-r05/`，集合页已经连接这一版本。打开后自动穿衣走路，走、跑、跳、暂停、拨动衣摆和恢复都在主画面上方。

人物大范围运动由原完整骨骼绑定驱动；松动衣摆、袖口和裤腿保持独立的实时动力学。原裁片、接缝、全部外观控制点、三股实体纱线与原材质保留。当前是角色服装混合模型，不能当作完整自由布料或二维材料应变认证通过。

本地集合：[服装鞋帽工作台](http://127.0.0.1:8897/Human-Clothing-Workbench/%E6%9C%8D%E8%A3%85%E9%9E%8B%E5%B8%BD%E5%B7%A5%E4%BD%9C%E5%8F%B0.html)。

独立固定预览：[MP05 R05](https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-regional-r05-caa6d2ba5f1f/?look=K03)。该固定地址已在 Chrome 155 / RTX 4070 Ti SUPER 实测：走、跑、重复跳跃约 53–58 帧/秒，单步中位约 7.1–7.2 ms，活动时钟比约 0.999。首次完整载入约 57 秒；这是载入时间，不是运动帧耗时。

实现与限制见 [candidate-r05/README.md](candidate-r05/README.md)，方法核对见 [docs/R05_METHODS.md](docs/R05_METHODS.md)，最终证据见 `qa/R05_EVIDENCE.json`。录像为实际浏览器画面，位于 `qa/R05_K03_连续走跑跳.mp4`。

原 `baseline/`、`candidate/`、R02/R02.1 预览及集合页旧内嵌数据都保留。R02 完整自由布料的快速动作与实时目标仍未通过；本轮没有改写其验收结论。新角色服装模型使用独立目录，Draft PR 不自动合并，主分支不强推。
