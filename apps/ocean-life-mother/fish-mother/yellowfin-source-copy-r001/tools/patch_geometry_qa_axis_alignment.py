from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1))


def patch_html() -> None:
    path = ROOT / "geometry-qa.html"
    replace_once(
        path,
        '      <div class="metric wide"><b>SOURCE↔COPY BROWSER Δ（记录项）</b><span id="browserDeltaText">—</span></div>',
        '      <div class="metric"><b>ALIGNED OVERLAY Δ</b><span id="alignedDeltaText">—</span></div>\n'
        '      <div class="metric"><b>RAW AXIS Δ</b><span id="browserDeltaText">—</span></div>',
    )
    replace_once(
        path,
        "  sourceStats:null,copyStats:null,receipt:null,receiptBounds:null,sourceBrowserBounds:null,copyBrowserBounds:null,\n"
        "  copyVsReceiptBoundsDelta:null,sourceCopyBrowserBoundsDelta:null,boundsTolerance:BOUNDS_TOLERANCE,\n"
        "  browserBoundsPolicy:'source SkinnedMesh bounds are diagnostic only; copy must match exact R006 package bounds',checks:{},failure:null",
        "  sourceStats:null,copyStats:null,receipt:null,receiptBounds:null,sourceBrowserBounds:null,copyBrowserBounds:null,alignedCopyBrowserBounds:null,\n"
        "  copyVsReceiptBoundsDelta:null,sourceCopyBrowserBoundsDelta:null,sourceVsAlignedCopyBrowserBoundsDelta:null,boundsTolerance:BOUNDS_TOLERANCE,\n"
        "  browserBoundsPolicy:'raw source/copy browser bounds are diagnostic; the copy must match exact R006 package bounds and the +90deg X aligned copy must match the source browser axes',checks:{},failure:null",
    )
    replace_once(
        path,
        "    sourceRoot=sourceGltf.scene;copyRoot=copyGltf.scene;\n"
        "    sourceRoot.name='ExactSourceRoot';copyRoot.name='SegmentedCopyRoot';\n"
        "    contentRoot.add(sourceRoot,copyRoot);displayRoot.add(contentRoot);scene.add(displayRoot);",
        "    sourceRoot=sourceGltf.scene;copyRoot=copyGltf.scene;\n"
        "    sourceRoot.name='ExactSourceRoot';copyRoot.name='SegmentedCopyRoot';\n"
        "    copyRoot.rotation.x=Math.PI/2;\n"
        "    copyRoot.updateMatrixWorld(true);\n"
        "    qa.alignedCopyBrowserBounds=boundsRecord(new THREE.Box3().setFromObject(copyRoot,true));\n"
        "    qa.sourceVsAlignedCopyBrowserBoundsDelta=maxBoundsDelta(qa.sourceBrowserBounds,qa.alignedCopyBrowserBounds);\n"
        "    $('alignedDeltaText').textContent=qa.sourceVsAlignedCopyBrowserBoundsDelta.toExponential(3);\n"
        "    contentRoot.add(sourceRoot,copyRoot);displayRoot.add(contentRoot);scene.add(displayRoot);",
    )
    replace_once(
        path,
        "      allFacesAssignedExactlyOnce:receipt.gates.allFacesAssignedExactlyOnce===true,\n"
        "      copyBoundsMatchExactSourcePackage:qa.copyVsReceiptBoundsDelta<=BOUNDS_TOLERANCE\n",
        "      allFacesAssignedExactlyOnce:receipt.gates.allFacesAssignedExactlyOnce===true,\n"
        "      copyBoundsMatchExactSourcePackage:qa.copyVsReceiptBoundsDelta<=BOUNDS_TOLERANCE,\n"
        "      sourceAndAlignedCopyBoundsMatch:qa.sourceVsAlignedCopyBrowserBoundsDelta<=BOUNDS_TOLERANCE\n",
    )
    replace_once(
        path,
        "    if(failed.length)throw new Error(`几何 QA 失败：${failed.join(', ')}；copy↔package Δ=${qa.copyVsReceiptBoundsDelta.toExponential(6)}；source↔copy browser Δ=${qa.sourceCopyBrowserBoundsDelta.toExponential(6)}`);",
        "    if(failed.length)throw new Error(`几何 QA 失败：${failed.join(', ')}；copy↔package Δ=${qa.copyVsReceiptBoundsDelta.toExponential(6)}；raw axis Δ=${qa.sourceCopyBrowserBoundsDelta.toExponential(6)}；aligned overlay Δ=${qa.sourceVsAlignedCopyBrowserBoundsDelta.toExponential(6)}`);",
    )
    replace_once(
        path,
        "    qa.ready=true;$('progressBar').style.width='100%';setMode('copy');setView('side');setRegion('all');setState('ok','分区几何副本通过结构门禁',`${receipt.output.faceCount.toLocaleString()} faces · ${receipt.output.meshCount} regions · copy↔package Δ ${qa.copyVsReceiptBoundsDelta.toExponential(3)}`);",
        "    qa.ready=true;$('progressBar').style.width='100%';setMode('copy');setView('side');setRegion('all');setState('ok','分区几何副本通过结构门禁',`${receipt.output.faceCount.toLocaleString()} faces · ${receipt.output.meshCount} regions · package Δ ${qa.copyVsReceiptBoundsDelta.toExponential(3)} · aligned Δ ${qa.sourceVsAlignedCopyBrowserBoundsDelta.toExponential(3)}`);",
    )
    replace_once(
        path,
        '<div class="rule"><strong>硬门禁：</strong>源和副本的完整场景三角面数必须一致；每个源 mesh primitive instance 必须保留；副本边界与精确源包边界的最大差不得超过 0.00005 源单位。重合模式中青色线框为浏览器蒙皮源，彩色实体为静态分区副本。</div>',
        '<div class="rule"><strong>硬门禁：</strong>源和副本的完整场景三角面数必须一致；每个源 mesh primitive instance 必须保留；副本边界与精确源包边界的最大差不得超过 0.00005；副本按已证明的坐标映射 `(x, y, z) → (x, -z, y)`，即 `+90° X` 后，与浏览器源边界差也不得超过 0.00005。重合模式中青色线框为浏览器蒙皮源，彩色实体为轴对齐后的静态分区副本。</div>',
    )


def patch_capture() -> None:
    path = ROOT / "geometry-qa" / "capture-geometry-qa.cjs"
    replace_once(
        path,
        "    copyBrowserBounds: qa?.copyBrowserBounds || null,\n"
        "    copyVsExactPackageBoundsDelta: qa?.copyVsReceiptBoundsDelta ?? null,\n"
        "    sourceVsCopyBrowserBoundsDelta: qa?.sourceCopyBrowserBoundsDelta ?? null,",
        "    copyBrowserBounds: qa?.copyBrowserBounds || null,\n"
        "    alignedCopyBrowserBounds: qa?.alignedCopyBrowserBounds || null,\n"
        "    copyVsExactPackageBoundsDelta: qa?.copyVsReceiptBoundsDelta ?? null,\n"
        "    sourceVsCopyBrowserBoundsDelta: qa?.sourceCopyBrowserBoundsDelta ?? null,\n"
        "    sourceVsAlignedCopyBrowserBoundsDelta: qa?.sourceVsAlignedCopyBrowserBoundsDelta ?? null,",
    )


def patch_test() -> None:
    path = ROOT / "tests" / "source-copy-geometry-r001.test.mjs"
    replace_once(
        path,
        "assert.ok(browserReceipt.copyVsExactPackageBoundsDelta <= browserReceipt.boundsTolerance);\n"
        "assert.ok(Number.isFinite(browserReceipt.sourceVsCopyBrowserBoundsDelta));\n"
        "assert.match(browserReceipt.browserBoundsPolicy, /diagnostic only|record/i);",
        "assert.ok(browserReceipt.copyVsExactPackageBoundsDelta <= browserReceipt.boundsTolerance);\n"
        "assert.ok(Number.isFinite(browserReceipt.sourceVsCopyBrowserBoundsDelta));\n"
        "assert.ok(browserReceipt.sourceVsAlignedCopyBrowserBoundsDelta <= browserReceipt.boundsTolerance);\n"
        "assert.ok(browserReceipt.checks.sourceAndAlignedCopyBoundsMatch);\n"
        "assert.match(browserReceipt.browserBoundsPolicy, /diagnostic|aligned/i);",
    )
    replace_once(
        path,
        "  sourceVsCopyBrowserBoundsDelta: browserReceipt.sourceVsCopyBrowserBoundsDelta,",
        "  sourceVsCopyBrowserBoundsDelta: browserReceipt.sourceVsCopyBrowserBoundsDelta,\n"
        "  sourceVsAlignedCopyBrowserBoundsDelta: browserReceipt.sourceVsAlignedCopyBrowserBoundsDelta,",
    )


def main() -> None:
    patch_html()
    patch_capture()
    patch_test()
    print("PATCHED_EXACT_SOURCE_COPY_AXIS_ALIGNMENT")


if __name__ == "__main__":
    main()
