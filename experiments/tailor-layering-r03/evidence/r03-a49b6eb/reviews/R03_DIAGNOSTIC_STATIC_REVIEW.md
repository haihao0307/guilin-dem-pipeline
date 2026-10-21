# R03 passive-observation verifier — independent static review

**STATIC PASS for the bounded observation supplement; this is not a public acceptance or sharing decision.**

The diagnostic verifier is `349f7b784141d9cfb2737b799e15202a9c801f01`, sole parent `1996ff7ea75bb62cdf1a785588173c3be4a558b2`. Independent GitHub compare readback reports ahead 1, behind 0 and exactly two modified files:

- `.github/scripts/tailor-layering-r03-mobile.mjs`, Git blob `30cfad7494105bab21ac2c7bf4f2b5c6151e18ca`.
- `.github/scripts/tailor-layering-r03-public.json`, Git blob `3c557fabade54a81de9baa82731903118ca40dfb`.

The workflow remains blob `826c18464dcaf84ecf241b5b9f598d56f94ab284`; the production source remains a49 and runtime subtree remains `114feff8d1b1c79a9a164fc8a99b181507d1cc89`.

## What was checked

The first review compared the proposed helper to the original actually executed first-public helper. After the transient workspace was lost, this reviewer independently fetched both immutable Git blobs again and recomputed their identities:

| Helper | SHA-256 |
| --- | --- |
| Original 1996 verifier | `8b2a5e592aa1c78c22e091e2e7f31f266750eebfe08fd729fefe42b338c921b8` |
| Diagnostic 349f verifier | `5c390c80ad6307670d8eeb0cc76e22487b2cd8307555880f5c34b00ca146bd6c` |

All **39 original assertion lines** remain byte-identical. The complete suffix starting with `mobile-native-entrance`, including navigation, all actual interactions, numerical/scene assertions, screenshot saving, failure handling and exit status, remains byte-identical.

The only helper additions are summary fields, console location/time, and passive CDP Log/Network handlers installed and enabled before navigation. They retain request/response URL, ID, status, initiator, timestamps and loading failures. No route, abort, response fulfilment, cache override, production mutation or error filtering was added. The configuration, after removing its explicit `observationSupplement` metadata, exactly equals the original Git config: same fixed URL, source, runtime tree, entry/provenance hashes and nine file fingerprints.

The observation purpose is to identify the otherwise unattributed console 404 from first public run 39544000653. CDP observation is not a promise of complete browser-internal request coverage and is not evidence that any run has passed.

## Required interpretation

The unchanged diagnostic remains bound by its original zero-console-error assertion. A repeat failure is retained, not rewritten as success. A later proposed classification change would be a **new verifier rule change requiring separate review**; it is not covered by this assertion-preservation PASS.

The existing task's failure history is not reset by the diagnostic commit or public stage. The evidence gathering is a bounded ROOT_CAUSE_REVIEW activity under `knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md` section 10 at a49. No new browser, solver or World was executed by this independent reviewer.

## Persistent CI checkpoint recovery

The prior full-CI evidence survives at commit `7e8bcc8528cab42e6eac011d65ae418dac249fd8`, evidence folder tree `2dc33590e248293ff584f04d6ecf3468854949db`. This reviewer independently fetched the complete non-truncated tree and original index, then checked:

- **55 blobs**, **9 archives**, **32 parts**, total compressed archive bytes **115,888,536**.
- All 32 part paths, Git blob IDs and sizes agree with the immutable index.
- Part offsets are contiguous and their sizes sum to each recorded archive size.
- Index, restored full-CI report, preflight report, historical receipt and restore helper reproduce the recorded Git blob IDs and byte sizes.

Index SHA-256: `dbb59f5ba52ace661b5ad34299516e34e89319626e53b28accaaf4c07f2540d6`.

The large archive payloads were **not** downloaded or fully restored in this metadata review. This is an accurate persistence/index check, not a new claim of all-archive decompression. First-public artifacts are being recovered separately from their original completed GitHub artifacts, with exact digest checks; lost derived reports are not fabricated as byte-identical originals.

Machine readback: `scratch-review/r03-diagnostic-static-and-checkpoint-readback.json`, SHA-256 `ee5c0a2e84b515fa2b851faf29e7ae1a6ed64a6298763566937db40f9ea07672`.

**Public sharing remains HOLD / `shareAllowed:false`; human `visualAcceptance` and `productionReady` remain false.**
