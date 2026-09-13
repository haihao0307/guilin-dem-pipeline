# Landscape Mother R5.K3 — Living Karst, first causal sample

Continues the exact R5.K2 candidate supplied in the 2026-09-14 full handoff. The accepted macro specimen and the K2 six-scale organic Microscope remain the baseline. Both `worldSource` and `generateSource` are byte-identical to K2. The seven-file Landscape Mother core and unrelated production lines are not modified.

## What this candidate does

- Finds four stable vertical columns on the actual rendered rock triangles; pairs upward-facing cave floor and downward-facing ceiling, and traces the column to the highest exterior surface. Intermediate rock/void intersections are recorded in `pathNodes`.
- Validates a 0.48-unit root neighborhood before accepting each column. Stalactite and stalagmite roots embed slightly into their corresponding surfaces; geometry stays independent of camera and device.
- Uses one relative water/mineral account: water input, runoff, stored/in-transit water, dissolved mineral, transported mineral, ceiling deposit, floor deposit and downstream mineral export.
- Delays cave arrival. Cutting supply retains earlier deposits; remaining in-transit water drains before wetness and dripping stop.
- Requires a positive degassing condition for deposition. Setting it to zero leaves water and dissolved-mineral transport but produces no deposits.
- Produces fixed-topology solid deposits, with volume proportional to their respective mineral accounts. Their size conversion is an uncalibrated visual scale, not a measured density or geological growth rate.
- Recomputes state from relative phase and the same supply cutoff, so rewinding reproduces the same ledger, drops and deposit geometry. Export/import preserves the process state.
- Adds an explicitly labeled optional through-rock water-path view. Default rendering uses depth-tested 3D deposits and droplets. No image, external mesh, texture or LOD is used.

## Boundaries

The internal vertical connectivity is an authored infiltration proxy, not recovered measured fractures or a pressure/flow solution. Rock dissolution is currently a mineral-account proxy with localized moisture response; it does not remove frozen rock volume. Water chemistry, CO2 exchange, saturation and rate laws are not physically calibrated. Small deposits are a first shape prototype, not a completed cave asset. Visual approval and production readiness remain false.

The original K2 information panel incorrectly described its current surface as 17 octaves; K3 corrects the text to the actual six non-integer surface scales. It does not claim to implement the complete Yohei 17-scale method.

## Inspect

Open `index.html` directly over HTTPS. Select 洞内观察. Move 相对演化阶段 forward/backward; use 从此断水, then advance beyond the transit delay. 重演 clears the cutoff. In 水与沉积, vary 脱气条件; zero disables deposition. 水路 shows the labeled connectivity proxy. Material sliders retain the frozen base geometry.

## Rebuild and checks

From the repository root:

```bash
python workbenches/landscape-surface-r5-k3/build.py
node --test workbenches/landscape-surface-r5-k3/living-karst.test.cjs
```

`source-r5-k2.html` is the pinned internal build input (SHA-256 `919df1a9eff14a6d310d4aca93a2ccfcc9a59bb70a9b44b0bfe7d57aed335709`), not a new production choice. The builder checks its hash and exact generator preservation. JavaScript modules are embedded into the single HTML output.

Browser QA distinguishes desktop/390×844 viewport validation from physical iPhone performance. No physical-device performance approval is claimed.

## Mechanism references

Primary sources accessed 2026-09-14 Beijing time:

- https://www.nps.gov/ozar/learn/education/speleothems.htm — dissolved carbonate transport, CO2 release and deposition.
- https://www.nps.gov/subjects/caves/speleothems.htm — ceiling attachment and early stalactite formation; the current compact solid deposit is a later-form proxy, not a resolved hollow soda-straw lumen.
- https://www.nps.gov/grba/learn/nature/speleothems-cave-formations.htm — degassing and the change from dissolved carbonate to deposited calcite.

## Next work

User visual review first. Then refine the four deposit shapes and root blending, replace straight infiltration proxies with evidence-driven fracture/void routes, and introduce local dissolution geometry only within an explicitly protected shell. Do not replace the macro specimen or expand into a cave full of random formations.
