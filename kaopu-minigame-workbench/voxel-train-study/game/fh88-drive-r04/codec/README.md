# FH88 原生 SQLite 驾驶设置 profile R04

已生成真正 SQLite 数据库，不是 JSON 改扩展名。此包在既有 KAOPU 原型 envelope（application_id 0x4B505531 / user_version 1）的五表结构内定义新实验 profile：

`kaopu.fh88-driving-restart/0.1-experimental`

它只支持“保存设置 / 重载复位”。没有宣称通用 KAOPU 标准定稿、已有编辑器通用兼容、历史车辆参数校准或中途断点续驶。

## 浏览器接入

运行时只需以下四个文件，保持相对位置：

- `codec.mjs`
- `template-data.mjs`
- `default-parameters.mjs`
- `frozen/driving-physics.mjs`

纯 ES module + 浏览器原生 Web Crypto + TextEncoder/TextDecoder + structuredClone；没有 WASM、SQL.js、外部网络、动态求值或新增依赖。Web Crypto 需要 HTTPS 或 localhost 安全上下文。编码与解码都返回 Promise。

```js
import {
  createRestartRecipe, encode, decodeFile, restartPlan, verifyDependencyBytes
} from './native-codec/codec.mjs';

// First verify the actual nine local rule/source byte arrays keyed by dependency id.
// IDs and expected versions/SHA256 are available from pinnedDependencies().
await verifyDependencyBytes(actualLoadedRuleBytes);

const recipe = createRestartRecipe(currentParameters, {
  instanceId: 'fh88-main',
  initial: initialScenario,                 // Explicit restart initial conditions
  view: { mode: 'full', camera: 'cab' },   // overview / side / inside / cab
  archivedSnapshot: unifiedLiveSnapshot,  // Complete inspection-only archive
  capturedAtSimulationTimeS: unifiedLiveSnapshot.physics.timeS
});
const fileBytes = await encode(recipe);    // Uint8Array of real SQLite bytes
const blob = new Blob([fileBytes], {type:'application/octet-stream'});

const decoded = await decodeFile(selectedFile);
const plan = restartPlan(decoded);
// Caller validates and constructs a candidate new simulation before committing.
// Reset with plan.parameters and plan.initial, set plan.view, and pause.
// Keep plan.archivedSnapshot separately accessible; never feed it into reset().
```

`decode(Uint8Array | ArrayBuffer)` returns the full validated recipe. `decodeFile(File | Blob)` rejects size before allocating its buffer. `restartPlan(recipe)` returns parameters, initial, view, paused:true, identity, mechanism, dependencies, archivedSnapshot, restoreMode and explicit Chinese warning text. No function here mutates the active simulator or renderer.

`initial` contains positionM, speedMps, pressurePa, coalKg, waterKg and all six controls. Missing initial values are explicitly filled from parameters/defaults at recipe creation. Unknown fields reject; they are never silently dropped. The decoder does not infer restart conditions from the running snapshot. Reload starts at t=0, tick=0, empty time backlog and fresh thermal/brake/ledger initialization. Controls may be selected as a startup preset. Browser reload must remain paused until the user starts it.

A live archived snapshot is completely retained as bounded JSON, including all accepted nested fields and signed zero. It is inspection data only. The current physics snapshot does not provide a supported contract for restoring every hidden initial-energy reference and integration detail; no exact hot-resume claim is made. If no archive was supplied the field is explicitly null. Consumers must retain imported archives in a separate readable location and must not silently discard them when resetting.

## What is pinned

The manifest holds exact versions and SHA256 for nine inputs: original driving runtime, R04 metric adapter, three-cylinder rules, outside-drive rules, mechanism design, retained shape rules, retained shape recipe, frozen Three runtime and frozen ParametricGeometry. Saved dependencies must match this codec's release. `verifyDependencyBytes()` additionally verifies the actual runtime assets supplied by the host app; callers must do this before enabling save/reload. It does not fetch or execute incoming file contents.

The immutable graph stores those dependencies and a 45-entry stable part identity list plus six connection-rule identities. These are identities for this generated preview, not a complete mechanical authoring graph. Existing omissions such as inner crank webs, certified joints, wheel/rail profiles and suspension design remain unresolved.

Changing an underlying rule byte requires an explicit updated codec/template release and migration decision. Moving byte-identical files into a package does not affect their hashes. Viewer/UI code is not one of the pinned nine dependencies.

## Real container and deliberate compatibility boundary

The Python builder creates a legal 135168-byte SQLite file using stdlib sqlite3, with the original header/records/links/fields/assets envelope. A fixed 98304-byte BLOB holds canonical UTF-8 JSON plus space padding. The assets.sha256 hashes the entire padded BLOB. The graph_sha256 uses the existing prototype's typed-record digest.

The generated module contains that trusted template and 25 exact physical BLOB fragment mappings. The browser may change only those fragments and the 64-byte ASCII asset digest. Every other input byte must match the trusted immutable template. Overflow pointers, B-tree cell layout, schema, graph, profile, application ID and version cannot be changed by a saved file. This avoids shipping a general SQL parser or executing stored SQL.

Even a valid SQLite file is rejected if it has been VACUUMed, rewritten by a different SQLite layout, or uses another KAOPU profile. Future profile migration is a separate task. The existing R01 functional-rail reader rejects this different asset role, as actually tested. The old desktop image reader is not supported. Do not display old-editor compatibility or generic “all .KaoPu” import claims.

SHA256 is an integrity check, not a signature or author authentication. “Bad signature” tests refer only to SQLite's 16-byte file magic. Someone able to generate a new permitted recipe and recompute its digest can create a valid file; the decoder still applies the full inert schema and bounds. Do not use this as a rights-verification or trust mechanism.

## Production input bounds

- Exact supported file length, exact immutable bytes and fixed asset role
- Max payload 98304 bytes; never silently truncated
- Finite numbers before serialization and after parse, bounded parameter magnitudes, runtime controls/initial validation and mechanism consistency
- Arrays limited to 64 elements, bounded depth/node/string counts
- Unknown profile, rule hash/version, part/connection identity, parameters and fields reject
- Recursive rejection of common mesh/image/field payload keys, data URLs and large opaque base64 strings
- No incoming executable code, scripts, imported meshes, animation sample arrays, teacher image/field payloads, or automatic network retrieval
- Canonical JSON check rejects duplicate keys and ambiguous rewrites
- Caller buffers are copied before asynchronous hash validation

The source-payload denylist and structural limits are guards against typical accidental source-data inclusion, not a proof of ownership. The only intended archive is this app's own state/diagnostic data.

## Actual tests

```sh
node tests/test-codec.mjs
PYTHONDONTWRITEBYTECODE=1 python3 tests/verify_sqlite.py
```

Node checks cover exact/deterministic round trips, cab camera, complete live archive preservation, explicit restart reset, invalid magic, immutable/schema tampering, asset tampering, invalid digest, large/truncated files, unknown profile with a recomputed hash, nonfinite values including JSON exponent overflow, rule mismatch, part/connection mismatch, unpaused reload rejection, bounds, source-payload rejection, duplicate keys, prototype keys and caller-mutation safety. Both fixtures are opened by Python sqlite3 independently, which verifies PRAGMA integrity_check, application ID, version, five real tables, typed BLOB, full asset hash, graph hash and complete content against expected JSON.

The standalone Chromium runner could not start in this environment because the process singleton socket was denied. No browser PASS is claimed here. `tests/browser.html` and its self-test are available for the parent's unified R04 private browser CI; that integration is responsible for real browser save/reload and atomic failure tests.

## Fixtures

- `fixtures/FH88-default-restart.KaoPu`: default paused restart recipe
- `fixtures/FH88-running-snapshot-archived.KaoPu`: changed mass/initial/control/view preset and complete running snapshot at t=8.125 s retained only for inspection
- `fixtures/*-expected.json`: comparison data, not .KaoPu containers

`template.sqlite` is a developer construction template with a sentinel BLOB/digest. It is not a user recipe and the runtime decoder intentionally rejects it. Only the fixture `.KaoPu` files are valid sample recipes.
