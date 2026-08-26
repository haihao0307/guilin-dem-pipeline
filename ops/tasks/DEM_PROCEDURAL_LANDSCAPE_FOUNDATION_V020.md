# 程序化地貌生产线基础实现 v0.2 执行任务

## 工作目标

在现有技能分支和 Draft PR #51 上，把 v0.2 生产纲领转化为机器可读合同、validator、项目绑定和统一状态网页。当前阶段只建立可执行基础设施，不改动任何权威 DEM、海底、潮汐、水系、道路、聚落、机场或历史真值。

## 仓库与分支

```text
repository: haihao0307/guilin-dem-pipeline
branch: skill/dem-procedural-landscape-v010
Draft PR: 51
base: skill/dem-ecology-surface-v050
```

开始时重新确认远端 PR #51 head。若 head 已变化，从最新远端 head 建立干净工作树并正常快进。

保持 PR open、Draft、未合并。禁止强推、改写历史、修改 `main`、`gh-pages` 和其他项目 PR。

## 开始时读取

```text
skills/dem-procedural-landscape/SKILL.md
skills/dem-procedural-landscape/PRODUCTION_DOCTRINE.md
skills/dem-procedural-landscape/BRANCH_REGISTRY.json
skills/dem-procedural-landscape/branches/guilin-10km2-detail/SKILL.md
skills/dem-procedural-landscape/branches/terrain-geomorphology/SKILL.md
skills/dem-procedural-landscape/branches/water-system/SKILL.md
skills/dem-procedural-landscape/branches/ecology-agriculture/SKILL.md
skills/dem-procedural-landscape/branches/historical-reconstruction/SKILL.md
skills/dem-procedural-landscape/branches/runtime-publication/SKILL.md
projects/guilin/config/procedural_landscape_binding_v010.json
projects/wenzhou/config/procedural_landscape_water_binding_v010.json
```

## 第一阶段，建立 schema

新增版本化 schema，至少覆盖：

```text
branch registry
project binding
truth source manifest
terrain derivative manifest
procedural delta manifest
historical evidence manifest
water field manifest
runtime build manifest
QA manifest
release and rollback manifest
```

所有 schema 要求来源状态、CRS、transform、分辨率、单位、垂直基准、NoData、覆盖、校验和、父级掩膜、可逆性和运行时角色。

缺失字段使用明确状态。禁止填造数据以通过 schema。

## 第二阶段，validator

实现无网络依赖的 validator。

最低验证：

```text
branch ID 唯一
registry 路径存在
技能版本一致
项目绑定指向存在的分支
城市数据没有跨项目误引用
真值层不可逆修改标记为 false
所有程序化层具有 parent mask
所有增量具有最大值和 rollback
1 m 历史输出具有 native1mSurveyClaim=false
ASF RTC 12.5 m 输出具有 native12_5mSurveyClaim=false
公开候选具有 browser QA 和 rollback
```

提供单元测试和故意失败的夹具，确保 fail closed。

## 第三阶段，项目绑定

为桂林、温州和昆明建立或补齐机器可读绑定。

要求：

```text
只写合同和来源状态
不复制城市坐标和数据
不把桂林代理高程传播到其他城市
不把温州海岸、水深、潮汐传播到内陆项目
不把现代土地利用静默写入历史项目
```

每个绑定列出已具备、缺失、阻塞和下一步。

## 第四阶段，统一状态网页

建立直接打开的静态页面，例如：

```text
web/procedural-landscape-skill/index.html
```

页面从 manifest 动态显示：

```text
生产线版本
负责人小王
分支结构
项目绑定
真值状态
程序化增量状态
历史重建状态
水体状态
GAEA 构建状态
浏览器 QA
在线候选
回滚版本
当前阻塞
```

页面只做技能和状态审查，不加载大型 DEM。不得写死虚假通过状态。

## 第五阶段，CI 和证据

增加：

```text
JSON schema validation
validator tests
registry path checks
Markdown link checks
static page smoke test
desktop browser screenshot
390 × 844 screenshot
console error check
```

每个工作流使用真实执行结果。被跳过的 job 不计通过。

## 交付

```text
schema 文件
validator 和测试
项目绑定
统一状态网页
浏览器截图
QA manifest
HANDOFF_DEM_PROCEDURAL_LANDSCAPE_FOUNDATION_V020.md
```

交接文件记录：

```text
开始 head
最终 head
提交列表
文件清单
测试命令和结果
浏览器证据
在线候选
当前阻塞
回滚方式
下一任务
```

## 事实边界

```text
技能合同完成不等于地形数据完成
schema 通过不等于浏览器视觉通过
浏览器页面打开不等于真实 DEM 已挂载
程序化候选不等于历史真值
视觉水面不等于水动力模型
```

保持 Draft，等待用户审阅。
