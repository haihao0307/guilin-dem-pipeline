# Current Best View R65 — propagated Half-gap bound is conservative but not compact

Status: **Candidate partial**.

For the fixed Three.js r186 Chromium/SwiftShader fixture, a preregistered recurrence propagated half of each bracketing binary16 gap through all later transmittance. It dominated the exact final Half-minus-ideal error in all `4,356` locked channels, with zero underestimation. Maximum actual error was `0.12773165063845437`; maximum bound was `0.18712705453127046`.

This is narrower than a portable asset metric. The recurrence still needs ordered Half state, source channels and measured per-pixel effective alpha. It removes signed-residual storage, not ordered replay. Its largest reported bound/error ratio for nontrivial error was `26.4842`, so it is a conservative regression guard rather than a quality score.

An endpoint-only Half-ULP shortcut underestimated all `52` visible stable-inside and cutoff-inside channels and is **Rejected**. Unordered summaries, alpha-only traces, center samples and endpoint ULP do not certify accumulated color precision.

This remains the R55-R65 software-browser evidence lineage. Multiple centers, anisotropic overlaps, SH, WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance/energy and human acceptance are **Unknown**. Mother adoption is unacknowledged. Canonical Truth and Frozen R1 are unchanged.

Next: test conservative blockwise checkpoint composition with an adversarial cross-block case, seeking lower state cost without weakening the no-underestimate obligation.

