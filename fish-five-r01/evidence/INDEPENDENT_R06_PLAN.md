# R06 independent startup verification

Frozen baseline: R05 production `86b75a1f708b6efe1171983424d71408b2664f4c`, standalone `d77102c2ffa8320efe0242495d11a2f3db277798f93d2eb05d801144d8bc0b17`.

GPU and browser remain with the coordinator until an exact R06 source/HTML freeze and release. This lane owns independent scripts/reports only.

## Startup gates

- Stream the exact final small online entry through a loopback HTTP server and record server-sent byte timestamps together with browser DOM/stage timestamps. The six original-source thumbnails must appear before the complete entry and selected model arrive.
- Stream only the default selected source slowly. Require actual partial byte progress, then the full-source interactive fish. Unselected sources must have no request before selection; static catalog thumbnails do not count as live fish.
- Independently bind both fully inline offline HTML and small online entry hashes. Verify all six fetched assets match the decoded offline carriers and original compressed sources, exact length/SHA, and only same-origin content-addressed URLs. Test six selections on desktop, 390px mobile and local file; offline must need no HTTP core requests.
- Inject HTTP500, same-length corruption, truncation and a real30second stalled download. Each must reach a readable failure and recover via retry without editing production. Cancel the initial default download by selecting herring and check no stale error/ready race. Deny WebGL creation in an isolated browser context and require a clear diagnostic.
- Check pause/loading clocks and default automatic modes after startup. Compare all source geometry/index/UV/pixels, eye fit and controller, native oral bindings, locomotion and original R14 carrier/files with R05. Parser packaging may change; visual/physical assets may not.
- Record `INDEPENDENT_R06_REPORT.json` with tested HTML hash/source head, trusted timeline evidence, positive and negative startup cases, fidelity hashes, exact limitations and PASS/HOLD. Public byte/resource/browser checks remain a separate publishing gate.

No generated image, fake canvas, reduced model, fallback artifact or test fixture may replace the actual workbench. QA screenshots are internal evidence. Aesthetics and motion acceptance remain false until the user decides.

Completed frozen candidate: source9a36778ae6ac794138487bcee7fe4073b930b805, offline aee23744fa2fe606cfdef016e0279c4580a252ae3f77eec340d6f755ff5d0d80, online584fda91a55f7b3e3bca267c9c0813590f50ea1ddeee15400fa5e3e23c36f8b1. Final local status PASS_LOCAL_PROMOTE; public HTTPS gate remains with coordinator. All browsers/servers closed and GPU released.
