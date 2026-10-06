# KAOPU Anny 身体工作台 R01

固定官方 Anny v0.6.1 提交 d6fc027ced5c17b6b0775dee944096ade7a9ef80。独立浏览器教师模型，保留官方原生网格前向计算。

- 六个官方形态维度；age 额外允许官方 newborn 锚点 −1/3
- 254 个默认局部变化、104 根骨骼 local-ref 姿态、完整 LBS 权重
- 可旋转缩放、冷暖灯、线框与骨架；一键还原官方基线
- 参数 JSON 导入/导出与当前原生米制 Z-up 网格 OBJ 导出
- 不含照片拟合、梯度优化、表情 action、碰撞与其他拓扑

这些是艺术家定义的形态坐标，不用于推断真实人物的年龄、性别或族群。没有上传照片或个人资料的功能。模型数学在浏览器本地完成。

## 运行

静态 HTTP(S) 服务打开 index.html。所有前端和模型文件同源自托管，不依赖外部 JS CDN。浏览器需支持 WebGL、Web Crypto、DecompressionStream gzip（较新 Safari/Chrome/Firefox）。初次模型压缩下载约 44 MB，解压后约 113 MB；实际大小与 SHA-256 见 assets/anny-model.json。老旧或低内存手机可能受限，不宣称已在真实 iPhone 验证。

## 校验

运行 node tests/model.mjs。黄金数值由官方 PyTorch 实现生成，涵盖全部顶点、骨骼与中间量；脚本支持直接解压 assets/anny-model-*.bin.part。浏览器脚本 tests/browser.cjs 由独立只读 QA 工作流分别在 Chromium 与 WebKit 执行，检测像素、全部控制、重复还原、下载/恢复、失败重试和上下文恢复。

## 重建

安装官方 anny==0.6.1 及其依赖，运行 tools/export_anny.py。必须保持固定源码版本，并重新生成黄金对照。原始解压 bin 仅用于开发，不需发布，压缩文件分片按元数据顺序拼接，可无损恢复。

## 授权与资料

Anny 代码 Apache-2.0；MakeHuman-derived assets CC0-1.0；Three.js MIT。详见 licenses/、PROVENANCE.json 与 LEARNING.md。未下载或发布受限 SMPL/SMPL-X 资产。
