# Codex 任务：O1B 接入验证与 O2A 首个海浪实验

本文件为待执行指令。研究整理完成不代表本任务已执行。

## 工作位置

仓库 haihao0307/guilin-dem-pipeline。
只延续 work/ocean-mother-handoff-20260901。已知研究前基线 4d497c0d63c251e62e952c2833b8fcc659fc4bd3。
开工重新读取远端 head；已有后续提交时正常快进。读取 ocean-mother/README.md、research/R001_WATER_SKY_DISTILLATION.md、bridge-v1/README.md、bridge-v1/UPSTREAM_LOCK.json、HANDOFF_ACCEPTANCE.json 及实际存在的适用 AGENTS.md。不得将其他旧 Ocean 分支当执行基线。

本任务不修改 main、gh-pages、Weather Mother 冻结文件、DEM 真值或其他生产线；不新建 PR、不合并、不强推、不改历史。仅在 ocean-mother/ 内做候选和证据。公开部署应另走受控发布任务，不能为获得链接手工改 gh-pages。所有人工批准继续 false。

## 第一阶段：O1B

1. 按 UPSTREAM_LOCK 从精确发布 ref 2619725efe236d2df8f2a55031bdae9e60a51555 取得上游源文件，核验 MANIFEST 的 files 字段和锁定字节身份。必要的本地测试副本保持原字节；不采用旧 repositoryReadRef。
2. 重跑现有 48 项 Node 测试，记录当前实际成绩。源接口测试可使用 WEATHER_ENGINE_PATH 指向精确原版 engine.js，不编造 DOM 完整渲染结果。
3. 启动同源 HTTP 宿主和冻结天气页面，通过现有 OceanMotherBridge.EnvironmentBridge 采样。初始化、切换和 SOURCE_UNAVAILABLE 必须可见，禁止供应伪造环境或将陈旧帧标记 ready。
4. 真实浏览器覆盖 0/90/180/270 度来风，验证分别吹向 +Z/-X/-Z/+X；关闭 windLink 时单独改变 cloudSpeed 不得影响风浪输入；再单测显式 windLink。验证阵风向量不重复乘系数。
5. 覆盖暂停/恢复、1×和其他时间倍率、重复采样、时间回退、向前载入配置、不同种子和云属、切换期间不可用、来源丢失及恢复。宿主控制的配置载入先调用 bridge.resynchronize()。单测云循环归零不会重置海洋时钟。
6. readiness 的现有限制如实保留。同种子同云属下 count/instability 重建，当前接口无法完整识别所有 GPU 中间资源状态；O1B 只证明环境参数接入，不宣告共享纹理就绪。
7. 保存 browser/version、视口、DPR、实际后端、控制参数、资源 URL 与哈希、consoleErrors、pageErrors、failedRequests、完整页面截图与测试结论。WebGL2 初始化失败或导航被策略阻断时记录实际错误，停止宣告 O1B 通过。可保留离线数学研究，不能越级报告集成完成。

## 第二阶段：仅在 O1B 通过后执行 O2A

只做可控海面实验片，暂不增加岸线、岛屿、泡沫、潮汐、海底、船只、完整云反射或 WebGPU 迁移。

实现优先沿当前 WebGL2 / GLSL 路线。若使用 Three.js WebGLRenderer 与 ShaderMaterial，先锁定确切依赖版本和许可；不得直接给 WebGPURenderer 塞入旧 ShaderMaterial。原天气页面继续原样运行，海面以独立实验视图展示。分离视图必须标明未完成水天合成。

海洋时钟来自 bridge 输出。禁止另外累加墙上时钟作为海浪时间，禁止对 simulationSeconds 再乘 timeScale；性能测量允许单独使用现实时间。discontinuity 触发历史清空。

建立米制水平测试片及单方向波，记录面宽、网格数量和最短几何波长。采用本项目明确的相位约定 theta = k*dot(directionXZ, positionXZ) - omega*t + phase，k = 2*pi/wavelengthM。这里是本项目定义，不能暗中套用其他教材不同的频率符号。时间增加时波峰应沿 directionXZ 传播；相速是独立波参数，不直接设成风速。

用同一位移函数产生位置与法线，提供线框、法线和中性照明检查模式。至少验证固定输入重现、暂停不推进波相位、平面零振幅、指定传播方向、真实峰谷高度、平移相机不导致纹理游泳，以及网格加密前后的几何误差。振幅指平均面到波峰的距离，单正弦峰谷差为两倍振幅。

加入两个独立参数组用于下一阶段扩展：windSea 与 swell。O2A 可先只实现单波，尚未实现的组必须标记 disabled/unimplemented。不得把 UI 控件存在当成多尺度浪已完成。O2B 再扩展稳定种子、中尺度波与法线微细波。

海面首次外观采用共享 sun.direction、sun.linearColor 等数据，注明简化着色。颜色渐变只作为调试辅助；没有获取云辐亮度资源时 cloudReflectionsImplemented=false。保持独立平均水位，不把噪波偏置当潮汐。

## 性能与视觉证据

每完成一阶段都按 ocean-mother/README.md 的测量规程记录全部窗口。新增优化前保留固定相机和时刻的参考图与真实运动片段。输出必须标明渲染分辨率、DPR、网格、效果开关、采样或更新策略。不得通过降低冻结云画质使海面测试表面变快。

至少保留俯视、低机位掠视、近景波峰、远景、日落、夜晚，以及转头和缩放的实际浏览器证据。先检查形体、方向、法线和高光，再讨论配色。软件渲染和移动视口模拟分别标注，不代表真实手机验收。

## 提交与终止条件

只提交任务范围内的代码、必要的小型测试和文字证据索引。大截图使用专属 artifact 或受控证据渠道，禁止往冻结交付目录混入资产。

推送前后核对远端，使用正常提交与普通 push；发生并行提交时正常整合，不强推。保存精确 source head、构建资源哈希与证据身份。

最终报告分别给出：原件核验、Node 测试、真实浏览器、海浪实现范围、性能实测、公开部署、人工视觉批准。状态由证据决定。默认 visualAcceptance=false、productionReady=false；没有公开入口时明确说明，不把本地 HTTP 地址或仓库文件页称为公开海洋网页。

目标闭环：O1B 通过后，给用户一个有真实几何、可暂停、可调方向与波长的 O2A 候选；O3B 水天合成仍需单独实现和审查。
