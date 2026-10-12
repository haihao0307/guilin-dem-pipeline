# N147 — GitHub Artifact Attestation Teacher Candidate

状态：`TEACHER_CANDIDATE / AUDITION-NOT-STARTED / Human-Ear-local / no production change`

## Bounded question

GitHub Artifact Attestations 能否在 KAOPU 现有 SHA、run/job 与 freshness 收据之外，新增可验证的 artifact digest × producer/workflow/source identity，阻止旧产物被新收据重命名后继续晋级？

## 现有真实失败

用户长期痛点包括旧模型、旧网页与旧截图冒充新结果。当前 R2、freshness gate 与 `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001` 已绑定 base/head/tested-subject/run/artifact digest，但这些字段仍是仓库内自述；它们可以检测明显 lineage/freshness 冲突，却不能单独证明某个 audit bundle 确由预期 workflow 在预期 source SHA 上生成。

Ear PR #226 的 `.github/workflows/ear-r03-refinement.yml`（blob `d45ce2179da904b0bb5123ba6901286e70e9cfd8`）会上传 `ear-r03-audit`，但只声明 `contents: write`，没有 `id-token: write`、`attestations: write`、`actions/attest` 或 attestation verification。因此当前结论保持 scoped：已有 63/18 检查和 run/digest 收据没有被否定，但产物 provenance 仍为 `HOLD_PROVENANCE_ATTESTATION_MISSING`。

## 外部方法 / Teacher screening

候选为 GitHub 官方 `actions/attest` v4.2.2，固定源码 commit `1e69f48acb82d1966a394da916b4c1698aa569d6`，MIT license。

1. **Source/provenance**：GitHub 官方 Actions 组织；release commit 可固定。
2. **维护活性**：v4.2.2 于 2026-08-04 发布；仓库 2026-10 仍有 push 与 Sigstore prober run。
3. **可运行证据**：Node 24 action；unit/integration tests；公开 release 与 scheduled prober。
4. **权利**：MIT；只建议学习/试验，不复制不明资产。
5. **直接相关性**：signed in-toto/SLSA statement 可绑定 artifact digest、repository、workflow 与 source identity。
6. **相对 CBV 新增**：KAOPU 当前有 digest/run 声明，但没有签名 builder identity verification。
7. **依赖/风险**：GitHub Actions OIDC、attestations permission、GitHub/Sigstore/CLI/network；manual local build 不自动受益。
8. **失效边界**：不是视觉或语义验证；signature-valid 仍必须校验 expected repo/workflow/source/digest；试验必须 pin full commit。

回答“它多知道了什么”：它能证明一组 bytes 的 digest 是由哪个 GitHub repository/workflow/source 身份签发，而不仅是接收一个可复制的 JSON/SHA 声明。

## 与当前制度比较

`NO_NOVELTY`：exact tested subject、run/job、artifact digest、metadata-only descendant 与 stale-delivery fail-closed 已存在。

`NOVELTY`：签名的 builder/workflow/source identity 以及对 expected identity 的 verifier-side policy binding 尚不存在。它只补 provenance/integrity，不替代 reference fidelity、visual/browser/device/physics、producer-verifier 分权或 USER-ACCEPTED。

## 可反驳假设与最小历史回放

假设：若 Delivery Receipt 增加 attestation bundle/ID、artifact digest、verified signer repo/workflow/source SHA/ref 与独立 verification receipt，则 gate 必须区分：旧产物新命名、无签名复制 digest、错误 workflow、旧 source SHA、正确 provenance 但语义 gate 仍失败、以及全部 gate 通过。

在原 `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001` 上去重扩展七个 fixture；隔离 Node 分类回放 7/7。它只证明状态语义可区分，不是 GitHub/Sigstore 在线验证，也不是 production gate run。

## 适用边界与决定

仅允许在一个 CI-built、user-visible HTML/audit artifact 的 Mother 上 audition。建议的最小试验是 Ear：保持现有 63/18 与 reference gate 不变，新增 pinned attestation、verify against expected repo/workflow/source/digest，并故意注入 wrong-workflow/old-source 控制。若不能比现有 exact digest/run receipt 多检出至少一个真实控制，或耦合成本不可接受，则 `REJECTED` 并回滚。

决定：保留 `TEACHER_CANDIDATE`，尚未进入 `AUDITION`；不修改 R2、不修改生产 workflow、不改变晋级阈值。

生命周期：`POSTED=true`（PR #226 comment `6134819204`）；`CLASSIFICATION-GATE-RUN=true (7/7)`；`ACKNOWLEDGED / IMPLEMENTED / HUMAN-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。

效果指标：首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数、stale delivery 次数、accepted delta 内部迭代数与指令到合法 candidate 时间均为 `unknown`。
