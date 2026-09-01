# Ocean Mother 启动入口：Weather Mother Clean V1.0.0

本文件补充交接定位信息，解决新窗口无法取得 ZIP 附件实体时的读取问题。它不修改冻结压缩包、不修改天气渲染内核，也不代表海洋系统已完成。

## 核验结果

2026-09-01，交付窗口实际读取并解压 Weather_Mother_Clean_V1.0.0.zip。ZIP 为 37,906 bytes，SHA256 为：

```
596b963fef0cc2eafe7855178ae9f93c3e2aef2b78bdf98dd5e9e49c1a443bae
```

CRC 检查通过；包内共 12 个文件。MANIFEST.json 列出的另外 11 个文件逐项通过字节数与 SHA256 校验。OCEAN_HANDOFF.md 和 HANDOFF.json 已从包中按原字节单独提取，未改写其内容。

这只证明交付窗口已取得有效文件，不能证明另一个对话窗口已经挂载同一附件。

## 仓库读取定位

仓库：haihao0307/guilin-dem-pipeline

发布分支：gh-pages

已核验能够读取该交付版本的固定提交：

```
2619725efe236d2df8f2a55031bdae9e60a51555
```

这个提交用于定位发布文件，不应标注为所有运行代码最初生成的提交。

按顺序读取：

```
weather-mother/clean-v1/OCEAN_HANDOFF.md
weather-mother/clean-v1/HANDOFF.json
weather-mother/clean-v1/MANIFEST.json
weather-mother/clean-v1/README.md
```

然后按 HANDOFF.json 和 MANIFEST.json 读取同目录的六个运行文件：

```
index.html
engine.js
field-worker.js
cloud.glsl
motion.js
reuse.js
```

GitHub 连接器可使用 fetch_file，并明确提供 repository_full_name、path 和上面的 ref。不要省略 ref 后只检索仓库默认分支。读取仓库文本不等于 ZIP 已下载或解压，交接进度须分别陈述。

## 旧字段的定位说明

原包 HANDOFF.json 中的 repositoryReadRef 为 329670eea20d008189d0dce68d16899e667d8baf。它记录清理前所用的仓库读取基线，不包含后来发布的 clean-v1 目录。实际测试在该旧 ref 读取 weather-mother/clean-v1/OCEAN_HANDOFF.md 返回 404。

sourceCommit 为 bf2aaa5d853af4f114c68d5bbafb99ea47134ef5，表示 V062 渲染基线。它同样不应用来定位新 clean-v1 交付目录。完整交付定位使用本文件给出的 2619725efe236d2df8f2a55031bdae9e60a51555；来源与运行合同仍以原包文件为准。

## ZIP 与校验收据

同一固定提交中：

```
weather-mother/distributions/Weather_Mother_Clean_V1.0.0.zip
weather-mother/distributions/Weather_Mother_Clean_V1.0.0.receipt.json
```

ZIP 根目录为 Weather_Mother_Clean_V1.0.0/，启动说明位于该根目录下。用户端文件名附带 (1) 时仍须按上述字节数与哈希核验，不凭文件名认定内容相同。

可由支持二进制下载的工具取得固定 ZIP：

```
https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/2619725efe236d2df8f2a55031bdae9e60a51555/weather-mother/distributions/Weather_Mother_Clean_V1.0.0.zip
```

文本读取接口无法直接解压二进制时，先读取已发布的启动文件和代码即可继续交接核对。只有真正取得文件实体、列出包内路径并完成校验后，才报告已解压。

## 本次接续范围

Ocean Mother 以这套干净天气内核作为上游输入。先完整读取 OCEAN_HANDOFF.md，再读 HANDOFF.json；维持十种云属、八种天气案例、循环形态、独立风力与云速和原光照体系。

已提供 getConfiguration、applyConfiguration、getEnvironment。海洋侧后续可读取共享时钟、日照和风数据。单位约定、坐标轴和接入边界以 OCEAN_HANDOFF.md 原文为准。

本包没有海浪、泡沫、潮汐、海水光学、海底、共享深度或水天反射系统。七彩云、台风和重做闪电实验不属于本交付。不要借附件问题重新替换天气内核或导入其他生产线旧版本。

先报告真实已读文件、版本与尚未读取的部分，再在海洋生产线中继续执行任务。若具体读取失败，记录工具、ref、路径和返回错误。
