# TEN24 原女性 · 本项目本地接入任务（未完成）

日期：2026-10-05。任务位置：`kaopu-hair-workbench/handoffs/ten24-original-local/`。在同一 Groom／毛发项目中继续，本地接入与完整交互尚未完成。

## 要完成什么

本任务指定的是 TEN24／3D Scan Store 免费原女性，要求完整保留原人物身份、原网格、原分辨率贴图、眼睛、睫毛、原材质节点和原细分。先让这位原人物在本地 Blender 中完整打开、能够旋转检查，再依据已有 Groom 项目的实际结构推进接发。原男性形状和已有男性毛发实验必须保留。

GNM 生成身份不属于这份原女性资产，不能替代指定人物或记作本任务完成。不要减面、降细分、做 2K 贴图代理、改肤色、替换眼睛或材质、遗漏部件，不要把静态图片当交互完成。

这份轻量包只有任务书、校验清单和脚本，**不含约 2 GB 原资产，也不表示资产已经搬到用户电脑**。本地 Codex 应先检查用户已有原包；没有匹配副本时，从下列官方入口获取完整原包。

## 第一步：在本地定位已有项目

1. 先确认用户当前打开的 Groom 项目根目录、未保存工作和 Git 状态。不要猜测 D 盘、桌面等绝对路径，不覆盖用户现有文件。
2. 关联仓库是 `haihao0307/guilin-dem-pipeline`，工作台范围为 `kaopu-hair-workbench`。核对本地 checkout 的实际 remote 和目录关系，不能仅凭文件夹名认定。
3. 阅读项目 `AGENTS.md`、相关 `.agents/skills` 和已有启动／测试说明。先定位现有 Blender、版本和可用内存／显存，不要重装。原场景由 Blender 3.2.2 制作；已有版本不同时，先报告兼容性问题，不自动迁移或覆盖原场景。
4. 此本地原件接入任务不发布第三方原资产。原模型、贴图、ZTL、FBX、OBJ、场景及其可提取衍生资产都不得进入公共 GitHub、CI、Pages 或公开附件。Groom 工程内只记录本地私人资源引用；原资产最好保存在整个 Git checkout 之外的私人目录。

## 官方原包与固定校验值

- 产品页：https://www.3dscanstore.com/blog/Free-3D-Head-Model
- 原 ZIP：https://samplescan.s3.us-west-2.amazonaws.com/3D_ScanStore_Free+Head.zip
- 许可：https://www.3dscanstore.com/terms-and-conditions-licensing
- ZIP 精确字节：`2019571774`
- ZIP SHA-256：`9aa6a036462910c9dbe861d53201b3fed3bd39b37dc8f0c7d2e33c852eeecfe7`
- ZIP 90 条目：72 文件、18 目录；解包文件总字节：`4257253681`
- 主场景相对路径：`Blender/Blender Scene.blend`
- 主场景字节：`21842524`
- 主场景 SHA-256：`7e069f5508aaaf53f8ea0ce560741b54b5ddbc2e90128141c6c94edd22bd54a9`

`original-files-manifest.json` 列出了全部 72 文件的原相对路径、字节数、CRC32、SHA-256。这些值来自实际官方包，并在 2026-10-05 从官方重新下载后独立逐项对照，差异为 0。官方以后若改包，校验失败应停止并报告，不能悄悄换基准。

主要目录是 `Blender/`、`ZTL/`、`FBX/`、`OBJ/`、`Marmoset/` 和 `Textures/`。应完整保留 JPG、TGA、PSD 化妆分层与 TIFF 位移等原文件。Blender 场景使用其原来引用的 JPG；不要自行换成 TGA。原 `.blend` 头部坐标与包内 OBJ 有细小差异，因此不能拿 OBJ 导入结果冒充原 `.blend` 人物。

## 获取与只读校验

校验脚本只依赖 Python 3.8+ 标准库，无网络、无解包、无 Blender 调用，不写原资产。若已有 Python，用其实际命令；没有时，可使用已有 Blender 自带 Python 的实际可执行路径，不为此重装 Blender。

在交接包目录中运行，下列尖括号必须替换为已核实的本地路径：

```powershell
python verify_original.py --zip "<官方原ZIP绝对路径>" --root "<完整解包根目录>" > "<私人报告目录>\ten24-integrity.json"
```

`--root` 指直接包含 `Blender`、`Textures` 等目录的根，报告不要写进这棵原资产目录，否则会被列为多余文件。可只给 `--zip` 或 `--root`。ZIP 模式校验整个压缩包 SHA 和尺寸，再读取全部条目检查 CRC 与逐文件 SHA。目录模式校验完整 72 文件并报告缺失／多余文件。退出码 0 才表示本次请求的检查全部通过；1 表示失败；2 表示参数错误。

可选 Windows 下载脚本 `Download-Original-Windows.ps1`：

```powershell
.\Download-Original-Windows.ps1 -PrivateAssetsParent "<已确认的本地私人资源父目录>"
```

父目录必须已经存在、属于用户私人位置、位于 Git checkout 之外，且不是 junction／符号链接；不要选共享目录或公开同步目录。脚本不建立新的 ACL 权限。脚本检查余量，在其中创建带时间与随机后缀的新目录，流式下载官方原包，校验整个 ZIP SHA，再完整解包并逐一校验 72 文件。需要约 7.35 GB 空余磁盘含 1 GiB 预留，这不是 Blender 运行内存要求。下载失败保留新目录内的诊断，不覆盖或删除旧资产。脚本不改执行策略、不安装软件、不启动 Blender、不上传文件。如果本机执行策略阻止脚本，停止并报告，不绕过策略；可通过官方 URL 手动下载后执行只读校验。

PowerShell 脚本已做代码检查，尚未在用户 Windows 上执行；Python 校验脚本的本次实测情况见 `VALIDATION.md`。

## 原人物完整性检查

`original-character-checkpoints.json` 记录原对象数量、拓扑、变换、细分、材质节点数量、原图尺寸和色彩空间。SHA 匹配保证原文件字节完整；摘要数字本身不等于已完整加载，也不足以重造原材质。

10 个原网格部件，基础总计 202,093 顶点／154,233 四边面：

| 对象 | 原顶点 | 原四边面 |
| --- | ---: | ---: |
| Brows | 121586 | 87922 |
| Lashes | 50120 | 36195 |
| Head | 12466 | 12410 |
| Eye Wet | 478 | 394 |
| Lens Left | 1666 | 1664 |
| Lens Right | 1666 | 1664 |
| Realtime Eyeball Left | 1666 | 1664 |
| Realtime Eyeball Right | 1666 | 1664 |
| Teeth | 9846 | 9744 |
| Tongue | 933 | 912 |

- 所有 10 个部件原 Subdivision 均为视口 2／渲染 2，不应用、删除或降低修饰器来通过加载
- 原皮肤材质 `Material.001` 有 22 节点／17 连线，曲线、Mapping、微法线、散射等原节点值和连接以原 `.blend` 为准
- 眼球、Lens 和 Eye Wet 是不同原部件，眼球有原图及材质，睫毛和眉毛都有真实原网格；不能改成简单眼球或遗漏透明层
- 眼睑、耳廓属于 Head；先检查原耳廓与入口区域，不凭猜测补深耳道或宣称缺件
- Face 主图与 Lens normal 为 8192×8192；Eyes 图为 4096×4096；原 Face micro normal 是 3965×3965；其余图保持各自原尺寸
- 17 张源栅格图和 1 个 HDRI 路径需逐个解析；原场景的 Windows 相对路径分隔符需按所在系统正确解析，不改贴图内容或色彩空间
- 原场景为 Cycles、4096 samples、2800×1216、100%、Filmic、曝光 1、Simplify 关闭、相机 Eyes Shot。保留这些原设定，不用降质渲染当完整交付

## 本地 Blender 操作边界与验收

1. 先保护用户当前打开的场景，不强制关闭、不覆盖未保存工作。确认原资产校验通过后，在独立进程打开原场景，禁用自动执行脚本。命令行参数 `--disable-autoexec` 必须位于场景路径之前；不要添加 `--enable-autoexec`。
2. 首先建立完整打开和可交互证据：全部 10 部件存在、细分仍 2／2、原贴图路径和原材质节点正确，实际旋转检查正面、侧面、眼球／Lens／Eye Wet／睫毛／耳廓。不能仅有对象清单就声称人物已恢复。
3. 原文件始终保留。若需要另存工作副本，放到新的私人工作目录，记录原源 hash 与新文件位置，原源不可覆盖；工作副本仍要保持上述质量与身份。贴图路径只允许必要的等价重定位，不能替换字节或材质逻辑。
4. 完整原人确认后，才调查既有 Groom 平台的本地集成方式与真实头皮接发，先报告方案。私人浏览器分发并不自动豁免许可中的 viewer／software bundling 限制；没有适用许可确认时，继续普通个人 Blender 学习路径，不导出受限网页资源。用户拥有代码仓库发布权限不代表能重新分发第三方模型。
5. 若本地仍失败，保留具体版本、日志、进程终止信息和内存／显存证据，明确停在哪一步。不要反复相同重开，不要用陌生人、简化版或静态预览顶替。完成标准是指定原女性在本地完整可交互，并明确接发是否已实际验证；男性旧版本完好。

## 已做过哪些检查

详见 `PRIOR-TESTS.zh-CN.md`。官方包完整性已经证实，基础 Blender 安装和小模型 GUI 正常；云环境完整原人加载仍被终止。换成本地执行是下一步，当前没有证据表明原女性已经成功进入用户本地平台。

## 交接包文件

- `README.zh-CN.md`：本任务书
- `original-files-manifest.json`：全部 72 原文件 SHA／CRC／尺寸
- `original-character-checkpoints.json`：原人物保真检查点
- `verify_original.py`：只读校验
- `Download-Original-Windows.ps1`：可选官方私人下载与校验
- `PRIOR-TESTS.zh-CN.md`：已经证实的结果、失败与限制
- `VALIDATION.md`：交接包自身测试范围

本地接续时先确认整个工作台源码和这份任务目录真实存在。原资产从这里的官方 URL 获取并核验，不把其他机器的路径视为本地输入。私人资产目录必须位于整个 Git checkout 外；如需保存本地资源路径，用本目录被 `.gitignore` 排除的 `local-resources.local.json`，不能提交个人绝对路径。

## Groom Codex 协作规范

- 有证据发现指令中的事实有误时，明确指出并解释依据，不顺着错误继续做
- 指令含糊、会改变对象或范围时先澄清，不猜测替换；指令明确则直接落实
- 每项任务给出执行、质疑或澄清的明确状态。遇阻说明具体动作、目标、原因与下一步，不能用资料收集或局部测试冒充完成
- 已认可的原人 R8／R9 是保留锚点；新的学习、材料和人物尝试使用独立案例与存储，确认后再集成
