# ET19-L3 / P2：程序404修复与原生网页交付

2026-10-13。状态：PUBLIC_VERIFIED。用户反馈优先：P1在用户端最终报“程序 HTTP 404”，此前云端成功不能替代用户实际可用性。

## 新入口

正式直接审查入口（主程序内置，不再额外请求压缩程序）：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/lip-startup-r02/p2-b30a256af94b/compat.html

普通脚本入口（脚本404或20秒仍未执行时自动切换内置入口）：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/lip-startup-r02/p2-b30a256af94b/index.html

旧P1、ET19和其他工作台均未覆盖。该版本目录不改作滚动最新版。

## 已确认的故障与没有证据的推测

用户第二张截图明确显示“程序 HTTP 404”。因此是程序获取失败，不是可以靠继续等待解决的普通慢下载。仓库核查确认原P1引用的app-6dd147deede78cca.js.gz仍存在于固定提交41d5434；截图不含实际失败请求URL和响应来源，不能断言是文件丢失、特定CDN节点故障或用户缓存塞满。

P1程序下载阶段显示的下载量来自后续模型资源计数，未跟踪程序下载本身。因此“0.0MiB”不能用来断言网络收到了零字节，这个进度提示也有误导性。

## 本次改法

撤掉主交付链中的HTMLPreview转发、运行时程序gzip下载/解压和Blob执行。主入口compat.html直接内置同一人物应用程序；程序不会再通过单独的.js.gz请求获取。模型、面部材质、预设缩略图和描述文件按原字节镜像到同一GitHub Pages版本目录。不会把“只嵌入程序”说成“完整模型无需下载”。

程序已在构建时解压；这里只做固定资源URL重定向并添加启动诊断。原人物、原嘴唇、眼球、皮肤、身体的最终运行逻辑与参数保留。复用之前的并行运输、完整权重校验、有限资源缓存以及启动/退出绘制合并。

67项镜像资源共85,803,897 bytes；内置程序网页4,819,520 bytes。这些是文件大小，不是压缩后网络流量或运行内存。首次仍要加载完整模型。

失败时提供可见的阶段、用时、失败资源、重试按钮和“复制诊断”。同源资源HTTP/建立连接失败最多尝试两次；响应头/响应体长时间无进展有15秒时限，流读取失败明确报告。普通脚本入口20秒未执行会转入内置入口。总等待超过150秒显示明确失败，不以无限转圈掩盖错误；这些时限不是加载速度承诺。

## 档案与兼容性边界

没有清空用户档案、localStorage、其他命名缓存或旧页面。新站点与HTMLPreview不同源，浏览器不会自动把旧源的档案提供给新源；需要迁移旧档案时仍使用原本的导出/导入。不要把页面换源说成旧档案已自动迁移。

主人物与嘴唇启动和已测预设不依赖Raw或HTMLPreview。可选的旧动作研究资源和外部文档链接仍保留原先路径；不宣称整个总平台离线可用。

## 固定交付链

源代码：b30a256af94b26c135068d1681cf243cb41bbe64。
候选构建：1f6307c2eeb083f5c40d6be3891a9bb675b11783。
站点树：71ec2d64846ccf713f26cfe4443d4d1b3b4a13b9。
Pages发布提交：5e5d37282f1f4bcfd9684b011a626e3b8d6ab575。
Pages原父提交：4a32e43b48da0477fad92b5e0a9498405997dfa2。
Pages发布只增加本版本目录；仓库比较无其他目录修改/删除。
候选成功运行：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38343818860
Pages部署运行：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38344391262
公网检查源码：5f78b1e0a86cbaa2d64d76aca4f4c77af5b0409d。
公网成功运行：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38344483044
Draft PR：https://github.com/haihao0307/guilin-dem-pipeline/pull/234 。未合并、未强推、未改写历史。

## 候选验证

17项完整画面与功能检查通过：初始几何、9动作、72条保留预设的原生/派生顶点与索引摘要与固定原版一致；同视角近景画布差异mean=0/max=0。原上下唇控制、档案往返、总台展开及手机视口检查保留。

4项实际浏览器故障注入通过：程序404自动切换内置入口；程序无响应自动切换；模型404有限重试并显示正确文件和错误；缓存拒绝时走校验后的网络加载。候选网络通过Playwright路由提供测试字节，不是公网测速。

## 真实公网验证（已完成）

2026-10-13，Pages部署运行38344391262成功。公网验证运行38344483044第2次执行成功；第1次仅在部署等待超过4分钟时提前退出，尚未执行公网运行时测试，随后部署成功后重试。

主交付compat.html在真实HTTPS上进行首次打开和缓存后重开，两轮均完整就绪。确认两轮都没有任何单独应用程序.js或.js.gz请求；将Raw和HTMLPreview域名阻断后仍可用。17项完整画面、几何及交互检查全部通过；没有记录到JavaScript或着色器错误。

初始几何、9嘴部动作、72条保留预设的原生/派生顶点与索引摘要与冻结原版一致。同视角嘴唇近景画布像素差mean=0/max=0。这是原效果保留检查，不是新增影视级视觉验收。

在真实发布站点上另做4项浏览器故障注入，均通过：普通入口程序404或一直不响应时，自动转入内置程序页面并完整就绪；模型描述文件被强制404时只尝试2次，明确显示head-transfer.json与HTTP404及重试按钮；缓存被拒绝时仍可通过已校验的网络资源完成加载。不能将这些统称为所有故障都自动恢复：缺失模型只被正确、有限地报告，不能凭空恢复缺失数据。

测试环境为GitHub Actions Chromium / Playwright1.56.1 / SwiftShader软件GPU，桌面1280x900，手机390x844仅视口模拟。本次单次冷开完整就绪11.3064秒、重开16.0592秒；不是用户设备速度保证或多次平均，不用于否认用户后续故障。重开26项模型资源命中缓存。已实际查看本次公网public-macro.png和public-mobile-viewport.png，人物画布、材质、嘴唇面板可见。

## 验证产物

候选产物11788720239，lips-p2-candidate，ZIP SHA-256：1af4f9891e0578bb1ba598c0802ef6d8bc21a61680f52a88b85b86eaa0a8079a。
公网产物11788228862，lips-p2-public，保留14天，ZIP SHA-256：4057770c2048c2f91ba4cd2e1b92e08c964dab050289e7b4250597ed98dcf200。
已解包读取公网public.json、public-faults.json、no-program-subrequest.json与public-build.json。
public.json SHA-256：14ec7a171d5400fc73a152d6a731a797284aaf4ab0b9bd0b23243453359543c1。
public-faults.json SHA-256：5188a80d7a64d65a09eaf953cd18a2c7b580cc40df91464efb0592f4a28a8ce5。
no-program-subrequest.json SHA-256：87a416aab413fd7de7be78a677228dd7d2633b93aa2bacd7939d831b1186c657。

数值摘要与检查清单见QA_P2.json。主交付为上述原生HTTPS网页，不以会话沙盒、截图或ZIP替代。
