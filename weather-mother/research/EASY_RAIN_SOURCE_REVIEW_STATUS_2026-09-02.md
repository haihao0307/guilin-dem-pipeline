# Weather Mother EasyRain 官方资料读取状态

日期：2026-09-02

## 已定位的官方来源

1. Fab 产品页
   `https://www.fab.com/listings/274c81ae-3554-4801-8ec0-04f93212da06`
2. William Faucher 官方教程视频
   `https://youtu.be/SHLCj1SwSSU`
3. EasyRain 官方更新记录
   `https://docs.google.com/document/d/1SDxztZKled2rSgKw4_H74oa35KmEbSNiYdEJbsO_ZfQ/edit?usp=drive_link`
4. Epic Developer Community 产品讨论页
   `https://forums.unrealengine.com/t/william-faucher-easyrain/2422456`
5. William Faucher ArtStation 项目页
   `https://will_faucher.artstation.com/projects/QKWx2l`

## 官方公开文字已确认的范围

- Blueprint 总控与 Niagara 降雨粒子。
- 小雨至强降雨的控制。
- 实时、游戏和离线渲染用途。
- Movie Render Queue 中的真实运动模糊表现。
- 两个 Material Functions，分别覆盖世界水洼以及模型表面的滴水、漏水和水珠。
- 水洼支持涟漪、数量、衰减和破碎形态控制。
- Mesh Distance Fields 依赖以及教程中提供的处理方式。
- 两个演示关卡：`L_EasyRain_Showcase_Demo`、`L_EasyRain_ExampleDemo`。

## 尚未完成的读取

- 教程视频逐段内容、参数面板、Niagara 模块与材质连接尚未完成逐帧读取。
- Google Docs 更新记录正文当前只能读取标题，正文尚未获取。
- 商业包内部 Blueprint、Niagara 和 Material Function 图没有公开源码，禁止把推断写成原产品实现。

## 当前工程结论

Rain V0.2 在完整教程读取之前过早进入实现。其屏幕空间细长亮条、简化 SDF 砖瓦和经验式光照已经被用户判定为粗糙。该版本保留作反例和回归基线，不继续以外观微调冒充 EasyRain 技术蒸馏。

下一候选必须先完成以下证据闭环：

1. 教程视频逐段技术卡。
2. 雨滴动画、形状、尺寸、运动缩放与背光控制。
3. 雨帘三层或同等深度组织方法。
4. 遮挡、碰撞、飞溅与 Mesh Distance Fields 的实际数据流。
5. 世界水洼函数和模型滴水、漏水函数的职责隔离。
6. Movie Render Queue 与实时渲染的运动模糊差异。
7. 真实 Brick Mother 与 Tiles Mother 运行时适配件。

批准状态：

```text
sourceReviewComplete=false
visualApproved=false
aaaQualityApproved=false
productionReady=false
```
