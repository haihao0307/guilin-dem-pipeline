# 陆港铁路：香港海陆总览 R01

独立地理关系研究候选。真实约 30m 背景 + 冻结 Ocean R01C 波形、微法线与光学；原 Ocean 页面及旧地形案例未改变。

- 数字来源：Copernicus GLO-30 DSM，不是 0.5m CEDD 裸地 DTM。保原 EGM2008 高程，EPSG:2326 米制水平坐标，真高 1×，无垂直基准混接。范围为铁路走廊与维港、港岛背景，不是香港全境。
- 海陆：同源官方 Water Body Mask，海洋才绘 Ocean；湖、河保各自 DSM 高程，未当海洋，未把 NoData 当海。
- 现代地表/现代岸线，不代表架空 1970 年代海岸。
- 粉虚线为用户讨论的概念走向：旧九龙钟楼 → 巨型庙宇第二站选址区 → 狮子山穿山意向 → 沙田河/马场/大学候选区 → 田园 → 罗湖。尚无坡度、曲率、站位、隧道与工程设计。
- 蓝线为现代东铁红磡至罗湖参照，33.197km；OSM relation 4248592 version69，成员几何为下载当日当前 API，不冒充 2026年4月冻结。两条线都是地图标注，未赋轨面工程高程。
- 尚未恢复并接入原 390 个 CEDD 0.5m TIFF 近景；本页不冒充完整 KAOPU 香港谱。
- 画面矩形边是加载范围，没有添加侧墙。可拖动旋转、滚轮缩放、右键拖动平移，四个视角按钮。

## Attribution

produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved

Copernicus sources and license: see SOURCE_MANIFEST.json source.sources and source.license_url. Official product handbook: https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf

© OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright
Source: https://www.openstreetmap.org/relation/4248592

Ocean source: project-owned frozen Ocean Mother V001 as adopted by HK R01C. Source HTML SHA256 84c48cc777f9860cb3e62cbfe2246a7e5fbf49e206d740546fd0f4abf7d46325. Only host camera and geographic clipping are adapted; 24 wave, 12 micro-normal, sky and optical source retained. No new third-party model/image assets.

## Rebuild / audit

index.html 内含无损 gzip Float32 数值与官方海陆类别，不是高程贴图。运行 python restore_embedded_data.py 可无损重建 data/ 下源数组与场景配置，再运行 build_map.py；所用冻结原海面在相邻 hong-kong-background-sea-r01/index.html。prepare_scene.py 是原始源处理步骤的记录，原始 Copernicus/OSM 来源均在清单中。新页约 3.75 MB，不是几 KB 的完整香港 KAOPU 谱，也不含全部 0.5m 近景。
