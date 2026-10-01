# R08 连续单鱼表面与鲱鱼参考学习

用户要求先学习 `school_of_herring.zip` 的骨骼动画，修复 R07 表面块状破碎，再发展群体。当前只处理单鱼；原始参考动画和本鱼同屏运行，鱼群按钮仅播放附件的六鱼烘焙动画。

根因已测量：继承的部分 fin chart 误包含躯干皮肤，共享材料地址分裂；另有零鳍根旋转轴造成 GPU 无效法线。R08 根据原模型的向外鳍根距离重新限定鱼鳍响应，以平滑边界带和共享绑定保证接缝一致，并跳过无效轴的法线旋转。原几何、索引、UV、法线和 4K 图集保持不变。七鳍独立、身体全脊椎搬运和原眼球控制保留。

知识库：`knowledge/fish-motion/README.md`，记录参考来源与许可、骨骼节律实测、坐标差异、不能直接继承硬蒙皮的原因、根因、函数归属、必跑回归与后续生态边界。

构建：先 `node scripts/build-reference.mjs`，再 `node scripts/build.mjs`。单体 HTML `dist/KAOPU_FISH_TAIL_DRIVE_R08_WORKBENCH.html` 以无损封装完全内嵌主鱼与参考的运行资源，可 file:// 直开。生产验证使用 `verify-motion.mjs`、`measure-gait.mjs`、`verify-extremes.mjs`、`verify-surface.mjs`、`verify-gpu-surface.mjs`、`verify-browser.mjs`。内部截图及视频来自真实 WebGL，不是三维交付替代品。公网版本 `kaopu-fish-r08/` 保留旧版本入口。

参考：School of Herring by radiator，CC-BY-4.0；完整原始许可在 `reference/herring/license.txt`，网页参考栏包含署名和来源。原始资产只用于可切换的参考播放，不替换我们的鱼。群聚/避碰代码未存在于附件，也未在本轮虚构实现。推进响应依然是未标定估计。人工视觉与动作验收仍待用户，不能从测试自动置 true。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码。
- [x] 用户看到的是可交互三维工作台。
- [x] 画面来自实时三维运行时。
- [x] 公网固定链接和真实浏览器已验证。
- [x] 如果只有截图而没有工作台，本轮判定失败。
