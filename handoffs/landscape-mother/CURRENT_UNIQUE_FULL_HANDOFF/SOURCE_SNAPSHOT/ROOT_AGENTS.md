# Landscape Mother active work

## Mandatory user delivery correction: 2026-09-01

本条适用于 Landscape Mother 的全部地貌制作、工作台、样板、案例展示、知识接入、下游任务和后续交接，延续用户已经反复确认的三维生产目标。

地貌成果只交付可直接在线打开、旋转、缩放并从正面、侧面、背面检查的真实三维资产。山体、岩壁与落石必须有实际体积、厚度和接触关系。不能用单面图片板、面对相机的平面或其他二维替身冒充三维地貌。

禁止为这些任务调用图像生成来交付概念画、效果图或所谓完成样板。用户说“再做一版”“模仿质感”“给我看成果”时，默认指三维代码、数值资产和在线运行结果，不能转成绘图任务。本次生成的金色喀斯特二维图不计入生产成果、完成证据或三维实现；不得把该生成图反过来当作新的来源真值或已蒸馏知识。

用户提供的照片和原模型可以作为观察、测量和学习的来源。来源观察与三维生产资产严格分开，图片不能进入地形的运行贴图或展示替身。实际浏览器截图仅作为内部 QA 记录，不能替代交互式三维交付，也不能把生成图片称为运行截图。

零 LOD、零贴图、纯数值和固定几何精度继续生效。体积、轮廓、遮挡、接触、洞口、裂隙与台阶的空间关系必须由三维几何承担。没有通过侧面、背面、近景及交互检查，不能宣称三维样板已经完成。

原件提取、拟合、分区、误差、数据量与调试面板留在内部制作流程。用户默认看到已完成本轮制作的彩色三维样板，不再把原件观察室或中间拟合流程当作完成成果交付。缺少原件、代码、发布或实测证据时，准确报告缺口，禁止用二维图补交。用户对方法或方向的认可不构成美术资产批准。

上述条款是本次写入的生产指令，不能声称自动检测或运行时验收已经实现。后续工作开始时先读取此条款；任何下游任务及交接必须继承。七文件核心保持原样，禁止为记录本次纠正而重开旧实现或修改其他生产线。

## Branch and asset protection

Work only on feature/landscape-mother-field-graph-v002 using normal fast-forward commits. Recheck the remote head before writing. The seven-file landscape-mother/ core remains the authority for numeric-only, fixed-geometry, zero-LOD, zero-texture rules. Read its AGENTS.md, SKILL.md and platform.json first. Preserve that core and shared truth, contracts, knowledge, pipeline and viewer byte-identically.

## B1 internal implementation context

The previous B1 task implemented a single source-driven cliff reconstruction in workbenches/landscape-mother/. The original selected GLB must determine the fitted numeric field. Do not load old procedural mountain, paddy or river recipes. The three category controls remain, but unprovided categories are waiting for sources. Do not invent replacement scenery. Original/source and generated reconstruction use the same camera, scale and light for internal comparison. Source images may be observed on CPU to derive numerical evidence; renderers may not sample any textures. Geological explanations, true physical scale, crack widths/depths and full PBR remain unverified unless actually measured.

The B1 execution environment did not contain the original GLB bytes. Its browser implementation performs extraction from the user's selected local file or previously saved same-origin B custody copy. This historical limitation must be rechecked against actual available files in each new session. Synthetic fixtures only test functionality. Never claim their fidelity scores or images belong to the user's cliff. Preserve the historical B intake receipt as provenance; it does not validate a new fitted result. The B1 comparison page is internal tooling, not the finished sample now requested by the user.

Only landscape-mother-workbench/ on existing gh-pages may be replaced through the scoped workflow after staged tests. Preserve unrelated public paths, main, other branches, releases, PR 60 and Pages settings. No original GLB, images or default synthetic fixture may be published. No force pushes.

Report numerical measurements, browser function, hardware performance and artistic approval separately. Source-specific surface fitting is not a recovered geological family generator. Extra boundaries, components and unresolved source information must remain visible in internal checks. Keep visualApproved=false and productionReady=false until actual user approval.
