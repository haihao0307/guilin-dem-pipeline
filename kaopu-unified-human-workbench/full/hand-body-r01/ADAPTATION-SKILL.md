# Reusable hand/body adaptation procedure

1. Lock the accepted character topology, full influence CSR, shape state and rest fingerprint. Obtain a fresh native rig for each changed identity. Do not edit or replace accepted anchors.
2. Inspect source pose order, virtual root, helper joints, parent chains, axis conventions, units and reference pose. Execute zero pose, single-joint, translation and finger probes before retargeting.
3. Convert rotations through rest-aligned bases. Never reinterpret SOMA T-pose angles as Anny A-pose angles. Reject incomplete maps instead of silently dropping joints.
4. Build task goals in an explicit space. Native pelvis-centred Z-up, view/world Y-up and object origin/COM are separate frames. Keep a fixed grasp-to-object transform.
5. Solve body participation, planted support, arm reach/pole, wrist swing/twist and individual finger articulation. Preserve bone lengths; clamp and report unreachable targets. Redistribute axial roll over existing helpers without adding or truncating skin weights.
6. Test open/fist/pinch/grasp/carry/reach-turn through approach, closure, hold, release and recovery. Test both sides, exact resets, scrubbing, changed proportions and repeated transitions.
7. Skin actual complete CommonPerson geometry. Render body front/side and close hand views, not only skeletons. Measure thumb/index pad clearance and inter-finger penetration separately from skeleton-tip proxies.
8. Bind a real rigid-body lifecycle only at fixed steps, after current-pose alignment. Release after the last completed kinematic target and inherit the solver's COM velocity. Reset on discontinuous seeks.
9. Record teacher-derived principles, executed external code/weights and self-authored algorithms separately. If a corrective checkpoint, physical grasp or full-body retarget has not run, say so.
10. Publish only the independently verified candidate directory after source/asset integrity and visual gates; leave established workbenches untouched.
