# Fish Mother Clean Restart Checklist

This checklist is mandatory for the first new session opened from `handoff/ocean-life-fish-mother-clean-r02-20260919`.

## A. Before touching code

- [ ] Confirm the branch is `handoff/ocean-life-fish-mother-clean-r02-20260919`.
- [ ] Confirm base ancestry begins from R02 commit `d7c39469c6158dbd5f6e36f6d275608bd73d816a`.
- [ ] Read `README.md`.
- [ ] Read `OCEAN_LIFE_FISH_MOTHER_全量知识交接.md`.
- [ ] Read `EXECUTION_ONLY_CHARTER.md`.
- [ ] Read current Xiaoma guidance relevant to the task.
- [ ] Confirm Fish is the only immediate production focus.
- [ ] Confirm Bird remains available from R02.
- [ ] Confirm Coral is not being implemented in this branch.
- [ ] Confirm Game Mother and Ocean Mother are not being changed.

## B. Select one fish and one defect

Write these before implementation:

- Fish target: `____________________________`
- Reference files actually mounted: `____________________________`
- Exact source SHA(s): `____________________________`
- One defect: `____________________________`
- Fixed views: side / 3-quarter / front-head / top-bottom / motion
- Acceptance statement: `____________________________`

Do not start with “make many fish.”

## C. Reference-read gate

- [ ] Exact file exists in the active runtime.
- [ ] SHA matches the recorded identity.
- [ ] File is not silently replaced by a similarly named asset.
- [ ] Source label and habitat identity are retained.
- [ ] Shape, material and animation observations are separated.
- [ ] Missing information is marked unknown.
- [ ] No source mesh/texture/rig/track is copied into the native runtime.

## D. Structural fish gate

- [ ] Centreline and body stations are explicit.
- [ ] Width and height relationships are stable.
- [ ] Head volume is correct.
- [ ] Mouth is structural, not a painted line.
- [ ] Eye volume and position are correct.
- [ ] Gill-cover boundary is structural.
- [ ] Dorsal/anal/pectoral/pelvic fin roots touch the body correctly.
- [ ] Tail peduncle and caudal fin are coherent.
- [ ] Left/right and top/bottom fixed views have been inspected.
- [ ] No colour work is used to hide a bad silhouette.

## E. Material gate

- [ ] Base colour regions follow body coordinates.
- [ ] Roughness/specular workflow is explicit.
- [ ] Normal detail is separated from geometry normals.
- [ ] Scale/skin pattern orientation is stable.
- [ ] Fin transparency is implemented deliberately.
- [ ] Pattern does not slide during motion.
- [ ] Near view does not alias or look toy-like.
- [ ] Far view filters the same identity rather than swapping assets.

## F. Motion gate

- [ ] Body curvature is continuous.
- [ ] Phase delay along the body is explicit.
- [ ] Tail motion does not stretch body length incorrectly.
- [ ] Fins have separate control where required.
- [ ] Eye/gill/mouth action is structurally anchored.
- [ ] Water-relative movement is separated from world current.
- [ ] Phase does not reset when speed changes.
- [ ] No real speed is claimed from clip duration alone.
- [ ] The fish direction follows its velocity.

## G. Habitat/physics gate

- [ ] Same water/seabed world definition is used for display and constraints.
- [ ] Whole body and fin envelope is checked.
- [ ] No sand penetration.
- [ ] No shore penetration.
- [ ] No rock/reef penetration.
- [ ] No coral collision claim until Coral Mother supplies the interface.
- [ ] No water-surface escape unless it is an explicit action.
- [ ] Rejected movement does not teleport the fish.
- [ ] Unknown current is not treated as zero.

## H. Evidence gate

- [ ] Before/after images use the same camera and lighting.
- [ ] All fixed views are saved.
- [ ] The assistant inspected the images.
- [ ] Numerical tests support the exact defect.
- [ ] Browser tests cover desktop and 390×844 when visible.
- [ ] Failures and omissions are written down.
- [ ] No automated test is described as user visual acceptance.

## I. Publication gate

Do not publish unless explicitly authorised.

- [ ] Candidate is visibly better than R02.
- [ ] Entry and dependencies return HTTP 200.
- [ ] Version identity matches the tested commit.
- [ ] Desktop public browser starts.
- [ ] 390×844 public browser starts.
- [ ] No JS/WebGL errors.
- [ ] Required controls work.
- [ ] Bird access remains available.
- [ ] No Coral placeholder has been inserted.
- [ ] User approves the direction.

## J. Stop conditions

Stop immediately when:

- task scope expands without instruction;
- the fish is being replaced by a generic body;
- colour is being used to conceal bad anatomy;
- another Mother must be modified;
- the reference file is not actually available;
- natural evidence is missing for a claimed physical parameter;
- the candidate is worse than R02;
- public release has not been authorised.

Record the stop condition and wait for the next bounded instruction.
