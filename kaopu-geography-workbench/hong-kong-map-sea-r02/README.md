# 陆港铁路：故事疆域 R02

按 2026-10-13 五张用户圈图建立的独立故事候选。R01 地理参考和冻结 Ocean R01C 均保留。

- 正北边界：EPSG:2326 [823035, 808015, 848475, 845485]，约 25.44 × 37.47 km。依据截图相机、现代铁路控制线和 DSM 反投影后向内选矩形；不是直接把屏幕红框当坐标，边界解释误差约 600m。所有导演、编剧以金色边界为共同故事范围。
- 地形：现代 Copernicus GLO-30 DSM，30m、米制、原高程比例1×。船湾淡水湖、城门河及沙田两段直线支沟残片（58格点）按原水体边界及周边高程插值为架空陆地/谷地；万宜水库在边界之外不加载。此为故事改造，不是历史地形复原。其他山体与水域没有整体压平。
- 沙田：两黄圈表示大致双侧关系。共同意图区附近约67m处找到平缓站场轴，原300×90m足迹约6.7–12.4m。采用9m共同规划标高，仅64个30m格点局部调整，最大约3.17m；双侧平台约60m分离，没有把两个黄圈绑成相隔500m、跨81m高差的大平台。
- 第二站：黄圈在城寨参考位置西南约400m，按候选落点显示双侧大棚。轻量平台/棚体是关系标注，不是批准的建筑模型或工程设计。
- 路线：旧钟楼沿用户画出的旧线逻辑，到红磡前转第二站，再城寨低速展示、狮子山正下方隧道意向、沙田、田园、罗湖。所有线为地图投影，未赋铁路纵断面；北段局部跨现今水面也只代表架空走向。现代东铁参照默认关闭，可独立开启。
- 可拖转、缩放、右键平移；故事全境、正北俯看、港口、第二站、狮子山、沙田视角均为普通透视。初始北朝上，转动后右上北针跟随。

## 原始参考与复现

原始页面：../hong-kong-map-sea-r01/ 。冻结海面：../hong-kong-background-sea-r01/ 。Ocean 波形、微法线和光学核心保持，只适配同坐标宿主镜头与水域裁切。

prepare_story.py 使用 R01 原始数组与 research/markup_coordinates.json 生成新故事数据。build_map.py 由冻结原海面和新数值数组生成自包含 index.html。restore_embedded_data.py 可无损恢复本页内嵌的最终故事数组。研究文件记录反算方法、源图校验、候选误差与选址调整；不会将截图像素冒充测绘坐标。

## 来源与许可

produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved

https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM

© OpenStreetMap contributors，ODbL：https://www.openstreetmap.org/copyright 。现代东铁参照源：https://www.openstreetmap.org/relation/4248592 。手绘故事线依据用户指示，不称历史精确铁路。

尚未接入0.5m CEDD近景或88游戏。此版本用于确认全局关系与故事边界。

沙田两段支沟残片在源WBM中被分成两个lake类小块，分别33与25格点；这里只按本轮图面指出的位置移除，不声称它们在30m分类栅格里与主河连通，也不据此盲删全图其他小水体。
