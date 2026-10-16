# 88号陆港铁路 R08 · 原游戏控制与同行视角

独立候选，R06/R07保留。沿用原 GrandLoco 和完整 GrandCoach，不接入独立 A6 新壳。

- 使用原陆港铁路公司 151 个轮廓制作加载封面，显示实际阶段及等待时间。不是恢复整张旧封面，也不代表冷启动性能已达标。
- 原 120Hz DrivingPhysics、汽门、制动、档位、暂停和整列轨端保护继续驱动。预排汽3秒、柔起步6秒为本版可调游戏参数；在原固定步内采样，暂停冻结全部物理时间和蒸汽。
- 加速、减速、按住制动、停车、原汽门/制动滑块、惰行、紧急制动均接实际控制。W/↑、S/↓、Space可用。
- 原“到站后开门接送”约束已找回，但本地图中心轨没有贴邻站台，门动画与乘客服务尚未接齐。按钮明确禁用，没有模拟成功的上下客。
- 六个同行机位：车侧、附着车头向前看轨道、驾驶室侧窗前望、机车内部、车厢内、车尾后视；另保留原自由跟车和整图。机车内部是现有驾驶舱/后火箱同一真实舱室的另一眼点。
- 主蒸汽来自原双中空嘴，侧排汽来自原母体声明的左右 drain 接口。384粒单draw，时间由同一物理快照提供；是视觉效果，未解算流体或屋顶碰撞。
- 横版布局将工程诊断折入主动开启的设置。窄屏仍可操作，并提示横置；不强制旋转画布而损坏原指针映射。

## 保留范围

完整4节客车共享原938396三角源，原1197网格与312实例内容转为14批；无删几何。车厢轮子转动仍未接独立轮轴动力学。1–8节参数继续保留，长编组不能冒充旧站客运适配。

地形、海岸封闭面、真实弯曲隧道/门户、642个历史证据灰建筑候选均沿R07逐字节保留。红磡2m/5m局部块继续排除，那里显示30m背景并标待补。地形完整大小见 terrain-kaopu/CURRENT-RELEASE.json；本版没有额外学习模型。

建筑仍未全九龙覆盖、未接真实纹理；历史证据不证明每栋1997外形。站场、平台、地理线路及桥隧仍含此前明确的候选限制。

## 验证

本地固定步、原母体几何、相机眼位及补丁合同通过；真实浏览器记录另见 evidence。CPU通过不能代表视觉通过。使用同一只读GitHub Actions流程检查真实启动、暂停、排汽、起步、全部视角与隧道同行；软件GPU时间不能代表用户硬件性能。

Steam visibility correction: the authored shader now applies the retained renderer output color space. Main opacity and paired-drain cloud opacity/radius are moderately strengthened; original outlets, timing, full train geometry, depth testing, 384-particle capacity and one draw are unchanged. Real station columns still occlude steam. Targeted close-view captures complement the default side-view evidence; this is not fluid/roof collision simulation.
