# 分形造波树综合工作台 R01

## 这次合并的准确含义

KuKo Day 123 老师没有被改写，也没有被拿来替代 Tree Life R05。新的综合工作台把两个 Grammar Anchor 放在同一个可打开界面中：

- `mobile-r05-seasons/` 继续负责三维 Seed、Root、Trunk、Branch、Leaf、生命阶段和环境约束。
- `kuko-day123-branching-r01/` 继续负责原样演奏二维分枝老师。
- 根目录 `index.html` 新增并排听音、模式切换、知识映射和分枝谱地址解码器。

## 已经真正学会并抽出的声部

1. `TOTAL / BR / off / dec / path`：把枝号解码为每层的分枝选择。
2. `R() × disp()`：用局部变换链表达分枝走向。
3. `sdCylinder + min()`：用距离场查询枝段与叶端并集。
4. `c += off - 1; break`：一次跳过不可能命中的整组后代。
5. `wind0 / wind1`：把不同相位插入具体语法节点，而不是整体移动最终画面。

综合工作台中的“分枝谱地址解码器”直接运行第一项逻辑。它不是图片注释：选择中央、左、右老师树和任意枝号，可以现场看到对应的基数路径。

## 仍然不能混淆的边界

- 二维 SDF 结果不证明三维几何、连接、半径、受力或生物正确性。
- KuKo 风相位目前只是节点运动相位；进入三维树以后必须接受力传导与连续性验证。
- Tree Life R05 的 Root/Shoot 分工、生命历史和器官生成规则继续作为树的主锚点。
- 后续生产合并必须另开实验声部，并与两个冻结老师并排回归，不能直接覆盖锚点。

## 当前入口

- 综合工作台：`kaopu-tree-fractal-wave-lab/`
- Tree Life R05：`kaopu-tree-fractal-wave-lab/mobile-r05-seasons/`
- KuKo Day 123：`kaopu-tree-fractal-wave-lab/kuko-day123-branching-r01/`
