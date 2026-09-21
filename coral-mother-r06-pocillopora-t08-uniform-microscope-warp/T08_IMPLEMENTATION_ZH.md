# Coral Mother R06-T08 实现回执

- 默认显示统一为单一物种主色；枝序多色只在显式诊断模式出现。
- Microscope 覆盖全部连续管环，管环由 10 边提高到 18 边，路径采样由 3 提高到 5。
- 位移后使用环向与纵向切线重算法线，不再沿用未位移径向法线。
- Warp 使用共享世界坐标场，连续影响中心线、接点、枝端和疣突。
- 细枝仍补齐至共同附着根，禁止悬空枝进入网格。
- 运行时保持 0 GLB、0 外部贴图、0 fetch。
- visualAcceptance=false；productionReady=false。
