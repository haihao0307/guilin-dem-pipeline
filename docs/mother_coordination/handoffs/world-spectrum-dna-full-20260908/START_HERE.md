# 世界谱 DNA 全量交接包 R0.1

日期：2026-09-08

Repository：`haihao0307/guilin-dem-pipeline`

工作分支：`handoff/world-spectrum-dna-r01-20260908`

基线提交：`f35e3f264157171af93183834f5b00d2ebb99365`

本目录是本轮“世界谱坐标、时间、Object DNA、父子关系、自适应地球压缩与 WSD 文件格式”讨论的 Codex 续作入口。当前内容属于候选研究架构，不接入任何生产内核，也不声明已经取代测地学、传统坐标系统或既有 DEM 真值。

## Codex 立即开始

先运行：

```bash
cd docs/mother_coordination/handoffs/world-spectrum-dna-full-20260908
python RESTORE_PACKAGE.py
```

脚本会按顺序拼接 `archive_parts/`，校验 ZIP 的 SHA-256，然后解压到：

```text
restored/World_Spectrum_DNA_Full_Handoff_R0.1_2026-09-08/
```

随后读取：

```text
restored/World_Spectrum_DNA_Full_Handoff_R0.1_2026-09-08/START_HERE.md
```

并执行：

```bash
cd restored/World_Spectrum_DNA_Full_Handoff_R0.1_2026-09-08
python -m unittest prototype/test_wsd_reference.py -v
```

预期为 9 项测试全部通过。

## 无需解包即可先读

本目录同时直接放置以下关键文件，方便 Codex 立即理解任务：

1. `AGENTS.md`
2. `CODEX_START_PROMPT.md`
3. `CURRENT_STATE.json`
4. `FULL_DISCUSSION_LEDGER_CN.md`
5. `NEXT_TASKS.md`

完整架构文档、schema、示例、实验计划、原型和测试都在恢复后的文本与代码全量包里。

## 核心提案

```text
World = Decode(Time, SpectralLocation, Level, ObjectDNA, State, History)
```

候选地表地址：

```text
EarthLocation = (earth_id, atlas_page, u_phase, v_phase)
```

候选地表高度：

```text
H(u,v,t) = H0 + sum(lambda_k * X_k(u,t) * Y_k(v,t)) + residual
```

候选子对象位姿：

```text
WorldPose(child,t) = WorldPose(parent,t) composed LocalPose(child,parent,t)
```

传统经纬度、投影坐标、DEM、卫星资料、OSM 与引擎 XYZ 在 R0.1 中保留为边界转换接口。核心身份候选采用整数谱相位、谱页、时间、对象 ID 和具名父子路径。

## 包边界

GitHub 中的可恢复归档包含全部文本、代码、schema、示例和测试。用户提供的三张原始参考图保留在本轮本地完整 ZIP 中；归档内保存参考说明、来源状态与原始资产哈希。由于当前 GitHub 连接器不能直接上传本地二进制图片，本分支没有把图片字节伪装成已推送资产。

任何后续生产接入必须先读取目标生产线最新 HEAD、冻结真值和最后有效用户要求，再在独立实验中验证。