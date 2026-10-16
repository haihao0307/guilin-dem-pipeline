# N165 — 来源记录不等于精确内容已取得

- 日期：2026-10-16
- Mother：Coordinator / documentary research
- 类型：制度验证 / source provenance / user-correction regression
- Bounded question：只有书目记录、目录、检索片段、馆藏说明或航摄任务记录时，能否向用户说“所求原文/老照片已经找到”？
- 结论：不能；当前真实失败落在 `SOURCE_RECORD_FOUND__HOLD_CONTENT_BYTES_UNBOUND`。

## 1. 现有真实失败

同一历史资料检索对话出现两次同机制过度表述：先把县志说成“已查到”，随后承认只有书目/目录层，没有正文页和所求原文；另一次先把老航片说成“找到了”，随后撤回为档案计划或来源存在，精确影像帧与目标地点覆盖均未证实。

这里不判断县志一定没有相关记载，也不判断历史航片一定不存在。失败仅绑定证据层级：`source record exists` 被错误提升成 `exact requested content acquired and verified`。本记录不复制未核验原文或私人材料。

## 2. 外部方法 / 与 KAOPU 当前制度比较

美国国家档案馆说明，其目录同时包含有数字化记录与没有数字化记录的描述，只有专门筛选在线可访问内容时，才表示描述中包含数字对象；电子记录 FAQ 也明确，并非系列内全部文件都能从目录下载。IIIF Presentation API 用 Canvas/Annotation 把内容绑定到特定对象，Content State API 还能把引用缩小到 Canvas 的空间或时间片段。

- https://www.archives.gov/research/catalog/help/using
- https://www.archives.gov/research/electronic-records/faqs
- https://iiif.io/api/presentation/3.0/
- https://iiif.io/api/content-state/1.0/

这些原则与 R2、参考复刻门禁的来源身份、证据绑定、缺失即 UNKNOWN 完全一致，因此外部方法在原则层记 `NO_NOVELTY`。当前体系未见的增量，是把证据成熟度拆成四层可执行状态：`record -> content object -> target span -> original cross-check`。

## 3. 可反驳假设

假设：若“找到/取得/引证/验证”声明必须依次绑定：

1. 来源记录身份；
2. 精确内容对象与可访问字节；
3. 所求页、Canvas、帧、图幅、时间或空间区域；
4. 与原始对象交叉核验后的原文、图像身份或覆盖结论；

那么本次县志与老航片两类过度表述都会在用户之前被 HOLD，同时完整页图或精确航片帧的正控仍能通过。如果真实失败仍被放行，或完整正控被一律拒绝，则假设被反驳。

## 4. 最小历史回放

建立去重 Candidate `SOURCE-RECORD-NOT-EXACT-CONTENT-001`，隔离分类回放 8/8，覆盖：

- 无来源记录身份；
- 当前县志书目/目录但无正文；
- 当前档案计划/任务记录但无精确帧；
- 已得数字对象但未定位目标页/帧；
- 定位到错误版本、地点、日期或覆盖；
- OCR/推断未对照原始对象；
- 精确页图与目标原文核验正控；
- 精确航片帧与目标地点覆盖核验正控。

状态语义为：

- `HOLD_SOURCE_RECORD_UNBOUND`
- `SOURCE_RECORD_FOUND__HOLD_CONTENT_BYTES_UNBOUND`
- `CONTENT_BYTES_ACQUIRED__HOLD_TARGET_SPAN_UNLOCATED`
- `TARGET_SPAN_LOCATED__HOLD_REQUESTED_SUBJECT_UNBOUND`
- `TARGET_SPAN_LOCATED__HOLD_TRANSCRIPTION_OR_FRAME_VERIFICATION`
- `EXACT_CONTENT_VERIFIED_SCOPED`

最后一个状态也只证明 exact object + target span，不等于研究完成或用户验收。

## 5. 适用边界与是否采用

局部作为 Coordinator / documentary research Candidate：

- 适用于县志、档案、论文、手册、地图、扫描照片、历史航片与卫星影像；
- 不阻止报告“发现一条书目记录”或“确认某档案计划存在”，但必须使用对应的低层状态，不能改写成“目标内容已找到”；
- 正文不可访问、页码未定位、影像帧未取得或覆盖未证实时，必须显式 UNKNOWN/HOLD；
- 下一次真实档案任务先做单次试用，再由独立 verifier 检查 exact object 与 target locator；未经回执不改 root AGENTS、不全局强制。

## 6. 生命周期与 KPI

- regression：`SOURCE-RECORD-NOT-EXACT-CONTENT-001`（Candidate）
- classification replay：8/8
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6219282410
- ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED：false
- 同一对话内观察到同机制过度表述：2
- 首次候选通过率、用户纠错次数、同错复发率、stale delivery、accepted delta 内部迭代数及从指令到合法 candidate 时间：unknown
