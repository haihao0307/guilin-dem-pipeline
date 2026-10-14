# 人物总平台 · 整合审核版

公开入口：[打开人物总平台](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/ab499da18b1da1e256cd66e35ec1212183c58028/kaopu-unified-human-workbench/review-platform-r01-20261014/preview.html)。本机入口为 http://127.0.0.1:8893/，使用已经下载校验的资源，不需要浏览器再访问模型下载站。

界面只保留预设、观察、保存和审核功能；数值调整面板已隐藏。

- 六款原创头脸，统一眼周、鼻唇、耳部和眉毛。
- 四款眼色、三款眉毛、三款嘴唇与四款体型预设。
- 六种基础肤质，可组合自然肌理、柔透组织、薄肤微脉三种组织质感。
- 毛孔微起伏、漫反射柔透、淡淡皮下色泽；毛孔近看和皮下微脉观察入口。
- 正面、斜侧、左右侧、眼周、嘴唇、耳部、全身观察；按需自然待机。
- 人物存档往返、实际 PNG 下载与审核要求记录下载。

`preview.html` 与 `platform.html` 是同字节完整构建网页，保留固定上游资源地址。`npm install` 后运行 `npm run build` 可从同目录源码重新构建。`review-server.cjs` 为原工作区的本机缓存审核入口，依赖已校验的 `asset-cache`；缓存不重复提交到仓库。公开网页直接读取已固定的上游资源。

用户已明确授权将这一版网页及配套代码公开发布，采用独立整合分支；固定网页地址与提交以交付记录为准。原发布入口保留。

模块来源、整合边界、许可、研究依据与运行方式见 [SOURCES.md](SOURCES.md)。最终实测报告以 `qa-local-*.json` 和 `qa-tissue-*.json` 为准；更早的下载限额失败记录单独保留。测试通过不代表用户已经完成美术验收。
