# KAOPU 捏脸工作台 R01

独立 GAME 工作台候选目录 `kaopu-face-workbench/`。未修改毛发工作台、原男性、R8/R9、女性页面或仓库导航。未确认 GAME 总览位置，故没有伪造总览挂载。

## 当前可运行功能

- 原始 Google GNM Head v3 官方网页权重，253 维身份、383 维表情、4 关节，17,821 顶点、35,324 三角面。固定版本、长度和 SHA-256 校验。默认零参数基线。
- 单个 Three.js WebGL 画布，原脸旋转/缩放、冷暖灯、原始基线恢复；统计分量编辑默认折叠，无虚构语义映射。
- 用户填写人物名并确认同一人物后，本地导入多个照片/视频。视频使用浏览器解码，手动取当前帧；记录秒数，最长边限制2048像素。浏览器不支持某视频编解码器时须换格式。
- 每图手工观察文字；档案 JSON 参数与文字导出/回导；当前网格 OBJ 导出。不含照片、不含贴图、不含毛发、不含推定真人身份。
- 入口/返回复用同一画布与模型；隐藏/离页暂停动画；context loss 暂停，浏览器 restore 后重绘。不存在自动刷新/重开画布循环。
- 公共模型是唯一跨域请求；照片仅 object URL / canvas 内存，不上传、不存 localStorage。档案包含用户主动输入的名字与观察文字，导出到用户本地。

档案 JSON 依赖同版本共享 GNM 底座，文件小不意味着无需模型即可重建；当前 OBJ 也不是用户最终的轻量数字谱。编辑台到游戏的个人轻量谱仅在讨论，不在 R01 实施。

## 明确未完成

本原型没有照片拟合、自动人物识别、自动mask、landmarks、相机估计、置信度评分、摄影测量、真实皮肤材质。导入照片后模型不会改变，不显示“分析完成”。参数手动编辑不是自动重建质量验收。原始脸只是 GNM 统计基线，不宣称是导入者。

正式上线前需真实浏览器 GPU 验证，并在外部 HTTPS 部署后再次验证。Node测试不能代替WebGL或iPhone验收。

## 结构与后续接口

1. 输入：一个用户明确指定的 `person` 档案。图像各自有 source、时间戳、观察记录；禁止自动跨档案认人。
2. 观察：未来每图 `mask / landmarks / intrinsics / extrinsics / expression / pose / confidence / provenance`；缺失用 null，不能填伪结果。
3. 联合拟合：固定共享身份向量；每图独立 camera、pose、expression。返回误差、遮挡、采样来源和失败状态，不把资料接收当拟合成功。
4. 表示：GNM模型固定 hash。当前保留完整身份/表情参数。Pixel3DMM 的 FLAME 结果必须先在原生模型离线验证，再通过单独注册 adapter 转到 GNM；参数不可直接复制。
5. 输出：当前档案 v1 + OBJ。未来 adapter 的输出须另设经过校验的 schema，不能复用 `not-fitted` 结果冒称拟合档案。

SAM3是分割/跟踪辅助；不把它作为脸身份核心。SAM3DBody/MHR 不在本台范围。候选后端尚未运行或购买；不得默认上传人像到外部服务。GPU 后端需要另行评估部署位置、模型许可与逐项授权。优先先做用户批准的少量同人资料离线试验，并与原 RealityScan→MetaHuman 结果对照质量与耗时。

## 运行与验证

用任意静态HTTP服务器服务父目录，打开 `kaopu-face-workbench/`。Web Crypto SHA-256 要求HTTPS或localhost。无构建、无需 npm install；权重首次读取约33.3MiB。

- `npm test`：档案恶意输入、维数、范围、OBJ、来源哈希、隐私和文件边界静态检查
- `GNM_ASSET=/path/to/gnm_head_web.bin node tests/model.mjs`：真实官方数据、参数变化、独立表情、原始基线恢复
- `FACE_URL=http://localhost:8000/kaopu-face-workbench/ node tests/browser.cjs`：已安装Playwright/Chromium上的真实图形回归。需可创建浏览器socket的执行环境。覆盖20轮enter/back、参数回基线、context loss/restore、移动尺寸、不上传照片。

## 来源

GNM Apache-2.0，含原许可证末尾舌部MIT说明；XRBlocks求值器 Apache-2.0；Three.js r170 MIT。保留所有对应许可证。权重只固定引用官方公开版本，不复制受限人脸素材或 TEN24。

## 独立只读 QA 候选

分支 `qa/face-workbench-r01-20261005`，新增专属 `.github/workflows/face-workbench-r01-qa.yml`。仅 PR / 手动事件，无 push 触发、部署或生产 ref 更新；contents:read、checkout 不持有凭据。固定官方 Playwright 1.57.0 与其 Chromium；输入是合成图、浏览器生成的合成 WebM 和官方 GNM，不含用户照片。测试输出截图不能代替实际用户手机验收。
