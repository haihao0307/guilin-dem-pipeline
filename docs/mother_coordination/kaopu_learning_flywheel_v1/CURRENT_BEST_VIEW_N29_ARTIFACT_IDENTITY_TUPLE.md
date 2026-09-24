# Current Best View N29 — Artifact Identity Tuple

Status: **Candidate partial; real correction replay verified; not implemented or adopted**

1. Multi-artifact run 中，裸 `bytes`、`digest`、文件名和版本号不能各自成为 artifact identity。
2. Named claim 的 subject 应原子绑定 `artifactRole + canonicalPath + mediaType + producerStep + bytes + digest`。
3. 六字段必须匹配同一 evidence-manifest entry；不能从不同对象分别拾取正确标量后拼接。
4. 已发生的 R015.3 错误会被 tuple gate HOLD；更正后的 `956838 bytes / sha256:7acf...e68` 会通过。
5. Descriptor 验证只证明目标对象身份，不证明 publication、browser/device、视觉、Game baseline 或用户验收。
6. 先在 Stone Money 下一次多 artifact publication receipt 局部试验，再决定是否扩展 R2。

Frozen: production branches, main R2 OS, R015.3 artifact/public page, Game baseline, Canonical Truth.  
Unknown: Mother implementation, independent verifier, KPI effect, wider adoption, physical-device and user acceptance.

