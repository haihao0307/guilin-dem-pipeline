# 世界谱 DNA R0.1 推送回执

日期：2026-09-08

仓库：`haihao0307/guilin-dem-pipeline`

分支：`handoff/world-spectrum-dna-r01-20260908`

基线提交：`f35e3f264157171af93183834f5b00d2ebb99365`

已核验的载荷提交：`c00db9a0a3c3c575bd9a8bd624a130a149ec7932`

入口：`docs/mother_coordination/handoffs/world-spectrum-dna-full-20260908/START_HERE.md`

## Codex 启动

```bash
cd docs/mother_coordination/handoffs/world-spectrum-dna-full-20260908
python RESTORE_PACKAGE.py
```

恢复后：

```bash
cd restored/World_Spectrum_DNA_Full_Handoff_R0.1_2026-09-08
python -m unittest prototype/test_wsd_reference.py -v
```

## GitHub 载荷核验

GitHub 中的文本与代码归档由 10 个 Base64 分块组成。所有分块的远端 Git blob SHA-1 与字节数均已和本地生成的精确文件逐项比对，10 项全部一致。被替代的错误分块已经删除。

恢复后的 ZIP：

```text
World_Spectrum_DNA_Text_Code_Handoff_R0.1_2026-09-08.zip
```

大小：`40649 bytes`

SHA-256：

```text
afd1081baa6964a4a97945521cb0cb8c520886bd259500073a0957c839ce426a
```

ZIP 共 29 项文本、源码、schema、示例和测试文件。恢复脚本已通过分块哈希、归档哈希、ZIP CRC、安全路径解包和必需文件检查。

## 原型测试

共运行 9 项，全部通过：

1. WSD0 容器往返。
2. 容器哈希失败检测。
3. 示例文档打包。
4. 对象图循环检测。
5. detach 事件。
6. 父链位姿合成。
7. 确定性谱高度。
8. 局部连续性。
9. 相位环绕。

## 包含范围

本包保存了本轮完整讨论纪要、世界谱坐标宪章、数学模型、Time 与 Object 谱系、父子关系、WSD 二进制格式草案、自适应地球压缩、人与智能体共享地址语法、来源与证据台账、DEM 与对象图实验计划、JSON schema、Earth 与 B24/M2 示例、Python 原型、测试和 Codex 启动规则。

## 完整本地包

本地完整 ZIP：

```text
World_Spectrum_DNA_Full_Handoff_R0.1_2026-09-08.zip
```

大小：`4596862 bytes`

SHA-256：

```text
ea3b091f8c07f334a14fb8cd3875a3afb3c510c9596cf7ee97402973832d439a
```

该包包含用户提供的三张原始参考图。当前 GitHub 连接器无法直接上传本地二进制图片，因此 GitHub 分支保存完整文本、源码、schema、示例与测试，并在资料台账中保存三张图片的身份与哈希。原始图片字节保留在聊天中交付的完整 ZIP 内。

## 状态边界

当前是候选研究架构。尚未接入生产内核，尚未证明全球交点唯一，也没有作出取代测地学、固定压缩率、视觉通过或生产就绪的声明。Codex 应在独立实验里继续验证。