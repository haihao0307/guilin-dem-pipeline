# KAOPU 全部 Mother：单体 HTML 双击直开交付硬门禁

版本：1.0.0  
日期：2026-09-21  
状态：PERMANENT / CROSS-MOTHER / USER-AUTHORITY  
适用：Game、Ocean、Weather、Cloud、Landscape、DEM、Fish、Bird、Animal、Coral、Tree、Human、Clothing、Fabric、Brick、Tiles、Aircraft、Farmland、Object DNA 及后续全部 Mother / Codex / 子执行端。

## 0. 用户最新交付规则

以后凡是交给用户直接打开、查看、测试、验收的网页/三维工作台/演示，**交付本体必须始终是一个单独的 HTML 文件**。

用户操作应当只有：

1. 得到一个 `.html` 文件；
2. 双击；
3. 浏览器直接打开；
4. 工作台/三维场景/交互立即可用。

不允许要求用户：
- 解压 ZIP / 7z；
- 安装依赖；
- 运行 npm / Vite / Python / local server；
- 配置路径；
- 手动放置 assets 目录；
- 再打开第二个工具；
- 逐个下载图片、模型、脚本；
- 修改浏览器参数才能运行。

## 1. 单体 HTML 的技术定义

交付 HTML 必须自包含运行所需的全部内容：

- JavaScript；
- Three.js / runtime bundle；
- shader；
- CSS；
- 图片；
- SVG；
- JSON / CSV / 参数表；
- 小型模型/二进制；
- 音频；
- 字体替代/图标；
- worker 源码；
- 必要 decoder。

允许的内部封装：
- inline `<script>` / `<style>`；
- base64 / data URI；
- JS typed array；
- 压缩数据 + **同文件内** decoder；
- HTML 内创建 Blob URL；
- 内嵌 shader string；
- 单文件内的虚拟文件系统。

不允许最终交付依赖：
- 相对路径 assets；
- CDN；
- npm package runtime fetch；
- GitHub raw URL；
- 远程图片；
- 外部 GLB；
- 外部 JSON；
- service worker 预缓存才能首次启动；
- localhost；
- HTTP server。

网络能力可以作为**可选增强**，但断网和 `file://` 打开必须保留核心运行能力。

## 2. file:// 是正式门禁

发布前必须实际验证：

- 本地磁盘双击 / `file://...` 打开；
- 首帧成功；
- 关键交互可用；
- console 0 error；
- 无缺失脚本/图片/模型；
- 无 CORS 导致的核心功能失败；
- 不启动本地服务器；
- 核心运行期间无必须的外网请求。

如果模块系统、fetch、worker 或 asset loader 在 `file://` 下受限制，应在构建阶段解决：
- bundling；
- inline；
- Blob URL；
- data URI；
- classic script / bundled module；
- inlined worker source。

不能把“请运行 server”作为交付说明。

## 3. 单文件不是低质量许可

单体 HTML 只是包装/交付合同，不允许因此：
- 简化真实几何；
- 换成截图；
- 换成视频；
- 删除物理；
- 降低材质；
- 丢失真实数据；
- 用 toy / placeholder；
- 用旧版本；
- 改验收门槛。

必须把真实生产工作台**封装进去**，不是重新做一个简化展示页。

## 4. 大数据如何处理

即使数据较大，用户交付仍保持一个 HTML。

建议优先级：
1. 构建时去重；
2. 结构化数值压缩；
3. gzip/deflate/brotli 等可嵌入 payload + 同文件 decoder（以浏览器支持和 file:// 为准）；
4. 二进制 base64 / typed-array chunk；
5. runtime 解码后创建 Blob URL；
6. 只删除经过批准且不影响真值的数据冗余。

禁止因为文件大就把资产拆成用户需要自己管理的目录。

内部开发仓库可以继续多文件维护；**最终用户交付**必须 build 成一个 HTML。

## 5. 在线链接与单体 HTML 的关系

此前部分 Mother 规定“只交付一个公开网址”。用户当前规则更新为：

- **单体 HTML 是强制交付本体**；
- 可额外发布一个固定 HTTPS 在线镜像；
- 在线镜像最好直接服务同一个 standalone HTML；
- 公开网址不得成为运行单体 HTML 的必要条件。

因此：
- “Pages 已发布” ≠ standalone gate 通过；
- “standalone HTML 可双击” ≠ 公网发布门已通过；
- 两者分别记录。

## 6. 最终 receipt 必须增加

```json
{
  "singleFileHtml": true,
  "standalonePath": "...html",
  "fileProtocolTested": true,
  "requiresUnzip": false,
  "requiresServer": false,
  "requiresExternalAssets": false,
  "requiresCDN": false,
  "requiredNetworkRequests": 0,
  "consoleErrors": 0,
  "desktopStandalonePassed": true,
  "mobileViewportStandalonePassed": true
}
```

移动视口通过仍不等于实体手机性能通过。

## 7. 用户可见交付格式

正常回复只给一个主要入口：

**一个可直接打开的 standalone HTML。**

除非用户明确索要，不要同时甩：
- ZIP；
- 一串文件；
- 多个测试地址；
- manifest；
- SHA 列表；
- 内部截图；
- 构建脚本。

内部证据继续保留在 GitHub。

## 8. 与真实三维硬门禁的关系

如果任务是三维/工作台：

- 单体 HTML 里面必须是真实实时三维；
- 不是静态截图；
- 不是 canvas 假图；
- 不是 prerecorded video；
- 不是 image-gen 结果；
- 不是只有 UI、没有三维运行时。

用户双击看到的就是最终真实运行工作台。

## 9. 失败状态

以下任何情况直接 HOLD：

- 双击后白屏；
- 必须 npm start；
- 必须 python -m http.server；
- 必须解压；
- asset 404；
- file:// CORS 阻断；
- CDN 不可用就无法运行；
- 打开的是 launcher，再要求选择目录；
- HTML 只是壳，核心资产还在外部；
- 用旧单文件冒充新任务产物。

正确状态：
- `CANDIDATE_READY`
- `HOLD_GATE_FAIL`
- `BLOCKED_VALID`
- `NO_NEW_ARTIFACT`

## 10. 生效

这是用户 2026-09-21 的全局长期交付指令。

以后不需要用户在每个 Mother 重复说明。
任何旧 README / AGENTS / PUBLIC_WEB_DELIVERY_GATE 与本规则冲突时：
**用户最新单体 HTML 规则优先。**
