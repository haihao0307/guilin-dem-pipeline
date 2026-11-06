# KAOPU Mother 每日协调会｜88号函数火车 Site v39 外部运行门

- 日期：2026-11-07（北京时间）
- 实际会议：2026-11-07 02:30:12 +0800 — 2026-11-07 02:31:03 +0800
- 会议边界：只处理一个最高价值问题；未修改生产 Mother 分支、main、Site、访问权限、托管、冻结成果、排程或学习飞轮
- 强制协议：R2 `LOCK → EXECUTE → VERIFY → PROMOTE`

## 本轮唯一问题

刚更新的“88号函数火车 · 总装候选”是否已经满足用户要求的固定网页、实际内容渲染、主要交互及交付版本核验，可以进入 `CANDIDATE_READY`？

## 会前读取与权威状态

- `main@34553e93d75a427c10dbf5b0077d42f8cdda0a63`
- 根 `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 Production OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- Reference Replication Gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- Freshness Gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 最新回流为 N248：Acorn 对 literal `import()` 的 bounded teacher audition；仍无 Train / Mechanical Mother 的 `ACKNOWLEDGED / ADOPTED`
- #63 最新有效回流仍为 N49 Coast 公网运行失败记录；没有新的 Train 回执

## R2 九项核对

1. **唯一 taskId / targetObject / targetDefect**  
   当前没有与 Site v39 绑定的 R2 Task Anchor。对象可识别为“88号函数火车整车播放器候选”，本轮缺陷限定为“外部浏览器无法进入工作台，且 GPU 帧与主要交互未验收”。`taskId=UNKNOWN`。

2. **accepted baseline / baseSha**  
   Site 历史有 v38 与 v39，但没有 Delivery Receipt 声明 v38 是 accepted baseline，也没有生产仓库 `baseSha`。  
   已知而未晋级的版本身份：
   - v38 source `b00391ace06bb53fadba550318c9820076150809`
   - v39 source `e0c1cf2a6a36a005fc13036bb433b89793247a61`

3. **用户最后约束**  
   - 交互/三维工作台必须给可在外部浏览器直接打开的清晰网页链接；
   - 必须核验实际内容渲染、主要交互及交付版本；
   - 手机与桌面范围分别说明，390×844 视口不得冒充实机；
   - 遇到访问或运行阻碍必须写“交付未完成”；
   - 不擅自同步、部署旧失败版、改访问权限或新增收费服务。

4. **referenceSet 与 UNKNOWN**  
   页面文字区分了“原生轮组/连杆”“前部机构来源片段”及“8组悬架静态”，但没有与 v39 Receipt 绑定的 reference identities / hashes。  
   页面明确保持 UNKNOWN：真实 GPU 画面、真实动力、机械闭合、8组悬架源动画。

5. **forbidden routes**  
   `REPLICATION_LOCKED / CREATIVE_AUTHORIZATION=false`；不得把 stage77、v24 或旧播放器当成 v39 验收；不得用截图、部署成功、旧网格 fallback 或未运行的 WebGPU 声明替代当前真实运行；不得未经用户决定改为 public。

6. **fresh head delta**  
   这是 fresh Site 版本，不标 stale：
   - v38 archive `sha256:c710e496efe5afac73b51af2c91660909789ee9652ba60c716ea3187714c8ecf`，254,781,440 bytes，4,435 files
   - v39 archive `sha256:1ba17aa2502488442f9c6caad669a72af1983b01ec9b8da1b227c4f60e74e344`，254,853,120 bytes，4,442 files
   - delta：+71,680 bytes / +7 files
   这些元数据证明新版本存在，但没有 source diff / Receipt，不能证明 delta 只服务于当前 targetDefect。

7. **applicable regression cases**  
   既有 Freshness、Public Web Delivery 和真实三维工作台门适用；Bird / Fish / Boat / Terrain 四类回归不适用。N248 仍是 `POSTED teacher audition`，本轮未声称已执行或采纳。没有新失败机制，不新建重复 regression case。

8. **machine / reference / browser gates**  
   - Machine：Sites v39 deployment `appgdep_6aee19b4ecb081919584fa0e46853e34` 为 `succeeded`，固定 URL 已存在。
   - Reference Fidelity：未取得 v39 current receipt 与同屏证据，未运行。
   - Browser：独立外部 Chrome 访问固定 URL 后只显示“登录后即可访问”；没有进入工作台 DOM，因此无法核验内容渲染、WebGPU 首帧、拖动松开旋转、逐帧推进、取消待完成帧或行程视角。
   - Desktop / 390×844：均没有当前 v39 运行证据；无实机声明。

9. **状态**  
   `HOLD_GATE_FAIL / BLOCKED_VALID / HOLD_EXTERNAL_BROWSER_ACCESS_AND_RUNTIME_UNVERIFIED`。  
   不标 `REJECTED_CREATIVE_SUBSTITUTE`；不标 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`；不得晋级 `CANDIDATE_READY`。**交付未完成。**

## 明确决定 / 有限方法

保留 Site v39 作为 fresh、精确可识别的内部候选；把“部署”和“可交付”分账。当前不改访问权限，也不继续用版本号累积替代运行验证。

Train / A6 / 88 Mother 与 publisher 的最小解除条件：

1. 补一份去重的 Task Anchor + Delivery Receipt，绑定唯一 taskId、accepted baseline/baseSha、reference identities、v39 source commit、archive digest、固定 URL、known limitations；
2. 给出 v38→v39 与 targetDefect 对应的最小 source delta，禁止只用 archive 体积/文件数证明；
3. 在用户批准的访问边界下，让同一 v39 URL 可由外部浏览器进入实际工作台；
4. 对 exact v39 执行 desktop 与 390×844：首帧真实渲染、零 fatal error，以及至少一项主要交互（拖动松开旋转或逐帧推进）；390×844 只记视口；
5. GPU / 动力 / 机械闭合 / 悬架仍未知时继续明确 UNKNOWN，不用“候选”文字替代实证。

## 责任端、未完成边界与下一学习题

- 责任端：Train / A6 / 88 Mother + Site publisher；独立 verifier 负责版本、访问、运行与参考门。
- 未完成边界：Task Anchor、Receipt、accepted baseline、reference fidelity、外部可达性、GPU 首帧、主要交互、desktop、390×844、实机、动力、机械闭合、悬架和用户验收。
- 学习飞轮下一题：怎样从 Site 的 source commit、archive digest、deployment 与 access mode 自动生成一份最小 R2 Receipt，并把“部署成功、访问可达、运行成功、用户接受”四层分开，避免每次发布都靠页面文字或手工会议补证据。

## 生命周期账

- `POSTED=true`（本协调记录）
- `IMPLEMENTED=true`（Site v39 候选存在）
- `GATE-RUN=deployment metadata + unauthenticated external-browser access`
- `ACKNOWLEDGED=false`
- `Reference Fidelity GATE-RUN=false`
- `desktop/390 runtime GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

没有真实 Mother 回执，不声称 Train Mother 已学会、采用或完成。
