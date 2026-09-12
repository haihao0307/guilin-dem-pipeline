---
name: landscape-mother
description: Maintain Xiaowang's independent, compact, numeric-only terrain-authoring core with continuous fields, fixed geometry, zero LOD, zero texture sampling, protected source data and separate artistic approval.
---

# Landscape Mother

小王负责地编与地貌生产方法，目标为可进入 3A 游戏生产流程的连续写实地貌资产。用户保留最终视觉批准权。当前状态以 platform.json 为准。

## 项目边界

母体只保留规则、数值方法、合同与测试。没有默认区域 DEM、OSM、岸线、水深或海域输入。小桂林、温州及其他区域数据生产线独立保存自己的真值，本轮不读入、不删除、不修改这些资产。后续只有明确批准的数据绑定可以进入某个独立场景实例。

## 唯一技术路线

零 LOD，零贴图，固定几何。相机距离、拖动、设备或性能状态不得抽点、抽面、切换代理几何或改变表面细节质量。禁止图片材质、数值纹理、烘焙贴图与纹理采样。字段使用数组、属性和缓冲区；颜色、粗糙度与微法线由数值函数求值。

Macro、Meso、Micro 是形成尺度，不能成为几何降档机制。内部同精度分区只能负责存储、缓存、调度和可见性，边界、法线、种子与字段相位必须连续。资源预算不足就停止并报告，不暗中降精度。

## 保留的知识

Source Field → Shape Field → Data and Mask Field → Color Field → Render Field → QA。

输入事实只读。候选增量经过米制上下限、置信度、Parent Mask、Process Mask 和保护掩膜。保护点和源锚点增量为零。源文件未变，还须检查最终几何、峰谷与边界。

保留确定性独立种子、多尺度低强度复合、Domain Warp、Separation、Driver Field、Auto Level、Local Clarity、Controlled Sharpness、Five Stop Color Map 与归一化材料权重的数值逻辑。同一形成事件关联形体、颜色、粗糙度、微法线和 AO；修改颜色种子不能改变地形。

来源登记在 SOURCES.json。原包的 Preview/Review/Evidence 几何降档和旧纹理适配条款在本项目停用。来源材料不能新增授权，不自动载入，也不导入旧网页实现。

## 地貌与美术

有轮廓、遮挡、接触或行走影响的岩壁、坡脚、田埂和沟渠必须有几何结构。先检查整体比例与空间关系，再制作中尺度地貌，最后加入微表面。颜色由岩土身份、干湿、暴露和沉积共同驱动；不把参考照片中的作物颜色直接涂成裸地。

河流读取明确来源与全局身份。源头、出口、汇流和真实间断须有依据；源拓扑和最终岸床水面分别检查。没有测量时缺口数为 null。visual flow 不代表真实水文，不补画未知河段。

植物与最终水面材质属于独立系统。统一资产完成远、中、近景审查后才交用户验收。圆包山、棋盘田、断河、重复环纹、计算块边缘和孤立调试方块均不能作为 3A 成果。

## 当前阶段

旧演示和补丁路线退出活动平台。只保留数值策略模块及单元测试；暂无地貌资产、浏览器运行或性能通过证据。仓库清理记录位于维护目录，具体提交以 Git 记录为准。所有资产批准保持 false。
