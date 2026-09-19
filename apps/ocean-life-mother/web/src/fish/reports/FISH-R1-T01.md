# FISH-R1-T01｜黑鲈结构修正任务：输入与运行门禁回执

- 日期：2026-09-19
- 执行分支起点：`handoff/ocean-life-fish-mother-clean-r02-20260919`
- 起点提交：`11970757e0233f31446ed399257de1dd4bdf1c00`
- 新指令固定提交：`c4b634bd9ca5a84335ea57ce1b092ec9ee5e15b4`
- 目标鱼：`FISH-REF-001` 大口黑鲈
- 本轮唯一缺陷：头—口结构关系；现有历史候选中的口裂、上下颌与头颅/眼眶关系仍是通用简化关系，未完成源约束绑定。
- 当前结论：`BLOCKED_AT_SOURCE_AND_REFERENCE_GATE`

## 1. 实际读取

已从固定提交读取 `ops/mother_execution/fish_restart_20260919/FISH_MOTHER_EXECUTION_ORDER_R1_ZH.md`。

已核对干净交接分支的实际 HEAD 为 `11970757e0233f31446ed399257de1dd4bdf1c00`，并读取：

- `apps/ocean-life-mother/CLEAN_START_HERE.md`
- `apps/ocean-life-mother/handoff-clean-20260919/OCEAN_LIFE_FISH_MOTHER_MASTER_HANDOFF.md`
- `apps/ocean-life-mother/handoff-clean-20260919/OCEAN_LIFE_FISH_MOTHER_全量知识交接.md`
- `apps/ocean-life-mother/handoff-clean-20260919/REFERENCE_MATERIALS_FULL_INDEX.md`
- `apps/ocean-life-mother/handoff-clean-20260919/EXECUTION_ONLY_CHARTER.md`
- `apps/ocean-life-mother/handoff-clean-20260919/CLEAN_RESTART_CHECKLIST.md`
- `apps/ocean-life-mother/handoff-clean-20260919/PACKAGE_MANIFEST.json`
- `apps/ocean-life-mother/r02/README.md`
- `apps/ocean-life-mother/r02/index.html`
- `apps/ocean-life-mother/r00/references/fish/REFERENCE_INDEX.json`

适用 `AGENTS.md` 核对：仓库根、`apps/ocean-life-mother/` 及该子树未找到适用文件；未自行假设不存在的额外规则。

只读追溯了旧生产检查点中的：

- `apps/ocean-life-mother/reference-intake/FISH-REF-001/APPEARANCE_CORRECTION.md`
- `apps/ocean-life-mother/r03-study/RUN5_ANATOMY.md`

它们只作为失败/研究证据，没有恢复 N02，也没有把旧研究候选导入干净基线。

## 2. 干净分支实际封版与处置表

| 对象 | 处置 | 结果 |
|---|---|---|
| R00/R01/R02 真实运行依赖 | `KEEP` | 保留，未修改 |
| Bird 入口与 R02 成果 | `KEEP` | 保留，未修改 |
| Coral、Ocean、Game Mother | `KEEP / OUT_OF_SCOPE` | 未修改 |
| 完整交接、参考索引、失败证据 | `KEEP` | 保留 |
| N02 通用玩具鱼、其发布入口与默认效力 | `REJECTED_EXCLUDE` | 干净分支中未发现；未为“清理”而重建 |
| 旧 `reference-intake`、R03 研究文档 | `ARCHIVE_REFERENCE` | 只读追溯，不作为生产依赖 |
| 可重建缓存 | `DELETE_REPRODUCIBLE_CACHE` | 未发现明确可删对象，因此没有删除 |

没有整库清空、没有历史重写、没有强推、没有删除用户原图/模型/视频/索引/R02/Bird/其他 Mother 成果。

## 3. 源码门禁

新指令指定的四个输入在干净分支 HEAD 的完整应用子树中不存在，逐路径读取均为 `404 Not Found`：

1. `apps/ocean-life-mother/web/src/fish/renderers/blackBassFish.js`
2. `apps/ocean-life-mother/web/src/fish/styles.css`
3. `apps/ocean-life-mother/web/src/fish/main.js`
4. `apps/ocean-life-mother/docs/species-geometry-cards/black-bass-card-r1.md`

`blackBassFish.js` 还在以下位置做了额外查找，均未找到：

- 固定指令提交 `c4b634bd9ca5a84335ea57ce1b092ec9ee5e15b4`
- `ocean-life-fish-mother-full-package-20260919`
- 旧生产分支 `work/ocean-life-mother-r00-20260918`
- GitHub 默认分支代码搜索

因此当前没有合法可修改的黑鲈原生渲染器。直接从 R02 通用鱼另造一个外形，会重复被拒绝的通用鱼路线，不能算 FISH-R1-T01。

## 4. 参考门禁

以下指令指定参考位置在干净分支 HEAD 均不存在：

- `apps/ocean-life-mother/assets/incoming/user-ref-fish/20260912/`
- `apps/ocean-life-mother/assets/incoming/demo3d-fish-dev/`
- `apps/ocean-life-mother/docs/USER_REF_DOMAIN_AND_FALLBACK_EVIDENCE_R1.md`
- `apps/ocean-life-mother/refs/ASSET_INDEX.md`
- `apps/ocean-life-mother/refs/REFERENCE_SOURCE_INVENTORY.md`

记录中的精确参考身份仍保留：

- 文件：`model_67a_-_largemouth_bass(1).glb` / 同哈希命名变体
- SHA-256：`c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64`
- 记录大小：18,644,040 bytes
- 用途：仅参考研究，不作为最终原生运行资产

本轮实际可读输入只有用户上传的 `OCEAN_LIFE_FISH_MOTHER_FULL_PACKAGE.zip`；其 SHA-256 为 `c13d4ffd024ce5b73b63fd9e3e45fb945f2184d3acbd29240d2dedc1c808940d`，ZIP 内仅一份 26,553-byte Markdown：`OCEAN_LIFE_FISH_MOTHER_FULL_HANDOFF.md`，没有 GLB、图片、视频、原生源码或运行依赖。

已对当前会话文件与 File Library 使用精确文件名、`FISH-REF-001`、完整 SHA、`largemouth bass glb`、`blackBassFish.js`、`FISH-R1-T01` 等查询；没有得到可读的目标 GLB 或目标源码。不能把“曾上传/曾解析/已有索引”误当成“当前原始字节可读”。

## 5. 第一条实际运行命令与结果

在只放入从 GitHub 读取到的精确 R02 `index.html` 的本地审计目录执行：

```bash
python3 -m http.server 4173 --bind 127.0.0.1 \
  --directory /mnt/data/fish_r1_t01_audit/apps/ocean-life-mother
```

结果：

```text
GET /r02/index.html                     -> HTTP 200, 3998 bytes
GET /r00/payload/payload-00.txt         -> HTTP 404, File not found
```

R02 的 `index.html` 会继续请求 R00 六个 payload、R01 两个 bundle 以及 R02 脚本/JSON；上传包未携带这些文件，所以当前本地包不能启动完整工作台。

随后尝试用受管 Chromium 打开同一地址，导航被环境策略拦截：

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

这不是浏览器画面通过，也不是代码失败结论；它只记录当前执行环境不能做本地浏览器导航。HTTP 入口和首个依赖结果如上，均为实际运行结果。

## 6. 本轮状态分离

| 维度 | 状态 | 证据 |
|---|---|---|
| 代码 | `BLOCKED` | 目标四个源码输入不存在；没有伪造替代实现 |
| 数值 | `NOT_RUN` | 没有可读黑鲈函数与精确参考，不能测量头口关系或误差 |
| 视觉 | `NOT_PRODUCED` | 没有合法 before/after，未以源模型渲染冒充原生成果 |
| 用户接受 | `NOT_REQUESTED` | 没有候选可供视觉验收 |
| 发布 | `NOT_ATTEMPTED` | 未获发布授权，也没有可发布候选 |

## 7. 停止原因与最小解除条件

当前若继续实现，只能在没有目标源码、没有精确参考字节、没有固定对照证据的情况下猜测黑鲈形体。这会把“记录存在”错误等同于“可验证输入存在”，并会再次生成通用鱼；因此按执行章程与 clean restart checklist 停在输入门禁。

解除 FISH-R1-T01 阻塞只需要补齐以下最小输入，不需要用户重讲全部需求：

1. 指令中四个原生源码文件所在的合法提交/分支，或将它们补入当前干净分支；
2. SHA 为 `c1b964...ee64` 的 FISH-REF-001 原始字节，或经过小妈明确批准、足以验证同一头口缺陷的固定视角回退证据；
3. 与上述 `web/src/fish` 对应的真实安装/启动/测试依赖及命令。

金枪鱼 `FISH-REF-002` 队列保持不变，没有取消或替代。
