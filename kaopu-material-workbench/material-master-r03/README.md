# 香港 PBR 材质大师 R03

七个一级类别：石材、木材、金属、玻璃、墙面、道路、瓷砖。瓷砖明确标为研究中，未开放不存在的渲染功能；釉面、无釉、马赛克待独立来源/母体核验。细分类只给已实现的案例开放交互入口。R01、R02 与 R18 原版仍保持独立；本页嵌入 R01，保留 R02 的构造与材质公式，仅在 R03 独立道路适配中把普通中线/车道线改为白色。

## 来源与年代

- 香港古迹办 2022 文集：granite、timber、brick、lime plaster、Portland cement/concrete、steel、cast iron、ceramic tile 等历史建筑材料。https://www.amo.gov.hk/filemanager/amo/common/form/2022_AMO_Summit-EN.pdf
- 香港石屋官方记录：花岗岩、混凝土、木屋架及陶瓦。https://www.heritage.gov.hk/en/revitalisation-scheme/batch-ii-of-revitalisation-scheme/virtual-tour-on-batch-ii-historic-buildings/stone-houses/index.html
- 市建局船街18号记录水磨石梯级。水磨石是人造复合材料，不冒作天然石。https://www.ura.org.hk/en/project/heritage-preservation-and-revitalisation/18-ship-street
- 建筑署 GS 2022 及官网勘误用于理解底漆/中层/面层体系；政府工程规格不等于所有香港私楼规定，也不是1997年前历史规范证据。应按官网当前勘误核对。https://www.archsd.gov.hk/en/publications-publicity/general-specifications.html
- 屋宇署设计守则目录提供玻璃、钢结构、防火等规范及修订；本页不作工程认证。https://www.bd.gov.hk/en/resources/codes-and-references/codes-and-design-manuals/index.html
- 运输署普通白线与行车线，以及路缘停车限制分别处理。现行说明不自动证明某历史街段线型。https://www.td.gov.hk/en/road_safety/road_users_code/index/chapter_5_for_all_drivers/white_lines_and_traffic_lanes_/index.html

## 程序来源与模型边界

R01 石/砖/抹灰母体与原来源许可见其 README/SOURCE_MANIFEST；不改源码。R02 金属与水泥原件哈希、尺度及出处见 R02 SOURCE_MANIFEST。新柏油依然属于研究，不是成熟继承母体。白色中线修正在本版 surface.mjs 单独保留，R02 历史版示意黄中线不作为香港正确标线证据。

木材继承用户 timber v3，完整原件 SHA256 ce6a10b73516cb3fe64b389c167daab6625354e2ea9a67c08ca6ab94c8b5df9c。暖褐、旧木、风化和栗褐清漆保留原预设；新不透明绿漆接收层另标。云南命名预设不是香港树种测量，也不等于按年数模拟老化。完整原木母体与新接口细节见 sources/wood-glass-provenance.json。

玻璃继承既有有限 Three MeshPhysicalMaterial：IOR 1.52、14mm基准实体、3.5m吸收距离、opacity 1。具真实闭合厚度，但屏幕空间传输不能保证多层互相透射、离屏折射、多次反射或焦散；14到60mm吸收差异理应有限，不人为夸大成深色透明塑料。

不为整个用户项目赋统一 MIT 许可。Three.js r170 依赖独立保留 MIT，沿用 R02 vendor。未使用教师贴图、扫描模型、受限照片或付费资产。

## 建筑接入合同

COMPONENT_CONTRACT.json 预留 objectId/componentId、构件语义、米制尺寸、表面法向、重力方向、材质配方、实例旧化参数、照片来源与权利、年代/测量置信度。这里只定义接口，没有自动识别立面、自动对齐图纸或一键完成整栋建筑。历史门窗尺寸以真实测量为依据，规范用于校核而不是统一覆盖尺寸。

## 检查

qa/browser.cjs 检查六类别与所有开放子类的实际 WebGL 像素、截图、玻璃厚度与漆层磨损交互及390px手机布局。它的通过不等于艺术终验；最终发布以对应提交的截图检查与验证收据为准。原 R01/R02 同时回归。

## 距离与可见性合同
照片逐立面标注材质区域，再绑定共享配方及构件实例参数，首先是数据流程约定。按屏幕贡献连续滤波微细节，远处仍保留平均颜色、粗糙度、金属/介质差异以及必要反射/透射，不能所有材料统一退成纯base color。直接视图外可裁剪，但必要的阴影/反射贡献仍需评估。本版没有把这些策略自动应用到全香港地图。

## 木接收尺度修正
首次实帧发现原大木构 textureScale=1 在小窗构件上仅出现少数粗色带，不能以保存代码代替保留视觉质量。右侧研究接收器明确继承 FH88 原接收器已有 textureScale=5.8，左侧保留原预设尺度；未新造木噪声。qa/wood-scale-study.html 对照完整原 GLSL 光照与 Three 接收器在相同几何上的两种尺度。新漆膜磨损移除规则正弦图样，使用原母体噪声构成受边缘影响的共享遮罩；它仍是新接收层，不称实测老化。
