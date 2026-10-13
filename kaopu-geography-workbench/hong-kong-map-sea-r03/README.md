# 陆港铁路 · 香港故事地图 R03

在 R02 正北故事边界内，接入五处官方 CEDD 裸地地形，保留红磡，尽量沿旧铁路走廊组织概念线，并加入山顶风动树冠试验。

## 这轮实际内容
- 背景仍为 Copernicus 30m 现代 DSM；40块新恢复 CEDD 0.5m 源瓦片形成五个局部窗，有效原生裁片7.61838525km²。运行显示是2m近看、5m远看，绝不是全线0.5m。
- 原生HKPD通过 LandsD HKGEOID2016_SMO 与NGA/PROJ EGM2008模型链做显示级对齐；改正约-0.472至-0.398m，非测量级承诺。裸地与DSM地物高度差仍存在，源窗边100m是明确的显示过渡。
- 原NoData不填零；用R02背景回填。R02已删湖河/沙田站场保留，不把现代水体重新放回来。
- 旧九龙—红磡按梳士巴利道/漆咸道旧走廊意向，北段尽量贴既有走廊。历史资料支持大关系，部分几何借现代OSM，不冒称历史精确原线。跨湾桥沿R02用户原蓝线，大埔墟河对岸为架空候选。
- 树冠借毛发工作台自有分支的根部约束、多频扰动与平滑噪声方法，新增地理小范围试验；不是逐棵真实树，也不是验证过的头发动学。
- 九龙 R05 B 建筑已接入：同源构件形体和原材质函数 GPU 有限采样，447,876 顶点、257,452 三角面；钟楼、主厅及三联棚保留。实际构件16点和材质186点/跨批/错误输入对照、整站采样、整图桌面与手机测试通过。它是地图中远景采样显示，不宣称完整解析函数实时渲染、严格面积平均或已达最终近景品质。其余站棚是布局示意。

## 共同故事边界
EPSG:2326节点界 west823035, south808015, east848475, north845485。X=E-834000，Z=827000-N，Y为显示高程，1倍高度。导演/编剧统一用此边界；用户仍可调整。

## 源与许可
produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved

CEDD/Lands Department HKSAR Government source URLs, per-tile SHA256 and datum evidence are in detail-data. Use subject to the applicable official open-data terms. Modern railway: © OpenStreetMap contributors, ODbL, relation4248592 v69; member geometry current at retrieval, not an archived historical trace.

Ocean Mother R01C original is preserved. Only this independent map host clips water geographically and sets coverage; the approved wave/optical core is retained.

R01, R02 and frozen Ocean remain separate. No private reference photos or scans are in the runtime; no connection to game88 or train gameplay is claimed.

## 发布与复现
最终运行由 index.html（14,691,672字节）与 station-data.js（5,455,144字节）组成，总下载20,146,816字节，未含浏览器缓存收益。车站资源失败会禁用实装按钮并给出可诊断状态，地形继续显示。两个资源的SHA256和测试关联见RELEASE.json。

qa-source-bundle.zip 保存原自有源和 frozen B 权威模块；workflow/frozen-b-station-qa.yml 是完整实际测试配方，明确记录组件脚本文件名修复，不改变母体。数据/原材质采样通过后生成整图，再运行 qa/externalize_station.py 拆资源并加入加载失败保护。

后续近景质量项：沿用现代/30m底图的海岸阶梯；棚顶细密构件的距离过滤；真实岸线/站位绝对方位非历史测绘承诺。主厅玻璃传输仍为源合同中的deferred项，未通过的玻璃未伪造为透明成品。
