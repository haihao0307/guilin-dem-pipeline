# Coral Mother R07-P12 测地半球表皮

- P11 的 Microscope 和非 RGB 光照信号都有效，但经纬网格在穹顶附近把局部杯体拉成长条。
- P12 用八级细分八面体测地半球取代经纬表皮：穹顶只有一个顶点，不存在经线汇聚重复点。
- 三角形在半球上近似均匀，Microscope 杯坑、杯缘、共享壁和隔片不再继承经纬方向。
- Poisson 站点、真实法线位移、统一 RGB 主色和非 RGB 局部光照信号继续保留。
- 底部边界按方位角排序并向下封口，保持固定附着基底。
- visualAcceptance=false；productionReady=false。
