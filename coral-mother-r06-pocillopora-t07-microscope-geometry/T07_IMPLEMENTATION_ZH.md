# Coral Mother R06-T07 实现回执

- Microscope 凹凸进入连续管环真实顶点位移。
- 三频带：杯体、杯缘／细脊、骨骼颗粒。
- 表面起伏改为中尺度轮廓位移。
- 枝端钝化控制连续闭合长度与半径保持曲线，不增加球帽。
- 附着根由枝序、半径、基底高度和拓扑度联合识别；细枝筛选后执行 BFS，只生成 root-connected 路径、节点和疣突。
- 运行时保持 0 GLB、0 外部贴图、0 fetch。
- visualAcceptance=false；productionReady=false。
