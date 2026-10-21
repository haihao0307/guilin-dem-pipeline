# 嘴唇细纹 R08：真人对照后的局部修正

当前版本为 `candidate-02 / native-lip-surface@2`。固定公开页面已完成 14 项实际运行检查；主审核逐张查看了 7 组原生对照与自然 UI。独立顺序盲评也只认可近景局部微小收益，整脸无可辨改善。当前决定是保留有限的细纹组织修正，整体真人质感不通过，`productionReady:false`。

[打开固定公开交互工作台](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/dcded3a1b471d32ce191296939b6266e6d41e62a/kaopu-unified-human-workbench/lip-surface-r08/preview.html) · [实际运行记录](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39544769008)

源码 `70457c86c20e724235705ff45fd919ac822dba8e`；构建 `dcded3a1b471d32ce191296939b6266e6d41e62a`；原始公开证据 `ef970bc114be9470e082ced03f061ce9e346063b`。原生图来自该公开构建，无后期修图。

## 对照真人后，当前系统的主要问题

1. 唇面的大块平滑体积与宽柔高光占主导。只加湿润度或降低反射，会在亮蜡和哑光之间变化，不能建立真实的组织层次。
2. 原 R01 细纹生成器在每个横向格子里放一条主沟和一个分支。长度虽有变化，拓扑规则仍过于重复；直接增强它会产生梳齿、细刻线。
3. 原生几何沟纹与材质细纹分别生成，尚未形成经验证的多尺度组织。两者都主要描述较窄的沟槽，沟间表面缺少可信的连续组织。加大相同噪声也未解决这点。
4. 外唇边界偏柔，但上一候选的整体收窄产生了更硬的轮廓；不能把边界更清楚自动视为更真实。
5. 张口时仍有内缘及口腔形体问题。本轮细纹不会修复这些问题，也没有改变原人物的唇厚。

这些是图像与原生实现的审核判断，不是临床测量。参考照片的人物、照明和拍摄方式与当前角色不同，不做数值 RGB 拟合。

## 实际保留的改动

`r08` 只替换原来的 `lrFolds` 高度函数：主沟允许缺席，长短不一，分叉可有可无；少量独立横向或斜向短纹使用原人物的静止毫米坐标。现有上下唇区域、动作牵拉、湿润衰减、距离过滤及原法线计算继续工作。

这是历史 R03 的有限沟纹组织适配到当前 R06，并将主沟与附属分支的工程系数设为局部对照中较克制的一档。独立短横纹不随该系数放大。尺寸、分支概率和强度都是工程选择，没有论文证明它们是本角色的实测组织参数。

本地原生图与独立盲评支持局部小幅收益：细纹较少呈等长平行线。它没有消除整片粉色平滑感；在整脸视角，原有距离过滤会继续淡出不可解析的细节，不能期待明显的整脸变化。

`r06` 必须返回原 fragment、原 cache key 和原生外观。实现从实际继承 shader 提取当前人物的坐标，生成可逐字回放、逆变换的替换清单；不将一次截图的人物坐标当成通用模板。

## 为什么撤回其他方案

| 试验 | 实际观察 | 决定 |
|---|---|---|
| candidate-01 局部色彩场 | 红灰云斑重新带回 R02 已拒绝的问题 | 删除 |
| candidate-01 外唇整体收窄 | 部分角度更清楚，但下缘出现偏硬的统一轮廓；跨姿态净收益不足 | 删除 |
| 只放大旧主沟、或更强的新主沟 | 细节更醒目，也更像梳齿或刻线 | 拒绝 |
| 固定静止步长求高度梯度 | 较强刻纹的断续感减轻；相对简单方案没有稳定净优势，还需额外场求值 | 不采用 |
| 沟边宽缓肩部 | 沟线突出，大片平滑主体仍在 | 拒绝 |
| 临时关闭唇部镜面反射 | 白反光减弱，但平滑粉色主体仍在，变哑光不等于更真实 | 仅用于归因 |
| 较弱连续中尺度起伏 | 盲评认可微弱局部收益，整体变化很小，且新增场的独立低通仍不足 | 保留证据，暂不采用 |
| 较强连续中尺度起伏 | 减少平滑，但变为密集颗粒、皮革或压纹橡胶观感 | 拒绝 |
| 减小下唇体积 | 会改变原人物唇厚；本轮没有执行 | 不作为质感修复 |

两次本地会话完成了 14 个原生 GPU 替换事务：12 个自然正面方案，以及选定方案的斜侧、张口斜侧复核。每次都检查真实 shader、全部 active uniform、原生状态和精确恢复；记录像素差仅用于证明响应，不能作为美感分数。运行环境问题及恢复过程也有记录，没有隐藏失败启动。

## 修正过的判断与系统责任

实际 GPU 浮点诊断显示，特写核心区原细纹全局可见系数中位数约为 0.879，原法线斜率上限没有触发。因此“主要被全局距离淡出或斜率截断吃掉”不是特写问题的正确解释。0.879 只是一项系数，不代表整个过滤链保留了 88% 的细节。

当前帧没有运行屏幕空间扩散。原材质使用有限 RGB light-wrap，不能将平滑直接归因于多次散射模糊。隔离高斯沟的遮挡估算也不支持凭空画很强的 AO 暗线。所有推算的假设和界限见材料责任记录。

原生 `COARSE_RELIEF_SCALE=.35` 只缩放原沟纹几何位移，不控制宽缓唇部体积。原 atlas 的红色通道进入几何；绿色次级沟纹没有进入当前几何或程序化 fragment。源码重算值不是实际顶点极值，不能混称为实测沟深。后续更值得研究的是不同尺度如何共用结构与受力关系，而不是继续叠加互不关联的细节。

## 参考证据与使用边界

- Vergnaud 等，2023，*Lip color measurement: A new hyperspectral imaging device*：https://onlinelibrary.wiley.com/doi/full/10.1111/srt.13418 。普通、交叉偏振、平行偏振原图用来区分颜色与反射；普通图用于外观对照。样本为 19 名法国白人女性，不能外推为所有人或直接反求粗糙度、沟深。
- Charton 等，2025 在线、2026 卷期，*Development of a lip colour chart across four ethnicities*：https://onlinelibrary.wiley.com/doi/full/10.1111/ics.70004 。514 名女性的 53 个色调表达人群下唇测量色域，不能给每张嘴强加多个斑块。均匀色调也可以真实。
- Kim 等，2025，*Image based quantification method reveals differential patterns of lip desquamation associated with age and sex*：https://www.nature.com/articles/s41598-025-89264-x 。直接查看原图中的低脱屑 score 0、1，用于沟纹与表面组织关系；不以重度起皮作为默认健康目标，也不从无物理标尺的照片推断微米深度。
- Epic，*Digital Humans*，UE 4.27：https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27 。支持分别校核底色、粗糙度、反射、散射与法线。没有提供当前嘴唇的测量参数。

研究照片没有作为产品贴图，也没有复制进产品仓库。原图网址、文件哈希与实际观察保存在研究记录中。

## 人物、存档与验证

固定原生 R06 预览 SHA-256：`a6f50aa8e1f7898da5e40b73fb7ab8476db7ca4a14505a6ffad2e8aca1f63cac`。

模块仍追加到固定 R06，移除相同追加块后逐字还原。原材质对象、顶点 shader、uniform 对象、原生与绘制几何、人物参数和灯光须保持。新旧保存入口沿用同一个完整人物控制器。

档案的 `schema` 更新为 `kaopu/lip-surface@2`，`implementation` 更新为 `native-lip-surface@2`。candidate-01 的 `@1` 档案在任何人物修改前拒绝，不能把失败的旧组合静默解释成新的细纹。没有 `lipSurface` 字段的旧 R06 与 R02 兼容档案仍走原有完整恢复链；本次实际测试使用独立 R06 的真实存档和派生的 R02 兼容样例，后者不宣称是历史下载档案；带 `lipEdge` 的 R07 档案继续要求原工作台。

公开验证已完成 7 组同条件 A/B：自然状态正面、斜侧、整脸；张口正面、斜侧；说话正面；噘嘴斜侧。另测独立 R06 的精确关闭、真实保存入口、真实 R06 档案及派生 R02 兼容样例回载、坏档案无副作用、新页面半进度张口恢复及自然页面截图。实际结果为 14 项测试全部通过、17 张原生 PNG、21 次 GPU readback、1 张自然 UI 截图；页面、控制台、网络和资源错误为零，浏览器已正确关闭。记录见 `evidence/candidate-02/qa.json`，SHA-256 为 `43b40dad41380ebacb8e4865558850e62410c1ab8b5ef5ec7734a28a6dfb874d`。

只要求自然特写确有像素响应；远景可以被正确过滤为零。所有原生不变项与恢复精确门都必须通过。自动记录始终保留 `visualAcceptance:false` 和 `productionReady:false`。

## 审核记录

- `research/CANDIDATE_01_VISUAL_REVIEW.json`、`EDGE_01_VISUAL_REVIEW.json`：已拒绝的公开候选及跨姿态图审。
- `research/DIAGNOSIS_01_REVIEW.json`：公开 GPU 浮点诊断。
- `research/R02_NEGATIVE_EVIDENCE.json`、`R01_R03_FINE_DETAIL_HISTORY.json`：历史错误与真实继承关系。
- `research/LOCAL_MATERIAL_REVIEW.json`：14 个本地事务、原图哈希、逐项接受或拒绝理由。
- `research/LOCAL_MATERIAL_RECIPES.json`：实际运行的完整可逆替换配方；失败试验不会混入默认。
- `research/LOCAL_MATERIAL_BLIND_REVIEW.json`：独立盲评原文，评审后才公开映射。
- `research/MATERIAL_RESPONSIBILITY_REVIEW.json`、`NATIVE_ATLAS_SOURCE_REPRODUCTION.json`：形体、几何沟纹、光照与表面场责任及计算限制。
- `research/CANDIDATE_02_VISUAL_REVIEW.json`：公开原图的逐姿态主审核、技术证据与有限接受结论。
- `research/CANDIDATE_02_BLIND_REVIEW.json`：独立图审原文与评审后公开的顺序映射。

噘嘴静态图仍有细刻线风险；本轮没有用静态原图代替连续运动测试。整脸 A/B 的实际像素完全相同，不能宣传整体人物质感提升。PR 保持 Draft，不合并。
