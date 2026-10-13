# HAIR-FOUNDATION-S01 — 固定公网已验证，待发线视觉验收

https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/foundations/s01-e45d8da17e81/

本轮实际完成：原生头部上的独立生长蒙版与密度场、稳定根点绑定、边界/距离/根点/法线诊断、同拓扑变形压力测试、局部增减生长区域与密度、撤销重做、本机保存读取及严格JSON导入导出。画笔修正版要求默认一次点按真正移除激活根点，并在真实画布中产生变化；随后补回、撤销和密度编辑验证通过。

源码 e45d8da17e81417ff5a378d3b6ba1749a671a82c
构建 45e36ef453dd5209c671683802b3bf844be85683
Pages fbd4d05610101a2338514389519c77115a60dd06
站点树 9a8bca876af8ccaff6ee89f0eb667b60e87dc582
公网任务 38375901663

检查：{"unit": 25, "brush": 5, "candidate": 37, "public": 37}。所有列举检查通过，但部分范围重叠，不相加冒充独立场景。公网逐项核对实际运行资源SHA和体积；冷启动、六视角、字段显示、密度、短针、绑定变形、点选、擦除/补回/密度画笔、撤销、存档、下载、无效导入、刷新、手机视口面板通过，无JS/控制台着色器错误。

实际公网默认状态：{"revision": 0, "candidateRoots": 20789, "activeRoots": 6158, "areaCm2": 590.1308463369991, "domainFaces": 4210, "boundarySegments": 282, "outsideRoots": 0, "maxBarycentricSumError": 4.470348358154297e-08, "rootBindingHash": "43c554a8e2f700da", "maskHash": "3a48a84f", "rootCountIsBiological": false, "distanceMethod": "mesh-edge Dijkstra approximation", "spacingMethod": "surface chord hard-core rejection", "draws": 1, "visibleHeadMeshes": 1, "positionHash": "6487401f", "source": "e45d8da17e81417ff5a378d3b6ba1749a671a82c", "geometryBytes": 425796, "hasFullHair": false}
画笔检查：{"name": "Actual surface brush removes roots and preserves bindings", "pass": true, "detail": {"before": 6158, "after": 6143}}

6158个激活点与20789个候选点仅为诊断采样，不代表真实毛囊总数。初始发际线是可编辑作者候选，额角、耳周、后颈仍须人物特定校准；没有宣称医学分区。灰模沿用原GNM中性几何和三角索引，不替换ET18正式头部材质。距离是网格边路径近似，间距是弦距；形变仅同拓扑横向压力测试。法线短针与测试切向不是完整头发或正确生长场。没有完整发型、冠旋生长解算、长度场、动力学或衣物碰撞。

手机只有390×844视口，不是实机；窄屏可能需缩小视图。此页不生成原64k完整发丝，不能将其轻量速度当成L03完整工作台的加速证明。本机存档不自动进入总台SharedWorker。旧L03与所有以前版本及其他工作台保留，PR250保持Draft，未合并、未强推。

下一方向：先校准发际线与局部密度；S02分离根部倾角/切向场并建立可调冠旋；S03独立弧长场和稀疏导向；之后才加入密集跟随发、发束、材质与物理。
