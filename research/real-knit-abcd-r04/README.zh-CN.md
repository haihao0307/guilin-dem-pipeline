# KAOPU 原针织 R04：A / E / F 实时交互对照

公网交互入口：/guilin-dem-pipeline/research/real-knit-abcd-r04/

## 使用对象
使用 KaoPu-Engine main 固定版本 603682e1c1aa86323154038ccfc7215833afcda9 中的 P02 C2 原针织函数、SourceKnit / SourceFibres、完整纤维 BVH 与原材质后端。28×54 针，每针 960 根原始纤维，理论人口 1,451,520 根。AA4、纱线与纤维求解预算不变。

## 三组
- A：原版 BVH 节点相交。每个节点查询时计算视线方向、远端角点深度及 padding。
- E：仅 Shader 改动。把全局 padding 提升为每像素一次计算，节点循环读取该像素结果。
- F：引擎与 Shader 联合。引擎按当前相机、实例局部坐标和模板整体 bounds，每次 camera/instance draw 预计算一个保守 padding 标量并上传；Shader 节点循环只读取 uniform。

三组保持同一纱线曲线、BVH、根数、AA、求解迭代和材质。A/E/F 只改变 padding 的计算位置，不减少纤维、纹理分辨率或画面尺寸。

## 页面操作
切换 A/E/F；整片、近景、斜视、背面；拖动旋转、滚轮缩放、连续旋转；运行 15 个交错配对帧并导出 JSON。报告设备 renderer 字符串、完成帧墙钟时间、P50/P95 和字段差异。

## 测量边界
页面测的是 GPU 完成后的浏览器墙钟时间，不是 GPU timestamp-query 的纯内核耗时；会包含 CPU encode/upload、GPU queue 和完成等待。不同设备不可直接比较。首轮准备/编译单独发生，不计入稳定配对样本。若设备不支持 float render target 或 WebGL2，页面明确报错，不切换截图冒充实时渲染。

本页是原 KaoPu WebGL2 布片后端的隔离实验，不是 WebGPU 移植，也不代表完整衣服/人物已通过。完整绒毛世界阴影与布料物理不在本次验收范围。任何候选只有在多视角正确性、用户硬件性能与原生产线回归通过后，才可考虑进入默认路径。
