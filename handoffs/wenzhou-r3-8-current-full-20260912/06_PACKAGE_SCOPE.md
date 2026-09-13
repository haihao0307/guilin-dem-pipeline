# 轻量交接包范围

目标：新窗口可以准确接续“小温州”当前生产状态，但默认不搬运历史大文件和浏览器二进制载荷。

## 默认包内包含

1. 当前 `START_HERE / STATE / SOURCE_LOCKS / WORLD_SCORE / NEXT_STEPS / EVIDENCE_ARCHIVES / PACKAGE_SCOPE / CHECKLIST`；
2. 当前 R3.8 关键 HTML/CSS/JS 源代码；
3. `tools/r3-8`、`records/R3_8` 中不超过 1 MiB 的文本型 QA/构建/记录文件；
4. `AGENTS.md`；
5. 自动生成的 `LEAN_HANDOFF_LOCK.json`，记录源提交、文件 SHA-256、内容去重 alias 和体积统计。

包内文本按 SHA-256 去重。相同内容只保存一个 canonical 文件，其他逻辑路径记录在 alias 表，不重复存储。

## 明确不进入默认随身包

- R3.1 / R3.2 约 1.03 GB 全量重启 ZIP；
- 完整无损 DEM 归档；
- 历史固定网页版本；
- WorldCover / JRC / OSM / SoilGrids 永久证据 ZIP；
- 当前浏览器 `.i16le / .u8 / .u16le / .wzdem2 / .bundle` 等二进制栅格/载荷；
- Windows Python wheels 和其它离线依赖；
- 已失效的 full-handoff 构建器和 PACKAGE_TRIGGER。

这些内容不是删除真值，而是退出活动随身工作集。需要恢复时必须使用固定 Git commit、Release tag、asset 名、bytes 与 SHA-256 精确取回。

## 为什么旧包会膨胀到约 2.05 GB

旧链路先完整解压 R3.2 的约 1.03 GB 重启底座，再叠加 R3.3–R3.8 的运行/浏览器数据、records 和 tools。R3.2 自身又继承 R3.1 的约 1.03 GB 底座。与此同时旧 ZIP 构建器把 `.zip / .whl / .gz / .wzdem2 / .i16 / .i16le / .u8 / .u16le / .bundle` 设为 `ZIP_STORED`，二进制基本原尺寸写入，因此新增六层 SoilProfile 等载荷会直接推高包体积。

这个“历史整包 + 当前增量继续叠加”的滚雪球方式已经停止。

## 关于两个土壤二进制声部

每个 SoilGrids `property × depth` 的两个 payload 是：

- `Q0.5`：属性中位预测值；
- `uncertainty`：模型相对不确定性。

两者哈希、单位、统计语义不同，不是重复。当前不删除任何一个。后续若要继续压缩运行载荷，应通过双通道容器、分块、量化或其它可验证编码方案实现，而不是丢弃 uncertainty。

## 体积门

轻量交接包唯一未压缩内容硬上限为 8 MiB；ZIP 本体同样必须 <= 8 MiB。超过即构建失败，不允许继续滚雪球。

首次实测轻量构建（workflow run `34744411363`，源提交 `86bf8d2d6b6e931ac68069923e727c3763cbe16a`）：

- ZIP：66,663 bytes；
- 逻辑未压缩内容：164,686 bytes；
- 唯一未压缩内容：164,686 bytes；
- 逻辑文件：32；唯一文件：32；重复 alias：0；
- 未嵌入 full restart base、永久证据 ZIP 或浏览器二进制载荷；
- 构建、ZIP 完整性、体积门和去重门全部通过。

这说明当前活动随身工作集内部已经没有同内容重复副本；旧包的大体积主要来自历史全量底座和二进制运行载荷被反复搬运。

## 冷档案

历史 Release 与固定已验证提交继续永久保留，不覆盖、不删除；它们只不再随每次交接重复搬运。
