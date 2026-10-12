# R03 研究依据与迁移边界

核查日期：2026-10-12。本轮参考官方/一手资料，不从参考页面拷贝人物或耳朵网格，也不把文献正确性等同于当前模型已达标。

## 1. NIH/NHGRI — Anatomy of the Ear

https://elementsofmorphology.nih.gov/anatomy-ear.shtml

参考对耳轮的连续Y形关系，上脚较宽、下脚更清楚；耳甲腔、三角窝、舟状窝要由相邻脊线界定。耳垂和软骨轮廓不应统一拉伸。

迁移：EarMath 的分叉平滑联合、上/下脚宽度区分、分区凹陷、耳垂下缘与附着控制。当前位置和增益仍是原生模板上的人工参数，不是临床测量、统计人群拟合或真实生长模拟。

## 2. Three.js — Color Management

https://threejs.org/manual/pages/color-management.html

光照与颜色插值使用 Linear-sRGB；启用颜色管理后，十六进制/CSS输入通过 Color 方法转换。法线/粗糙度等非颜色数据不是sRGB颜色贴图。

核查结果：原 CommonSkinLayer 的颜色输入已有 Color.set 处理，不能凭唇色难看就宣称是重复gamma错误。本轮保留线性颜色链，实际修复的是唇部横向边界、面部叠层串入及不合适的区域混合。新增颜色控件写入原生设置和档案，未另加显示空间染色层。

## 3. NVIDIA GPU Gems 3, Chapter 14 — Advanced Techniques for Realistic Real-Time Skin Rendering

https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin

参考表面反射、微细节和皮下传输必须分别处理的思路，而不是用一层强模糊抹掉所有结构。本版保留原人物渲染链，对唇红和耳部单独降低屏幕扩散影响，并区分耳轮、耳甲和耳垂的粗糙度与油光。

没有移植该章完整系统，也没有实测多层组织参数。EarMaterial 的薄区逆光与屏幕扩散门控是预算受限的实时近似，不能称作物理精确散射。

## 4. 项目内部证据

原用户耳部页：b2bb70362e2af7d8792b31d6340cf5565f83c685；其运行材质仍来自旧 ET17 唇部链。
R03固定构建：7e223fed91b389b9ff9b6709593930095b6120a4。
Actions 38188931546 的本地候选63项、公网18项断言通过；实际图片和报告在 acceptance/。对最终PNG的视觉复核仍发现近景耳根/耳屏偏软和程序化唇纹规律性，已在README记录，未因测试通过而删除这些限制。

不加入新的外部图像/扫描资产。原眼球 callharvey3d / Harvey_eye1、Harvey_eye2 资源的来源与CC-BY署名仍沿用 eye-materials/THIRD_PARTY.md；原资产哈希与加载锚点未更改。
