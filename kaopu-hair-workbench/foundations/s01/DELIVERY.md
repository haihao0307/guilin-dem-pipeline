# HAIR-FOUNDATION-S01 — 已完成固定公网技术验证，待发线视觉验收

https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/foundations/s01-031d9bb80ed5/

原生 GNM 中性头与原三角索引；独立可编辑生长蒙版和密度；稳定根点池；逐片元生长域显示与根点判定同源；边界、距离、根点、法线短针、测试切向与同拓扑形变检查；表面画笔、撤销重做、本机保存/读取及严格 JSON 导入导出。旧 L03、人物总台和其他工作台不改，PR250保持Draft，未合并、未强推。

源码：031d9bb80ed5e52001cec51053e8f769d8c8a81c
构建：ed3526a11f06af03d09b4758d96ecf7c4f925694
Pages：4fd26afd38420ff542beda5dfc00bbab3cd93870
站点树：20cacb572c7c194ba353016f0c65896ccbdfb669
公网 Actions：38374070137

检查：{"unit": 25, "candidate": 34, "public": 34}。原生公网和候选的资源逐项 SHA/体积匹配；实际操作视角、显示、密度、短针、形变、根点拾取、画笔、撤销、存档、下载、无效导入、刷新和手机视口面板。无 JavaScript / 控制台着色器错误。

默认诊断：{"revision": 0, "candidateRoots": 20789, "activeRoots": 6158, "areaCm2": 590.1308463369991, "domainFaces": 4210, "boundarySegments": 282, "outsideRoots": 0, "maxBarycentricSumError": 4.470348358154297e-08, "rootBindingHash": "43c554a8e2f700da", "maskHash": "3a48a84f", "rootCountIsBiological": false, "distanceMethod": "mesh-edge Dijkstra approximation", "spacingMethod": "surface chord hard-core rejection", "draws": 1, "visibleHeadMeshes": 1, "positionHash": "6487401f", "source": "031d9bb80ed5e52001cec51053e8f769d8c8a81c", "geometryBytes": 425796, "hasFullHair": false}

初始发线仍是作者候选，不是已确认的真实个人发线。6158个激活点和20789个候选点不代表生物毛囊总数。边路径距离与弦距间隔是近似；形变只验证同拓扑。没有完整头发、独立生长方向/冠旋、长度场或物理。手机仅视口，窄屏需缩小视图，不是实机性能。不能把这个较轻的诊断页当作L03完整发型性能优化。

下一步：先视觉校准额角、耳周、后颈和密度，再建独立初始倾角/切向方向与冠旋，之后长度场及稀疏导向；最后才回到密发、材质和物理。
