# 程序化地貌生产线范围冻结 v1.0

## 负责人

小华。

## 本线负责

```text
真实 DEM 小片区接入
山体与坡面细节
台地、阶地、坡脚和崖坎
河道、支沟、汇流、河岸与水面边界
可逆侵蚀、沉积和地形微增量
三维地形工作台与数据 QA
参考图、文字资料和知识蒸馏入库
```

## 本线不负责

```text
树木
竹林
灌木
草地
农作物
植被实例
生态群落
冠层与风场
```

上述内容归 `dem-ecology-surface` 及独立植被生产系统。本线可以输出坡度、湿度、河距、地貌单元和硬禁入掩膜，供植被生产系统读取。本线不编译植被实例，也不在地形验收页用植被遮挡地貌。

## 三地真实样板门槛

桂林、温州、昆明各自维护一个 10 km × 10 km、100 km² 的真实高程裁片。裁片需要记录源文件、SHA256、CRS、像元间距、源窗口、输出网格、边界、NoData、最小和最大高程。

程序化细节只能叠加在真实裁片之上，并独立保存为可回退增量。缺少真实裁片时，工作台显示锁定状态，不生成程序山体填充空缺。

## 资料输入和知识蒸馏

每个地区拥有独立资料入口，同时保留三地共享入口。

```text
knowledge/terrain-hydrology/shared/inbox/
knowledge/terrain-hydrology/guilin/inbox/
knowledge/terrain-hydrology/wenzhou/inbox/
knowledge/terrain-hydrology/kunming/inbox/
```

原始图片、文字和附件先进入 `inbox`。小华完成阅读、来源标注、冲突检查和规则提取后，将稳定知识写入对应 `distilled` 目录。原始资料和蒸馏结果保持可追溯关系。

网页工作台可以在浏览器本地保存资料并导出标准 JSON 入库包。浏览器不保存 GitHub 凭据，不直接向仓库写入。用户在对话中上传原图后，小华读取原图并完成正式蒸馏入库。

## 发布边界

```text
vegetationRuntimeIncluded=false
truthOverwrite=false
syntheticGapFill=false
visualAcceptance=false
productionReady=false
publicReleaseApproved=false
```
