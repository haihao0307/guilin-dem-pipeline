# Weather Mother V1.1 跨项目启动入口

本入口用于压缩包附件未挂载时，通过 GitHub 找到同一份干净交付物。

仓库：haihao0307/guilin-dem-pipeline

固定读取 ref：0303d499ebba7e7ddcfa105124c29087b9e421b2

依次读取：

```text
weather-mother/clean-v110/START_HERE.md
weather-mother/clean-v110/HANDOFF.json
weather-mother/clean-v110/INTEGRATION.md
weather-mother/clean-v110/MANIFEST.json
```

压缩包位置：weather-mother/distributions/Weather_Mother_Full_Clean_V1.1.0.zip

ZIP 字节数：46075

ZIP SHA256：ac1cd919b007eff60f2288106ca32cb8ff7f96ea8e02e52cec16d8045bb6ae6e

12 个文件，解压 113538 字节，包含一套完整天气运行器。当前实际打包检查 42 项通过；五个计算文件保持上游字节，HTML 仅修复可选光影页链接。公开访问结果以同目录最新 receipt.json 为准。

不要把旧 Clean V1.0 的 getEnvironment/getConfiguration/applyConfiguration API 当成此包已具备的接口。按本包 INTEGRATION.md 的真实接口接入。独立启动已验证，目标项目的共享场景、海洋反射和时钟耦合仍需接收方实现并验证。

原始天气运行发布 ref 为 fa75a338f406bebfefa3ea0458366831fef7de48，原始证据 ref 为 970aa25814e5d5f98cf10091da69666f62dbcd28。这两个 ref 用于读取上游 v110-full，不用于查找后来发布的 clean-v110。

只读取、修改接收项目已授权的目录。原 Clean V1.0、既有在线入口和其他 Mother 保持不动。人工视觉、生产和最终 3A 批准继续为 false。
