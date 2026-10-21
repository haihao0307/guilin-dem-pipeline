# 形与裁 · 纸样与成衣研究 01

任务：CLO-LEARNING-PILOT-R01-20261021  
工作分支：`research/tailor-clo-learning-r01-20261021`  
状态：独立候选。最终发布和浏览器状态以当前构建的 `evidence/PUBLICATION_PROOF.json` 为准；本文件不代替验收。

## 本轮研究什么

学习指定 CLO + AI 案例中的可编辑纸样、成衣对应关系和诊断反馈，用我们的既有 S03 后开衩铅笔裙实现一个受限改版闭环：

**修改裙长 → 重建解析纸样与材料度量 → 原生缝合和物理解算 → 查看成衣与本次诊断。**

页面使用真实的既有人物、裁片、材料身份、接缝和求解器。界面并列显示保留的原款和本次候选，并提供纸样选择、正侧背视角、应变显示、缝线显示、取消和还原。它没有自然语言模型调用，也不是 CLO 的网页移植。

原帖只作为流程学习来源：
- https://x.com/irinatoxi/status/2112109267788423379
- https://x.com/irinatoxi/status/2112265445193486494

## 受限操作与来源

本轮只处理固定 S03 纸样的下摆长度，范围为原款缩短 40 mm 至加长 100 mm，界面步长 10 mm。操作通过原解析编辑桥重建纸样；腰头、腰部缝线、省道、臀部曲线、横向宽度与开衩深度受保护。

这是本项目的 `kaopu-s03-hem-length/1` 操作，**不是**上游 GarmentCode 的高层裙长参数；上游高层参数还可能联动开衩比例。它也不是缩放旧三维成衣。初始纸样的放置与原求解工序继续保留，新纸样重新生成材料网格并求解。

原款只充当 BEFORE。首屏修改后结果来自本版本构建时重新求解的 +60 mm 候选；用户改变裙长后，会在浏览器 Worker 中重新执行求解。首屏可立即查看不代表任意修改瞬间完成；显示帧率和物理解算耗时分别记录。

可操作范围不等于其中所有值都已被预先认证。每次结果仍按原有接缝、材料和穿透阈值判断，失败候选不晋级为合格衣物。

### 来源锁

`SOURCE_MANIFEST.json` 保存：

- `c84b16a0ae022dda9fe22c09df758fcb8095bc07` 下 46 个固定运行时、纸样、基线、碰撞和许可文件。
- `c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49` 下原生人物压缩包及人物清单，写入 `assets/`。
- 已入库 vendor 文件的 SHA-256；来源和仅导入路径等适配记录见 `vendor/SOURCE_PROVENANCE.json`。

下载只使用完整提交 SHA；按字节数与 SHA-256 核验后才替换构建缓存。没有浮动分支、缺失资产替身或静默回退。原有许可证随源依赖保留，构建将许可证纳入单体 HTML。

## 运行边界

- 人物是与原碰撞场一致的固定原生状态；本轮不编辑人体比例或骨骼。
- 只验证单件裙装的静态改版与试穿；动作、多体型、多层叠穿和实体生产均未认证。
- 材料未新增实物标定。几何应变不是接触压力，视觉纹理不能证明材料物性。
- 沿用原求解阈值，不用扩大碰撞余量或降低门槛换取通过。
- 保留原款、失败诊断和版本身份。取消、过期请求和失败不得覆盖最新可用版本。
- 不新增固定距离 LOD 或动作缓存，不覆盖现有服装、衣柜及叠穿活动分支。

## 复现构建

以下命令在本目录运行：

```sh
npm ci --prefix build-tools
python download-sources.py
node prepare-worker.mjs
node run-solve.mjs 60
node build.mjs
```

下载与构建分开：`python download-sources.py --verify-only` 仅检查已有文件，不联网或写文件。原始依赖位于 `upstream/原仓库路径`；人物位于 `assets/native-person.json.gz`。

产物为 `dist/index.html` 和 `dist/manifest.json`。单体 HTML 内包含运行所需的脚本、WASM、人物、纸样、原款、当前构建候选及碰撞数据。开发源文件可以分开，用户运行核心不应依赖 CDN、远端数据或本地服务器。

浏览器测试由 `tests/browser-smoke.mjs` 执行。测试脚本是必须条件，缺失时发布流程失败；不得跳过或写入假通过记录。CI 为该测试准备 Playwright，并通过 `CLO_PLAYWRIGHT_MODULE` 提供模块路径。

## 固定公网发布

本目录的 `workflow.yml` 是待安装到 `.github/workflows/tailor-clo-learning-r01.yml` 的工作流。它只响应冻结研究分支的本项目路径变更，使用 Node 22、锁定依赖、来源校验、新求解、单体构建及真实浏览器检查。

`publish.sh` 只在已核对的仓库与分支执行，令牌由 `GITHUB_TOKEN` 环境变量提供，不写入 URL、参数或文件。它只向 `gh-pages` 追加：

```text
kaopu-tailor-workbench/clo-learning/r01-<source SHA 前12位>/index.html
kaopu-tailor-workbench/clo-learning/r01-<source SHA 前12位>/manifest.json
```

发布限制：

- 已存在的不同字节快照立即拒绝；相同字节允许幂等重试。
- 不删除旧入口，不修改其他目录，不合并主线，不强推。
- 其他发布者更新 `gh-pages` 时，只重放本地尚未发布的新增提交，再尝试普通快进推送；路径冲突立即停止。
- 先确认 Pages 仍从 `gh-pages` 根目录发布，不改整个仓库的发布配置。
- GitHub 官方说明使用 `GITHUB_TOKEN` 的推送不自动触发 Pages 构建，因此脚本在推送后请求 Pages build。需要 `contents: write` 和 `pages: write`。
- 最终 HTTPS 必须返回当前 HTML 和清单的完全一致字节，再执行公网浏览器交互检查。
- 仅有 HTTP 200 时 `shareAllowed` 仍为 false；公网浏览器通过后才允许分享固定入口。

发布机制依据：
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build

## 验收状态与交付纪律

- [x] 没有使用生成图片代替真实三维实现。
- [x] 本轮有受限改版、求解接入和独立工作台的真实源码变化。
- [ ] 当前构建已在真实浏览器验证可交互三维、镜头与参数操作。
- [ ] 当前单体 HTML 已验证无需服务器和核心网络请求。
- [ ] 固定公网 HTTPS 已回读并确认构建身份。
- [ ] 公网桌面与手机视口关键交互已完成。
- [ ] 独立 verifier 已核对当前构建的完整交付门禁。
- [ ] 用户视觉验收通过。
- [ ] 可合入生产。

上述未勾项不因构建成功自动变更。手机视口测试不等同于手机实机测试。只有截图而没有实际可交互网页时，本轮交付失败。若尚未形成可验收网页，应明确写“交付未完成”。

本轮按用户要求保持独立，后续由用户看过功能与效果后决定是否整合。

