# N211｜DiffLocks 单图 → 显式 3D 发丝专项老师候选

## 0. 状态与边界

- bounded question：**在明确排除 3D Gaussian Splatting 与“用函数直接生成发型几何”的路线后，DiffLocks 是否在“从单张 RGB 图像恢复可绑定到角色头部的显式 strand 几何”这一点上，比 KAOPU Hair Current Best View 多知道可复现知识？**
- 基线：`haihao0307/guilin-dem-pipeline@3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`。
- 生命周期：`RADAR_FOUND -> TEACHER_CANDIDATE`。
- `AUDITION=false`；`PROBATION=false`；`ACTIVE_TEACHER=false`。
- 本轮只做 pinned-source contract audit；没有下载 checkpoint/dataset，没有运行上游模型，没有修改 Hair Mother、生产资产、main、R2 OS 或全局门禁。

## 1. 为什么是当前最高价值问题

用户最新明确要找“少量图片转三维发型”，同时排除 3DGS 与函数生成。Hair F13 Current Best View 已有 strand 渲染、guide/follower、动力学与若干几何门禁，但当前 main 没有一条已验证的 `single RGB -> explicit strand geometry` 逆向重建链。DiffLocks 正好落在这个窄缺口：不是全面替代 F13，只可能补“从图像取得初始发型几何”这一段。

同轮 radar 中：

- Im2Haircut 的重建阶段使用 Gaussian-splatting-based differentiable renderer，按用户冻结路线 `REJECTED`；
- UniHair 使用 3D Gaussian representation，按同一冻结路线 `REJECTED`；
- HairStep 是较早的 step-map 路线，但代码链和依赖更旧，本轮不进入 audition。

## 2. 它到底比 KAOPU Current Best View 多知道什么

DiffLocks 把问题表示为一个受单张 RGB 条件控制的 **256×256 scalp texture**：

- 64 个通道保存逐 scalp texel 的 strand latent；
- 1 个通道保存 density；
- StrandCodec 将采样到的每个 latent 解码为 256-vertex strand；
- 输出是 `difflocks_output_strands.npz` 中的显式 world-space positions，可选导出 `.blend` 与 Alembic；
- 运行时生成器是 image-conditioned diffusion，不是 3D Gaussian Splatting，也不是手写函数几何。

相对 F13，明确新增不是“更多发丝”或“更好看”的口号，而是：**用图像条件与学习到的全局先验，直接预测包含遮挡/背面假设的逐发丝 scalp field，再导出显式 strand geometry。** F13 当前没有这条 image-to-strand contract；反过来，DiffLocks 也没有证明能取代 F13 的实时材质、动力学、WebGL/单 HTML 交付或现有用户参考保真门禁。

## 3. Pinned upstream evidence

上游固定为 `Meshcapade/difflocks@fcc73747dc60320c30228b6711000a53fc0c9d84`：

| 证据 | blob | 本轮读取到的事实 |
|---|---|---|
| `README.md` | `6d995f0493423a259ba731ddf6e725b1b75ba7e8` | 官方 inference/training code；40K synthetic hairstyles；每样本约 100K strands；CUDA kernels；Blender 4.1.1 |
| `inference_difflocks.py` | `544ff03c7b3fc83251429c14da4ffe4ba52e31a3` | 单一 `--img_path`；固定 Python/NumPy/Torch seeds=5；NPZ → optional Blend/Alembic |
| `inference/img2hair.py` | `01da67ba5a2e103b3b6a47a89a31a36c0b37ecda` | face crop；DINOv2 condition；CUDA/BF16；65-channel scalp texture；显式 strand positions |
| model config | `38dba15b5512f6a01261d80df72e84dee0427ecc` | `input_channels=65`，`input_size=256×256`，局部+全局 attention |
| `requirements.txt` | `a0f77a1f122b358739f37c85ef1327b291470498` | Torch 2.5.0、MediaPipe、libigl 等固定依赖 |
| checkpoint downloader | `c357f3947c7f1ab3b3fbbe23b14acd10bb762395` | checkpoint 必须在项目站注册并用用户名/密码下载 |
| dataset downloader | `84292bda8d6926975882ad03548ff58100afba1e` | dataset 同样需要认证；分块量很大 |
| `LICENSE` | `37f7cc6870f9574f7d5b199d231365b6c81ba009` | 仅非商业科研/教育/非商业艺术；禁止未经许可再分发；衍生物继续受同限制 |

论文为 CVPR 2025：Radu Alexandru Rosu et al., “DiffLocks: Generating 3D Hair from a Single Image using Diffusion Models”。官方论文页声称逐 strand latent、不需要 guide-strand post-processing，并展示高曲率/afro 案例；这些是论文/项目声称，不在本轮被升级为 KAOPU 运行事实。

## 4. 八项 Teacher Candidate 筛选

1. **source/provenance**：正式 CVPR 论文、作者项目页、Meshcapade 官方仓库；通过。
2. **维护/release/issue 活性**：latest pinned head 为 2025-10-31；到本轮约一年无新 commit，仓库未归档。2026-01 仍有 issue 更新，但没有 PR。结论 `WEAKLY_MAINTAINED / UNKNOWN`，不能当活跃生产依赖。
3. **代码/测试/数据/复现实验**：有 inference、training、40K dataset 脚本和 checkpoint 脚本；未发现独立 test suite。checkpoint/data 需要注册；本轮没有凭证也未下载，实际可运行性 `UNKNOWN`。
4. **license/rights**：非商业科研限定、单用户/不可转让、禁止无许可再分发；不允许把代码、checkpoint 或衍生模型直接吸收到通用/商业生产。只允许在权利确认后的隔离 audition 学参数和数据结构。
5. **直接相关性**：与“单张/少量图片转显式三维发型”直接相关；通过。
6. **相对 CBV 的新增**：逐 scalp texel strand latent + density、image-conditioned global prior、显式 strand export；是真新增。
7. **依赖/硬件/成本/数据/集成风险**：代码硬编码 `.cuda()`；BF16 autocast；NATTEN/FlashAttention-2；DINOv2 `torch.hub.load`；MediaPipe GPU face detector；约 40K×100K strands 数据；Blender 4.1.1；现有角色头绑定不在主链中。高风险。
8. **demo-only/不透明/版本失效**：不是只有视频，代码公开；但真实训练数据是合成 Blender 发型，domain gap 存在，checkpoint 受登录门；论文效果和实际复现之间有公开未关闭差异。不能晋级。

结论：`TEACHER_CANDIDATE`，不是 `ACTIVE_TEACHER`。

## 5. 公开 issue 暴露的失败边界

- #11（open，2026-01 更新）：用户报告同参数输出与官方例图不同；作者解释 diffusion 有随机性、Blender preview 的粗 strand 会误导密度，另有用户继续报告匹配差。CLI 后来固定 seeds，但代码未强制 deterministic algorithms，因此“固定 seed = 完全可复现”仍不能成立。
- #17（open）：用户报告头发颜色与论文示例不同，未见作者解决。
- #15（open）：注册/登录后仍无法下载 checkpoint 的报告，未见解决。
- #12（open）：V100 无 FlashAttention fallback，请求未答。
- #6：作者说明可用 Unreal 等外部工具把生成 hair 绑定到另一 scalp；这不是 DiffLocks 本身完成的 integration proof。
- #4：作者确认数据略偏向短发，且 base index 大致按长度排序；需要在 audition 中单列长发 coverage，而不能只看平均样例。

此外，`rgb2hair()` 在无脸时返回 `None`，而 `file2hair()` 直接双变量解包；no-face/profile/遮挡输入必须作为 negative control，不得静默 fallback。

## 6. 最小可反驳 audition（未执行）

只有 Hair Mother `ACKNOWLEDGED` 且确认权利/硬件后，才允许在隔离、非商业环境执行：

1. 固定 exact commit、checkpoint hashes、CUDA/driver、Torch/NATTEN/FlashAttention 版本和 seed；记录是否仍有 nondeterministic kernels。
2. 输入组：官方 positive control；KAOPU frontal reference；长发、高卷曲、遮挡、profile、no-face negative controls；禁止挑图后只展示成功例。
3. 几何 receipt：strand/root count、finite、root-to-scalp distance、scalp penetration、arc-length/curvature distribution、duplicate/zero-length strand、NPZ schema。
4. 参考保真：front silhouette 之外，必须用 withheld side/back reference 或已知 3D truth 测遮挡区域；单正面图不能把背面“看起来合理”升级为 truth。
5. 集成：把 exact NPZ 绑定到一个现有 KAOPU head；绑定变形前后分别测 root、penetration、长度与 silhouette，不把 Unreal/Blender 外部步骤藏成 silent fallback。
6. 对照：保留 F13 accepted baseline；DiffLocks 只作为 initialization candidate。若任何权利、checkpoint、GPU 或复现门不通过，状态保持 `UNKNOWN/REJECTED`，不得用论文图代替运行证据。

可反驳假设：**在固定参考集上，DiffLocks 产生的显式 strands 能在不增加 scalp penetration / invalid geometry 的前提下，比当前手工/参数初始化减少达到合法 hairstyle candidate 的时间，并提高 front + withheld-view reference fidelity。** 任一关键 metric 无法取得或只靠作者示例，即不成立。

## 7. 可执行制度翻译

若进入 audition，Task Anchor 至少增加：

- `teacherSourceCommit`
- `checkpointSha256[]`
- `licenseScope = NON_COMMERCIAL_RESEARCH_ONLY`
- `inputImageSha256`
- `viewEvidence = FRONT_ONLY | FRONT_PLUS_WITHHELD`
- `seed / cuda / driver / torch / natten / flashAttention / blenderVersion`
- `outputRepresentation = EXPLICIT_STRANDS_NPZ`
- `scalpBindingMethod`
- `negativeControls[]`
- `noSilentFallback = true`

Delivery Receipt 必须把 `UPSTREAM_INFERENCE_RUN`、`NPZ_GEOMETRY_GATE`、`SCALP_BIND_GATE`、`F13_RUNTIME_IMPORT`、`USER_ACCEPTANCE` 分层；上游脚本跑通不等于 production gate，更不等于用户认可。

## 8. 本轮机器审计

`difflocks_single_image_strand_contract_probe_n211.mjs` 对 pinned source facts 做 15 项 contract / rights / boundary audit，结果 `15/15 PASS`。它只证明“候选资料足以进入 Mother 决策”，不证明 checkpoint 可用、论文效果复现或生产适配成功。

## 9. 路由状态

- `POSTED=true`（Hair Mother 定向路由：#91 comment `6495822059`）
- source-contract `GATE-RUN=true`
- `ACKNOWLEDGED=false`
- `AUDITION=false`
- `IMPLEMENTED=false`
- Hair production `GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

定向对象：Hair Mother。只要求回答：真实相关性、现有覆盖、值得学的原理/代码/数据、最小可反驳试验。没有真实回复前不得说“已评估/已学会”。

