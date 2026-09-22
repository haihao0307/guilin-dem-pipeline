# Fish Mother 最新统一方向与执行基线

日期：2026-09-22  
适用范围：Ocean Life Mother → Fish Mother  
当前实例：Yellowfin tuna / `Thunnus albacares`  
当前执行分支：`work/ocean-life-fish-mother-yellowfin-biological-correction-r001-20260921`

本文件是 Fish Mother 当前唯一的方向同步文档。后续对话、执行窗口和交接包必须先读本文件，再读具体实例的状态文件。旧文件中与本文件冲突的“继续找模型”“重新从通用鱼开始”“把单一 Tuna 模型当公共母体”等表述停止生效。

## 一、先纠正三个容易继续犯的错误

### 1. Original Fish 不是一条通用模型

Original Fish 是所有典型硬骨鱼共享的数学、测量和关系语言，不是一只可以复制到所有物种上的“通用鱼 GLB”。

公共主干描述的是：

- 统一纵轴 `u = 0..1`
- 背部曲线、腹部曲线
- 左右宽度谱与剖面尺度
- 眼、嘴、鳃、鳍、骨骼等语义锚点
- TL / FL / SL 长度合同
- 年龄、尺寸、形态、颜色、栖息深度、食物、捕食和行为关系

每一个鱼种仍然是独立实例分支。Yellowfin、Clownfish、Largemouth Bass 等不能互相冒充，也不能用同一网格简单换色。

### 2. “Source Copy 完成”不等于“黄鳍金枪鱼完成”

Source Copy 的任务是忠实保存来源模型的几何、蒙皮、材质和动作，使后续修正有稳定输入。它不是黄鳍金枪鱼自然形态真值。

当前冻结输入：

- commit：`9b610f4ef0134e015c2fb6b14574e7e4f48ed943`
- SHA-256：`2130a3c03fc50d22676919c3599e75707e61d9f75ddd90523a6897887715ec02`
- 状态：immutable

禁止在冻结 Source Copy 上原地改写。

### 3. 机器门禁通过不等于视觉批准

Candidate B 已通过浏览器机器门禁，但当前仍然：

- `manualVisualAcceptancePending = true`
- `productionReady = false`

必须继续看实际轮廓、鳍根、眼眶和游动形变，不能因为数字落入窗口就宣布完成。

## 二、不可变的生产原则

Fish Mother 是执行生产线，不是自由创作平台。

固定方法：

`自然事实 → 完整观察 → 记录 → 测量 → 统一尺度与坐标 → 函数/关系 → 高保真复刻 → 误差修正 → 反向验证`

执行约束：

- 只学习、观察、测量和抄样板
- 不自由发挥，不凭想象补解剖
- 缺精确参考时停门禁，不用通用鱼替代
- 不删除用户原图、原模型、有效证据、Bird 资产或干净交接
- 不回到 N02 玩具鱼、低维 Tuna 或已拒绝的旧生成路线
- 不以数量、颜色、特效或复杂 UI 代替参考忠实度
- 每个阶段都要保留失败证据，不能只留成功截图

## 三、Original Fish 第一阶段合同

典型 Original Fish 第一阶段至少具备：

- 眼
- 嘴
- 鳍
- 尾巴
- 默认硬骨鱼骨架关系

生长尺度合同：

- `< 20 mm`：当前不生产，游戏中通常不可见
- `20–30 mm`：可见边缘，只建立必要合同
- `30–100 mm`：当前生长生产重点
- 只有一个真实测量点时禁止插值
- 至少两个真实锚点后才允许在已知区间插值
- `UNKNOWN` 不得自动补值
- 长大不是简单等比 `scale`
- 眼、骨、刺、鳍和体型必须允许随阶段改变
- 顶视宽度未知时不得宣称 `full3D = true`

已存在的可用事实包括统一 `u` 轴与测量内核、71 mm TL 小丑鱼测量卡，以及 20.82–34.50 mm 的连续实测段；这些属于公共测量主干，不应直接覆盖当前成年 Yellowfin Candidate B。

## 四、Yellowfin 当前真实进度

### 已完成

- 精确 Tuna 来源已从临时来源投入生产
- 高分辨率来源对象身份已验证
- Source Copy R001 已冻结
- 13 个语义区域、6,920 个语义面、98 根骨骼、蒙皮、材质和 `Swim` 动画已保留
- Candidate A 已生成并完成机器 QA
- Candidate A 已因视觉错误正式拒绝
- Candidate B 已生成
- Candidate B 已通过 17 张固定浏览器证据与 5 个同步 `Swim` 采样
- Console errors = 0
- Page errors = 0

### Candidate A 拒绝原因

Candidate A 把第一背鳍后部组件 2 和 4误认成第二背鳍并放大，产生额外矩形大帆。这个结果即使机器通过也不能进入下一阶段。

### Candidate B 当前参数

- SHA-256：`f36f8f034a9ea864c6050f3c0eda3629a201e0917ded9a631f2584be3cadbcbc`
- 最大体深：约 `0.2850 FL`
- 胸鳍长度：约 `0.2400 FL`
- 真第二背鳍高度：约 `0.1800 FL`
- 臀鳍高度：约 `0.1800 FL`
- 第一背鳍组件：保留 `0、3、2、4`
- 真第二背鳍组件：`1`
- 尾鳍未独立缩放
- 小鳍数量未改变
- 原 98 根骨骼、逆绑定矩阵和动画访问器保留

### 尚未批准的视觉问题

- 头部仍偏圆、偏厚
- 眼睛相对头部偏大
- 第一背鳍仍有整片塑料板感
- 第一背鳍与背部过渡不够自然
- 胸鳍和臀鳍根部像附着片，尚未真正长入身体
- 眼球、角膜和眼眶需近景检查是否悬浮或穿插
- 五个 `Swim` 采样仍需逐帧看局部拉扯

## 五、当前唯一允许的执行任务

继续从 Candidate B 收敛，不另找模型，不回退 Candidate A，不重做 Source Copy。

执行顺序：

1. 收头部体积与眼睛比例
2. 收第一背鳍完整轮廓与根部过渡
3. 修胸鳍根部
4. 修臀鳍根部和自由边
5. 固定眼球与透明角膜贴合
6. 在 5 个同步 `Swim` 时间点检查并修正局部拉伸
7. 重新输出侧视、三分之四、顶视、正视、背鳍近景、胸鳍近景和叠加证据
8. 浏览器 Console 0 errors
9. 浏览器 Page errors 0
10. 等待明确人工视觉批准后，才允许 `productionReady = true`

## 六、工作台与交付合同

稳定项目入口：

`apps/ocean-life-mother/fish-mother/index.html`

实例入口：

`apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/index.html`

两级入口都必须指向当前 Candidate B 三维 QA 工作台，不能再让使用者猜文件名。

最终验收不是“仓库里有 HTML”，而是：

- 一个固定公开网址
- 一按直接进入三维页面
- 不下载 ZIP
- 不要求解压
- 不经过 ChatGPT 中转
- 页面可见
- 控制台 0 错误
- 当前模型、分支、SHA 和阶段在页面中可核对

目前仓库内稳定入口已补齐，但在公开 Pages 部署和公网浏览器验证完成前，不能宣称“一按即开在线交付”已经关闭。

## 七、项目结构关系

- Original Fish：公共数学与测量主干
- Yellowfin：独立物种实例分支
- Frozen Source Copy：不可变输入
- Biological Correction：在冻结输入之外独立迭代
- Candidate A：失败证据，永久保留
- Candidate B：当前活动候选
- 后续 Candidate：只能在 Candidate B 明确问题基础上继续，不得另起无关路线

## 八、当前状态一句话

Fish Mother 已经结束“找鱼”和“复刻源鱼”的阶段，正在执行 Yellowfin Candidate B 的人工视觉收敛；机器验收已通过，但头眼、第一背鳍、鳍根、角膜贴合和游动局部形变尚未获得人工批准。
