# KAOPU Mother 每日协调会有限纪要

日期：2026-10-03（北京时间）  
实际核心核查：02:30:28–02:35:02（4分34秒；完成即结束，未凑时）  
唯一问题：Wet Stone Material R04 是否已经具备跨 Mother 生产复用资格？  
实际 Mother 参与：0；没有取得新的 ACK、采用或用户验收回执。

## 1. 会前读取与新鲜度

- 当前 `main@93630d823e99ba79f6a5d452aef986a18ed2f500`；相对上一轮 main 有真实 Material 生产增量。
- 根 `AGENTS.md`、R2 Production OS、Reference Replication Gate、Freshness Gate 的 SHA-256 与上一轮逐字回读版本相同：`d836c5… / c9d1ec… / 7bbed7… / eb7c91…`，继续作为强制协议。
- #91 最新仍为 N56（shorts 定向），本题没有新的 Mother 回流；#63 最新仍为 N49 Coast 公网运行证据，不与 Material 结果混用。
- R03 teacher-copy 基线提交：`e74603c8890d06126aaefd6e8b1cbd238f2cc6ac`。
- R04 生产提交：`d3e97f4aaf03bd9c511544c6b2babb9e94e50020`；main 上复核记录：`93630d823e99ba79f6a5d452aef986a18ed2f500`；gh-pages 发布提交：`8c05ca08e93722d7296b5e1ea91a95c12a784f8f`。

## 2. 当前最好事实

1. R04 是用户授权的衍生实验，不是未经授权的创作替代：十种配色、裂纹、青苔与 PBR 研究均有当前指令来源。
2. 颜色与几何没有混写：仅换配色时白模几何保持不变。
3. 裂纹深度、青苔厚度通过 `heightDelta(p)` 进入 `surfaceField(p)`，参与 raymarch 表面求交；在当前隐式石头运行体内属于真实可见表面位移，不只是底色或法线假凹凸。
4. 老师原有高频颗粒仍是 normal-only；R04 文档已诚实区分，不能把它宣传为全部 Microscope 几何化。
5. QA 记录十色、六种状态、七观察通道、谱往返、WebGL2 错误码、390px 无横向溢出；Pages workflow 成功。但运行证据来自本地 Chromium/Xvfb/SwiftShader，未完成最终公网浏览器端到端、物理设备、目标 GPU FPS 或用户视觉验收。
6. R04 保留 TDM / Alexander Alekseev《Wet stone》CC BY-NC-SA 3.0 老师源码与衍生许可。它可以继续作为非商业学习样件，不能直接晋级为商业游戏的通用材质生产父节点。

## 3. R2 九项核对（责任端：Material execution line）

| 项目 | 当前可证状态 |
|---|---|
| 1. 唯一 taskId / targetObject / targetDefect | `MATERIAL-001-R04` 只存在于材质谱，不是正式 R2 Task Anchor。目标可读为 Wet Stone 的十色、六状态、几何裂/苔与 GGX；正式 taskId 仍缺。 |
| 2. accepted baseline / baseSha | 用户曾明确对 R03 材质满意；R03 源提交为 `e74603c8…`，老师片元 SHA-256 为 `f03a5c…`。但缺把用户接受与 baseSha 绑定的正式 receipt。 |
| 3. 用户最后约束 | 保留满意的 R03，新增十种颜色、裂纹、青苔和 PBR 学习；学习方法，不把单个 Wet Stone 样件冒充万能材质系统。 |
| 4. referenceSet / UNKNOWN | 老师视频与 `teacher.frag` 已固定；真实岩石物性、米制尺度、水膜、生态苔藓、商用授权均 `UNKNOWN / NOT_GRANTED`。 |
| 5. forbidden routes | 禁止把 normal-only 高频写成几何；禁止以当前归一化石头外推所有对象；禁止未解决 NC-SA 权利边界即进入商业 Game；禁止 Producer 自批。 |
| 6. fresh head delta | 有：R04 五个运行文件、QA 与复核文档均产生于本轮；不是旧页面重发。 |
| 7. regression cases | 没有专门的 Material 授权/许可回归案例；通用 Freshness 与 Scope 门适用。当前无需为了数量重复建 case。 |
| 8. machine / reference / browser gates | machine 部分通过；reference 仅保留 R03 老师基线与几何消融；standalone `file://`、最终公网浏览器、物理设备、性能与独立 verifier 未通过。 |
| 9. 状态 | R04 学习样件：`VERIFYING / RESEARCH_CANDIDATE`；跨 Mother 或商业生产复用：`BLOCKED_VALID / HOLD_LICENSE_AND_PORTABILITY`。不是 `CANDIDATE_READY` 或 `ACCEPTED_BASELINE`。 |

## 4. 明确决定与有限方法

**决定：保留 R04 真实技术增量，但冻结跨 Mother 复用。**

- 不标记 `REJECTED_CREATIVE_SUBSTITUTE`：它有真实用户授权、fresh diff 和目标相关实现。
- 不标记 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`：当前 main、发布提交与 QA 指向同一轮 R04。
- R04 仅作为 `teacher-derived noncommercial research candidate`；Fish、Bird、Brick、Landscape、Coral、Game 不得直接把其源码或视觉样件当成已批准公共材质父节点。
- 可共享的是经过核对的条件方法：颜色/状态分离、隐式高度进入求交、normal-only 与 geometry 分层、材质谱与光照分离、消融验证。共享方法不等于共享受限源码。

## 5. 最小解除验证

责任端下一步只做一个短闭环：

1. 补 R2 Task Anchor 与 Delivery Receipt，绑定 R03 base、R04 head、用户授权范围、referenceSet、许可与 UNKNOWN；
2. 把用户最终交付构建为单体 HTML，执行 `file://` 零网络首帧、谱导入导出与关键交互；
3. 对 exact head 做桌面与 390×844、最终公网 URL、WebGL2 context、零 fatal error 和一次裂纹/苔层几何切换验证；
4. 独立 verifier 对比：baseline、仅颜色、normal-only、真实 height 求交、完整 PBR 五种消融，不用全图方差或高饱和替代形态判断；
5. 若目标是跨 Mother / 商业 Game，另建权利清晰的独立 instrument：只继承公开公式、接口与观察结论，不复制老师表达性源码；记录独立实现的来源与代码谱系。

前四项通过只能使当前非商业 R04 成为可审阅候选；第五项通过并经用户接受，才允许谈跨 Mother 生产复用。

## 6. 生命周期与未完成边界

- `POSTED`：本纪要保存后成立。
- `IMPLEMENTED`：R04 源码、QA、main 与 gh-pages 发布均存在。
- `GATE-RUN`：本地软件 WebGL 与部署 workflow 已运行；声明范围有限。
- `ACKNOWLEDGED`：本轮无 Material Mother 新回执。
- `ADOPTED`：false。
- `USER-ACCEPTED`：R03 的“满意”有对话依据但未绑定正式 SHA receipt；R04 为 false。

未完成：正式 Task Anchor/receipt、独立 verifier、standalone 单 HTML、本地双击、公网页面端到端、物理设备、性能、米制/物性标定、权利清晰的公共材质实现、R04 用户视觉验收。

## 7. 交给学习飞轮的单一问题

怎样用最小的 machine-readable provenance，把“老师表达性源码”“公开物理/数学公式”“观察得到的方法”“独立重写的生产实现”四层分开，并能证明下游 Material/Shader 没有把 NC-SA 学习样件误继承成商业公共父节点？

本会只保存协调决定；未修改生产 Mother 分支、`main`、`gh-pages`、冻结成果、日程或学习飞轮。
