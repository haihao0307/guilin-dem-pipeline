# Generic Coral runtime recovery regression

Only self-authored coordinate-pattern GLSL runs in CI. The test reads a fixed allowlist of public HTML/JS/CSS and substitutes only shader identity hashes/byte lengths to load the synthetic fixtures. It never reads private source folders, private initialization URLs, or original shader assets. Network fallback is blocked.

Linux Chromium/WebKit are real browser tests, not physical iOS/App sheet or original artwork performance tests. Forced context loss uses WEBGL_lose_context; provider cooldown is explicit getContext-null fault injection. Visibility and BFCache events are injected DOM events, not actual OS backgrounding.

Checks: R04 baseline reproduces loss after 14 completed frames plus 2-second context-provider cooldown; R05 recovery and original-cause retention; 20 case switches/hashless reopens; 180-second 07 synthetic play plus 60-second Color and Flower; recovery after healthy session; permanent-null bounded stop; manual retry; stale events; missing-source cold start.

The existing tree iframe is not visited; it may retain one additional context outside the selected parent-case budget. No original-artwork visual fidelity or mobile GPU reset claim is made.

The synthetic case patterns include a bounded, self-authored 24-iteration arithmetic loop. This is not a model of original-artwork cost, GPU memory use, or an iPhone watchdog. The final regression also covers a depleted recovery budget followed by pageshow without visibilitychange and a 2-second context-provider cooldown.
