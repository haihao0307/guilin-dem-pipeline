# 人物待机 ET19-IDLE-R01 — 参考、实现与限制

## 锚点

用户要求继承现有人物总平台而非新头模。固定父版本：`99defb97123d8101fefddf5aa039991446f557a8` 的 `kaopu-unified-human-workbench/lip-structure/preview.html`。只新增 `idle-r01/` 与专用 CI；旧人物、眼球、嘴唇、身体、骨骼、预设与旧网页保留，不合并、不强推。

## 实际读取的视频

用户提供 Facebook CDN MP4。Actions 38127787871 成功下载并解码，HTTP 200，4,746,434 bytes，1920×814，30 fps，1,290 帧，43.0 秒。SHA-256：`55a400893a6ec8eeb20657898d8eacfc05c68455b6c3e656fa87e8bdd91a0252`。已逐段查看抽样帧，不是只读链接文件名。原视频及截图没有复制进公开产品。

0–6 秒：三个人头可见不等间隔的眨眼、视线停留/转移及口部变化。6–12 秒：法线样式的彩色展示，不能当底色使用。12–18 秒：有较大笑容及说话样式的嘴部运动，不能直接作为安静待机。18–24 秒：偏高光的展示；24–30 秒：环境与反射球变化，说明不能把所有亮度变化归因于皮肤贴图。30 秒后：眼周、眉毛、睫毛及额部放大。画面中部分转动可能来自镜头或转台，未将其都判成角色自主转头。

作者、原始渲染器、原模型与贴图授权均 UNKNOWN。没有足够证据认定为 MetaHuman。观察记录不是逐帧动作捕捉；不能从压缩 MP4 唯一反求毛孔位移、粗糙度、散射和灯光参数。

## 一手学习资料及实际采用范围

- Epic MetaHuman Materials and Textures： https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures 。学习将颜色、法线、粗糙度、散射及动画细节分开；没有移植 MetaHuman 资产或完整渲染器。
- Disney Research, Fast Dynamic Facial Wrinkles (2024)： https://studios.disneyresearch.com/2024/04/26/fast-dynamic-facial-wrinkles/ 。学习运动与皮肤细节不能完全脱节。本版只用有界表情权重调整已有眼周/颊部中频对比，不是论文的应力求解器。
- Disney Research, Graph-Based Synthesis for Skin Micro Wrinkles (2023)： https://studios.disneyresearch.com/2023/07/03/graph-based-synthesis-for-skin-micro-wrinkles/ 。沿用原平台已有分频细节，不另外叠均匀噪声冒充毛孔。
- Lee, Badler & Badler, Eyes Alive (2002)： https://doi.org/10.1145/566570.566629 。参考停留、视线行为与眨眼调度，使用原创确定性事件生成器；数值是本项目艺术测试范围，不是实测生理范围或原论文完整复现。
- Three.js MeshPhysicalMaterial： https://threejs.org/docs/pages/MeshPhysicalMaterial.html 。沿用同一物理材质的 roughness/clearcoat 与法线输入，不另建覆盖皮肤。

没有使用中国网站作为研究来源。

## 实现

IdleTimeline：独立种子流、不等间隔眨眼、偶发双眨、视线停留、低幅抿唇/下颌放松/嘴角/眉颊动作与轻微头部跟随，三个可调状态。较大笑容和说话不循环混进普通待机。事件表可导出检查。

IdleRuntime：在当前人物上调用已有 Anny facialActions 与 GNM 轴角通道，经过原完整几何/眼周/唇部管线建立临时显示形变基底。原始参数、canonical 数组、索引、骨长、修订号不由逐帧待机修改；只在现有同一个 Mesh 上更新 GPU 形变权重。换人/改几何时重新校准，无第二个头，无静态视频替代。手动表情优先，走跑和多人擂台保持原版，不冒称整个身体系统已升级。

IdleSkin：减少已有面部微细节的重复叠加；屏幕导数限制低分辨率处毛孔频率；干燥颊部、鼻部、薄眼周与湿唇反射分区。同一光照和机位的静止原版对照，新增贴图字节为零。此版不是体积散射、扫描位移或真实组织应变。

IdleUI：暂停/继续、原版对照、面部近看、安静/倾听/较有反应、强度、随机种子、各动作开关、皮肤开关/增益、单次动作与人物档案。

## 现实约束

原人物眼睑解剖、嘴角大形和毛孔质量仍限定最终真实感，动作不能替代结构修复。小角度姿态形变缓存是近似，不能替代精确骨骼求解或软组织碰撞。呼吸是脊柱姿态代理，不是胸腔容积/肺部模拟。脸型更改需重新校准，显示形变缓存消耗内存和 GPU 纹理；浏览器首次仍需读取原平台的固定原生模型数据。多人实时与消费级 GPU 帧率未经认证；手机视口不等于手机实机。影视级目标仍需高质量采集/授权资产、准确眼睑接触、口腔接触、细节分辨率和独立硬件验证。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改派生产品源码。
- [x] 用户目标是可交互三维工作台，不是截图/视频。
- [x] 人物几何和动作使用原生运行时。
- [ ] 公网固定链接和真实浏览器已验证：以 DELIVERY.md 和 evidence 为准，不能因测试脚本存在就宣称通过。
- [ ] 用户视觉验收：由用户本人决定。
