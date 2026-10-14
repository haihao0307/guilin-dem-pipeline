# MP05-GPU-R02 · 最新人物与 GPU 试衣开发候选

最新人物、原生走跑跳、EB1 1.1.0 和 GPU 物理候选已接入。**快速运动接触稳定性和 60 Hz 目标仍未完成。**

本地服装入口：http://127.0.0.1:8897/MP05-Continuous-Demand-R01/candidate/

集合页已接入本轮候选，原完整文件保存在同目录带 R01_保留 标记的备份；`?clothing=legacy` 可打开原服装版本。鞋帽内嵌数据保持原字节。

候选说明见 [candidate/README.md](candidate/README.md)，核对记录见 [qa/R02_SUMMARY.json](qa/R02_SUMMARY.json)、[qa/r02-final.json](qa/r02-final.json)、[qa/r02-actions.json](qa/r02-actions.json)。持续测试三轮各 60 秒，整页约 29 帧/秒，真实模拟推进速度约钟表的 48%；不能称为已解决性能目标。

本轮没有合并主分支。基线和旧候选保留，来源与发布状态见 [RELEASE_STATUS.json](RELEASE_STATUS.json)。
