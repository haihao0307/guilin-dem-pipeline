# Runtime Publication Branch v0.2

## 中文名称

程序化地貌生产线运行时与发布分支

## 目标

本分支把真值、程序化增量、历史增量、实例、水体和 GAEA 输出编译为可验证的 Three.js 或 WebGPU 网页、在线候选、本地包和回滚版本。

## 云端优先架构

```text
GitHub
项目配置、技能、任务、代码、manifest、QA、版本和回滚记录

大型资产存储
Git LFS、GitHub Release 资产或项目批准对象存储

私有 Windows 节点
GAEA、GDAL、Python、Chrome 或 Edge、资产编译和截图

网页
Three.js 或 WebGPU 共享画布、共享相机、共享数据状态
```

Windows 节点只保留临时缓存。构建完成后上传成果、校验和、receipt、QA 和截图，再执行缓存清理。

## 统一工作台

全域、地貌、水文、生态、农业、历史核心和 QA 使用同一运行时。

要求：

```text
共享画布
共享相机
共享 AOI 和坐标
共享数据谱系
共享图层状态
共享版本和回滚
```

禁止通过多个 iframe 拼接互不共享状态的旧页面。

## 运行时资产

推荐：

```text
versioned manifests
COG or tiled raster references
packed scalar and categorical textures
compact binary instance streams
stable prototype tables
vector tiles
water field manifests
historical evidence manifests
checksums
rollback release references
```

网页需要公开显示：

```text
项目
AOI
年代
实际分辨率
源数据状态
覆盖缺口
NoData
垂直基准
真值层
程序化增量
历史增量
版本
构建时间
回滚版本
```

## 连续细节调度

```text
远景
总体地貌、父级掩膜、综合色、主河道、主波和总体冠层

中景
田块、岩石、侵蚀、河岸泡沫、视差体积和冠层层次

近景
预算内实例、碎石、树干、作物、水岸几何、泡沫和交互粒子
```

调度依据：

```text
屏幕占用
镜头高度
镜头速度
焦点
遮挡
GPU 预算
内存预算
网络预算
```

## 相机

至少提供：

```text
全域俯视
自由轨道
地面行走
固定历史视角
机场视角
河岸和海岸视角
QA 诊断视角
```

地面相机需要最小离地间隙、地形跟随、回到项目中心和防止走出可恢复范围的控制。

## 浏览器 QA

```text
桌面浏览器控制台错误为 0
390 × 844 移动视口通过
关键视角截图
图层开关和版本切换通过
真值与增量 A/B 通过
回滚浏览器测试通过
外部 HTTP 地址验证
资源 404 为 0
跨源读取错误为 0
```

性能报告分别记录：

```text
GPU 时间
CPU 时间
FPS 采样窗口
内存
网络读取量
瓦片数
实例数
水体网格
泡沫和粒子预算
```

## 发布门槛

候选状态：

```text
local-candidate
online-candidate
browser-qa
visual-review
approved
published
rolled-back
```

在线候选、公开默认版本和历史稳定版本分开管理。用户视觉批准前保持 Draft 和可回滚状态。

## 本地包

Windows 兼容本地包包含：

```text
启动脚本
静态服务器
网页资产
manifest
校验脚本
版本说明
离线回滚入口
故障排查
```

启动脚本避免窗口闪退，并将错误日志保存在可读取位置。

## 状态

```text
branch skill version: 0.2.0
status: contract
public release: gated
```
