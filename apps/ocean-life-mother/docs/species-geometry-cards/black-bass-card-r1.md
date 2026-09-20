# FISH-R1-T01｜大口黑鲈头—口结构卡 R1 / 原生候选 v0.7

日期：2026-09-20  
对象：`Micropterus salmoides` / Largemouth Bass / 大口黑鲈  
范围：只修正“嘴不是贴色线或断开的板片，而是与头颅、面颊、眼眶、上颌、下颌、口腔和鳃盖保持结构关系”这一项缺陷。

## 1. 精确输入

- Reference ID：`FISH-REF-001`
- 当前文件名：`model_67a_-_largemouth_bass(2).glb`
- SHA-256：`c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64`
- 字节数：`18,644,040`
- 文件内标题：`Model 67A - Largemouth Bass`
- 文件内许可：`CC-BY-NC-4.0`
- 证据等级：`N2_TRANSITIONAL_REFERENCE`

原 GLB 只用于观察、测量和反向校验。v0.7 不包含源网格、源贴图、源蒙皮或源动画轨道，也不在运行时读取该 GLB。

## 2. 坐标与源文件事实

源坐标：`x` 为左右宽度，`y` 为背腹方向，`z` 为纵向且头部为正。观察体长范围为 `z=-0.2382134199 ... 0.1178226694`，体长 `0.3560360894 source units`。原生卡采用 `u=(z-zMin)/bodyLength`，尾端 `u=0`、吻端 `u=1`。

已读取事实：

- 身体与鳍：`8,556` 顶点、`15,904` 三角形；
- 独立双眼体积：合计 `130` 顶点、`224` 三角形；
- 一套蒙皮、`33` 个源关节；
- 一个 `Swim Cycle`；
- `jaw_22` 绑定铰点约为 `[0,-0.0265282431,0.0643457175]`；
- 左右眼中心约为 `[-0.01642162,0.01074783,0.07416826]` 与 `[0.01634877,0.01073904,0.07414965]`。

这些是源资产结构事实，不自动等于自然解剖真值。

## 3. 自然证据边界

目前只采用一条定性自然约束：成年大口黑鲈的上颌后端应超过眼后缘。具体超过多少仍没有本项目认可的统一毫米测量，因此 `maxillary` 后移量仍是 `ENGINEERING_CANDIDATE`。

游戏资产、渲染图与第三方模型只能作为 N2 视觉参考。物种、自然材质、生态和真实动作需由 NOAA / PIFSC、科研论文、博物馆数据、实拍或直接自然观察继续复核。

## 4. v0.7 实际结构增量

相对早期候选，v0.7 没有继续扩大开口，而是：

1. 将头颅侧面的阶梯式大缺口改为窄的解析口裂；
2. 口裂仅在限定 `u` 区间和左右侧面开口，保留眼眶下方和面颊连续体；
3. 上下唇改为跨越整张口的薄实体，不再是左右悬空片；
4. 下唇和口腔底随 `jaw_22` 铰点开合，上唇保持头颅锚定；
5. 嘴角增加左右圆滑连接；
6. 上颌骨改为嵌在面颊外侧的曲线实体，而不是明显板片；
7. 鳃盖增加左右窄重叠壳和边界折线；
8. 眼球、虹膜和瞳孔继续保持独立锚点；
9. 后部延伸只用于消除“断头”阅读，仍不是完整鱼体。

代码入口：

```text
apps/ocean-life-mother/web/src/fish/index-v07.html
apps/ocean-life-mother/web/src/fish/main-v07.js
apps/ocean-life-mother/web/src/fish/v07/blackBassFish-v07.js
```

## 5. 数值与浏览器检查

运行：

```bash
node apps/ocean-life-mother/web/src/fish/tests/blackBassFish-v07.test.mjs
```

结果：

```text
FISH-R1-T01 black-bass head/mouth kernel v0.7: 54 assertions passed
```

覆盖：精确 SHA、淡水身份、截面单调与有限性、窄口裂实际生成、铰点不漂移、下颌长度不拉伸、口腔随张口扩展、下唇随颌而上唇不漂移、上颌后端在眼后、左右鳃盖侧别正确、全部语义部件生成有效，以及所有源资产运行依赖为 `false`。

本地 Chromium/Xvfb 检查：

- 桌面：`1440×1000`；
- 手机：`390×844`；
- `WebGL error = 0`；
- 手机横向溢出 `0`；
- 页面错误与控制台错误均为 `0`；
- 原生部件 `19`；约 `33,716 triangles`；
- 侧视、斜侧、正面、俯视、下颌滑块、循环开合、鳃盖显隐、口腔显隐、网格、拖拽和缩放已检查。

受管环境仍阻止 localhost 网络导航，因此浏览器使用精确本地源码的 `page.set_content` 回退方式；这不是公开网址验收。

完整回执：

```text
apps/ocean-life-mother/web/src/fish/reports/FISH-R1-T01_V07_QA_20260920.json
```

## 6. 视觉自检结论

已改善：

- 早期候选巨大的面颊/眼下缺口已经消失；
- 口部现在能读成限定口裂、唇缘、口腔和独立下颌的组合；
- 下唇跟随下颌，不再与头颅错位；
- 鳃盖已经具有明确但简化的重叠边界。

仍未通过：

- 闭口时仍有“工程化暗楔”感，软组织尚未收敛；
- 唇缘、上颌骨和嘴角过渡仍偏机械；
- 鳃盖曲率与面颊体积仍过度简化；
- 牙齿、口腔软组织、角膜/虹膜光学和完整皮肤 PBR 尚未完成；
- 仍是头部限定候选，不是完整鱼；
- `visualAcceptance=false`；
- `userAcceptance=false`；
- `productionReady=false`；
- 未发布。

## 7. 新视觉资料的关系

用户新提供的 15 张游戏资产图已经登记为：

```text
FISH-GAME-ASSET-VIS-20260920-R01
```

它们只用于颜色分区、大形体家族、湿润 PBR、薄鳍半透明和环境氛围观察，不替代当前黑鲈结构任务，也不直接决定真实鱼种。详见：

```text
apps/ocean-life-mother/reference-intake/game-assets/20260920/FISH_GAME_ASSET_VISUAL_BATCH_R01.md
apps/ocean-life-mother/reference-intake/game-assets/20260920/FISH_PBR_IMPLEMENTATION_BOUNDARY_R01.md
```
