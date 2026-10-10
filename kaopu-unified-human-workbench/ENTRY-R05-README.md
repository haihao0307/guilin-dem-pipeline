# R05: single 36-person picker and cold ring entry

User requested removal of the first-edition comparison UI and reported that the ring could not be entered. Old catalogue/state support and all rollback assets remain; the main picker now creates only 36 current cards and has no version tab.

## Reproduced evidence, before the fix

Run 38028833145 on the original public URL, runtime c307016a:
- Fresh browser context; the first click was the top ring button, without loading a face first. Main entry completed 39 native humans in 22.842 s.
- A separate fresh context clicked the retained R02 link and its start button; 36 humans / 18 rings completed in 18.038 s.
- Thus a hard entry failure was not reproduced on this CI host. These software-rendered timings are not user-device performance measurements.
- The top entry message did not change for the entire main cold load. From around 10 s to 23 s, the actual per-person assembly status was only below the canvas. The ring-labelled action initially focused the outside trio.
- Source-level failure recovery was missing on the top entry path. A deterministically delayed old build also overwrote/unlocked newer modes. New lifecycle tests reproduce six failures against the old coordinator.

## Changes

- Separate “进入擂台” (first ring) and “场外走跑跳” buttons. Switching between them reuses the existing 39-human scene instead of rebuilding it.
- Mirror actual asset/build progress to the top status, with a visible cancel/return button.
- Cancel waits for the old build to settle before unlocking; failed builds restore the original native parameter archive and shape view.
- MotionStudio assigns asynchronously built crowd results only after checking its current ticket; stale progress/finally cannot change the new mode. No PerimeterStudio, motion solver, model or asset modifications.
- Keep only 36 current picker cards. First-edition files and archive lookup compatibility are retained off the picker.

## Verification boundary

Local entry/load/lifecycle tests: 27 passed; unchanged six native identity state tests are included in CI. The lifecycle regression passes 7/7 on the candidate and fails 6/7 on the old coordinator.
Native candidate cold click, mid-build cancel/retry, first-ring framing, old-link entry, full face/activity regressions and deployment-following public checks must pass before release. No R03 18-program, new grip, carry, cloth/hair or character-likeness claim is included.
