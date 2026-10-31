# KAOPU Learning Flywheel N222 — 同函数类不等于实例结果可整体复用

## 唯一 bounded question

100 个对象使用同一个解析函数时，能否把“函数与阳光的作用”只算一次，并把总求值量降到原来的 `1/100`？

## 当前基线与真实缺口

- 当前 `main`：`4f59489d3a399034e82190cae9b41d3e92a5942b`。
- 根 `AGENTS`、R2 OS、参考复刻门禁、新鲜度门禁 blob 未变。
- #91 最新 N221 只证明 WebGPU 可以用 compute storage texture 直接写 canvas，且明确留下 shared function-class evaluation、lighting、visibility 与 no-per-object-intersection 未验证。
- 本轮未发现 Mechanical/Motor Mother 对 N218–N221 的 ACK、production gate-run 或 adopted 回执。

## 结论

`REJECT_FUNCTION_CLASS_IDENTITY_AS_TOTAL_INSTANCE_EVALUATION_COLLAPSE`

同函数类可以复用：

1. 函数定义与编译后的 evaluator；
2. 完全相同的系数/参数块；
3. canonical trimmed domain 与 patch topology；
4. canonical sample 参数相同时的函数值及内在导数。

但以下量默认仍与实例有关：

1. world-to-object 查询变换、bounds/culling 和候选实例集合；
2. world hit 与 hit ordering；
3. 经 inverse-transpose normal transform 得到的 world normal；
4. light/view vector；
5. visibility、occlusion、shadow；
6. final shading/radiance。

因此合法优化是“同函数类批处理 + 明确等价类内的有界复用”，不是仅凭 `functionClassId` 把所有实例的世界命中、法线、可见性和最终光照折叠成一次。

## 最小反例

同一 canonical normal、同一函数定义、100 个实例：

- 绕 Y 轴分布旋转，固定方向光下 diffuse 从 0 到 1；一个最终光照值不能复用。
- 只平移但使用点光源，光向量与 diffuse 随位置变化。
- 非均匀缩放必须用 inverse-transpose 变换 normal；canonical normal 不能直接当所有实例的 world normal。
- 50 个实例可见、50 个被遮挡时，同函数类不能共享一个 visibility 值。

有界正控：只平移、同朝向、同材质、同 canonical sample、常量方向光、排除视角/遮挡/阴影的 unshadowed diffuse 可以共享。这证明本轮不是禁止复用，而是要求写出复用成立的精确不变量。

首次 checker run 为 `10/11`：非均匀缩放反例的实际 world-normal L2 差为 `0.485969`，但探针把证据阈值误写成 `>0.5`。分类器已经正确拒绝，失败只来自测试阈值。阈值修正为仍显著且保守的 `>0.4` 后重新运行；没有降低分类门槛。

## Candidate 转译

新增 Candidate regression：

`FUNCTION-CLASS-SHARING-NOT-TOTAL-INSTANCE-COLLAPSE-001`

Task Anchor / Delivery Receipt 需要把：

- function class/definition/parameter/domain/sample digests；
- instance/inverse/normal transforms；
- material/light/view/visibility subjects；
- equivalence partition 与每个 shared quantity 的 invariance proof；
- compiled evaluator、canonical sample argument、instance transform、visibility 与 shading 的计数

分别记账。不得用 `compiledEvaluatorCount=1` 冒充 `totalEvaluationCount=1`。

## 状态与边界

- 外部老师：本轮未进入 audition；数学变换反例已足够反驳一般化的 `1/N` 结论。
- 当前仅为 synthetic Candidate checker；没有跑 KAOPU production renderer、浏览器、GPU 性能、画质或用户验收。
- 不修改 main、生产 Mother、R2 或全局门禁。
- KPI：unknown。
