from __future__ import annotations

"""R07-P11 browser, geometry, and micro-readability gates.

P11 retains real surface-normal geometry displacement and a single RGB species
colour.  A separate vertex-alpha micro signal may affect only local lighting so
integrated pits, rims, and shared walls remain readable in close-up.
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
        "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 18, initial\n        assert qa.get('integratedCoralliteField') is True and qa.get('explicitCoralliteCups') is False, initial\n        assert qa.get('siteDistribution') == 'deterministic-poisson-dart-hemisphere' and qa.get('rowBandCount') == 0 and qa.get('spiralLattice') is False, initial\n        assert qa.get('coralliteSiteCount', 0) > 3500 and qa.get('siteAcceptanceRatio', 0) > .70, initial\n        assert .04 < qa.get('siteRadiusCv', 0) < .20 and .03 < qa.get('siteNearestNeighborCv', 0) < .45, initial\n        assert qa.get('poissonMinSpacing', 0) > .010 and qa.get('relaxedSiteFraction', 1) < .65, initial\n        assert qa.get('microDisplacementSpace') == 'surface-normal-integrated-voronoi' and abs(qa.get('microTangentialLeakRms', 1)) < 1e-10, initial\n        assert qa.get('baseVertexCount') == qa.get('vertexCount'), initial\n        assert qa.get('maxMicroNormalDisplacement', 1) < .016, initial\n        assert qa.get('microSignalEncoding') == 'vertex-alpha-lighting-only' and qa.get('uniformRgbColor') is True, initial\n        assert len(qa.get('microSignalRange', [])) == 2 and qa['microSignalRange'][1]-qa['microSignalRange'][0] > .45 and qa.get('microSignalRms', 0) > .08, initial",
    "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')":
        "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')\n        evaluate(\"setView('micro');true\");time.sleep(.8)\n        closeup = capture(f'QA_CLOSEUP_{label.upper()}.png')\n        evaluate(\"setView('persp');true\");time.sleep(.2)",
    "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full),":
        "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full), 'closeupScreenshotBytes': len(closeup), 'coralliteSiteCount': qa['coralliteSiteCount'], 'siteAcceptanceRatio': qa['siteAcceptanceRatio'], 'siteNearestNeighborCv': qa['siteNearestNeighborCv'], 'poissonMinSpacing': qa['poissonMinSpacing'], 'microSignalRange': qa['microSignalRange'], 'microSignalRms': qa['microSignalRms'],",
    "evaluate(\"camera.dist=4.4;camera.yaw=.72;camera.pitch=.34;true\");time.sleep(.5)":
        "evaluate(\"setView('micro');true\");time.sleep(.8)",
    "rebuildMs:q.rebuildMs}}":
        "rebuildMs:q.rebuildMs,microSignalRange:q.microSignalRange,microSignalRms:q.microSignalRms,microSignalEncoding:q.microSignalEncoding,uniformRgbColor:q.uniformRgbColor}}",
    "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0, (micro0,micro1)":
        "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0, (micro0,micro1)\n            assert micro0['microSignalRange'] == [.5,.5] and abs(micro0['microSignalRms']) < 1e-10, (micro0,micro1)",
    "assert micro1['microRms'] > .015 and micro1['microCoverage'] > 70, (micro0,micro1)":
        "assert .0015 < micro1['microRms'] < .008 and micro1['microCoverage'] > 18, (micro0,micro1)\n            assert micro1['microSignalRange'][1]-micro1['microSignalRange'][0] > .45 and micro1['microSignalRms'] > .08, (micro0,micro1)\n            assert micro1['microSignalEncoding'] == 'vertex-alpha-lighting-only' and micro1['uniformRgbColor'] is True, micro1\n            assert micro0['vertices']==micro1['vertices'] and micro0['triangles']==micro1['triangles'], (micro0,micro1)",
    "assert micro0['signature'] != micro1['signature'] and mdiff['changedPixelPct'] > .8 and mdiff['changedRegionMeanRgb'] > 5, (micro0,micro1,mdiff)":
        "assert micro0['signature'] != micro1['signature'] and mdiff['changedPixelPct'] > 2.5 and mdiff['changedRegionMeanRgb'] > 8, (micro0,micro1,mdiff)",
    "defaults={'microDepth':.72,'warp':.24,'lobes':.52,'saturation':1.0}":
        "defaults={'microDepth':.62,'warp':.12,'lobes':.16,'saturation':.92}",
    "build['functionalGates']={'noaaMassiveClassification':True,'anchoredBase':True,'uniformSpeciesColor':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}":
        "build['functionalGates']={'noaaMassiveClassification':True,'palauRegionalOccurrenceEvidence':True,'localPlacementStillUnresolved':True,'anchoredBase':True,'uniformSpeciesColor':True,'uniformRgbColor':True,'microSignalUsesNonRgbChannel':True,'neutralSignalAtMicroscopeZero':True,'readableSignalRange':True,'usuallySmoothBase':True,'integratedCoralliteField':True,'explicitCoralliteCups':False,'poissonDartSiteDistribution':True,'spiralLatticeRejected':True,'noLatitudeBandGenerator':True,'siteSizeVariation':True,'poissonSpacing':True,'surfaceNormalDisplacement':True,'zeroTangentialLeak':True,'moderateReliefCeiling':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'constantTopologyAcrossMicroscope':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}",
}

for old, new in replacements.items():
    if old not in code:
        raise RuntimeError(f"P11 QA source marker missing: {old}")
    code = code.replace(old, new, 1)

exec(compile(code, str(SOURCE), "exec"), {"__name__": "__main__", "__file__": str(SOURCE)})
