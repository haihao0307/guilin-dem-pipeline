# Coral Mother R07-P09 共享壁 Voronoi 珊瑚杯

- 已发布 P08 作为失败证据保留：它取消了纬线，但只读取最近中心，默认 Microscope RMS 仅约 0.0012，视觉变化太弱，也没有真正共享壁。
- P09 从干净 P07 母体重新构建，不覆盖 P08 证据。
- 黄金角半球站点加入各向同性切平面扰动、半径差异、深度差异与相位差异。
- 每个表面点同时读取最近与次近站点，次近距离参与共享壁形成。
- 杯坑、杯缘、共享壁、六向细微隔片全部整合进同一母体网格，不增加吸盘式独立圆片。
- Microscope 变化前后顶点数和三角形数保持不变。
- NOAA 分类保持 Hard / stony coral → Massive coral。
- Palau 群岛区域出现证据已关闭；Airai / Stone Money Island 局地投放仍未关闭。
- visualAcceptance=false；productionReady=false。

# Coral Mother R07-P09 整合式不规则珊瑚杯

- P07 的明确失败：杯体沿纬向排成规则行列，大小重复，并像粘在表面的独立圆环。
- P09 不再生成独立杯体网格，而是在 192×384 母体表面上直接执行法线位移。
- 站点采用黄金角半球分布，并加入各向同性切平面扰动、尺寸差异、深度差异和相位差异。
- 最近与次近站点共同形成不规则杯坑、杯缘、共享壁和细微隔片；没有纬向 band 生成器。
- 所有 Microscope 形体与母体共用顶点和法线，避免悬浮甜甜圈和底面穿插。
- NOAA 分类保持 Hard / stony coral → Massive coral。
- NOAA NCEI 只关闭帕劳群岛区域出现证据；Airai / Stone Money Island 局地投放仍未解决。
- visualAcceptance=false；productionReady=false。
