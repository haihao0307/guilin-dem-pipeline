# F08 · RootBundle / GuideGroom 交接约定

## 权威与顺序

1. 完整人物 P01 原生公共网格及三角面顺序为绑定权威。
2. 固定的 F02.1 头皮范围经原生面映射得到 3067 个激活工程采样点；不是观察到的真实生物毛囊。
3. 每个激活点恰属一个 BundlePlan 根区，根区不跨组共享。运动时归属不重算；编辑分缝可显式重新分配并重建导向。
4. 192 条导向全部以自身 native triangle / barycentric 根点开始，每条从根到梢保持同一 bundleId。
5. 半透明带仅由该导向的采样点横向展开；没有独立的全局外壳。终点、轮廓错落和少量外突也属于该导向。

## 数据

`kaopu/root-bundle-plan@1` 保存 groups、每组 rootIds / guideRootIds / tipTargets 和全部 rootBindings。工作者内部的目标是 head-aligned Y-up/Z-front；导出时全部 tipTargets 转为 native-common-viewer-Yup，与导出导向一致。位置不能混用。

`kaopu/guide-groom@4` 保存 design、native target、guides、coverage、extensions.bundlePlan、extensions.motionRules、personArchive 与 placement。每条 guide 有原生 binding、localOffsets、designPoints、bundleId、styleProfile、弧长。localOffsets 相对于实际根三角边建立的双精度坐标框；同一个 viewer.mesh 的 placement 只施加一次。

`tipTargets.position` 必须等于该导向的实际最后点；`designed` 是构建时偏好的终点位置，接触支撑、最后内收和导向弯曲可令实际位置偏离它。不得把 designed 冒充实际终点。

覆盖只在同一 bundleId 内选最多三条导向，用原头皮图表中的采样距离作权重。它是归属与后续插值接口，不是最终密集发丝或精确测地线。根区内还可细分更小发束；必须保留 source patch 到 guide 到 follower 的归属链。

`validateGroom` 拒绝旧 schema、不同人物或三角面索引、根区遗漏/重复、跨组覆盖、终点不一致、旧 shapeVolume。`attachGroom` 另核对实际三角索引的 SHA256，再由原生框重建位置。旧 F07 外壳绑定包不可直接当作 F08 发束包。

## 未求解的状态

设计路径是头部局部造型目标。stressFreeRest、equilibrium、runtime 和材料质量/刚度/阻尼仍为 null。绑定跟随和静态线段避让不证明动态物理、有限宽度接触或发发碰撞正确。半透明带的宽度不是头发物理直径。表现资产接入后须对真实宽度和生成密度重新检查。

## 固定人物

P01 平台提交 d413d108704af47cf531ee8c25d93f682c3176e3；25417 顶点 / 50624 三角面；indexSHA256 为 426c934a70c30c2a1229d1166175f08726943bcaf65087e937b0ba9932e55653。原生模型源码、五官、皮肤、骨架均保持其原有权威。
