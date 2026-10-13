# ET19-L3 / P1 加载优化交付

日期：2026-10-13。状态：PUBLIC_VERIFIED。只优化加载与启动/退出绘制，不修改嘴唇造型、皮肤质感、原人物、眼球或身体的最终效果。

## 固定入口

新网页：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/41d5434c18de223d3b29e2717cca8bbef19ee56f/kaopu-unified-human-workbench/lip-startup-r01/index.html

原版仍保留：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/5b4997e6dca27106533022b4ab46164cea073818/kaopu-unified-human-workbench/lip-structure/preview.html

源码提交：5837800bebbd1da18fecd5d5296025ca4dcb782b。
构建提交：41d5434c18de223d3b29e2717cca8bbef19ee56f。
Draft PR：https://github.com/haihao0307/guilin-dem-pipeline/pull/231 。未合并、未强推、未改写历史。

## 查到的问题，不猜测用户电脑

没有读取或证明用户本机的缓存已经塞满。实际代码存在四处可复现的额外等待：原 load-common 先等待约35MB的 GNM 原始头部数据，再启动完整 Anny/MHR 权重；每组权重分片又逐个下载；每次启动额外获取16份已经打包的源文件来校验；原完整就绪前已有25次面部散射绘制。

刷新还有退出阶段的开销：原 MotionStudio.dispose -> clear -> viewer.resize 会在旧场景清理期间触发绘制。于是即使后续资源已命中缓存，也可能先等待旧页面释放。这里不能把所有等待都称为网络下载或缓存容量问题。

## 已实际实施

完整 GNM、Anny、MHR 与依赖描述文件并行准备；模型资源下载队列同时最多6个请求。没有删减人物参数、表情权重或原始精度。

已有 GNM 二进制仅做无损 gzip：34,937,952 bytes -> 9,970,245 bytes；解压后 SHA-256 仍为 fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961。原许可及说明保留于 assets/GNM-LICENSE.txt 和 assets/NOTICE.md；不是换一个头模。

将4,802,066 bytes的内联页面改为32,886 bytes入口，加独立压缩程序3,057,642 bytes。33KB只表示入口，不是完整下载量。16份源码的原校验移到构建时；实际模型数据仍在读取缓存/下载后做 SHA-256 校验。

新增独立命名缓存 kaopu-lips-verified-assets-p1，资源体积预算128MiB，超限淘汰本缓存条目；缓存损坏时单项重新获取，存储不可用时保留校验后的网络回退。不清空人物档案、localStorage或其他命名缓存。128MiB不是全部运行内存、显存或浏览器总磁盘用量；普通HTTP缓存由浏览器另外管理。

启动时合并构造、纹理就绪、初始相机与布局的重复绘制，等待原完整材质及控件，再输出完整画面；之后仍调用原渲染。退出时在原清理执行前停止绘制，但不跳过资源释放或档案保存。

## 实际公网测量

测试配置：GitHub Actions，Chromium / Playwright1.56.1，SwiftShader软件渲染，桌面1280x900。每个URL各记录一次首次打开与一次缓存后的重新打开，不是多次平均或用户电脑的速度保证。原版基准来自运行38339123537；本次以固定摘要复用其几何/画面基准，新网页在运行38340455955重新测量。运行器并非用户的消费级显卡，云端耗时存在波动。

| 项目 | 原ET19固定网页 | P1最终固定公网网页 |
|---|---:|---:|
| 首次完整就绪 | 63.295秒 | 10.9472秒 |
| 缓存后重新打开完整就绪 | 83.6432秒 | 12.2576秒 |
| 首次网络传输（CDP统计） | 113,719,192 bytes | 88,675,194 bytes |
| 本轮重新打开网络传输（CDP统计） | 100,873,722 bytes | 0 bytes |
| 完整就绪前的面部散射绘制 | 25次 | 1次 |

完整就绪的严格定义是：原人物/控制器ready且非busy，脸部及自然眼球纹理ready，P1首个完整渲染已经执行，再等待两个requestAnimationFrame。加载提示文本不作为严格计时门槛。缓存后12.3秒仍含页面退出、解析、解压和软件渲染等开销，缓存命中不代表没有初始化成本。

最终再次打开命中26项模型缓存，读取84,045,179 bytes的已验证资源，模型组 fetch-body 字节为0。加载器的读取字节计数与CDP实际传输字节是不同口径；普通HTTP缓存命中时，读取量不代表重新走了网络。

首次运输优化中间版a58936e曾通过功能检查，但单次冷启动观察为40.4489秒，对应原版26.6254秒，不能据此称整体变快。因此又补做启动绘制合并与退出重绘处理，最终才使用上面的41d5434版本交付，不隐藏中间实验的不足。

## 画质与功能回归

最终候选15项检查、公网15项检查全部通过，无记录到JavaScript或着色器错误。9个嘴部动作和72条保留预设逐项比较原生顶点、派生顶点与索引摘要，与固定原版一致；原初始几何也一致。相同视角的嘴唇近景画布逐像素比较，平均差和最大差均为0。不是降低贴图、减少面数或关掉散射换取速度。

另外检查实际动作按钮、上下唇独立参数的档案往返、展开/收回原总台及390x844手机视口。手机仅视口模拟，不是实机。已人工查看最终公网macro与mobile-viewport画面。

缓存逻辑另有7项Node.js隔离测试，覆盖校验命中、损坏重取、存储拒绝回退、排队取消、预算淘汰、其他项目缓存保留及模型下载并发上限。它们使用模拟fetch/CacheStorage对象，不冒充浏览器配额故障实测。复现：node qa/lips-startup-p1/cache-unit.mjs。

## 证据与边界

最终成功运行：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38340455955
产物：lips-startup-p1-evidence，ID11786900880，保留14天；ZIP SHA-256 6c2c09c4be1de62e0d6963555dcbdafbd71091e5a79be40a537a9978b28bb4e7。数值摘要见QA_STARTUP_P1.json。

首次仍需要完整Anny/MHR等模型数据，慢网不能保证秒开；缓存也可能被浏览器淘汰或拒绝。完整模型的运行内存没有因gzip而同比减少，不能把磁盘缓存预算当作内存上限。没有新增影视级视觉或完整生物力学验收声明。

原 lip-structure、full、eye-materials、face-transfer、identity-lab 等源目录保持不变。新运行时只在 lip-startup-r01，另有专项测试与工作流。旧固定链接不会自动变成新版，请使用新入口。

API依据：
https://developer.mozilla.org/en-US/docs/Web/API/Cache
https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API
