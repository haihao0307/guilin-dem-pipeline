# R29 side-offset whole-installation study

Implemented finite configurable control solver, joint bore/frame/guide/shaft constraints, conditional pin enclosures and independent tests of the actual R29 added common-casting web. No R28, v19 or Git edits. All new numerical dimensions are inferred; official evidence supplies topology only.

Read WHOLE_INSTALLATION_PLAN.md for dependencies, admissible families, integration instructions and explicit proof limits.

Run from this study directory, or use the full script path from anywhere:

    node test_solver.js --model /absolute/path/to/r29
    python certify_input_box.py --model /absolute/path/to/r29
    node test_actual_casting.js --model /absolute/path/to/r29

If --model is omitted, the scripts find ../r29 in the original study layout, or the parent model directory when this folder is copied inside R29. No files are written into the model directory. The model must contain its retained gresley_solver.js, stack-reconstruction and gresley-reconstruction helpers.

The first command regenerates candidate references and sampled QA; the second uses those references to regenerate the conditional outward interval bounds. The last reads the actual sibling r29/build_middle_chest.js and topology-parameters.js and writes independent casting checks here, without modifying r29.

API: side_offset_solver.js provides createSideOffsetGresleySolver(scene,dynamic,outside,options), compatible with the existing pose/reference/frame interfaces. Default values are an inferred example; integration must pass its complete candidate parameters. installation_constraints.js exposes pure corridor, coordinate and sampled cycle gates.

No whole-mechanical, historical, tolerance, steam-event or structural pass is claimed. The broad independent-input-box certificate is not a continuous guide/gland-clearance certificate.
