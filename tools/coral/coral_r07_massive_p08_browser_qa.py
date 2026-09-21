from __future__ import annotations

"""R07-P08 browser and geometry gate profile.

P08 uses one continuous base mesh with an integrated, irregular Voronoi-like
corallite field.  It intentionally rejects P07's separate cup mesh and visible
latitude rows while retaining the same three browser sizes and image-difference
gates used by the earlier Massive candidates.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name("coral_r07_massive_p00_browser_qa.py")
code = SOURCE.read_text(encoding="utf-8")

replacements = {
    "assert qa.get('candidateSpecies') == 'Porites lutea morphology prototype', initial":
        "assert qa.get('candidateSpecies') == 'Porites lutea', initial",
    "assert qa.get('palauOccurrenceEvidence') == 'UNRESOLVED' and qa.get('ecologicalPlacementReady') is False, initial":
        "assert qa.get('palauArchipelagoOccurrenceEvidence') == 'NOAA_NCEI_CONFIRMED' and qa.get('localSitePlacementEvidence') == 'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND' and qa.get('ecologicalPlacementReady') is False, initial",
    "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 70, initial":
        "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 35, initial\n        assert qa.get('integratedCoralliteField') is True and qa.get('explicitCoralliteCups') is False, initial\n        assert qa.get('siteDistribution') == 'golden-angle-jittered-hemisphere' and qa.get('rowBandCount') == 0, initial\n        assert qa.get('coralliteSiteCount', 0) > 1800 and qa.get('siteRadiusCv', 0) > .08 and qa.get('siteJitterRms', 0) > .05, initial\n        assert qa.get('microDisplacementSpace') == 'surface-normal-integrated-voronoi' and abs(qa.get('microTangentialLeakRms', 1)) < 1e-10, initial\n        assert qa.get('baseVertexCount') == qa.get('vertexCount'), initial",
    "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')":
        "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')\n        evaluate(\"setView('micro');true\");time.sleep(.8)\n        closeup = capture(f'QA_CLOSEUP_{label.upper()}.png')\n        evaluate(\"setView('persp');true\");time.sleep(.2)",
    "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full),":
        "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full), 'closeupScreenshotBytes': len(closeup), 'coralliteSiteCount': qa['coralliteSiteCount'], 'siteRadiusCv': qa['siteRadiusCv'], 'siteJitterRms': qa['siteJitterRms'],",
    "evaluate(\"camera.dist=4.4;camera.yaw=.72;camera.pitch=.34;true\");time.sleep(.5)":
        "evaluate(\"setView('micro');true\");time.sleep(.8)",
    "assert micro1['microRms'] > .015 and micro1['microCoverage'] > 70, (micro0,micro1)":
        "assert micro1['microRms'] > .0035 and micro1['microCoverage'] > 35, (micro0,micro1)\n            assert micro0['vertices']==micro1['vertices'] and micro0['triangles']==micro1['triangles'], (micro0,micro1)",
    "defaults={'microDepth':.72,'warp':.24,'lobes':.52,'saturation':1.0}":
        "defaults={'microDepth':.62,'warp':.12,'lobes':.16,'saturation':.92}",
    "build['functionalGates']={'noaaMassiveClassification':True,'anchoredBase':True,'uniformSpeciesColor':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}":
        "build['functionalGates']={'noaaMassiveClassification':True,'palauRegionalOccurrenceEvidence':True,'localPlacementStillUnresolved':True,'anchoredBase':True,'uniformSpeciesColor':True,'integratedCoralliteField':True,'explicitCoralliteCups':False,'goldenAngleSiteDistribution':True,'noLatitudeBandGenerator':True,'siteSizeVariation':True,'siteJitter':True,'surfaceNormalDisplacement':True,'zeroTangentialLeak':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'constantTopologyAcrossMicroscope':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}",
}

for old, new in replacements.items():
    if old not in code:
        raise RuntimeError(f"P08 QA source marker missing: {old}")
    code = code.replace(old, new, 1)

exec(compile(code, str(SOURCE), "exec"), {"__name__": "__main__", "__file__": str(SOURCE)})
