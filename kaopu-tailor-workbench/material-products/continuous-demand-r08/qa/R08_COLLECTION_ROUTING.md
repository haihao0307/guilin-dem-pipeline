# R08 牛仔织纹与渲染维护

集合基线 `work/wardrobe-studio-20261014` / `b08e312014f41008a87949a37ef9600ba9d9b6e2`。只更新活动服装路由，原内嵌衣物、鞋与帽字节保持。R07 完整页面备份为 `服装鞋帽工作台_R07_20261015_保留.html`；Git 历史继续保留原入口。

默认牛仔织纹放大 6 倍（可调 1–8 倍）；浅洗款独立强化纱束起伏和棉质柔光，物理厚度 0.7 mm 保持。不是增加遮洞背板或更换人物/裁片。

- 本地：`../MP05-Continuous-Demand-R01/releases/r08-ccccfd5ca9c1/?look=D01`
- 最终固定预览：<https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-denim-r08-ccccfd5ca9c1/?look=D01>
- Runtime tree：`ccccfd5ca9c16b7ac8b1650ec2e59889f9d6391c`
- Pages commit：`091a87cd721d77f94408521441452648dc5644b0`

R07 双牛仔基线约 6–7 FPS；R08 初测约 55–60 FPS。最终公开数据和实际录像以相邻 MP05 项目 `qa/R08_EVIDENCE.json` 为准。初版浅色已按“纹理太平”反馈继续重建，早期 runtime `49ec7c0beaa5` 不是最终效果。

本轮不推进七阶段成衣工艺验收，不新增完整自由布料、全自碰撞、CCD 或材料标定。

远距离摩尔纹：对斜纹颜色、浮长带法线、逐纱高光和粗糙度按各自屏幕足迹过滤，使用 1 / 1.5 / 2 / 3 倍全身距离的真实相位对照；近处保留真实闭合纱线。

集合当前本地入口固定到上述 338 文件版本。公开入口的并行人物皮肤路由保留在工作区，本次集合提交只修改自己的本地路由。最终材质验证与录像直接访问上面的固定公开预览；不把并行人物试验帧率记入最终结果。
