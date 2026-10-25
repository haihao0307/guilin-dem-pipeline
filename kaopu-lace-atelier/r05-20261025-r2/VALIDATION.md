# LACE R04 本轮验证

2026-10-22。状态：IMPLEMENTED / NUMERIC_CHECKED / NATIVE_EGL_CHECKED / PUBLISH_BLOCKED / BROWSER_WEBGL_UNAVAILABLE。

**交付未完成。参考质感、完整网页与实际 GPU 性能尚未验收。**

## 来源核对

上传 R03 包的 157 个清单文件校验通过。GitHub Draft PR #9 开放、未合并；本轮核对基线 269bf7f41de93925ebc44a157c74ff468a81960a。50 个相关 tracked 项目文件中 49 个与包一致；唯一差异为包里已经注明修正的 docs/TASK_RECEIPT_R03.json。

GitHub 本来不保存生成后的 dist/BUILD_MANIFEST.json；对应依据为交接包清单与固定源码，不能将一次 404 解释为 R03 源码不存在。

## 实际运行结果

| 范围 | 本轮结果 | 文件 |
|---|---|---|
| 生成结构 | 22 项通过，含原三层哈希及全部填针端点/属性保留 | CORE_TEST_R04.json |
| 宿主绑定 | 8 组通过；38,680 路径、223,918 点 | ADAPTER_TEST_R04.json |
| 透视与扫掠 | 6 组通过 | DISPLAY_TEST_R04.json |
| 采样状态 | 12 项通过 | SAMPLING_TEST_R04.json |
| 观察恢复与静止 | 5 项通过 | OBSERVATION_TEST_R04.json |
| 毛羽灯光同步 | 3 项通过 | FIBER_TEST_R04.json |
| 实际显示几何 | 三预设共 12 层，0 反向面、0 退化面、0 非有限顶点 | DISPLAY_REVIEW_R04.json |
| 原生 GLSL | 12 program / 24 stage 编译链接成功 | NATIVE_GLSL_R04.json |
| 实际材质 | 整体、微距、近距各 32 样本，2400×1800 缩至 1200×900 | MATERIAL_R04.json |

56 项 CPU/API 检查不是 56 项视觉测试。原生采用 Mesa llvmpipe，未冒称实际 GPU 帧率。渲染没有阴影、硬件 MSAA、浏览器 UI/驱动或背景平面，不证明动态稳定性。

## 对照判断和成本

新旧整体与微距相机、模型变换、颜色和固定光源一致；近距沿用旧报告记录的相机与掠射灯光。其实际焦平面高度 2.7904 cm，不能称为 1.3 cm。比较图只裁切同一区域，无渲染内容修饰。

叶片中央急折变缓，仍有重复平行细杆和规整感。整体柔软材质不足，未达到参考，暂保留为实验候选。增加几何的成本/观感收益尚未证明合算。

主体三角形 2,142,080 → 2,731,072（+27.5%）；毛羽 36,987 根、295,896 三角形不变；总量 2,437,976 → 3,026,968（+24.16%）。部分过去支持的大尺寸密纹配方现在超预算，会明确失败。没有新硬件性能或动态摩尔纹改善数值。

## 原生对照复现

固定相机和掠射光记录在 `DETAIL_FIXTURE_R04.json`。近距沿用 R03 报告里的实际钳制相机；脚本将明确的 `raking` 标签、相同数值光源和模型变换施加到新几何上。原始数据文件在工作目录重建，不提交数百 MB 的中间缓冲。

```sh
node tools/export-native-glsl.mjs work/shaders
node tools/export-coverage-scene.mjs work/coverage
node tools/export-material-scene.mjs work/coverage work/shaders
python tools/apply-detail-fixture.py work/coverage/macro-material-scene.json
python tools/egl-material-study.py work/coverage/material-scene.json work/coverage/macro-material-scene.json work/coverage/fiber-detail.json --out work/material-output --shaders work/shaders --samples 32 --render-scale 2
```

此流程需要原生 EGL/GL 库、NumPy、Pillow；不启动浏览器，也不提供完整网页验收。

## 本轮浏览器与发布阻碍

1. 原 Site 仍为 version 3、所有者私有、线上 R02。
2. 新空目录中，官方 Site source helper 普通模式连接原源码仓库，失败于 Failed to connect to browser-proxy port 8889。未换站点、受众、认证或托管通道。
3. 受支持的内部预览返回了正确 R03 UI，但真实日志明确为 GL_VENDOR = Disabled、GL_RENDERER = Disabled 和 Error creating WebGL context。
4. 交接记录中先前自动审批拒绝的公开受众与独立登录动作，本轮未重试。

R04 数值与原生检查继续完成；R04 浏览器首帧、关键交互、透明/阴影合成、保存恢复 UI、手机实机及 file 协议仍未通过。没有将离屏图或旧网站冒充新网页。

## CI 和历史

原 Draft PR 和 artifact 上传必需步骤保留；不合并、不强推、不删除历史产物、不将失败改成成功。新远端结果以实际 commit Actions 为准；上轮整体 CI 因 artifact storage quota 失败。

R01/R02/R03 单文件保留。R04 独立 HTML 和清单是继续核验的候选，不替代尚未完成的原 HTTPS 交付。
