# R29 原生整车分辨率补丁，未执行浏览器验收

这个目录是独立 overlay。原始 `../r29`、Git、Library 和发布状态均未修改。

## 运行时文件

- `app.js`：可替换工作台对应文件。
- `material-renderer.js`：可替换工作台对应文件。
- `legacy/app.js`、`legacy/material-renderer.js`：保留的修改前源码，仅供可复核差分测试，不用于页面运行。
- `SOURCE_BASELINE.json`：本次 R29 输入快照及原历史锁已存在的差异。不是对旧锁的替换。

不需要修改 `index.html`：原有 canvas 属性仍是 720×400。

页面默认和 `?resolution=720x400` 均保持 720×400。只在页面初始化时，`?resolution=1440x800` 把 canvas intrinsic 尺寸设置为 1440×800，然后才创建 WebGL context。其他 resolution 值拒绝；没有任意超大缓冲分配入口，没有运行中 resize 接口，没有设备像素比倍乘、图片插值或 drawImage 放大。

切换尺寸应加载另一页面。页面运行中改变 URL 查询不影响已固定的尺寸；外部直接改变 canvas 尺寸会令后续渲染拒绝，避免错误的 viewport 或队列竞态。

## 改动边界

1. scissor 的投影中心改用 width/2、height/2，尺度仍为 height/1.2；像素保护边距仍为 2。相机参数和视场没有改变。
2. 每帧显式设置实际尺寸 viewport，并在清整帧之前关闭 scissor。缓冲实际尺寸必须与初始化尺寸相等。
3. 720 路径生成的完整 vertex/fragment shader 文本与保留旧版本逐字相同。此路径的新 uniform 查询在真实 WebGL 中返回 null，上传是合法无操作。
4. 1440 路径增加 renderResolution 和 surfaceRayEpsilon uniform。主射线像素坐标改成 `(gl_FragCoord.xy - .5 * renderResolution) / renderResolution.y`。
5. 材质只改变像素足迹 epsilon 的来源：`1.2 / height * sqrt(2)`。800 高时约为 0.002121320343559643；旧 GLSL 的 400 高常量保留原字面量。原波场、频率、振幅、相位、调制、材质分配、逆变换、光照、过滤权重函数、0.15 掠射屏蔽以及几何位移零均不改。
6. 交点搜索、步进容差、法线差分、深度表达式、机械参数及所有解析场不改。

`QA.resolution` 是渲染配置/状态记录，不是像素验收证明。实际 framebuffer、PNG 尺寸及图像内容仍需隔离浏览器确认。

## CPU 测试

在 `a4-recovered` 目录执行：

```sh
node resolution-study/test_resolution.js
node resolution-study/test_material_renderer.js
```

两个测试只运行 Node，不启动 Chromium、Playwright、浏览器服务或 GPU。

测试自动使用当前目录或相邻 `r29` 的场景依赖，并优先使用此 overlay 的两个运行时文件。也可以显式指定：

```sh
A4_SCENE_ROOT=/absolute/path/to/r29 \
A4_RENDERER_ROOT=/absolute/path/to/updated/r29 \
node /absolute/path/to/resolution-study/test_resolution.js

A4_SCENE_ROOT=/absolute/path/to/r29 \
A4_RENDERER_ROOT=/absolute/path/to/updated/r29 \
node /absolute/path/to/resolution-study/test_material_renderer.js
```

`A4_QA_OUTPUT` 可选择报告输出目录；默认写测试所在目录。`A4_RESOLUTION_STUDY` 可指定保存 SOURCE_BASELINE.json 和 legacy/ 的目录，便于将测试放到工作台根目录。测试默认也识别根目录中的 resolution-study/ 子目录。

### 已通过的覆盖

- 7 个 program 的 720/1440 尺寸与 epsilon 上传；720 未声明的新 uniform 为 mock 无操作。
- 默认 720 及显式 720 的完整 shader 与旧版逐字一致。
- 1440 shader 逆向去除四项明确尺寸改动后，与旧版完整 shader 逐字一致。
- 保留旧 shader 锁证据，独立锁定 field/ranges、交点与法线原文、深度表达式。
- 2,000 个归一位置射线等价样本；4,000 个 scissor 测试；近面整屏回退。
- 20 组足迹数值、2,114 个高分辨率切平面锥约束样本、掠射过滤和随分辨率提高的权重单调性。
- 整车完整、整车剖切、基线、候选和回退序列；720 的所有旧 uniform/scissor/draw 顺序与旧版一致，1440 的非分辨率输入完全一致。
- 固定初始化配置、后续查询变更无影响、外部 resize 拒绝、无效尺寸拒绝。
- 原材质测试的 1,920 次过滤采样、2,500 次原足迹样本、坐标上传与不可变排队状态。

报告为 `CPU_RESOLUTION_QA.json` 和 `MATERIAL_INTEGRATION_QA.json`。它们明确标记未运行浏览器、未验证 PNG 字节复现、未完成机械验收。

## 不能掩盖的已有测试债务

原 `MATERIAL_GEOMETRY_LOCK.json` 写的是 R27 历史基线。未被本次补丁修改的 R29 输入 `gresley-dynamic.js`、`stack-fields.js` 已与两项历史哈希不同。原锁原样保留；报告逐项列出原哈希和当前 R29 哈希，不把旧锁整体宣称为通过。新增快照只证明本次分辨率补丁没有进一步修改当前 R29 输入。

原 `test_material_renderer.js` 还使用 R28 依赖列表，遗漏 R29 的 side-offset solver 等模块，并保留 574/73 的旧计数。提供的测试副本改为读取实际 index.html 脚本依赖，并从 SCENE.parts / DYNAMIC.visible 得出断言数量。当前 R29 实测为 655 个定义场、519/636 个可见 draw、77 个 stack 定义场；这些是本次结果，不是未来版本的固定常量。

## 整合到 R30 时

不要把 R29 的 636、77 等数量写成 R30 断言。新测试的 draw 和 stack 预期已从实际场景可见性计算，projection/ray/shader 差分不依赖固定 parts 数。

R30 的授权机械更改会使 R29 输入快照校验失败，这是正确行为。保留这套 R29 证据，为 R30 新建明确命名的输入基线和测试上下文；不要覆盖 R29 历史快照后声称旧模型没有改变。旧 renderer 快照仍可与同一套 R30 场景输入一起运行，以比较采样实现是否只改变分辨率。

## 后续隔离 GitHub QA

本目录没有运行或修改 browser_qa.py。建议后续独立打开 `?resolution=1440x800` 页面，对两张整车帧执行真实 readPixels 与原生 PNG 导出：整车完整、整车剖切。逐张检查 canvas intrinsic、drawingBuffer、实际 GL viewport 和 PNG IHDR 都是 1440×800，draw 数从实际可见场得出，几何位移仍为零。

旧 browser_qa.py 的 717/397 边界断言要改成 width-3 / height-3；前景像素门槛应按面积缩放。CSS viewport 不是 framebuffer。既有 720 回归另行保留；不同分辨率之间不要求 PNG 字节相同。720 shader 和调用一致只是保留复现条件，实际同驱动 PNG 复现仍需真实浏览器对比，不能由 CPU/mock 结果替代。
