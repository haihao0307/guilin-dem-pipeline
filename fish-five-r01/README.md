# 鱼类的制谱师

## 当前修订 R04

保留已验证的 R03 连续脊椎、群游与性能改进，增强源眼形内的扫视/停留，接入两种金枪鱼原下颌骨的口部活动和海狼来源鳃盖起伏。海狼下颌未过表面应变门禁，其余三个来源口部结构未确认，四个嘴部保持原姿态，详见 R04_CRANIAL_INTEGRATION 和 R04_MOUTH_SOURCE_AUDIT。当前构建为 `scripts/build-r04.mjs`，单体为 `dist/KAOPU_FISH_SCOREMAKER_R04.html`，同一公开入口不变。最终门禁以 R04 独立和公开报告为准。

## 已验证修订 R03

同一个鱼类制作系统负责原表面采样重构、脊椎与鳍绑定、动画、活动及群体行为。六来源共用中央实时三维与缩略图阵列；新模型从统一接口继续接入。当前单体为 `dist/KAOPU_FISH_SCOREMAKER_R03.html`，构建脚本 `scripts/build-r03.mjs`，固定入口仍为 https://haihao0307.github.io/guilin-dem-pipeline/kaopu-fish-system/ 。

本轮处理异步切换闪现、主线程数据解析、隐藏模块空转、重复眼睛提交和阴影通道开销；鲱鱼采用连续、平滑限弯的脊椎，五种鱼群保留接触后的速度，海狼显示插值独立于原求解器。原鱼体、拓扑、UV、贴图与眼睛控制保留，未通过删面或降贴图优化。

最终门禁见R03_BUILD_RECEIPT、INDEPENDENT_R03_REPORT、R03_PUBLICATION_PROOF及R03_DELIVERY_RECEIPT；运行原因与共用接口见 `knowledge/fish-motion/R03_RUNTIME_AND_SYSTEM.md`。用户视觉和动作验收不自动通过。

## R02 历史修订

### 共用鱼类制作系统 R02

用户纠正后的当前版本是 `dist/KAOPU_FISH_UNIFIED_R02.html`，由 `scripts/build-r02.mjs` 构建。海狼原R14完整乐器与海底环境内嵌，和五份来源共用一个选择窗口、单鱼/同种鱼群及活动接口，只有当前选择类型绘制；旧R01与R14独立HTML保留为历史基线。

本轮修复原材质的specular/unlit/AO/默认因子、鳍根源拓扑零响应带与完整梯度、源材料地址的脊椎输送和Jacobian法线，按实测骨骼及可见表面范围修正鲱鱼和黄鳍动作。所有眼睛源字段、几何/材质函数与行为序列冻结，眼睛自然形态留给后续统一任务。

蓝鳍身体原图512²、彩色鱼原图128²，不能从放大恢复不存在的细节。保留原拓扑与像素，未把场景的1024²背景贴图误用为鱼皮。真实精度显示于材料卡。

当前验收以带R02前缀的报告、`INDEPENDENT_R02_REPORT.json`和`R02_PUBLICATION_PROOF.json`为准；旧R01机器通过不等于本轮视觉批准。新增框架见 `knowledge/fish-motion/R02_RENDER_AND_UNIFIED_FRAMEWORK.md` 和绑定/动作修订记录。

当前入口：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-fish-system/ 。统一显示海狼及五份来源；原海狼R14源码、文件和旧页面保留。眼睛本轮冻结，后续统一处理。

## R01 历史基线（以下记录不代表当前发布）

R01任务：五份原模型的完整表面参数化重构、连续脊椎、独立鱼鳍、眼睛、程序动画和自主活动。海狼 R14 保持暂停；不修改其源码、文件或页面。

选择窗口包含鲱鱼、黄鳍标签 Tuna、蓝鳍标签 Animated Tuna、Colorfull Fish、Picasso 来源标签模型。中间一次只显示当前一种鱼；支持单鱼、30 条同种演示、巡游、缓游、加速、转向、驻留、骨架和相机操作。具体物种与自然动作标定未确认的项目保留候选状态。

## 源码与框架

- `scripts/prepare-sources.py`：读取五份原 ZIP，处理 glTF 节点与蒙皮静止姿态，测量规范坐标、曲面函数、完整残差、鳍绑定和眼窝；保留原材料地址、索引、UV 与法线。
- `data/scores.json`：五来源的单体、原始署名和完整采样数据。纹理采用逐像素验证的无损封装，不缩小原 4K 图。
- `src/behavior.js`：共享连续中心脊椎、独立鳍相位、眼睛停留与扫视、活动模式、邻近协调与接触约束。
- `src/app.js`：源参数函数求值加残差、GPU 截面运输、鳍形变、法线导数、眼窝适配和选择工作台。
- `../knowledge/fish-motion/FISH_FACTORY_FRAMEWORK_R01.md`：共同解剖接口、BCF/MPF 控制母型、逐来源测量、证据分类、例外路线与生产验收。

`dist/KAOPU_FIVE_FISH_R01.html` 是全部运行资源内嵌的单体 HTML，file:// 不需要服务器或 CDN。开发构建可在本目录安装 package.json 中的 esbuild 后执行 npm run build；源码提取脚本的原路径对应当前本地库，接入新模型时须更新来源卡。

## 验证范围

源读取、重建、共享接缝、全顶点 GPU 位置/法线、五模式、30 条同种接触包围、原眼轮廓、桌面/390 手机布局与独立复核都有实际执行报告。公网状态以 evidence/PUBLICATION_PROOF.json 为准。数值间距是工程包围体保护，不是水动力。尺寸是规范体长，尚不是实际米数；生物身份和行为数值未假称已校准。visualAcceptance 与 productionReady 等待用户判断。

- [x] 没有使用生成图片或几何体替身代替鱼体。
- [x] 已实际修改五鱼生产源码与参数数据。
- [x] 存在实时、可交互三维工作台。
- [x] 已通过本地双击文件、桌面与手机视口真实浏览器。
- [x] 公网固定链接与真实浏览器：PUBLICATION_PROOF.json 已记录 HTTP 200、同版本全文哈希与桌面/手机视口交互通过。
- [x] 只有截图没有工作台不能交付；截图只作内部 QA。

R01历史入口：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-fish-factory-r01/

本次冻结生产源码 head 与网页哈希绑定在 BUILD_RECEIPT.json；后续回执提交只追加交付文件与文档，不改变已复核生产代码。
