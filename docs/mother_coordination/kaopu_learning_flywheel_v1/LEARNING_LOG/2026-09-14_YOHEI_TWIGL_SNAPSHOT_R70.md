# KAOPU learning log — R70 Yohei twigl snapshot identity

Date: 2026-09-14  
Question: Does the author-linked twigl snapshot lock the exact source bytes and `geekest (300 es)` mode?  
Status: **Candidate partial**, with source bytes and mode promoted to Observation.

## New observations

1. The author's [original post](https://x.com/YoheiNishitsuji/status/1880561598982668452) has a same-author [reply](https://x.com/YoheiNishitsuji/status/1880562010603311179) linking the fixed snapshot `https://twigl.app/?ol=true&ss=-OGsvumeLdZM1eg3CtFG`.
2. The public twigl service record returned HTTP 200 JSON. Its graphics mode is `7`, which the pinned [twigl database schema](https://github.com/doxas/twigl/blob/969491b285ba217fd895132a466ee6b3128243f3/database-structure.md) maps to `geekest (300 es)`.
3. The stored source and the visible author-post text have the same SHA-256 `5253b2a44baa9f99af79cd04d85747ac6bb515c021562c7558e841446a4c3fea`, with 265 UTF-8 bytes and 265 Unicode code points. The stored source contains two ASCII `--` tokens and no U+2012–U+2015 dash.
4. The snapshot timestamp is `2025-01-18T10:22:40.000Z`. Decoding the two X IDs with the archived official [Snowflake implementation](https://github.com/twitter-archive/snowflake/blob/b3f6a3c6ca8e1b6847baa6ff42bf72201e2c2231/src/main/scala/com/twitter/service/snowflake/IdWorker.scala) places the post 38.999 seconds later and the linking reply a further 98.138 seconds later.
5. Fifteen source-free machine checks passed in [CI run 34830246605](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/34830246605). Mutable view/star counter values are deliberately excluded from identity.

## Candidate interpretation

The short time ordering, exact source fingerprint equality, same-author reply and matching mode form a strong provenance chain for the stored source and mode. This resolves R69's share-identity gap. It does **not** identify the exact deployed JavaScript bundle, browser, GPU, driver, framebuffer state or pixels used to create the posted video.

The Codrops typography is not canonical source text: its long dashes are a presentation/transcription artifact relative to both the author post and twigl snapshot. The canonical byte-level candidate for future replay is the twigl snapshot fingerprint, not copied article text.

## Failure and correction

The first gate assumed the optional `sound` member would be present with value `null`; a second gate used `value !== null` and misclassified an omitted member as present. Both runs failed and were retained. The final gate tests key presence explicitly. This matches official [Firebase Realtime Database guidance](https://firebase.google.com/docs/database/web/read-and-write): writing `null` deletes data, so absence and an application-level null default must not be conflated.

Rejected:

- A visible article transcription is sufficient to reconstruct exact shader bytes.
- `snapshot.sound !== null` proves a sound payload exists.
- A snapshot ID proves the exact recording runtime or displayed pixels.

## Current Best View

**Observation:** source fingerprint, 265-byte/code-point length, two ASCII decrement tokens, no typography dashes, mode 7, snapshot time and author-linked snapshot ID.

**Candidate:** the 39-second pre-post snapshot is the exact author-intended source for the posted video.

**Frozen:** KAOPU Canonical Truth and Frozen R1.

**Rejected:** Codrops long dashes as canonical tokens; missing-vs-null shortcut; snapshot identity as runtime/pixel proof.

**Unknown:** deployed twigl bundle, browser/GPU/driver, initial undefined values, framebuffer pixels, visual acceptance and artwork reuse license.

## Observation roots and applicability

- `OR-AUTHOR-PUBLICATION`: author post and same-author reply.
- `OR-TWIGL-SERVICE`: public snapshot record.
- `OR-TWIGL-REPOSITORY`: pinned schema/loader source.
- `OR-X-SNOWFLAKE-SOURCE`: archived official ID generator.
- `OR-FIREBASE-DOCUMENTATION`: null/delete semantics.
- R70 Node checks are a derivation over those roots, not an independent visual or physical root.

Transferable method: preserve publication link, service identity, stored-source fingerprint, mode/profile, time ordering and deployed-runtime proof as separate gates. Do not persist copyrighted raw source when a fingerprint answers the identity question.

## Routing and next gap

Prepared for Renderer / Three.js Mother and Landscape / Tile / Brick / Stone Mothers; no acknowledgment or adoption is claimed. Next: generate the exact fully preprocessed GLSL ES 3.00 shader from this fingerprint and pinned historical wrapper, then compare compact, literal-expanded and explicitly initialized reinterpretations in a fixed runtime. Keep undefined-state behavior and visual acceptance separate.

Gaussian R66 remains queued and is not superseded. First-tier expert AI was not called.
