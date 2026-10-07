# TEN24 私有导入：从原包到同一个工作台

原入口就是 `kaopu-hair-workbench/handoffs/ten24-original-local/index.html`。画面和毛发参数同屏；工具准备只需做一次，以后打开这一页并选择自己的 `runtime` 目录。

## 1. 只下载代码工具包

在原入口点“首次准备原件”中的“下载私人准备工具”，解压 `TEN24-Private-Setup-Code.zip`。包内只有本项目 Python 代码、来源/许可说明与原件哈希清单，不含扫描、贴图、Blend、groom 数据或浏览器运行资产。

依赖：

- Python 3.10 或更新版本，只用标准库，不需要 pip/npm
- 已安装的 Blender；完整流水线实测版本为 4.3.2，原扫描场景来自 3.2.2。其他版本会保留原件、另存副本，但不能假定材质迁移等价
- 至少 2 GiB 空余磁盘；完整 Blender 测试峰值约 4.4 GB 内存，建议留足余量
- 第一次若本项目导向文件不在附近，会只下载约 650 KB 的固定已有导向并核对 SHA；不会生成新人物或换另一套发型
- 原件和结果都应放在私人、非共享目录，输出父目录必须在所有 Git checkout 外

脚本不会安装/升级 Blender、改权限、改执行策略、启用原场景脚本或公开数据。

## 2. 从已有原件建立新工作目录

在解压后的代码工具目录打开终端。把三个尖括号路径替换成实际位置：

```text
python rebuild_private.py --private-parent "<现有私人输出父目录>" --blender "<Blender可执行文件>" --source-zip "<官方原ZIP>"
```

Windows 的 Blender 可执行文件通常名为 `blender.exe`；macOS/Linux 名为 `blender`。请选择你已有版本的实际路径，不要照抄另一台机器的历史 G 盘路径。

如果已有完整解压目录：

```text
python rebuild_private.py --private-parent "<现有私人输出父目录>" --blender "<Blender可执行文件>" --source-root "<直接包含Blender和Textures的目录>"
```

原 ZIP/目录始终只读。脚本仅复制并逐文件校验需要的 26 个 Blender/JPG 文件，随后在新建随机后缀目录生成独立 R11 工作副本。原件不会被覆盖。

若没有原包，可省略最后一项，直接从作者官方公开 ZIP 按 HTTP Range 获取约 300 MB 的原场景/贴图子集，不下载整个约 2 GB ZIP。每个原文件 SHA 必须匹配。此子集不是完整 72 文件原档案，不宣称整包哈希已校验。

已有毛发工作台的旧导向可以显式指定：

```text
--groom-data "<原项目/kaopu-hair-workbench/qa/gnm-groom-editor/data/teacher-groom.js>"
```

固定导向 SHA 为 `706a8192d47b1f8a422ee3094107a71946b8fd417ce7f0c456ef29addf2c60be`。不匹配即停，不偷偷换来源。

## 3. 回到原入口选择 runtime 目录

成功结束会输出两个路径：

- `Verified private Blender scene`：可在 Blender 打开的独立 `TEN24_Groom_R11_Verified.blend`
- `Private browser import folder`：回到原工作台选择的 `runtime` 目录

选择整个目录，不是 ZIP、Blend 或单个 JSON。目录内需要 `runtime.json`、10 个几何 `.bin`、`groom.bin` 和原 JPG 贴图。网页只通过本地 File API 读取，不发送这些内容到服务器；刷新网页后需重新选目录，没有暗中持久缓存。

确认内存需求后选择目录。载入成功时会显示 10/10 原部件与 13,998 条接发。可拖动旋转、滚轮缩放；右侧直接调长度、密度、粗细及显隐。本轮验收聚焦桌面 1440/2048 同屏布局，真实设备帧率还需结合显卡检查。

## 清楚的错误与处理

| 提示 | 处理 |
|---|---|
| 缺少 runtime.json | 选脚本生成的 runtime 目录，不能选原压缩包或 Blender 目录 |
| 原部件不完整、几何/接发校验失败、缺少原贴图 | 保留现有文件；用同一原件在新私人目录重新生成，别补其他人的脸或贴图 |
| 原 SHA 不匹配 | 停止。原件版本不同或不完整，不改基准、不绕过校验 |
| 设备不支持 8192 贴图或 WebGL2 | 不降图、不减面；换支持原尺寸贴图的桌面浏览器/设备 |
| 内存不足、图形上下文丢失 | 关闭其他占内存程序后再试；原目录仍完整，不能据此称低配设备已适配 |
| 脚本 STOPPED / 某阶段失败 | 原输入未改；新私人目录的 reports 保存诊断。提供失败阶段即可，不要将原模型/贴图上传公开仓库 |
| Python 命令不存在 | 使用已安装 Python 的实际命令（部分 Windows 为 py -3）；本工具不会自动安装软件 |

## 验收与许可边界

WebGL 技术 15 项已通过不代表人工视觉已认可：浏览器尚未等价复现原 SSS、微法线混合、节点曲线和 Filmic；真实硬件帧率、连续样条碰撞与动力学也未完成。原男性 R9 没有替换。

官方产品为个人使用；商业用途、模型再分发或公开扫描 viewer 另受作者许可限制。不要公开原件、工作 Blend 或 runtime。官方：https://www.3dscanstore.com/blog/Free-3D-Head-Model ，许可：https://www.3dscanstore.com/terms-and-conditions-licensing 。
