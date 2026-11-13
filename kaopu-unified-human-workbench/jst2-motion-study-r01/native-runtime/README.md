# 原生 R07 人物动作查看器接口

该目录只接入已存在的完整 R07 人物，不加载外部人物网格。原生宿主 SHA-256 为 `d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a`，父目录 `native/r07-host.html` 不修改。显示几何、两个原材质组、104 骨、完整 CSR 权重和细化祖先关系保留。当前固定为默认的一位人物。

## 构建

资源已存在时，一条命令即可构建并复制到父项目的静态输出：

```bash
node native-runtime/build.cjs --dist
```

首次需要下载原始资源时先运行 `python native-runtime/prepare.py`。它会从固定 commit 自动补齐未纳入版本管理的 `native/r07-host.html`、数据分块与两张贴图，干净 checkout 无需手工复制宿主。下载逐文件检查固定长度和 SHA-256，按包 gzip 解压后再检查原始长度和 SHA-256；无模型转换或数据量化。

输出为 `dist/native.html` 与 `dist/native-assets/`。父页面可使用 `<iframe src="native.html">`。两者必须一起发布到相同静态站点。这个模块本身使用本地静态资源文件，尚不是双击离线单体 HTML。

默认资产为原 hot 包 8,774,867 bytes 与两张原图 1,374,970 bytes；总计 10,149,837 bytes。没有打包完整体型库。若默认原生初始化实测请求额外的原形态页，用 `prepare.py --packets hot,anny-N,...` 补充清单中真实需要的页，再构建；不得用替代模型掩盖缺页。

## 就绪

同源父页面：

```js
const iframe = document.querySelector('#native-person');
const native = iframe.contentWindow.NativeMotionViewer;
const descriptor = await native.ready;
```

原生宿主必须完成 `__LIP_P3__.ready`、`__HEAD_PROC__.gpuVerified`、完整皮肤和眼睛图像就绪。随后建立 `NativeBinding`，确认 266,098 个显示顶点、104 个骨骼，并验证接管后两份最终材质的实际 GPU link 与单次骨骼顶点注入；`ready` 才会解决。状态可随时从 `NativeMotionViewer.diagnostics()` 读取。初始化失败时 ready 拒绝且页面显示具体错误。

R07 全身程序皮肤会动态继承原皮肤的顶点着色器。`binding-adapter.cjs` 只把 NativeBinding 的骨骼注入改为幂等，避免两个材质互相继承时重复声明同名 GLSL 函数；两份原皮肤片元、材质、灯光和多遍渲染均保留。原 `NativeBinding.mjs` 文件不修改。

页面左下角「显示诊断」可展开 `#native-debug-data` JSON，供浏览器 DOM 读取：包含两份材质实际 link / shader 日志、原皮肤 uniforms、场景所有灯及其有效可见性、曝光与 WebGL 状态。刷新按钮会增加画面中心 64px 颜色探针；它只作调试，不替代视觉验收。旧宿主的播放与重置按钮已隐藏。

## 数据约定

`getRig()` 返回 `names`、`parents`、`restMatrices`、身高、绑定报告及来源版本。原生空间是米、Z 轴向上，矩阵为行主序、作用于列向量。原生向显示的转换为 `[x, z, -y]`。

目标使用自定义 CSR 蒙皮，不能对它直接运行标准 `AnimationMixer.clipAction`。外部动作先在源骨架采样，经过骨名、绑定姿态和坐标系适配，再提交原生姿态。`setRotations` 的数值是以度为单位的旋转向量，不能直接当欧拉角。

| 同源 API | 作用 |
| --- | --- |
| `ready` | 就绪 Promise，结果为骨架描述 |
| `getRig()` | 返回复制后的骨架、绑定与来源信息 |
| `setSkinMatrices(matrices, {render:true})` | 提交 104 个原生 row-major skin 矩阵 |
| `applyPose({q,p}, {render:true})` | 提交 Native RigidPoseSampler 的局部 skin-delta 四元数和根位置 |
| `capturePose()` | 导出当前原生 sampler 姿态，q 长 416，p 长 312 |
| `setRotations(map, rootTranslation, options)` | 诊断用原生关节旋转向量字典与根平移 |
| `reset()` | 恢复当前人物初始绑定姿态 |
| `setView(name)` | three/front/rear/side/face |
| `setSkeleton(bool)` | 显示实际最终 104 骨连线 |
| `sampleVertex(index)` | 取完整 CSR 变形后的原生显示表面点 |
| `diagnostics()` | 来源、资源、启动、帧提交和骨长检查 |

`setSkinMatrices` 检查有限数值、骨长、刚性变换。非法姿态会恢复上一接受状态并拒绝。每次提交只更新骨矩阵纹理；不重新运行人体生成器。渲染按 requestAnimationFrame 合并多次请求，`framesSubmitted` 只表示 CPU 渲染提交，不能当 GPU 完成帧率。

## postMessage

所有消息都有 `protocol: "kaopu-motion-native@1"`。只接受父窗口或自身发送的消息。

```js
iframe.contentWindow.postMessage({
  protocol: 'kaopu-motion-native@1',
  id: 'pose-001',
  command: 'set-skin-matrices',
  matrices
}, location.origin);
```

命令包括 `get-rig`、`set-skin-matrices`、`set-native-pose`、`set-rotations`、`reset`、`view`、`skeleton`、`capture-pose`、`diagnostics`。成功返回 `{type:"native-response",id,ok:true,result}`，失败返回 `ok:false,error`。

主动事件为 `native-progress`、`native-ready`、`native-error` 和 `native-frame`。`native-ready` 携带 `rig`；`native-frame` 明确标注 CPU 提交口径。

## 当前范围

保留原人物，没有导入外部人体或截断蒙皮权重。没有修改活动 GitHub 分支、发布站点或改写父页面 UI。源码与资源静态校验已执行；最终实际显示、pose API、镜头和固定 HTTPS 由父任务的受管浏览器验收，不因构建成功而自动标记通过。
