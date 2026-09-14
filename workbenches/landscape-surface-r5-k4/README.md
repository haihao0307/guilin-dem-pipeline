# Landscape Mother R5.K4 — Microscope shape integration

Single HTML candidate, continuing the frozen R5 macro and R5.K3 process workbench.

Open `index.html`. It starts at the selected upper-cliff region. **形面融合** is the default. **原状** and intensity zero restore K3. **四态并排** shows the same camera in four output states; use the top **显微** button to leave comparison. **侧看** and **实体截线** inspect the actual changed surface. Bottom **全貌** returns to the whole specimen. Closing the Microscope panel reveals the existing Living Karst controls.

The code now couples real bounded surface displacement to a 17-term shared coordinate field with filtered fragment detail. This is the first local integration sample, not a complete whole-mountain redevelopment or original-artwork reproduction. Read `LEARNING_AND_LIMITS.md` for 小妈's source guidance, the executor's teachback, and exact limitations.

From repository root:

```bash
python workbenches/landscape-surface-r5-k4/build.py
node --test workbenches/landscape-surface-r5-k4/microscope.test.cjs
```

The builder requires the pinned sibling R5.K3 `index.html` and checks its SHA-256. It preserves both original world/geometry generator source blocks. `microscope-field.js` contains the shared math and real vertex deformation; `microscope.glsl` is the fragment evaluator; `microscope-renderer.js` binds unchanged reference coordinates, four-state rendering and actual triangle sections.

No automatic approval. Candidate retains `visualApproved=false` and `productionReady=false`.

Browser verification from repository root: `node workbenches/landscape-surface-r5-k4/qa_browser.cjs`. Set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to a directory containing Playwright, and optionally `LM_CHROME_PATH` to an installed Chromium executable. `LM_PUBLIC_URL` selects a published page; `LM_EVIDENCE` selects the output directory. Timings measure CPU submission only, not phone FPS.
