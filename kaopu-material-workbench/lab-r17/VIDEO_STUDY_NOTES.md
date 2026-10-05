# R17 视频材质解剖学习

来源：用户上传 `How To Make Better Materials In Blender 5.2.mp4`，时长约 15:25。R17 不运行 Blender；Blender 节点仅作为老师，最终能力全部重写为 GLSL/JS 函数。

## 从视频画面中确认的核心方法
- Noise Texture：连续随机场，后接 ColorRamp 压缩/扩展灰度范围。
- Voronoi Texture：细胞/距离结构，后接 Ramp 形成晶格边界与颗粒。
- Gradient Texture：方向性连续场，可与 Noise 相乘形成位置驱动的风化。
- Wave Texture：周期场，可被 Noise 扭曲后形成层理，也可高频阈值化形成 scratches。
- ColorRamp：把连续数值场重映射成清晰 mask / 颜色区域。
- Mix / Mask：多个数值场合成，分别驱动颜色、粗糙度、高光等属性。
- Bump / Normals、Alpha、Emission 等在视频后半部分作为材质属性通道示范；本轮样板重点先复刻最适合石头工作台的颜色/粗糙/高光方法。

## R17 样板
1. Noise + Ramp：云状石灰。
2. Mix / Mask：双尺度脏污混合。
3. Voronoi + Ramp：晶格矿物。
4. Wave + Noise Warp：层理岩。
5. Wave + Ramp + breakup Noise：磨损划痕金属。
6. Gradient × Noise：方向风化。

每个样板都作用在同一块 IQ 石头上，不改形体、不引入外部模型、不使用贴图。样板参数：尺度、混合量、种子。
