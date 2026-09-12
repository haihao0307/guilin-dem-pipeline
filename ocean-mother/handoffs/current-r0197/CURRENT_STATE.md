# Ocean Mother 当前真实状态

日期：2026-09-12

## 当前运行候选

- 名称：`Ocean Mother R019.7 · Mobile Heightfield`
- 固定提交：`b5be782a135d43d54253cbe20e664b53f2c726c6`
- 文件：`ocean-mother/releases/Ocean_Mother_R0197_Mobile_Heightfield_Direct_Open.html`
- 用户实机结论：iPhone Safari 可以正常看见和运行。
- 视觉结论：太粗糙，不是商业候选；未获视觉批准，未获生产批准。

R019.7 解决的是移动端打开、轻量 Ocean 核、较可靠的高度场命中和固定公网交付。它不能取代过去接近成功的视觉母体。

## 冻结视觉恢复源

- 分支：`handoff/ocean-mother-full-20260905-v0.3.11`
- 固定提交：`7b6bba5f9affb9cfcfea5dabfafa5e7931bb492d`
- 目录：`ocean-mother/restart-v0311`
- 角色：此前接近成功效果的完整恢复源与历史依据。

该源保留 R018.11 的原样 HTML、运行资料、源码、近岸与深海相关内容、规则及证据。它存在真实性能与 context-loss 阻塞，不能冒充最终完成版；但其视觉成果不得被 R019.7 的兼容占位外观覆盖。

## 已吸收的方法源

- KAOPU 世界合唱交接：`f254721b7e3e23cb35b7b660fa9441dc6cef9796`
- Ocean Coast Adapter 与 Ocean 学习资料已包含在包内。
- 用户 2026-09-12 提供的 `KAOPU-LEARN R0.1` 方法指导已逐字保存于 `METHOD_GUIDANCE_KAOPU_LEARN_R0.1.md`。

## 已验证但只允许按需移植的运行修复

1. UI 与 Ocean GPU 启动解耦。
2. Boot → Lite Ocean → Full Ocean → Coast 烟火 → GPU Query 分阶段加载。
3. 首屏不执行 `readPixels`。
4. 移动端默认不自动编译最重的完整 Ocean shader。
5. WebGL context loss / restore 后重新建立资源。
6. 移动像素预算和 FPS 自适应。
7. 固定提交公网 HTTPS 地址与 SHA 校验。

这些修复属于运行架构，不构成视觉母体更换理由。

## 尚未完成

- 将冻结视觉源和稳定运行修复合并为同一候选。
- 同镜头、同参数的旧视觉源 / 新候选 A/B。
- 商业级海岛主形、表面分区、岸线、礁岩和植被层次。
- 商业级近岸浪、破浪、泡沫、浅深水光学与远海方向谱。
- 三处烟火的风场、地形遮挡和连续体积效果。
- iPhone Safari 连续运行、后台恢复、context loss / restore 的完整实机门禁。
- Windows 独立显卡的帧时间、显存和稳定性门禁。
- 水动力正确性与视觉正确性的独立记录。

## 新生产线执行顺序

1. 从 `frozen_visual_source/restart-v0311` 找回用户此前认可方向的原始画面和镜头。
2. 为冻结视觉源建立固定对照镜头与参数快照。
3. 先只移植非阻塞启动，不改视觉函数；完成 A/B。
4. 再移植 context restore 和像素预算；完成 A/B。
5. 再按海面、近岸、岛体、礁岩、烟火逐层商业化精修。
6. 每一层通过后冻结，禁止下一层覆盖已通过成果。
7. 最后才形成新的固定提交公网候选。

## 当前批准状态

```json
{
  "userCanOpenR0197OnIPhone": true,
  "visualApproved": false,
  "productionApproved": false,
  "commercialQualityReached": false,
  "hydrodynamicsValidated": false,
  "r0197IsVisualMother": false,
  "r01811IsFrozenRestoreSource": true
}
```
