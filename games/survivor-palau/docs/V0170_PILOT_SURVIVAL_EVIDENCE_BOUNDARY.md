# Palau V0.1.7.0 — Pilot Survival / Surface Observation Candidate

Date: 2026-09-21  
Branch: `work/survivor-palau-v0170-pilot-survival-20260921`  
Parent: `work/survivor-palau-v0160-reef-islands-20260917` at `565cc35be05511f315ee1aa9b393d2e71caed6d8`

## 1. Corrected premise before implementation

The uploaded R2 package already fixes the historical prototype date to **1944-11-21**, but its evidence ledger still contained an obsolete open question about choosing October or November 21. The active repository copy resolves that contradiction in favor of 1944-11-21. `08_ORIGINAL_R1_ZH.md` remains an archive and does not override R2/R2.1.

The real McCullah event ended in rapid rescue. Long survival near Airai is an explicit game divergence, not a minute-by-minute reenactment.

## 2. Why this slice comes before a full ditching sequence

The exact FG-1 one-man raft stowage point, release path and cockpit animation remain P0 research items. Building a confident-looking egress animation now would convert an unresolved detail into false history. V0.1.7.0 therefore begins with the first mechanically well-defined gameplay slice:

- finite handline gear;
- surface observation through an improvised aviation-lens device;
- a short snorkel whose top must remain above the moving surface;
- visible bait, hook and fish;
- fish approach/avoidance driven by player movement and observation stability;
- manual hook-set and tension-managed retrieval.

## 3. Actual source implementation

### Runtime state

`PalauExperience.survival` records:

- historical prototype and game divergence;
- water, ration, hook, line-set and bait counts;
- surface-observation breath, fog, leak, calm and snorkel clearance;
- visible fish candidate distance;
- explicit false flags for elastic spear, Hawaiian sling and mechanical speargun.

### Real-time 3D assets

All new assets are procedural geometry inside the retained WebGL runtime:

- survival-pack proxy, line spool, flask and knife at camp;
- two-lens surface-observation proxy and short snorkel;
- underwater bait and hook;
- twelve low-cost animated fish with oriented bodies, tails, fins and eyes.

No generated image, rasterized fake scene, external model or external texture is used.

### Fishing decision path

The previous V0.1.6.0 loop used a fixed waiting interval before bite. V0.1.7.0 replaces that timer gate with `pilotFishReadyToBite()`:

1. bait and hook are placed below the surface;
2. one visible fish becomes the candidate;
3. calm observation raises interest;
4. head/camera movement, canoe movement, lens wiping and snorkel flooding frighten fish;
5. bite is permitted only after the candidate physically approaches the visible bait;
6. the player must still see the bite and press to set the hook;
7. retrieval still requires hold/release tension control;
8. line failure consumes one hook and one line set.

This is not automatic targeting and not one-button capture.

### Short-snorkel physics

The observer body follows a low-pass surface height while the actual wave surface continues to move. Snorkel clearance is measured each frame. Holding “贴近观察” lowers the tube top; a passing crest can overtop it, interrupt breathing and increase ingress/leak. Releasing the control lets the player recover. The tube is not treated as underwater breathing equipment.

## 4. Honest limitations

- The existing canoe remains the inherited navigation carrier. It is not presented as the historical pilot's actual post-ditching craft.
- There is not yet a full player-body swimming animation; current geometry validates camera, gear, waterline and fish interactions first.
- Fish are a reusable behavior/visibility test school, not a species-validated Palau ecology catalog.
- Food processing, spoilage, ciguatera/toxic-spine rules, patrol avoidance and rescue are not implemented.
- The sharpened wooden spear and later freediving stages remain locked.
- Physical iPhone/Safari sustained performance and thermal behavior remain untested.
- Visual acceptance must remain false until user review.

## 5. QA gates

The V0.1.7.0 browser test must verify:

- WebGL2 starts with zero GL/page/console/request errors;
- story date is 1944-11-21 and forbidden weapon flags remain false;
- at least ten fish are visibly active in the observation scene;
- camera eye remains close to the moving water surface;
- a real wave can overtop the short snorkel through the legitimate low-profile control;
- wiping the lens clears fog but creates fish-disturbing movement;
- bait and hook are visible below the surface;
- a candidate fish must approach before bite state;
- capture requires real hook-set and reel input;
- deliberate over-tension consumes finite gear;
- desktop and 390×844 controls remain within the viewport and non-overlapping;
- final fixed HTTPS URL is byte-verified and browser-verified before sharing.

## 6. Required Mother delivery checklist

- [x] This task did not use a generated image as a substitute for real 3D work.
- [x] Production source was actually modified.
- [x] The intended user result is an interactive 3D workbench, not a static image, video or placeholder.
- [x] Visual output comes from the real-time 3D runtime.
- [x] Camera, observation, fishing and gear-loss interactions are implemented as controls.
- [ ] Build and JavaScript syntax checks pass on the branch head.
- [ ] Real Chromium/WebGL QA passes.
- [ ] Fixed public HTTPS URL passes HTTP/body/resource/browser checks.
- [ ] `PUBLICATION_PROOF.json` reports `shareAllowed=true`.
- [ ] User visual acceptance is recorded separately.
