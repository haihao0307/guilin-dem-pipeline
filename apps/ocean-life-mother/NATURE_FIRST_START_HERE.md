# Ocean Life Mother — nature-first continuation

Date: 2026-09-19. Read before older source-conversion handoffs. This captures the user's latest direction: third-party models were an initial learning aid, NOT the production truth or mandatory blueprint. Final shape, material, growth and behavior must be justified by natural observations and independently implemented relationships. The goal is a reusable KAOPU life kernel, not another encoding of an author's completed model.

Baseline read and rechecked before additive work: de93bfe40c646593061d9e79cfe91b4d90c82066 on work/ocean-life-mother-r00-20260918. Existing R00/R01/R02/R03 files, Game Mother, other Mother branches and automations have not been modified or deleted. Existing Xiaoma DISTILLATION_CORE.md was read again; no separate Xiaoma session or reply occurred.

## Source independence and eventual cleanup

The final runtime should require none of the third-party model/texture/rig/animation payloads or content-bearing coefficients/residuals fitted to them. Removing a GLB while retaining its encoded expression is not that transition. General mathematical methods and factual biological measurements are different from an author's particular model, photograph, video, animation or software expression. U.S. Copyright Office explanation: https://www.copyright.gov/help/faq/faq-protect.html . This is a production distinction, not a guarantee that all future outputs have no rights issues.

Make a new independent input path, test it with old assets unavailable, then clear obsolete research payloads/caches from the release. Keep minimal text records of measurement provenance, conditions, uncertainty and independent implementation. Those are not required third-party runtime models. A final-release cleanup and an irreversible deletion of all repository history are different operations. No blanket history/attachment deletion has occurred in this increment. Do not erase evidence or pretend that this small new module proves the whole project is already independent.

## Actual new implementation: N01 natural-data swim clock

See nature-core/n01/src/natural-swim.js. It is newly authored code, with no import of previous source-fitted waveform parameters. This narrow module provides:

- An explicitly bounded steady-swimming frequency estimator from a primary live-fish study.
- Water-relative swimming speed, distinct from world/ground-relative transport.
- Continuous phase obtained by integrating frequency as speed changes, rather than recomputing final frequency times all elapsed time or restarting an animation clip.
- Exact integration for the declared constant-acceleration-to-target and constant-current interval model.
- Pure view queries, explicit clock advancement, actor identity and rule-bound checkpoint/restore.
- Refusal of incompatible species, length definition, speed regime, unknown/stale current, unsupported sizes or out-of-domain measurements. No unknown current is treated as zero.

Unsupported output is an evidence/API result; a future host must not turn it into a biological claim that a fish stops moving. Turning, arbitrary time/space-varying currents, full body curvature, fin amplitude, hydrodynamic force, collision, eating and escape trajectories are NOT implemented here. This is an adapter inside the existing Mother system, not a new universal KAOPU format or a second complete renderer.

### What the natural source actually supports

Shadwick and Syme (2008), DOI 10.1242/jeb.013250, studied live yellowfin tuna under controlled conditions. The primary paper reports fork lengths 0.39-0.54 m and holding seawater 24-26 C. Its Figure 2 caption reports 95 swimming bouts from 12 fish and a tailbeat-frequency regression f = 1.22*(U/L) + 0.85, R-squared 0.91. The water-tunnel trial range was 0.7-3.5 fork lengths per second. The profile retains this conservative source-condition envelope. Holding temperature is not claimed as a measured per-bout covariate, and no thermal correction is invented.

Source: https://journals.biologists.com/jeb/article/211/10/1603/17416/Thunniform-swimming-muscle-dynamics-and-mechanical . The textual results and caption were read directly; no figure, underlying video or author code was copied into the module. No new raw natural-video measurement was performed. These are live-fish experimental facts, NOT measured wild Palau behavior, and not a species identification of the user's uploaded generic tuna asset.

At an explicitly supplied fork length of 0.45 m, 1 FL/s is 0.45 m/s and the regression estimates 2.07 Hz; 2 FL/s is 0.90 m/s and estimates 3.29 Hz. Those numbers are regression predictions, not universal per-fish exact frequencies. The model is not evaluated at zero speed, where blindly using its intercept would be misleading. There is no justified growth function or adult/larval transfer from this study. Acceleration controls in the diagnostic are labelled engineering test values, not measured predation/escape acceleration.

### Knowledge records, kept separate from simulation claims

profiles/yellowfin-natural-facts.json records NOAA's qualitative differences between adult diet and larval/juvenile predation context. Missing probabilities, shape stages, growth coefficients and colour trajectories remain null. Source: https://www.fisheries.noaa.gov/species/pacific-yellowfin-tuna . This is a species summary, not an age-to-shape dataset.

It also records PICRC's report of the February-March 2024 expedition with National Geographic Pristine Seas, MAFE and OneReef: https://picrc.org/new-research-expedition-uncovers-palaus-rich-marine-life/ . Yellowfin presence in the Southwest Islands/offshore survey is regional occurrence evidence; it is not an Airai population, swim-speed calibration, 1944 census or seasonal sardine-following model. No wildlife images or video clips from these pages were embedded or redistributed.

## Actual tests and what they show

26 Node regression tests passed. An independent VM without require, filesystem or network ran the new core with its small natural-data profile; no GLB, texture, skeleton, keyframe or R03 coefficient was supplied. Constant-flow examples included 10 seconds at 0.45 m/s through-water speed with -0.45 m/s current: world displacement is zero while the clock continues for 20.7 cycles. This is a numerical counterexample to ground-speed-driven animation, not a claim that a tagged wild tuna was observed station-keeping this way.

A two-second ramp from 1 to 2 FL/s accumulates 5.36 cycles; the erroneous final-frequency-times-time formula gives 6.58. 60, 30 and 7 Hz update partitions agreed with the exact single-interval calculation to less than 1e-9 in the tested state quantities. Observation/render queries do not change state. Checkpoints preserve the phase and reject changed rules or actor dimensions.

Real Chromium ran the actual inline core/profile at 1280x900 and 390x844. It exercised autoplay, inverse-current demonstration, acceleration, unsupported adult-size refusal, phase continuity and pause. Outbound requests were blocked: zero requests occurred, page errors were zero, and there was no horizontal overflow. This was a Canvas2D phase/velocity diagnostic, NOT rendered fish, WebGL, live game integration or physical-phone performance. Internal screenshots were inspected. An initial large-time diagnostic jump produced only one drawn endpoint; the diagnostic helper was corrected to collect intermediate samples and final tests were rerun. The core integrator itself was not replaced.

All six remote code/profile/tool blob hashes at ddfd69f37d5bc942a9ab3160fff0b6897159a934 matched the final files actually tested. See nature-core/n01/qa/QA_RECEIPT.json for the results and scope.

## Reproduction without any former model assets

From nature-core/n01/ run:

    node tools/numerical.cjs
    python tools/build_lab.py
    python tools/browser_qa.py

Node runs the mathematical checks and creates qa/. The build uses only this directory's newly authored core plus the natural measurement profile. The browser script uses Playwright and /usr/bin/chromium. Neither build nor tests need former mounted model files or old R03 data. The generated self-contained internal HTML is 19,248 bytes, SHA256 95275623a571da826c61e744385f42002f18b3227779615a3d2ac90da8ab5329. This is a tiny motion diagnostic, not the byte size of a complete fish/world system. Numerical detail files and screenshots can be regenerated by the persisted tools; copies from this run are at /mnt/data/ocean_nature_n01_20260919/qa/ and are not assumed to survive future sessions.

## Next bounded task and release status

Connect the clock to an independently authored continuous deformation test only after its spatial amplitude/shape assumptions are explicitly separated from measured frequency. Do not reuse the old black-bass-derived frequency/phase vectors to make this new path look more complete. For biological validation, obtain a source-matched natural midline/fin-motion measurement; distinguish raw observation, primary study summaries and uncalibrated engineering controls. Preserve world frame, time, identity and water authority when joining the existing Mother system.

Juvenile/adult morphology and color require separate natural evidence; neither scaling a single adult body nor interpolating an author's Young asset establishes the growth law. Full feeding/escape actions, body/PBR fidelity, mutual collision and public integrated visuals remain to be done. Keep pursuing observable increments rather than more asset-intake paperwork.

No new public total-workbench entry was deployed or validated. Do not share the internal diagnostic or old R02 as a new finished fish release. Final public HTTP200, version, dependencies and browser checks are still required by knowledge/PUBLIC_WEB_DELIVERY_GATE.md. No unverified link is supplied.

N01 numericalChecks=true; browserDiagnostic=true; nativeFishVisualAcceptance=false; fieldBehaviorAcceptance=false; lifecycleMorphologyAcceptance=false; gameIntegrationAcceptance=false; wholeProjectSourceRemoval=false; legalGuarantee=false; shareAllowed=false.
