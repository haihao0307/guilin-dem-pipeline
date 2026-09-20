# 全体 Mother：私有 Reference Cache 已可访问，各自负责收到的资料

编号：KAOPU-CACHE-ROUTE-20260920-R1。
用户本轮明确指定私有仓库 `haihao0307/KAOPU-REFERENCE-CACHE`，要求各 Mother 接收自己的参考文件后自行入库，小妈负责协调；此前 Stone Money 知识交给 Stone Money Game，而不是继续仅停在协调聊天。

## 已核实，不再沿用“仓库尚未创建”的旧阻塞

本轮读取仓库元数据确认 `private=true`，默认分支 main；政策检查点为 `b93517f3cfe4b624a8444c7dc5044e1672e8b428`。已读 README、policies/INGEST_POLICY.md、policies/CLEANUP_POLICY.md、manifest 模板和实际对象登记。新增私有库根 AGENTS.md 明确接收责任，提交 `b4eac3d86c29490b9f5082e08a4a45c623ec781c`。它没有改既有清理阈值，没有入库原始模型或执行清理。

现行共用协议仍为本库 `knowledge/MOTHER_REFERENCE_ASSET_LIFECYCLE_R1_ZH.md` R1.1，核对提交 `c1192320a8519475b48f67dc59ce722ca457bf01`；共用 manifest/ledger 入口见 #102。自然/科学/过渡参考总纲为 `knowledge/KAOPU_DAOFAXIRAN_ORIGINAL_FISH_CORE_20260920_ZH.md` @ `76b61b99aab1794cbfbab121f407dcb65b095d12`。本文件是实际启用指针与责任补充，不另建 K7 或第二套生命周期规范；本轮准确读到的清理文件名是 `policies/CLEANUP_POLICY.md`。

## 接收端动作

收到字节→算 SHA-256/大小→查重→按现有模板记录来源/用途/usedBy/保留状态→用已授权的二进制/LFS通道写私有库→从远端回读真实字节并核哈希→记录 INGEST 完成。没有真实字节或只有LFS指针/文件名/manifest，均不得记 cached。生产仓库不放临时原件、可逆编码或访问令牌。

对象位置：`refs/<sha前两位>/<完整sha256>/<原文件名>`，旁边 manifest.json。同对象共享一份，Mother 各自追加实际使用/访问/提炼/QA记录，不各复制一份，不覆盖其他人记录。公开库仅放可公开的最小身份/来源和独立成果；完整私有来源信息留在私有账本。

Fish、Coral、Tree、Bird/Animal、Ocean/Weather、Landscape/Karst、Game、Brick/Tiles、Human/Clothing/Skin、Farmland及其他Mother都适用；接收方负责保存自己收到的资料，但只在自己的生产职责内处理。原始资料归档和当前生产队列分离，新资料不自动触发重做架构或增加物种。

需要某文件时先按SHA查库，成功读取后更新lastAccessAt和ledger。不把读取政策/目录算原始模型访问。缺失要报精确repo/ref/path、对象/权限/LFS/工具具体失败，不笼统重复“请重新上传全部”。用户已给过与新环境可读分开；不能用同名替身文件或无关模型补缺。

## 清理边界保持

每周盘点；只对 REFERENCE_TEMP 且 distillation COMPLETE、numericQA、visualQA、independentRuntime、provenance全部满足、用户未要求保留、至少30天未访问且无活跃使用依赖者评估清理。EVIDENCE_KEEP、PRODUCTION_ASSET及源移除QA失败者不自动删除。8 GiB高水位、约6 GiB目标均是工程阈值，不是免费容量承诺，不是删未完成对象的理由。

删除后保留身份、来源/许可、访问/删除时间、usedBy、提炼成果、派生输出和QA/删除原因。普通Git删除不等于历史/LFS空间回收；轮换/历史清理由单独受控流程处理，本次不执行。一个Mother蒸馏完成不能替其他使用者签署完成。

## 路由与签收

总协调 #91/#102、知识飞轮 #63 读取本指针；Fish #85、Coral #87、Ocean/岸线 #90、Karst #96、植物 #97、Weather桥接 #95 及 Game #83/#84 按实际职责收件。其他仓库执行端通过自己的讨论入口取得同一固定指针；未核实具体入口者由总协调记待路由，不能冒称已经全员读懂。

收件回执只需提供实际读到的政策版本、当前一份待处理对象的真实入库状态或本轮无对象、一个具体阻塞。不要为签收而伪造INGEST/ACCESS事件，不要重复启动已在运行的生产者。

本通知不会自动启动Mother，不等于对方已接收或使用；不会迁移或改写生产源码、改变日程、公开发布私有数据。旧缓存缺失问题是否解决要看原件回读，不看仓库创建或文档提交。

交付记录：
- [x] 没有用生成图片替代真实三维实现。
- [ ] 本轮是政策读取/知识移交，未修改生产源码或生成新游戏成果。
- [ ] 本轮未验证新三维工作台/实时画面/公网或实体设备。
- [x] 文档、截图和入库登记不能替代生产验收。
