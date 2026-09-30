# R06 中心脊椎与鱼鳍权重

本轮修复用户指出的 R05 运动误解：完整身体截面由中心脊椎一次性搬运，躯干和头部不再按响应权重混合。七组鱼鳍保留原始根尖地址、局部权重和独立弹性链，随后跟随同一脊椎。眼睛保留 R05 独立眼球与视线控制。切换动作保留当前链状态和速度。

所有原始表面、索引、残差、法线、UV、解剖连接和图集数据逐字节继承 R05；静态口／鳃／眼窝连接遮罩保留，不属于身体运动倍率。完整源模型没有简化。`data/score-metadata.json` 是解码记录；实际运行谱由 `scripts/build.mjs` 从 R05 冻结谱生成。

构建：`node scripts/build.mjs`。数值验收：`node scripts/verify-motion.mjs`。浏览器验收：`node scripts/verify-browser.mjs`，包含实际顶点着色器 transform feedback 与 CPU 材料地址对比、桌面和窄屏启动、眼睛与鱼鳍控件。生成的 `dist/KAOPU_FISH_SPINE_FIN_R06_WORKBENCH.html` 可通过 file:// 独立运行。发布镜像采用独立的 `kaopu-fish-r06/`，R05 入口保留。

QA 截图仅作内部证据。人体等其他工作区和 gh-pages 其他目录受保护。人工 visualAcceptance、motionAcceptance、productionReady 均保持 false，用户通过实时三维工作台决定路线。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码。
- [x] 用户看到的是可交互三维工作台。
- [x] 画面来自实时三维运行时。
- [ ] 公网固定链接和真实浏览器已验证（发布后以 PUBLICATION_PROOF 为准）。
- [x] 如果只有截图而没有工作台，本轮判定失败。
