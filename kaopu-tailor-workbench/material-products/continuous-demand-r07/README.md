# MP05 R07 · 服装闪烁与卡顿修复

当前候选为 `candidate-r07/`，本地集合页已连接该版；R06 完整保留在 `candidate-r06/`。

本轮修复运动中的反复几何重建、共享 GPU 属性的释放交叉，以及离屏画面缺少覆盖抗锯齿的问题。拉近看纱线后返回全身，可释放近景缓存；Worker 不再空转轮询。原人物、原裁片、针目、三股纱线、材质、灯光、实际物理步与动作保持。

[本地集合](http://127.0.0.1:8897/Human-Clothing-Workbench/%E6%9C%8D%E8%A3%85%E9%9E%8B%E5%B8%BD%E5%B7%A5%E4%BD%9C%E5%8F%B0.html?v=R07-7ad0e0f08594) · [固定公开预览](https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-temporal-r07-527117f28a68/?look=K03)（部署验证中）。

来源、对照与范围见 [方法](docs/R07_METHODS.md)、[验证](qa/R07_VALIDATION.md)、`qa/R07_EVIDENCE.json`。这仍是原角色服装混合模型，本轮未新增完整自由布料、全自碰撞、CCD 或生产工艺验收。原历史版本、失败研究、源数据及 Draft PR 保留，不自动合并。
