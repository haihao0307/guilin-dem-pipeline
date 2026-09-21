from __future__ import annotations

"""R07-P10 browser and geometry gate profile.

P10 keeps Porites lutea's usually smooth massive surface while resolving many
small, irregular, integrated corallites.  The gates therefore require visible
but moderate relief, deterministic Poisson spacing, no spiral/latitude lattice,
and constant topology across Microscope values.
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
        "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 18, initial\n        assert qa.get('integratedCoralliteField') is True and qa.get('explicitCoralliteCups') is False, initial\n        assert qa.get('siteDistribution') == 'deterministic-poisson-dart-hemisphere' and qa.get('rowBandCount') == 0 and qa.get('spiralLattice') is False, initial\n        assert qa.get('coralliteSiteCount', 0) > 3500 and qa.get('siteAcceptanceRatio', 0) > .70, initial\n        assert .04 < qa.get('siteRadiusCv', 0) < .20 and .03 < qa.get('siteNearestNeighborCv', 0) < .45, initial\n        assert qa.get('poissonMinSpacing', 0) > .010 and qa.get('relaxedSiteFraction', 1) < .65, initial\n        assert qa.get('microDisplacementSpace') == 'surface-normal-integrated-voronoi' and abs(qa.get('microTangentialLeakRms', 1)) < 1e-10, initial\n        assert qa.get('baseVertexCount') == qa.get('vertexCount'), initial\n        assert qa.get('maxMicroNormalDisplacement', 1) < .016, initial",
    "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')":
        "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')\n        evaluate(\"setView('micro');true\");time.sleep(.8)\n        closeup = capture(f'QA_CLOSEUP_{label.upper()}.png')\n        evaluate(\"setView('persp');true\");time.sleep(.2)",
    "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full),":
        "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full), 'closeupScreenshotBytes': len(closeup), 'coralliteSiteCount': qa['coralliteSiteCount'], 'siteAcceptanceRatio': qa['siteAcceptanceRatio'], 'siteNearestNeighborCv': qa['siteNearestNeighborCv'], 'poissonMinSpacing': qa['poissonMinSpacing'],",
    "evaluate(\"camera.dist=4.4;camera.yaw=.72;camera.pitch=.34;true\");time.sleep(.5)":
        "evaluate(\"setView('micro');true\");time.sleep(.8)",
    "assert micro1['microRms'] > .015 and micro1['microCoverage'] > 70, (micro0,micro1)":
        "assert .0015 < micro1['microRms'] < .008 and micro1['microCoverage'] > 18, (micro0,micro1)\n            assert micro0['vertices']==micro1['vertices'] and micro0['triangles']==micro1['triangles'], (micro0,micro1)",
    "defaults={'microDepth':.72,'warp':.24,'lobes':.52,'saturation':1.0}":
        "defaults={'microDepth':.62,'warp':.12,'lobes':.16,'saturation':.92}",
    "build['functionalGates']={'noaaMassiveClassification':True,'anchoredBase':True,'uniformSpeciesColor':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}":
        "build['functionalGates']={'noaaMassiveClassification':True,'palauRegionalOccurrenceEvidence':True,'localPlacementStillUnresolved':True,'anchoredBase':True,'uniformSpeciesColor':True,'usuallySmoothBase':True,'integratedCoralliteField':True,'explicitCoralliteCups':False,'poissonDartSiteDistribution':True,'spiralLatticeRejected':True,'noLatitudeBandGenerator':True,'siteSizeVariation':True,'poissonSpacing':True,'surfaceNormalDisplacement':True,'zeroTangentialLeak':True,'moderateReliefCeiling':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'constantTopologyAcrossMicroscope':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}",
}

for old, new in replacements.items():
    if old not in code:
        raise RuntimeError(f"P10 QA source marker missing: {old}")
    code = code.replace(old, new, 1)

exec(compile(code, str(SOURCE), "exec"), {"__name__": "__main__", "__file__": str(SOURCE)})
