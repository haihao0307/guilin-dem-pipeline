# R02 自有结构拳套

## 一手结构参照

核验日期：2026-10-09。

- [Hayabusa 官方 T3 产品页](https://www.hayabusafight.com/products/t3-boxing-gloves)：官方列出的 attached thumb、perforated palm、grip bar、hook-and-loop wrist closure，用于确认拳套应有独立拇指腔、掌侧分区、抓握区与腕部固定，而非只有一个球形体积。
- 实际查看该官方页图库的[手背／掌侧成对照片](https://cdn.sanity.io/images/6tpq25k0/production/25cec9bae260d22c5deb6085ea5786778e1b8d2e-1080x1080.png)与[掌侧细节照片](https://cdn.sanity.io/images/6tpq25k0/production/0fc17f511f21206cd977f1ee4989251161a57b58-1080x1080.png)：观察厚拳面、弯向掌侧的独立拇指、掌垫边界、袖口开口和外覆束带。没有把照片打包、转制成纹理或公开复制。

这是基于一般装备结构的自有参数几何，不是产品扫描、尺寸测绘、品牌复刻或医学防护模拟。没有任何品牌标记。官方照片只作阅读参照，模型颜色与构造均为本工作台自有设计。

## 已实现的可辨认结构

1. 20侧分段超椭圆放样形成连续手背壳体，横向饱满、前端较平的拳面；不是三球叠加。
2. 六段曲线扫掠形成独立附连拇指腔，尖端向掌侧内弯，左右几何镜像。
3. 深掌侧指腔与壳体内一体化掌垫分区。为了容纳现有人体底座的收拳，掌侧轮廓以实际完整CSR皮肤顶点校准，尤其覆盖儿童手指的卷曲位置。
4. 掌垫包边、拇指侧缝、低多边形通风／缝线标记。
5. 真正有内缘与短内衬的腕口、绕腕束带与抬高的重叠束带端片。

## 接入

导入 `createGlovePair`，传入 `{names: human.names, height: human.height, color: teamColor}`。返回两个 `StructuredGlove`，它们自身是 `THREE.Mesh`，可以直接加入actor group。每帧调用 `glove.updateFromPose(out.posedMatrices, human.height)`。袖口后段根据 lowerarm01→wrist 的方向柔性转动，拳体不变；每帧只更新后段顶点和旋转法线，不调用整网格法线重算。

局部轴：+Y为腕到中指掌骨根，+Z为手背；左拳+X为拇指侧，右拳的几何X镜像。腕、食指根、小指根共同恢复手掌滚转；输入矩阵为现有BoxingRig的行主序native Z-up，内部转成actor group的view Y-up。

保留中心 `lerp(wrist, finger3-1, 0.75)`；按 `height / 1.75` 等比缩放。未变形拳体 y≥−68mm 的顶点限制在原R01 101.25mm参考半径之内（实现用101.2mm留浮点余量），袖口有独立轻量弯折并向手腕后方延伸，不在这个包围球承诺内。该约束本身不能代替两人真实表面的交互碰撞回归。

## 开销与验证

- 每只794三角形，一个mesh、一个draw call；72只合计57,168三角形。
- 左右×两队色共四份共享不可变基几何；每只拥有独立的可变位置／法线缓冲，避免袖口变形串人。全部共用一个顶点色标准材质，无纹理资源，无额外网络请求。
- `glove-geometry-test.mjs`：有限数、非退化三角形、镜像、缓存复用、中心与解剖方向。
- `glove-surface-test.mjs --all`：36个既有体型，每个12个动作时刻，用完整CSR蒙皮真实手部顶点测试主壳／拇指腔包含；结果写入 `glove-surface-qa.json`。它是采样覆盖测试，不声称连续全时刻数学证明。
- `glove-showcase.html`：可供浏览器／CI查看手背、掌侧、侧面、拳面与左右镜像。
- `glove-software-preview.png` 为自编CPU几何检查图，不冒称浏览器或WebGL截图。当前单模块本地Chromium因系统socket限制未启动，实际WebGL整机验证由主任务继续执行。

此模块未修改人物、衣服、动作或R01；没有发布操作。

## 第二轮近景修正

第一轮实际WebGL近景确认了独立掌垫与壳体交叉、独立高对比腕口包边与束带表面争抢的问题。第二轮把掌垫整合进连续壳体，把包边整合为束带自身的窄色带；腕口内缘改为与主壳相同的20侧采样。重叠束带端片按真实束带三角面高度抬起0.45至1.8mm，避免再次穿入束带。缝线宽度收至0.65mm并使用低对比队色。没有加大拳体或修改动作；面数仅从792变为794。
