# KAOPU 头发结构工作台 R01

按用户提供的结构学习指南重建基础。本轮只有一个静态工作台、同一个原生 P01 和一个当前长度结构方案。F14 的三长度外观及物理实验暂停，没有把旧实验当作已验收结构。

**第一轮：结构验收中。第二轮：锁定。** 数值合法不等于发型视觉通过，也不等于已准确还原参考照片。

## 发流与中束实验 03

本轮加入基准、发缝左移、刘海减小侧扫、侧发偏向耳后四个可切换对照，以及隐藏的 1 mm 小步稳定性探针。它们共享毛囊、导向发身份和剪裁；新方向场在头皮图上求解，中束收束实际改变曲线并保留根与梢端。可勾选“查看中束聚合前的导向发”检查差异。

其他实验差量数据按需下载；缓存后切换复用原人物和皮肤。自由拖拽编辑、体积发流、密集发丝、材质和物理尚未完成。[研究、实验与局限](docs/EDITABLE-FLOW-03.md)。

## 静态结构修订 02（上轮基线）

已调整头皮/颈部启用边界、绕耳后的完整下垂路线、连续区域剪裁和按整条发流组织的束群。原有 3,300 个候选绑定不变；当前启用 2,217 个、135 条完整 Guide，三级束群为 16 / 35 / 60。六视角完整显示发尾。[修改依据、前后指标与局限](docs/STATIC-FLOW-02.md)。

## 已落实的体系

`ScalpDomain → CandidateRootField → ActiveRootMask → RootDirectionField → Parting/Whorl → RegionalLength/Cut → GuideGroom → ClumpGraph → RestShape`

唯一发型入口是 [HairStyleProfile](src/HairStyleProfile.mjs)。生长域、方向、物理弧长与空间剪裁分开；分缝保留毛囊并改变两侧发流；旋涡是有影响范围的方向约束；耳前和耳后拥有明确路线。修订 02 的束群按完整曲线的实际弧长采样距离构造，保留区域、分缝侧与耳前/耳后路线边界。Guide 保存原生三角面、重心坐标、97 点完整曲线、实际弧长、局部运输坐标和三级束群父链。

本次实际输入是 F02/F12 的 **3,300 个候选根**，启用数量由密度场与稳定种子决定。用户指南提到的 64,000 候选库未在当前这条原生输入链中找到，不补撒点凑数，也不把候选数称作最终发丝数。

九个查看层：十区头皮、候选毛囊、启用毛囊、根部方向、分缝/旋涡、区域长度、完整 Guide、发束层级、灰色静态结构。每层可从正面、左右、背面、顶部、斜侧观察，并可筛选区域。保存按钮导出包含绑定、配置、完整曲线和束图的结构包。

密集子发丝、根中梢质感、碎发、动作、风和物理没有进入本轮。灰色 Guide 是低密度结构线，显示宽度不代表真实发丝直径。现有角色皮肤只是固定宿主，本轮未修改皮肤算法。

## 发质与物理成果合并

两边已汇入当前工作台。来源代码与证据冻结在 `../../integrations/fiber-runtime-r08`；当前页面实际创建统一结构输入，复用第二轮门禁。完整物理与密集渲染仍需按这边的运输坐标及束链适配，未启用。具体复用范围、未完成项和性能限制见 [合并规则](docs/MERGED-SYSTEM.md)。

## 学习与验收记录

- [用户指南原文](docs/KAOPU_HAIR_STRUCTURE_LEARNING_GUIDE_R01.md)
- [十个问题的回答与旧系统审计](docs/UNDERSTANDING.md)
- [研究阅读、适用结论与未实现部分](docs/RESEARCH.md)
- [结构规则、数据所有权与验收状态](docs/STRUCTURE-CONTRACT.md)
- [合并后的实际数据与运行边界检查](evidence/runtime-integration-checks.json)
- [几何和方向检查](evidence/structural-checks.json)、[数据合同反例检查](evidence/contract-checks.json)

## 重建

需要 Node.js，以及 esbuild。`ESBUILD_PATH` 可指定 esbuild 可执行文件；当前构建器的默认路径只适用于此工作环境。

```powershell
node tools/build.cjs
node tools/serve.cjs
```

构建会重新生成当前静态结构，执行数据合同、统一输入与静态改进检查，避免使用过期结构资产。

本地唯一入口：`http://127.0.0.1:8785/preview.html`。离线输入和人物宿主均在本目录冻结；无需 F12 的隐藏构建目录。原生宿主仍按其已有固定地址加载项目资源。本地验证服务器用已有项目缓存映射相同资源，公开页面访问原固定地址。

`BUILD_MANIFEST.json` 固定源文件、输入、人物宿主和结构资产散列；页面在加载时检查压缩数据的长度与 SHA-256；`PUBLIC_BUILD.json` 固定网页压缩块，`PAYLOAD_PIN.json` 固定公开数据提交。

## 查看当前研究基线

[打开唯一结构工作台](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/codex/hair-structure-lab-r01-20261016/kaopu-hair-workbench/foundation/structure-r01/public.html)。首屏只读冻结静态结构，不加载另一套发型或物理演示。公开下载数据固定到 `PAYLOAD_PIN.json` 的提交。

修订 03 公开冷启动实测：结构约 24.4 秒可操作，共享皮肤约 38.3 秒完全准备好；无页面异常或请求失败。首开速度仍未达标，不能称为已提速。变体首次读取约 1.3–2.2 秒，全部缓存后四组连续切换约 65 毫秒、无新增请求。[本轮实测](evidence/public-flow03-check.json)；[上轮记录](evidence/public-load-check.json)。
