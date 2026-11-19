# R14 宽绒光候选：数值与接入记录

状态：默认关闭的可选视觉试验。以下保留接入前的研究记录，并在此补充浏览器对照结果。

**最终状态更新**：在实际浏览器中以同一花型、机位及 32 样本比较棚光和掠射光，试验前后整块画面的平均 RGB 差异约为 0.35–0.49 / 255（含采样等画面差异），肉眼变化较轻，不能据此说解决了针条感。该控件现作为「绒光展宽 / 试验」保留，默认值为 0；「绒光试验」按钮提供柔棉 0.6、丝光 0.08、细网 0.2 的可选对照。下方数值与接入建议保留为原研究记录。

## 来源与适用边界

- [Filament 布料材质说明](https://google.github.io/filament/main/filament.html#materialsystem/clothmodel)：介绍布料中的宽柔绒光，以及丝绸可适合使用方向性高光。这里借鉴的是效果目标，没有复制 Filament 实现。其[源代码为 Apache-2.0](https://github.com/google/filament/blob/main/LICENSE)。
- [Unity HDRP 布料说明](https://docs.unity.cn/Packages/com.unity.render-pipelines.high-definition%4017.4/manual/understand-fabrics.html)：将偏漫射的棉/毛与具有方向性高光的丝绸作为不同材质起点。这是引擎材质设计指南，不是当前样布的实测参数。
- [Lace Curtain，SIGGRAPH 2009](https://ist.ksc.kwansei.ac.jp/~nagata/data/1599301.1599368.pdf)：论文对织造窗纱进行多角度光照采集和扭捻纱研究，可供区分孔洞透光与纱线散射；作者保留图片版权。窗纱不是当前刺绣样本。

`src/yarn-sheen.js` 由本项目独立编写。它是方向分布代理，不是 Charlie BRDF、真实纤维模型、测量结果或论文算法的完整实现。它不引入参考图片或代码。

## 机制

R13 的直接纱束高光和绒光使用相同的 `laceAngular.x`。候选将原绒光方向分布中的一部分替换为 `3(1 + cos²θ)/(16π)`，范围宽且对正反散射方向对称。两个分布在出射方向全空间的积分均为 1。原有入射截面积项、颜色、光源衰减和阴影继续使用；没有额外光源、发光或透明度变化。球面积分保持不等于任意单帧亮度保持，也不证明整套材质满足能量守恒或物理准确。

`laceSheenSpread` 为 0 或缺失时模块返回原 shader，正值只改变已有绒光位置。混合仅发生在已启用 `bundleScatter` 的分支内；其他直接/间接光贡献与孔洞几何不变。正值 0.1 和 1 复用同一编译变体，参数经 uniform 更新。

## 数值检验

`node --test tests/r14-yarn-sheen.test.mjs`：6/6 通过。覆盖中性设置的 shader 字节一致、注入位置、缓存后缀、有限性、角度积分、相同光线遮挡及旋转不变性。此处没有证明 GPU 编译、最终亮度、动态稳定性或实际视觉质量。

`node tools/r14-sheen-probe.mjs` 生成 [r14-sheen-probe.json](./r14-sheen-probe.json)。它使用 R13 的填绣材质控制、三个假设纱向、单位白光和正面观察，计算直接绒光标量；不包含画面、色调映射、其他灯、漫反射、几何遮挡或毛羽。试验混合值：柔棉 0.6、丝光 0.08、细网 0.2。柔棉三纱向的绒光平均值，正面 0.01493→0.01314，掠射 0.00740→0.00582；掠射下方向变异系数约 0.562→0.449。它只描述该光泽分量，不应被解释为整图对比度或视觉改善。

## 接入建议与待验收

1. 在现有 bundle、finish、surface、continuity 注入后调用 `injectYarnSheen(shader, amount)`；仅当 `amount > 0 && bundleScatter > 0`。添加同名 `laceSheenSpread` live uniform。
2. 为有效状态增加 `sheenProgramSuffix(amount,bundle)`；有效状态跨零需要 `needsUpdate`，其他正值调整仅更新 uniform。旧配方缺失该字段应按 0 处理。
3. 做相同花型、机位与灯光的开/关检查：柔棉、丝光、细网分别对比正面、侧光、背光与近/远距离；留意棉线是否成片发白、丝光是否变闷、网孔是否被视觉抹平。
4. 若实际改善不可辨认或影响网孔、已有亮度与性能，则保留为关闭的研究候选，不应宣布解决针条感。仍需有尺度的实布对照和动态检查。
