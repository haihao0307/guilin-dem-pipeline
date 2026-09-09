# 小温州 R3.1 全量重启包

当前已完成海域裁切、河流线位、瓯江/飞云江/鳌江名称和近景。公网已验证。

- [R3.1 固定公网三维预览](https://wenzhou-3d-lab-r3-20260909.sunhaihao.chatgpt.site/r3-1/)
- [R3 固定历史预览](https://wenzhou-3d-lab-r3-20260909.sunhaihao.chatgpt.site/r3/)

重启后的新任务先读取本文件、AGENTS.md、两个 Mother 规则原件，以及 records/R3_1/KNOWLEDGE_APPLICATION_R3_1.md。下一阶段是用户提出的离地 1.6 米人眼视角；尚未实施，不要声称现有 DEM 有米级精度。继续温州自身工作，不介入其他项目清理。

## 包含什么

site 是完整静态网页及本次源码、锁定依赖、两版数据和部署配置；inputs/canonical-dem 包含完整无损 DEM 归档和索引；inputs/hydro 包含实际使用的全球海岸 ZIP 和原始河流 GeoJSON；inputs/knowledge-r2-2 是测量与知识交换资料；records 包含小妈知识原件、全部本次验证、来源与交付回执；source-tools 保留本次新写的生产脚本；history/site-source-r3-1.bundle 保留 Sites 项目 Git 历史；release 是已验证的静态发布压缩包。

不含撤销的旧资产生产技能、旧渲染器或旧恢复流程。河流 GeoJSON 仅为有来源的原始地图观测，不是旧生产代码。全球海岸 ZIP 用于精确恢复输入，不进入网页下载。

没有把 708 MB 临时解码格网和已有机器的虚拟环境当成持久事实打包：解码可由完整归档无损恢复；Windows x64 / Python 3.12 的依赖 wheel 已放在 wheelhouse。其他平台需按 requirements.txt 安装对应依赖。Python 解释器本身需在新环境提供。

## 恢复与验证

下载 GitHub Release 中的完整 ZIP 后解压。Git 分支浏览页只提供源码和交接资料；大体积原始输入与离线依赖以完整 ZIP 为准，不能只下载分支源码便声称全量恢复。

1. 使用 Python 3.12：`python tools/verify_package.py`，核对 MANIFEST.json 中每个文件的长度和 SHA-256。
2. 建立新环境：`python -m venv .venv`。
3. Windows 离线安装：`.venv\Scripts\python -m pip install --no-index --find-links wheelhouse -r requirements.txt`。
4. 无损解码检查：`.venv\Scripts\python tools/rebuild.py --decode-only`。
5. 如需从原始输入重建：`.venv\Scripts\python tools/rebuild.py`。输出仅进入 rebuild-work，不覆盖 site 中已固定公开版本。路径自动从解压目录解析，不依赖原来的 G 盘路径。

正常查看继续使用上面的固定公网地址。开发时可在 site/dist 启动 HTTP 服务，但本地页面不作为最终交付。下一版须新建版本路径，保留 /r3/ 与 /r3-1/，实际打开公网检查后才交付。

## 重要事实

DEM 格距 12.5 米，来源信息尺度约 30 米，垂直基准和独立实测误差未确认。海岸为 OSM/FOSSGIS 地图陆地区域，不是即时潮位；河流为 2026-08 混合归档，非完整实时水系，水位/河宽/河床/物理连接未知。持久测量、参考架、区域和曲线规则与临时显示缓冲分开。

Sites 项目 ID：appgprj_6aa11b8bd13c8191a106022056f525e0。已发布源码：d3036588b07ce932c15b2d9bcab1355687b96c1d。小妈知识协作任务：01a07ac3-5002-7a81-b768-427659c37230。无需把其他项目清理重新设成温州停工条件。已完成的跟进 automation-2 处于暂停，不重复创建。

## 来源与许可

OSM 地图资料 © OpenStreetMap contributors，ODbL 1.0；海岸预处理来自 https://osmdata.openstreetmap.de/data/land-polygons.html 。Three.js 的 MIT LICENSE 随 site/dist/vendor 保存。原 DEM 的已知来源与未知项以归档索引及 records 为准，不新增未证实的测绘精度或许可断言。
