# Blue Coral A04 一比一高维函数表达状态

**日期：2026-09-23**  
**阶段：ONE_TO_ONE_HIGH_DIMENSIONAL_FUNCTION_EXPRESSION_GEOMETRY_CORE**  
**状态：LOCAL_RUNTIME_READY / ONLINE_BINARY_BINDING_PENDING**

## 权威边界

- 只使用用户在本轮重新提供的 `blue_coral.zip`。
- 不恢复旧 Coral 分支、旧模型或旧分析结果。
- 不改变小妈规定的方法顺序。
- 本轮只关闭一比一高维函数表达的几何核心，不进入结构语法或最终 Coral Generator。

## 已完成的真实产物

1. 从老师原始数据建立独立 `teacher fields`，保留：
   - 9 个技术原语；
   - 582,034 条 POSITION 顶点记录；
   - 3,000,000 个索引；
   - 1,000,000 个三角面。
2. `BCP1` 位置函数字段：有符号定点整数 + zigzag delta varint + gzip。回解为 Float32 后与老师 POSITION 逐位一致。
3. `BCI1` 拓扑函数字段：逐三角局部差分 varint + gzip。回解后全部索引一致。
4. 浏览器右侧通过 `position(i,c)` 与 `triangle(i,c)` 独立编译另一套 GPU 缓冲；不调用 GLTFLoader，不 clone 老师对象，不读取 GLB 或贴图。
5. 同一相机、同一尺度进行左右对照；右侧材质参数只作用于函数回解对象。
6. 桌面 1200×900 与 390×844 WebGL2 实际载入通过；初始运行未观察到 console error 或 page error。

## 精确证明

- POSITION bit mismatch：0
- index mismatch：0
- max position error：0 scanner unit
- removed vertex records：0
- removed triangles：0
- removed primitives：0
- simplification / decimation / remesh / voxel / Marching Cubes / surface projection：全部 false
- runtime GLB dependency：false
- runtime texture dependency：false
- clone teacher object：false

## 当前没有冒充完成的范围

- UV 字段尚未绑定；
- 老师原始法线字段尚未绑定，A04 从精确几何重算法线；
- 健康活体组织、健康水下颜色和最终材质不属于本轮扫描标本几何门禁；
- 用户视觉批准仍为 false；
- 固定一按直开在线入口尚未发布，因为两个精确二进制字段尚未绑定到公共托管路径。

在公网字段未实际发布前，不得把 A04 写成“在线交付完成”。下一执行动作仍在同一获准路线内补齐字段托管和在线入口，不得转向网格简化、体素替代或低维代理。