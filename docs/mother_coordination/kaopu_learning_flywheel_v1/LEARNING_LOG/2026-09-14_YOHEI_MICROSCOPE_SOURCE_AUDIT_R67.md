# R67 | Yohei Macroscopic Microscope source and coordinate audit

Date: 2026-09-14  
Status: **Candidate partial**. This round verifies one bounded question: which coordinate and dyadic-scale claims are directly supported, which are reproducible derivations, and which remain unknown.

## Inherited priority

The current functional-world-score handoff makes Yohei source, code, license and formula evidence the first task. This outranks the previously queued Gaussian R67 cache-invalidaton probe for this round. R66 remains valid and queued; it is not superseded by this topic switch.

## Observation roots

### OR-R67-YOHEI-CODROPS — author-authored article

Yohei Nishitsuji's 2025-02-18 Codrops article embeds his 2025-01-18 `Macroscopic microscope` X post. The displayed expression directly contains:

- `p=vec3(log2(R=length(p))-2.-t*.3,-p.z/R,atan(p.x,p.y))`;
- `s=1.` with loop guard `s<1e5` and update `s+=s`;
- a compact trigonometric contribution divided by `s`.

The page renderer displays typographic dashes where the source almost certainly used decrement operators. This root therefore supports the unaffected tokens above, but it is not a byte-exact compilable source lock.

### OR-R67-GLSL-460 — Khronos normative semantics

GLSL 4.60.8 defines the two-argument overload as `atan(y, x)`, not `atan(x, y)`. It also states that the result is undefined when both arguments are zero. Pre-decrement subtracts one and yields the modified value.

This is independent normative documentation. It specifies language meaning but does not prove which GLSL version, compiler or precision the original artwork actually used.

### OR-R67-CPU — reproducible derivation, not a new physical root

`run_yohei_microscope_source_audit_r67.mjs` executed nine checks. All passed:

- the loop visits exactly 17 scales: `1, 2, ..., 65536`; the next value is `131072`, which fails `<100000`;
- amplitudes are exactly `1/s`; their sum is `1.9999847412109375`;
- frequency times stated amplitude is one at every level;
- the vector-dot expression and its scalar expansion agree at all locked sample points and scales;
- at transformed `(x,y)=(1,0)`, source-order `atan(p.x,p.y)` yields `pi/2`, while the common transcription `atan2(p.y,p.x)` yields `0`;
- the origin is outside the expression's declared safe domain because `log2(0)`, `0/0`, and `atan(0,0)` are not defined as finite source values.

The CPU result derives consequences of the article transcription. It is not independent evidence of original GPU pixels.

## Candidate reconstruction

The most plausible repair of the two typographic dashes is `q--` and `--p.y`. Under the normative pre-decrement rule, `e=--p.y` changes the transformed second coordinate before both the base value and the inner kernel use it. This is a **Candidate**, not a byte-verified Observation, until the original source bytes or an author archive are obtained.

Expanded per-scale term, for transformed coordinates `(u,v,w)`, is:

`C_s = cos(cos(ws)cos(us) + cos(vs)^2 + cos(vs)cos(us)) / s`.

The source call `atan(p.x,p.y)` means the angle is equivalent to `atan2(p.x,p.y)` in common CPU notation. Calling it ordinary `atan2(p.y,p.x)` without documenting an axis swap is wrong.

## Current Best View

1. **17 dyadic terms and reciprocal amplitudes are now verified consequences of the published loop**, not an unresolved approximate count.
2. They remain **artwork-specific, dimensionless transformed-coordinate settings**. They do not establish metres, a universal octave count, geometry displacement, material identity or physical truth.
3. The coordinate graph is `log2(radius)`, negative normalized source-z, and an angle measured with textual arguments `(source-x, source-y)` under GLSL's `atan(y,x)` signature. The origin is a real singular boundary.
4. The expression belongs to a ray-marched appearance loop. It must be separated from geometry, material and observation-time contracts before transfer to KAOPU.
5. Time shifts the log-radius coordinate and camera/ray setup in the published expression. A static Object-DNA use must freeze or explicitly reinterpret time; silent wall-clock use would cause identity drift.

## Rejected

- **Rejected:** `atan(p.x,p.y)` can be transcribed as conventional `atan2(p.y,p.x)` with no semantic change. The locked counterexample differs by `pi/2`.
- **Rejected:** Codrops' MIT statement for downloadable demos automatically licenses the embedded X shader. The audited item is not identified as a Codrops downloadable demo.
- **Rejected:** 17 levels are a universal cross-object prescription. Only this published loop fixes that count.
- **Rejected:** a small amplitude sum proves bounded slope, curvature or safe ray steps. The per-level frequency-amplitude product does not decay, and domain Jacobians still matter.

## Unknown

- original byte-exact shader text and the exact two decrement tokens;
- original GLSL profile, compiler, precision qualifiers, GPU and rendered framebuffer;
- explicit license or permission for shader adaptation/redistribution;
- author-intended reusable meaning of each level and phase;
- visual equivalence of an expanded implementation;
- metre mapping, material-specific budgets and user acceptance.

## License gate

Codrops grants MIT to its downloadable demos and permits article excerpts, but the audited shader is an embedded author X post. No explicit license was found on the article, linked portfolio or accessible X metadata. Use the result as a factual/mathematical study and independently reimplement the method; do not ship copied or lightly edited shader text until license or permission is confirmed.

## Incremental routing

Prepare, do not claim adoption:

- **Landscape Mother:** preserve the observed low-frequency DEM; if testing this domain grammar, declare units, singularity handling, time semantics and per-scale geometry budget. Do not run 17 levels globally or treat them as measurements.
- **Tile / Brick / Stone Mothers:** reuse only the coordinate-and-scale audit method. Each material needs its own process, boundaries and acceptance; do not reuse the artwork's visual signature as a material generator.
- **Renderer / Three.js Mother:** if a visual reproduction is later authorized, lock source bytes and license first, then compare compact and expanded shaders on one fixed runtime. Keep ray-marched appearance separate from mesh/PBR deliverables.

No Mother acknowledgment was observed in this round. Production branches, Canonical Truth and Frozen R1 were not modified. First-tier expert AI was not called.

## Next true gap

Obtain a byte-exact, licensed or permission-cleared original source (or author confirmation), then compile the compact and expanded forms in one fixed GLSL runtime and compare per-scale field slices and final pixels. Until that gate is met, additional visual tuning would deepen an unverified reconstruction.
