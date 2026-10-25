# R29 whole-installation constraint plan

This study implements a testable candidate family, not a historically calibrated A4 installation. It does not modify R28, v19 or Git. The failed centre-horizontal baseline remains available; nothing in this study turns its old cylinder/piston/frame failures into passes.

## Supported topology and unknown dimensions

The independently viewed official middle-cylinder casting photograph establishes a separate smaller middle valve-chest bore beside the power-cylinder bore. The photographs/reports of the conjugated mechanism establish that its levers pass through specific frame openings. Neither supplies the coordinate sign, side offset, inclination, bore-centre datum, pivot dimensions, opening profile, wall thickness or 60009-era calibration used here.

Sources:
- https://www.sirnigelgresley.org.uk/overhaul-1522/overhaul-04.shtml
- https://www.sirnigelgresley.org.uk/overhaul-1522/pics/o240.jpg
- https://sirnigelgresley.org.uk/overhaul-1522/overhaul-19.shtml
- https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-56/

Photo pixels are not redistributed. Image-right is not treated as train +X.

## 1. Derive the whole neutral mechanism, do not translate it

The retained outside inputs remain at X_L=-0.98, X_R=+0.98 and Y=1.48, with their existing finite Walschaerts solver and common absolute theta. The outside shaft front pin is its computed rear coordinate plus 1.15. A lateral middle-valve axis is X=m; both signs are retained as uncalibrated candidates.

With the 2:1 main lever and equal-arm combining lever, and a neutral transverse configuration:

- O_x = (m + X_R + X_L)/3 = m/3.
- A_x = X_R; B_x = X_L; E_x = m.
- C_x = (m + X_L)/2.
- Main long arm = X_R - O_x; short arm = half of that.
- Equal lever half-arm = (m-X_L)/2.
- O_z = 5.55 remains an inferred installation choice.
- Outer neutral front station = 5.25; the outer short links are O_z - 5.25 = 0.30.
- Middle short-link length is independent of the two outer short links. With length 0.25, the neutral middle terminal is Z=5.30.

The implemented factory solves the two circle intersections and final slider intersection from the actual outside inputs. It retains branches, finite rod lengths and the two lever ratios; it does not synthesize an output sine. At m=0 with the original 0.30 middle link, the whole old control solution is reproduced to 3.6e-15 m in the recorded phase regression.

Implementation: side_offset_solver.js. Browser and Node export createSideOffsetGresleySolver(scene, dynamic, outside, options). A candidate reference is computed from its own pose at theta=0.4. It must not reuse old reference endpoints for field transforms.

## 2. Axis direction and layer compatibility

With the existing two outside axes and revolute-pin construction, the present mechanism is horizontal in XZ. A constant lateral middle offset is compatible; a tilted middle spindle is not compatible with this same fixed-plane short link. A Y-component of spindle travel would require an evidenced transfer mechanism, moving normal-coordinate joint or redesigned gear plane. The factory rejects a nonzero middleAxisTilt and an independent planeY change rather than silently extending pins or drifting endpoints.

This is a restriction of this candidate, not a claim that the real middle valve axis is horizontal. The three finite-thickness plate layers and axial pin stacks remain explicit. A long pin is not itself an adequate frame mounting or strength proof.

## 3. Choose the bore and frame corridor jointly

Current model parameters, not independently recovered historical dimensions:

- Power bore radius R_pb=0.23495. The smaller 0.23295 is the moving piston radius and must not replace it in the stationary bore-preservation check.
- Power outer wall radius R_po=0.26.
- Current frame inner surface |X|=0.525.
- Candidate valve bore radius R_vb=0.1143 reuses the existing outside-valve research value; the actual middle bore size is not independently verified.
- Candidate valve outer radius R_vo=0.14 gives 0.0257 nominal bore-to-outer-wall thickness. Neither that thickness nor its strength is historically verified.

A deliberately sufficient projection test, independent of the tilted power-axis Y/Z position, is:

- |m| - R_vo >= R_pb + c: the new chest shell cannot fill the power bore.
- |m| - R_vb >= R_po + c: the preserved power shell cannot fill the valve bore.
- |m| + R_vo <= 0.525 - c: the full new chest wall and end covers stay inside the frame.

For chosen allowance c=0.005, the joint interval is |m| in [0.37995, 0.38000]. It is only 0.05 mm wide in this conservative design formulation. It is not a manufacturing-tolerance band, evidence of an optimum or a recovered historical offset. The selected |m|=0.380 nominal gaps are 5.05 mm, 5.70 mm and 5.00 mm respectively. Quantitative tolerance and strength remain unresolved.

A separate stationary-shell option would require |m| >= R_po+R_vo+c and cannot fit here with R_vo=0.14. The maximum completely disjoint shell radius at c=0.005 is 0.1275. Simply shrinking a 0.1143 bore's shell to 0.120 leaves 5.7 mm total wall and is not adopted as a collision-driven shortcut. Reusing the outside shell radius 0.1693 cannot fit this current bore/frame corridor.

Implementation: installation_constraints.js lateralFamily/lateralMargins. The shared-casting condition permits intended stationary cast-material union, not moving-piston interference.

## 4. Connect the same casting without filling either bore

The parent's actual R29 web is a bounded capsule-shaped transverse bridge between the power axis at each world Z and the new valve axis, radius 0.045, world Z in [4.35,5.00], additionally capped to power-axis station [4.37,5.13] to remain clear of the two detachable power-cylinder covers. Its field is the intersection of that new web volume with the complements of both exact bore volumes. These boolean exclusions affect only added web material: they do not cut, hide or resize the original power cylinder, piston, axle or frame.

The power axis at world Z is (0, 1.016+tan(beta)*Z, Z). Exact power coordinates are transverse (X, cos(beta)*(Y-1.016)-sin(beta)*Z), axial sin(beta)*(Y-1.016)+cos(beta)*Z. These coordinates must be used for the power bore, not an axis-aligned approximation.

Independent replay of r29/build_middle_chest.js is in test_actual_casting.js and ACTUAL_CASTING_QA.json:

- 719,712 sampled points inside either bore stay outside the web.
- 7,497 sampled beta/Z slices across beta=[0.11,0.16] have a connected interior path from a point overlapping the original power wall to a point overlapping the candidate chest wall.
- An additional monotonic-trigonometric bound establishes a connected path at world Z=4.7 for every beta in [0.11,0.16]: power-wall contact parameter <=0.644679 is below the valve-wall contact parameter >=0.668857; the path stays inside both axial caps.
- The web's exact X envelope is at most |m|+0.045=0.425, giving 100 mm to the current frame inner surfaces for any beta.

The boolean bore-exclusion and X-envelope arguments are exact nominal geometry statements. The volume-wide connectivity checks are sampled and have explicit contact witnesses; the single-section all-beta connection argument only establishes a connected material route, not minimum material strength. Neither establishes casting strength, steam passages, mount loads or full installation clearance. A whole-neighbor check must classify this intended stationary cast union explicitly, without granting blanket exemptions to piston, heads, covers, linkage or frame.

## 5. Derive terminal/guide/shaft extent together

Changing the middle short-link length shifts the terminal, valve displacement datum and required shaft coverage; it is not an isolated cosmetic edit.

For the chosen middle link 0.25, middle axis +0.380 and 1,441 common-theta samples:

- M_z is [5.221403700,5.380375017].
- Valve displacement relative to its own neutral datum is [-0.078596300,+0.080375017].
- Terminal-eye rear extent M_min-0.033=5.188403700 gives 18.404 mm to the guide end 5.17, before the chosen 5 mm allowance.
- In the earlier retained failed candidate, a rear gland starting at 4.228 required shaft length >=1.157375017 for a 5 mm extension. Retaining length1.15 then failed; that earlier configuration remains a deliberate failing regression.
- Whole-neighbor testing subsequently found that the earlier chest wall intersected the detachable power rear cover, so it was not accepted as a common-casting union. The current chest rear is 4.38 and rear flange starts at 4.358. The maximum old power-cover world Z over beta=[0.11,0.16] is approximately4.3522534, providing a chosen nominal5.747mm separation.
- A second whole-neighbor test found the previous new front cover (body front5.11) penetrating the removable power front cover by3.189mm at beta0.11. This is retained as a failure, not a same-casting exception. Current chest front5.01 and cover end5.032 stay behind the power front-cover minimum Z5.0426037 over the entire allowed beta interval, with10.604mm nominal gap. The added web ends at5.00, leaving10mm before the new detachable front cover.
- The current integrated candidate keeps shaft length1.18. Its rear-end range remains [4.041403700,4.200375017], giving157.625mm minimum extension behind the now-forward rear flange. That length is retained inference, not a uniquely necessary minimum after the rear-gland revision.

The head and seal positions must use the same qMiddle, not the old spindle Z datum or an extra time phase. The final candidate head centres are4.51 and4.87, half-length0.04, within liner[4.38,5.01]. Head spacing is now0.36, explicitly inferred from chamber length and full valve travel rather than retained as historical geometry. Lever ratios and stroke are unchanged. Sampled rear/front end margins are11.404mm and19.625mm. Their travel-end margin is geometric only; valve lap, lead, ports and steam timing remain unproven.

## 6. Apertures and O support depend on all moving bodies

The dedicated frame-interface study consumes these finite poses and the exact retained full-thickness plate/eye profiles. Its aperture envelope must cover each actual frame slab, every crossing plate and exposed joint hardware, both travel directions and clearance choices. It must not remove an entire frame region or erase a collision by an unbounded hole. Web/chest bore cuts are unrelated to these lever openings.

O moves from X=0 to m/3 in the candidate. Any stretcher, bearing seat and support attachment must follow that derived O, while retaining explicit load paths to actual frame material outside openings. A fixed numerical pivot, an empty bore, or a floating ring is not support. See the separate frame-support-r29-study for its proposed interface and provenance.

## 7. What each certificate actually certifies

SOLVER_QA.json contains sampled finite closure, rigid inverse mappings, nominal lateral gaps and terminal/guide/shaft/head gates. ACTUAL_CASTING_QA.json checks the actual integrated web implementation independently. Negative/unsupported cases include original centre placement, tilted-axis misuse, arbitrary Y shift, shortened shaft against the earlier retained rear-gland position, and oversized chest envelope. The early chest/rear-power-cover overlap and later front-cover/front-power-cover overlap are both explicitly retained as failures rather than renamed intended unions. The final whole-cover separation is checked by monotonic beta endpoint envelopes, not selected images.

CONDITIONAL_DOMAIN_CERTIFICATE.json and CONDITIONAL_PIN_BOXES.json use 60-digit directed-outward Decimal arithmetic, 4,096 cells for each sign, on independent outer spindle coordinates [4.02,4.18]^2. The exported binary endpoints are widened by nextafter. The proofs establish selected central-branch existence and bound pins conditional on that input rectangle. The1,441 outside-gear samples are asserted inside that rectangle, but they do not prove the upstream nonlinear outside solver remains inside it for every real phase, certify JavaScript floating-point execution, or establish whole-installation safety.

Importantly, the independent-input rectangle has a broader M range than the correlated actual phase samples. It does not pass the guide/gland bounds as a whole. Do not advertise the phase-sampled guide/gland margins as continuously certified by that rectangle. The frame study may still use those broader conditional envelopes conservatively.

## Integration checklist

1. Preserve original scalar fields and baseline visibility. Add a separate candidate only.
2. Inspect retained profiles from original extractReference(scene), not from candidate numerical endpoints.
3. Construct newG with the desired explicit candidate parameters. Set profiles.spindles.M.length to newG.reference.lengths.middleSpindle before S.parts/I.pack; otherwise old profile length 1.15 silently wins.
4. Derive stack layers from newG.reference; compile reference fields at newG.pose(0.4).
5. Every moving field gets exactly one inverse transform from its own candidate reference, all at the same theta. Do not stack old and new transforms.
6. Outside spindle aliases remain the same physical shafts and require the same terminal-bore policy; suppress no unrelated outside fields.
7. Render the whole train in baseline and candidate. Inspect power piston/covers, two outside mechanisms, central plates, all hardware, actual frame, axle and added chest/web/guide/support together.
8. Run whole-neighbor negative-field witnesses, not only AABBs or pictures. Preserve existing failure witnesses as baseline evidence.
9. Keep all claim flags below full mechanical/historical acceptance until force/support, openings, tolerance, valve events, fluid connections and complete swept interference are established.
