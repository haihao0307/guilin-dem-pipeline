#!/usr/bin/env python3
"""Materialize Candidate B contracts and browser QA from the proven Candidate A harness."""

from __future__ import annotations

from pathlib import Path

ROOT = Path("apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001")


def common(text: str) -> str:
    return (
        text.replace("CANDIDATE_A", "CANDIDATE_B")
        .replace("CANDIDATE-A", "CANDIDATE-B")
        .replace("candidateA", "candidateB")
        .replace("Candidate A", "Candidate B")
        .replace("candidate-a", "candidate-b")
    )


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def materialize_machine_test() -> None:
    source = ROOT / "tests/candidate-a-r001.test.mjs"
    target = ROOT / "tests/candidate-b-r001.test.mjs"
    text = common(source.read_text(encoding="utf-8"))
    text = replace_once(
        text,
        "assert.equal(receipt.deformation.secondDorsalMirroredSheetsDeformedTogether, true);",
        "assert.equal(receipt.deformation.secondDorsalMirroredSheetsDeformedTogether, false);\nassert.equal(receipt.deformation.secondDorsalSingleWatertightStructureSelected, true);\nassert.equal(receipt.deformation.firstDorsalRearPanelsIndependentlyElongated, false);",
        "Candidate B dorsal deformation contract",
    )
    text = replace_once(
        text,
        "assert.equal(receipt.after.secondDorsalSurfaceCount, 2);",
        "assert.equal(receipt.after.secondDorsalSurfaceCount, 1);",
        "Candidate B second dorsal surface count",
    )
    text = replace_once(
        text,
        "assert.equal(receipt.componentSelection.secondDorsalSurfaces.length, 2);",
        "assert.equal(receipt.componentSelection.secondDorsalSurfaces.length, 1);",
        "Candidate B second dorsal component count",
    )
    text = replace_once(
        text,
        "  [2, 4],",
        "  [1],",
        "Candidate B true second dorsal IDs",
    )
    anchor = "assert.equal(receipt.deformation.finletCountChanged, false);\n"
    extra = """assert.equal(receipt.gates.candidateAVisualRejected, true);
assert.equal(receipt.gates.trueSecondDorsalComponentSelected, true);
assert.equal(receipt.gates.firstDorsalFrontSheetsPreserved, true);
assert.equal(receipt.gates.firstDorsalRearSheetsPreservedFromIndependentElongation, true);
assert.equal(receipt.gates.candidateBMachineAcceptancePassed, true);
assert.ok(receipt.controls.secondDorsalFactor < 1.5, 'Candidate B must not repeat the 4.72x wrong-panel expansion');
assert.equal(receipt.predecessorReview.manualVisualAcceptance, false);
assert.equal(status.candidateA.manualVisualAcceptance, false);
assert.equal(status.gates.candidateAVisualRejected, true);
"""
    text = replace_once(text, anchor, anchor + extra, "Candidate B predecessor review gates")
    target.write_text(text, encoding="utf-8")


def materialize_html() -> None:
    source = ROOT / "candidate-a-qa.html"
    target = ROOT / "candidate-b-qa.html"
    text = common(source.read_text(encoding="utf-8"))
    old_box = "function regionBox(root,region){const box=new THREE.Box3(),temp=new THREE.Box3();let found=0;root.traverse(object=>{if(!object.isMesh||object.userData?.kaopuSourceCopyRegion!==region)return;temp.setFromObject(object,true);if(!temp.isEmpty()){box.union(temp);found++}});return found?{box,found}:null}"
    new_box = "function regionBox(root,region){const box=new THREE.Box3(),temp=new THREE.Box3();let found=0;root.updateMatrixWorld(true);root.traverse(object=>{if(!object.isMesh||object.userData?.kaopuSourceCopyRegion!==region||!object.geometry)return;object.geometry.computeBoundingBox();if(!object.geometry.boundingBox)return;temp.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);if(!temp.isEmpty()){box.union(temp);found++}});return found?{box,found}:null}"
    text = replace_once(text, old_box, new_box, "Candidate B geometry-only focus box")
    text = text.replace("Math.max(size.x,size.y,size.z)*3.4", "Math.max(size.x,size.y,size.z)*1.85")
    text = replace_once(
        text,
        "receipt.after.firstDorsalSurfaceCount===2&&receipt.after.secondDorsalSurfaceCount===2",
        "receipt.after.firstDorsalSurfaceCount===2&&receipt.after.secondDorsalSurfaceCount>=1",
        "Candidate B browser dorsal count",
    )
    check_anchor = "      rigPreservationMachineGatesPassed:receipt.gates.sourceNodeHierarchyRetained===true&&receipt.gates.sourceSkinTableRetained===true&&receipt.gates.sourceInverseBindMatricesRetained===true&&receipt.gates.sourceAnimationTableRetained===true&&receipt.gates.sourceAnimationAccessorsRetained===true,\n"
    check_extra = "      trueSecondDorsalIdentityResolved:receipt.gates.trueSecondDorsalComponentSelected===true&&receipt.gates.firstDorsalRearSheetsPreservedFromIndependentElongation===true&&JSON.stringify(receipt.componentSelection.secondDorsalSurfaces.map(item=>item.component))==='[1]',\n"
    text = replace_once(text, check_anchor, check_anchor + check_extra, "Candidate B browser identity gate")
    text = text.replace(
        "13 regions · 6,920 semantic faces · 98 bones · second dorsal sheets [2,4] symmetric · manual visual acceptance pending",
        "13 regions · 6,920 semantic faces · 98 bones · true second dorsal [1] · first-dorsal rear panels [2,4] preserved · manual visual acceptance pending",
    )
    target.write_text(text, encoding="utf-8")


def materialize_capture() -> None:
    source = ROOT / "candidate-a-qa/capture-candidate-a-qa.cjs"
    target = ROOT / "candidate-b-qa/capture-candidate-b-qa.cjs"
    target.parent.mkdir(parents=True, exist_ok=True)
    text = common(source.read_text(encoding="utf-8"))
    target.write_text(text, encoding="utf-8")


def materialize_recorder() -> None:
    source = ROOT / "tools/record_candidate_a_browser_status.py"
    target = ROOT / "tools/record_candidate_b_browser_status.py"
    text = common(source.read_text(encoding="utf-8"))
    old_next = '''NEXT = (
    "Review the fixed Candidate B screenshots manually for Yellowfin silhouette, first/second dorsal identity, "
    "paired-surface continuity, eye/cornea attachment, fin roots and Swim deformation. If rejected, create "
    "Candidate B from the frozen Source Copy; do not modify Candidate B in place and do not mark productionReady."
)
'''
    new_next = '''NEXT = (
    "Review Candidate B screenshots manually for Yellowfin silhouette, complete first-dorsal assembly, true second dorsal component 1, "
    "eye/cornea attachment, pectoral and anal roots, and Swim deformation. Keep productionReady false until explicit visual approval."
)
'''
    text = replace_once(text, old_next, new_next, "Candidate B recorder next step")
    text = replace_once(
        text,
        '    if machine.get("gates", {}).get("secondDorsalSurfaceSymmetryPassed") is not True:\n        raise SystemExit("Candidate B second dorsal mirrored sheets are not symmetric")\n',
        '    if machine.get("gates", {}).get("trueSecondDorsalComponentSelected") is not True:\n        raise SystemExit("Candidate B true second dorsal component is unresolved")\n    if machine.get("gates", {}).get("firstDorsalRearSheetsPreservedFromIndependentElongation") is not True:\n        raise SystemExit("Candidate B first-dorsal rear panels were independently elongated")\n',
        "Candidate B recorder anatomy gates",
    )
    target.write_text(text, encoding="utf-8")


def materialize_browser_test() -> None:
    source = ROOT / "tests/candidate-a-browser-r001.test.mjs"
    target = ROOT / "tests/candidate-b-browser-r001.test.mjs"
    text = common(source.read_text(encoding="utf-8"))
    anchor = "assert.equal(browser.focusAvailable.pectoral, true);\n"
    extra = """assert.equal(machine.gates.trueSecondDorsalComponentSelected, true);
assert.equal(machine.gates.firstDorsalRearSheetsPreservedFromIndependentElongation, true);
assert.deepEqual(machine.componentSelection.secondDorsalSurfaces.map(item => item.component), [1]);
assert.equal(status.candidateA.manualVisualAcceptance, false);
assert.equal(status.gates.candidateAVisualRejected, true);
"""
    text = replace_once(text, anchor, anchor + extra, "Candidate B browser identity assertions")
    target.write_text(text, encoding="utf-8")


def main() -> None:
    materialize_machine_test()
    materialize_html()
    materialize_capture()
    materialize_recorder()
    materialize_browser_test()
    for path in [
        ROOT / "tests/candidate-b-r001.test.mjs",
        ROOT / "candidate-b-qa.html",
        ROOT / "candidate-b-qa/capture-candidate-b-qa.cjs",
        ROOT / "tools/record_candidate_b_browser_status.py",
        ROOT / "tests/candidate-b-browser-r001.test.mjs",
    ]:
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
