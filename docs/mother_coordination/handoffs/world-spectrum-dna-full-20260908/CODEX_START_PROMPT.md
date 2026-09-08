# 给 Codex 的启动指令

你现在位于 `haihao0307/guilin-dem-pipeline` 的 `handoff/world-spectrum-dna-r01-20260908`。

先完整读取：

`docs/mother_coordination/handoffs/world-spectrum-dna-full-20260908/START_HERE.md`

随后运行 `RESTORE_PACKAGE.py`，按恢复包中的 START_HERE 顺序读完本包。不要直接进入任何生产线。

第一阶段任务：

1. 运行 `python -m unittest prototype/test_wsd_reference.py -v`。
2. 检查 `prototype/wsd_reference.py` 的格式与数学语义，修复真实错误，但不要擅自扩大承诺。
3. 在独立实验目录建立 256×256 或更小的 DEM 谱分解实验。
4. 至少实现一个可分离低秩基线，一个局部谱页基线，一个受坡度或曲率控制的 Ridged 细节候选。
5. 报告 RMSE、最大绝对误差、坡度误差、山脊位置误差、水文方向变化和实际字节数。
6. 验证 B24、M2、机匣、枪管、螺丝的父链位姿合成和 detach 事件。
7. 完善 WSD0 二进制容器，但保持旧测试可回放。
8. 所有结果写入本目录下的新 `codex_r01` 子目录。
9. 只提交研究与实验，不连接生产运行时。
10. 完成后更新 `CURRENT_STATE.json`，生成固定提交和可核验清单。

必须保留的边界：

传统经纬度和投影坐标只作为外部资料转换器。核心地址候选不使用度或弧度。球面拓扑必须通过谱页或同等严格的方法处理。复杂区域允许增加声部和残差。任何压缩率、全球唯一性和生产可用性都必须由实验支持。