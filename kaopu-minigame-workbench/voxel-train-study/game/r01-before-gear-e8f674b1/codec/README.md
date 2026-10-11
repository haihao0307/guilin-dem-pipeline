# Actual-game SQLite session profile

This extends the reviewed R04 fixed-layout SQLite-envelope technique for the existing train game's real Session. It does not rename JSON as `.KaoPu`, introduce a demo, invoke SQL/WASM in the browser, or deserialize incoming executable code.

Profile: `kaopu.fh88-game-session/1-experimental`
Container: real SQLite 3, application id `0x4B505531`, with `header`, `records`, `links`, `fields`, `assets` tables. Independent Python sqlite3 `PRAGMA integrity_check` passes. The inert canonical JSON payload is one SQLite BLOB. Its SHA256 is integrity checking, not author authentication.

This is an explicitly supported prototype profile for this game. It is not claimed compatible with every KAOPU authoring tool, the older desktop image reader, the functional rail reader, or the R04 hot-start-only decoder.

## Runtime API

Import `native-a4/game-save.mjs` from the existing game.

- `await encodeGame(game)` returns `Uint8Array` of SQLite bytes. Capture occurs synchronously before the first await. Export checks that replay reconstructs the captured state; unlogged fixture placement cannot produce a falsely successful save.
- `await decodeGame(bytes)` returns `{packet, session, appearance, dependencies, verification, restoreMode}` only after all checks pass. It never changes the caller's current game. The returned Session exactly reproduces the saved running/paused state, thermal state, position/wheel phase, passengers, doors, route progress and input history.
- `await decodeGameFile(file)` enforces size before allocating the file buffer.
- `verifyRuntimeDependencies()` checks actual served rule bytes against build-pinned SHA256. It is cached after success. Browser use requires localhost or HTTPS Web Crypto.
- Node tests pass `{dependencyBytes}` to encode/decode instead of fetching file URLs. `pinnedDependencies()` lists the exact required IDs.
- `formatInfo` reports the exact profile, capability limits and fixed file size. Do not invent another extension or MIME: use `.KaoPu` and `application/vnd.kaopu.sqlite`.

App integration should capture the old game, decode to a separate candidate, then replace `game` only on success. To load safely paused, call `candidate.session.command('pause', true)` after the exact saved state has been verified. This intentionally records a new pause command and does not falsify the original saved state. Refresh existing actors, audio, smoke, world effects and HUD through the app's existing restore path. On failure retain the old game and show the actual error.

The record contains the actual replayPacket, whole physical snapshot, deterministic Session signature, explicit A4 outer-shape recipe, dimensions, own three-cylinder design, all SI parameters and current branding parameters. The appearance and mechanics are reconstructed from pinned runtime rules; no meshes, teacher model, raster images, shader source or other incoming executable content is embedded.

## Build rule

After every final edit to Session, train, dimensions, physical parameters, native A4 or branding rules:

    python codec/build-template.py
    node --test tests/a4-game-save.test.mjs

Commit the generated `dependency-manifest.mjs` and `template-data.mjs` together with those rules. Do not generate after publishing and claim the earlier commit was verified. Source changes intentionally reject older exact-profile files instead of silently running them against a different shape/dynamics definition; no cross-version migration is claimed.

The builder uses Python's standard sqlite3 writer and validates its database, locates the owned payload segments, then stores a sparse static template. The 4.24 MB exported file has 4 MiB payload capacity; the template source is only approximately49 KB. Overflow page pointers remain immutable. Segment boundaries are based on SQLite page limits, not accidental byte matches. No third-party binaries are required.

## Bounds and rejection behavior

Only this fixed container layout, exact profile and current dependency set are accepted. Files are exact-size checked, immutable structure checked, SHA checked, canonical JSON checked, key/type/depth/array/replay-budget checked, then replayed and compared with saved signature and complete physics. The replay limit is 108000 Session ticks (one hour) and50000 input records, additionally bounded by4 MiB payload size. This covers the current9-station journey and6-station timed mode; indefinitely long sessions beyond the bound require a separate versioned checkpoint design. Oversized data is rejected, never silently truncated.

Pause, station service, a live asynchronous save, bad files, hash/appearance/rule tampering, complete nine-station restore and continued-state equivalence have Node tests. Browser download/upload and app UI restoration still require the actual-game CI test; numerical tests do not prove that UI wiring is present.
