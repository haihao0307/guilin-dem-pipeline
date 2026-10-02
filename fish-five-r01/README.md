# 五鱼生物制作工作台 R01

当前任务：五份原模型的完整表面参数化重构、连续脊椎、独立鱼鳍、眼睛、程序动画和自主活动。海狼 R14 保持暂停；不修改其源码、文件或页面。

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

固定测试入口：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-fish-factory-r01/

本次冻结生产源码 head 与网页哈希绑定在 BUILD_RECEIPT.json；后续回执提交只追加交付文件与文档，不改变已复核生产代码。
