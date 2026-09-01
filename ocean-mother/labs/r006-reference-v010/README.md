# R006 数值与几何参考小样 0.1.0

这些模块为独立 CPU 研究实现，不接入 coast-v010，不替换冻结天气或深海。不包含图片贴图、外部网格或渲染器。原始官方技术资料的索引见 ../../research/R006_READING_LEDGER.json。

运行 Node 测试：

```sh
node --test ocean-mother/labs/r006-reference-v010/reference.test.mjs
node ocean-mother/labs/r006-reference-v010/audit-baseline.mjs ocean-mother/coast-v010 /tmp/ocean-r006-audit.json
```

审计脚本先核对四份基线字节身份；不匹配立即退出，避免把后续版本当旧版。几何捕获运行的是精确源码中的两个 CPU 函数，GL buffer adapter 仅收集顶点与索引，不产生浏览器运行证据。

## 粒网传递

particle-transfer.mjs 实现有质量权重的 P2G 和 PIC/FLIP G2P：

```text
v_pic = I(u_new, particlePosition)
v_flip = v_particle + I(u_new - u_old, particlePosition)
v_next = (1 - flipFraction) * v_pic + flipFraction * v_flip
```

这里的 I 使用本线三线性插值。flipFraction=0 为 PIC，1 为 FLIP，参数方向由此文件明确规定。不得未经核对直接等同于外部界面滑杆。没有占据场生成、速度外推、自由表面、重播、移动碰撞体或粒子推进。本模块独立测试传递关系，不宣称已经组成完整 FLIP 求解器。边缘权重重归一化不等同于碰撞。

## 压力投影

pressure-projection.mjs 在三维交错 MAC 网格上实现静止闭域参考，采用常密度和对角预条件共轭梯度。假设每个有效单元为完整液体单元；无效单元和域外均为静止固体。

```text
A = -D G
b = -(rho / dt) D u_star
A p = b
u_next = u_star - (dt / rho) G p
```

离散梯度 G 与散度 D 使用同一面邻接和间距。每个连通域设置独立零均值压力规范；检查闭域兼容条件。新速度的实际最大散度通过后才返回 accepted=true，失败不返回供调用方误用的部分速度。任何输入缓冲均不修改。

位置/间距 m，速度 m/s，时间 s，密度 kg/m³，压力 Pa，散度 1/s。这里只测压力约束，未做时间积分收敛、自由表面、开放边界、燃烧膨胀、粘度或化学。未实现官方文档所述多重网格内部方法；此处 PCG 是独立参考选择。

## 封闭结构

boundary-geometry.mjs 从同一顶部边缘顶点构造侧面与底面。inspectClosedMesh 检查开边、非流形边、朝向、退化三角与有向体积。它只诊断网格，不证明防穿透或水量守恒。

fracture-solid.mjs 使用有限半空间交集生成凸体。geometry 与内外判定共享平面；signed half-space constraint 在外部角点处并非精确距离。这个模块没有损伤演化、地质标定或视觉批准。不能直接把底件数量和多面体闭合当成写实岩石验收。

## 实际证据边界

23 项测试覆盖本参考模块。BASELINE_AND_REFERENCE.json 另记录旧版缺陷复现、原尺寸默认水体的 12 秒探针、扩大面积的 2 秒探针和新封闭床面。软件测试未包含新的浏览器、实际用户设备或帧率。总体水量误差不能替代边界和形状检查。

当前结果均为本地执行，远端自动运行状态由专属工作流另记。自动通过与人工视觉/生产批准分开。visualApproved=false；productionApproved=false。
