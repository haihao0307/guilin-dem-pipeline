# MP05 R06 · 连续穿衣动作与绘制优化

当前活动候选为 `candidate-r06/`，集合页已经连接本地 R06。打开后自动走路，点击“连续演示”循环展示走、跑、跳；衣摆、袖口与裤腿继续实时计算。

本轮将两次面部辅助绘制改为原生皮肤通道，复用完整画面的同帧遮挡；三轴物理求解合并访问，并与原固定 8 轮逐点核对。人物、原裁片、接缝、复杂实体纱线、材质和冷暖棚光保留。

本地：[服装鞋帽集合](http://127.0.0.1:8897/Human-Clothing-Workbench/%E6%9C%8D%E8%A3%85%E9%9E%8B%E5%B8%BD%E5%B7%A5%E4%BD%9C%E5%8F%B0.html?v=R06-96863267eab7)。独立固定预览：[R06](https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-regional-r06-96863267eab7/?look=K03)（已公开实测）。

实现与边界见 [candidate-r06/README.md](candidate-r06/README.md)、[方法](docs/R06_METHODS.md)、[验证](qa/R06_VALIDATION.md)和 `qa/R06_EVIDENCE.json`。仍为人物随动参考加区域动力学，未完成全自由布料、二维材料认证、全自碰撞或高速 CCD。

R05 完整保留在 `candidate-r05/`，其 [固定预览](https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-regional-r05-caa6d2ba5f1f/?look=K03)、证据及录像继续可用。R02/R02.1 与失败研究草稿、旧集合嵌入资源同样保留。Draft PR 不自动合并，不强推主分支。

公开实测：walk 55.8 FPS, run 54.0 FPS, jump 56.9 FPS；同一静止场景 GPU 中位耗时 13.42 → 3.28 ms。实际录像：`qa/R06_K03_连续走跑跳.mp4`。
