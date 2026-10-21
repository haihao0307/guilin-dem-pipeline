# 独立衣物叠穿 R03：局部接触计算减负

本轮基于已冻结的 R02 `5186f8a5d71a5e75059539f83a31b2ba1e53042b`，推进相同人物与三件独立衣物的接触性能。旧 R01/R02 源码及公开页面保留。分支名称中的 `active-regions` 是后续研究方向，本轮没有实现语义活动区、遮挡剔除或衣物睡眠。

## 已实现的范围

- **衣物间局部几何界限**：缓存当前和前一位置的顶点、三角面、边界限；每次约束修正后，立即更新相关顶点与相邻特征。保持原候选顺序、原约束和接触历史，只有能保守排除的特征跳过精算。
- **静态人体包络查询**：同一三角面的索引、全部坐标和查询半径完全不变时复用结果；其余查询按特征界限剔除。人体几何变动会使静态加速结构失效并显式报错，不能将本功能当作动态人体支持。
- **可切换的执行路径**：页面“按需接触计算”开关只影响计算安排；关闭时使用 R02 的接触查询参考路径，切换不改变位置、速度、物理时间、材料参数或历史。R03 的显式重穿事务修复在开关两侧共用。
- **可核对的诊断**：记录整个物理步的衣间候选入口精算、邻面测试、人体精算与缓存命中；测量调用的候选访问也计入总数。`layerBroadphaseMS` 已包含在 `layerContactMS` 内，不能重复相加。
- **明确重穿语义**：重新加入衣物仍是 `GLOBAL_REDRESS_RESTART`，全部衣服从各自经过焊接与固定点处理的原始准备粒子重新初始化，速度及物理时间归零。该准备副本不会被后续穿着或模拟覆盖；正常物理步不重置衣形。没有宣称保留状态的穿回。添加失败会恢复原有衣物的物理数组、约束 lambda、报告、接触历史和时钟；随后界面对不存在对象的清理是空操作。

原人物、T08 内搭 / knit-fine-0、T03 外层 / knit-soft-0、P02 裤子 / denim-raw、独立纸样、质量、连续实心纱线、缝线、灯光和原来的按需呈现机制保留。本轮没有渲染降质、距离 LOD、合并衣服、冻结被遮住的承载层或替换人物外观。

## 验证合同

`tests/native-demand-ab.mjs` 在同一完整原生输入上比较 frozen R02、R03 OFF、R03 ON：8 步中第 3 步推挤外层、第 6 步拉扯内搭；逐状态严格比较位置、速度、旧位置、静止长度、质量、约束数据、接触历史、物理时间，以及呈现快照的位置/法线/索引字节。只剔除明确列出的执行计时、工作计数及 R03 新增说明字段，并单独记录这些字段。

每个离散状态继续执行独立的全部布料三角面交叉检查和人体半厚度包络审计。物理门槛不变：最大边拉伸 1.45，衣间剩余厚度穿透 0.5 mm，人体半厚度重叠 0.001 mm，缝线间隙 0.01 mm。失败的物理步回滚并报错，不虚增模拟时间。

`tests/native-redress-regression.mjs` 只接受真实页面原始 typed-array 字节捕获。三轮真实形变、移除、继续模拟、重新加入后，完整物理与呈现状态必须严格等于同设置的 fresh World；每轮随后真实推进一步并完整审计。另在真实初始化已收敛之后仅对测试实例注入失败，验证原有状态、全部历史及界面重复清理的事务恢复。它不代替浏览器三轮重穿和长程回放。

发布还必须通过原来的完整六任务 CI：display、demand、continuous、reentry 四项真实浏览器检查，以及 baseline、perturb 各 240 步原生数值回放。CI 重新从实际当前原生页面捕获输入；历史公开观测的数值重建只作为本地早期 A/B，不冒充本轮原始字节捕获。

```sh
python tools/download-reference.py
LAYERING_SOURCE_SHA=<exact-40-character-source-commit> python tools/build.py
node --test tests/contact.test.mjs tests/local-broadphase.test.mjs tests/body-envelope-demand.test.mjs tests/world.test.mjs
# GitHub Actions captures the complete input first:
node tests/native-demand-ab.mjs --input evidence/native-world-input.json --output evidence/native-demand-ab --steps 8
node tests/native-redress-regression.mjs --source . --input evidence/native-world-input.json --output evidence/native-redress-regression --expected-source <exact-source-commit>
node tests/native-replay.mjs --input evidence/native-world-input.json --output evidence/native-replay --steps 240 --mode baseline --label r03 --stop-on-failure
```

工作流 checkout 明确指定 PR head，而不是临时合并提交。构建将来源 SHA 写进页面与 `SOURCE_PROVENANCE.json`。`tools/export-runtime.py` 只导出构建清单和生成文本，不发布页面；完整矩阵通过后才可把这些精确字节发布到一个新的固定目录。公开地址仍须另过真实页面 smoke，生成 `PUBLICATION_PROOF.json` 后才能作为可交付入口。

## 性能与证据的解释范围

计数下降不等于同等比例的总耗时下降。衣间 VF/EE 计数仅覆盖候选入口精算，不包含 sweep、retarget 和诊断 sample 内的全部几何算术。人体精算计数采用其独立的完整查询计数。新增静态 typed arrays 可以精确报告；JavaScript 对象、动态布料缓存和本地界限的总内存仍需单独测量，同一进程保留多个 World 的 RSS 不是各路径的独占内存。

本轮仍未达到实时运行。8 步 A/B 只推进约 0.0667 秒物理时间；即使结果完全一致，也不能代替长程或任意动作验证。CI 的真实 Chromium 使用 SwiftShader 软件 WebGL，GPU 时间和帧率不能代表用户显卡。

其他未完成项：动态人体姿态同步、完整连续碰撞、完整自碰撞、渲染纱线逐根碰撞保证、标定材料参数、自动遮挡剔除、活动区睡眠/唤醒。下一步可以研究裁片级精确失效，先测量实际变动裁片比例，再决定是否细化 atlas 与控制纹理更新；针织孔隙和阴影使“外套壳挡住内搭”不能作为删除内层的依据。

## 文件入口

- `TASK_ANCHOR.json`：本轮范围与保护项。
- `BUILD_MANIFEST.json`：材料、人物、物理边界和运行约定。
- `src/local-broadphase.mjs`、`src/layer-contact.mjs`：衣间局部界限与原序接触。
- `src/body-envelope.mjs`：人体精确查询复用与保守特征排除。
- `tests/native-demand-ab.mjs`：冻结源码三路径对照。
- `tests/native-redress-regression.mjs`：原始准备衣形重穿及失败添加恢复回归。
- `tests/public-smoke.mjs`：固定公开地址的实际启动、单步、检查、开关和视角交互。
- `ci/workflow.yml`：与仓库 `.github/workflows/tailor-layering-r03.yml` 相同的完整发布矩阵。

源码与构建成功不等于发布验收；最终状态以同一来源 SHA 的 CI 记录、独立复核和公开页面证明为准。

## 当前候选的三维与发布门禁

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码，继续使用原实时三维运行时。
- [x] 预期交付本体是可交互三维工作台；仅有截图视为失败。
- [ ] 当前新源码的完整六项 CI 全通过；首个 `74c20ec` 候选的重穿失败保留于 `verification/local-redress/first-ci-failure.json`，不能作为成功发布。
- [ ] 新固定公网链接及真实桌面、手机视口浏览器已验证。
- [ ] 独立 verifier 根据同一来源 SHA 的证据允许分享；人工 `visualAcceptance` 和 `productionReady` 不自动通过。

准备衣形修复的本地证据与限制见 `verification/REDRESS_STAGE_REVIEW.md` 及 `verification/local-redress/`。早先的 `INDEPENDENT_STAGE_REVIEW.md` 和本地八步 A/B 保留为历史阶段证据，不代表修复后候选的最终发布结论。
