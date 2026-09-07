# 小温州 DEM Kernel R1 开工入口

日期：2026年9月7日

工作分支：`feature/wenzhou-dem-clean-kernel-r1`

固定基线：`df58a6413a8615b47214602fa482f0a88befcbb6`

小妈任务包：`3eb58693235505b9bb35dbb340c1cfd3007b8e01` 中的 `WENZHOU_DEM_CLEAN_SYSTEM_R1.md`

## 当前已经完成

1. 已从 V0.6.0 固定基线建立隔离分支，冻结分支、公开工作台和真值文件均未修改。
2. 已提交 `KEEP / ARCHIVE / DROP` 资产去留清单。清单控制新的活动依赖图，不执行历史删除。
3. 已建立新的 `CONTRACT.json`，锁定 17 片 COG 身份、温州与桂林数据隔离、垂直基准阻塞和停止条件。
4. 已实现整数到整数 CDF 5/3 lifting 二维可逆变换、独立 NoData 掩膜、完整容器哈希校验和指定细节频带归零重构。
5. 已完成生成整数夹具的数学探针。它只证明列明数组上的可逆性和完整性检查，不能证明真实温州压缩率。
6. 已建立真实窗口探针。它会拒绝普通数组，必须读取绑定固定 COG、整数窗口和载荷哈希的 `wenzhou-dem-real-window/v1` 清单。

## 当前硬阻塞

完整 COG 仍未挂载。仓库活动树中也没有可直接复用且带完整像元范围与载荷哈希的 R12/R13 原始窗口。因此真实温州探针保持 `blocked`，严禁用生成数据顶替。

## 读取顺序

1. `CONTRACT.json`
2. `qa/KEEP_ARCHIVE_DROP_R1.json`
3. `qa/REAL_WINDOW_STATUS_R1.json`
4. `transform/reversible_cdf53.py`
5. `transform/probe_real_window.py`
6. `qa/MATH_PROBE_RESULTS_R1.json`
7. `tests/test_reversible_cdf53.py`

## 重复数学检查

```bash
python -m unittest discover \
  -s projects/wenzhou/dem-kernel/tests \
  -p 'test_*.py' -v

python projects/wenzhou/dem-kernel/transform/math_probe.py \
  --output projects/wenzhou/dem-kernel/qa/MATH_PROBE_RESULTS_R1.json
```

## 真实窗口到位后的第一条命令

先从 `truth/REAL_WINDOW_MANIFEST_TEMPLATE.json` 生成经过核验的 `REAL_WINDOW_MANIFEST.json`，随后运行：

```bash
python projects/wenzhou/dem-kernel/transform/probe_real_window.py \
  --manifest projects/wenzhou/dem-kernel/truth/REAL_WINDOW_MANIFEST.json \
  --output projects/wenzhou/dem-kernel/qa/REAL_WINDOW_PROBE_R1.json
```

探针必须先验证固定 COG 身份、窗口边界、Int16、NoData、载荷字节数和 SHA256。逐像元零误差、NoData 完全一致以后，才允许讨论压缩率和局部频带选择。

## 下一工作

第一优先级是找回 R12/R13 实际使用的原始 12.5 米窗口及其像元范围和哈希。找不到时继续等待固定 COG 挂载，再从通过预检的 COG 裁切新的整数像元窗口。

随后补点、线、掩膜约束包，测峰顶、鞍部、山脊、谷线、河岸、海岸与共享边。任何一项结构门禁失败，当前候选编码停止升级。

当前状态：`mathProbePassed=true`，`realSourceProbePassed=false`，`productionIntegration=false`，`visualAcceptance=false`，`productionReady=false`。

## 全量包检查点以后重新开工

全量重启包已经在提交 `c3ff8622b2e7ae753e0a1b519cc302505e1e16c2` 固定。该包保存本轮重新开工以前的完整代码、合同、任务知识、测试、QA、清单与校验文件。

重新开工后的第一项实现是 `runtime/observation_policy.py`。它把视觉、交互、物理、故事和安全需求统一换算成最大允许采样间距，始终由最严格需求决定可关闭的细节频带。`forceTruth=true` 时保留全部频带，相机只改变观察请求。

生成夹具检查暴露了一个必须保护的问题。当前无损容器在变换前将 NoData 位置填零，并用独立位掩膜恢复语义。完整往返安全，关闭细节频带时，零填充值可能影响相邻有效高程。因此 R1 对任何含 NoData 的变换瓦片启用 `nodata_guard`，直接保留全部频带。只有真实温州窗口上的掩膜感知方法通过以后，才允许解除该保护。

重新执行观察策略检查：

```bash
python projects/wenzhou/dem-kernel/runtime/observation_policy_probe.py \
  --output projects/wenzhou/dem-kernel/qa/OBSERVATION_POLICY_PROBE_R1.json
```

当前这项证据只来自生成整数夹具。视觉阈值、真实压缩收益、岸线与脊谷保持、浏览器和 GPU 成本仍等待真实温州窗口。
