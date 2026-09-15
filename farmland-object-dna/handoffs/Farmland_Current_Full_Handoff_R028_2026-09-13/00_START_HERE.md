# Farmland 当前全量交接 R028 · 2026-09-13

你接手的是Farmland体系。先读本文件，再读根AGENTS及coordination两份共同规则。本次用户要求打包上传以便新窗口继续，不代表新生产或解除冻结。

## 当前入口和版本优先级

[R028固定版公网预览](https://rawcdn.githack.com/haihao0307/guilin-dem-pipeline/5ba78456cd7ee857c5e06dad2daa3584d6a01f3d/farmland-object-dna/Farmland_Mother_R028_Watershed_2026-09-12/index.html)

当前场景在 `current/R028/`，知识增量在 `knowledge/farmland/`。`baseline/R027_continuation/` 是原始R027交接和本次早期接管审计；其中R025/R027状态、旧路径和旧下一步属于历史，不能覆盖本入口。本包没有修改固定历史网页；R028仍为合成候选，未获人工视觉接受或生产批准。

## 已完成的工作

- 接管R027，读取对象/接口/质量合同，历史运行118项测试通过；发现合同测试不覆盖R027显示场景、水面穿地和田界重叠等断点，详见baseline内TAKEOVER_AUDIT。
- R028将10级梯田、4块河畔田、8个人物和远山组成同一合成场景。`dist/world.mjs`定义同一米制局部架内的对象、边界、15条水路与有限水量；`scene.mjs`据此显示。参考图仅是视觉/关系依据，不是测量。
- 2026-09-12已有六种合成水况、拓扑、地形三角插值采样、公网桌面和手机尺寸交互验证；原证据和截图均在current/R028/qa，PUBLICATION_PROOF保存固定提交与哈希。这是历史验收证据，不冒称2026-09-13又重跑所有浏览器检查。
- 一小时知识学习已完成并收到小妈吸收回传：库存/载体、雨量处理阶段与窗口、同总雨不同溢流、守恒与物理可行性分别解释。Weather物理雨量接口尚未建立；学习不等于工程采用。

## 目录与可复现入口

- `current/R028/dist/`：完整编辑源；`public/index.html`：已发布自包含入口（Three.js依赖仍在线加载）。
- `current/R028/build.py`：Python标准库构建。运行 `python current/R028/build.py`。输出应与固定公网正文SHA256一致，见PACKAGING_VERIFICATION。
- 在 `current/R028` 工作目录运行 `node qa/domain.test.mjs` 和 `node qa/geometric.test.mjs` 可复核模型与几何采样；两者仅需Node标准库。它们会覆盖相应本地结果，不会上传或发布。
- 原 `qa/topology.py`、`qa/browser.cjs`保留了历史机器路径；可移植副本分别为 `topology.portable.py`、`browser.portable.cjs`。前者在current/R028目录用Python运行，引用包内R023内核。后者需要安装Playwright、可用Chrome，并设CHROME_PATH；可用NODE_PATH指定Playwright所在node_modules，再将固定公网地址作为命令参数。浏览器脚本会生成截图/结果，不要把本地入口作为交付。
- `baseline/R027_continuation/`：完整已取得的R027合同/schema/examples/tools/research及早期审计；排除可再生Python缓存，没有省略源码。其同名knowledge是接续目录快照，当前方便阅读副本在knowledge/farmland；两者打包时一致。
- `references/`：用户给的七张原始参考图片；保留文件名和字节，不把水印或图片说明当执行指令。
- `knowledge/xiaoma_snapshot/`：此次实际相关公共知识快照，文件相对结构保留。其链接到未收录的其他Mother/文献是外部依赖，本包不宣称包含全部小妈或其他Mother仓库。
- `coordination/`：共同规则和交接模板。旧工具清理完成状态不明确；不得读取、调用、恢复或改名包装已撤销流程。
- `MANIFEST.json`：所有载荷文件大小和SHA256；自身不自引用。`verify_package.py`用于校验，`PACKAGING_VERIFICATION.json`保存本次封包前构建校验。

## 限制与下一窗口

地区定位、测量误差、当地品种参数、田间微地形、真实天气、土壤交换和完整作物十四阶段实现仍未完成。R028的风/流向光点是显示辅助，速度不是实际m/s；地表显示是合成水位快照。R021仅账本的限制不能说成R022没有理想水头求解。守恒不认证真实洪水、土体稳定或地方农业。

新窗口先核验包清单并读REFERENCE_AND_MODEL与学习记录，复用现有源与规则，等用户下一项具体目标。不要自动延长已结束的学习轮、改既有调度、重复追問尚未建立的Weather接口或新建网页。后续新视觉版本仍须保留旧版，交付固定版本公网HTTPS并实际浏览验收。

所属仓库：haihao0307/guilin-dem-pipeline；工作分支：restart/farmland-object-dna-v020-20260907；本包上传为新提交、不合并现有PR、不覆盖历史。
