from __future__ import annotations

"""Direct R07-P07 browser QA.

Build one final QA program from the stable P00 harness.  This deliberately
avoids executing the nested P05/P06 wrapper chain, whose source-marker order
became incompatible after P07 changed the corallite topology.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p00_browser_qa.py')
code = SOURCE.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global code
    count = code.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one source marker, found {count}')
    code = code.replace(old, new, 1)


# Species, regional evidence, mesh size, and explicit-cup runtime contract.
replace_once(
    "assert qa.get('candidateSpecies') == 'Porites lutea morphology prototype', initial",
    "assert qa.get('candidateSpecies') == 'Porites lutea' and qa.get('assetStatus') == 'morphology prototype', initial",
    'species contract',
)
replace_once(
    "assert qa.get('palauOccurrenceEvidence') == 'UNRESOLVED' and qa.get('ecologicalPlacementReady') is False, initial",
    "assert qa.get('palauArchipelagoOccurrenceEvidence') == 'NOAA_NCEI_CONFIRMED' and qa.get('palauEvidenceSite') == 'Ulong Channel' and qa.get('palauEvidenceDepthM') == 12 and qa.get('localSitePlacementEvidence') == 'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND' and qa.get('ecologicalPlacementReady') is False, initial",
    'Palau truth split',
)
replace_once(
    "assert qa.get('vertexCount', 0) > 8000 and qa.get('triangleCount', 0) > 15000, initial",
    "assert qa.get('vertexCount', 0) > 90000 and qa.get('triangleCount', 0) > 160000, initial",
    'explicit cup mesh size',
)
replace_once(
    "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 70, initial",
    "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 20, initial",
    'explicit cup coverage',
)
replace_once(
    "assert qa.get('warpGeometry') is True and qa.get('normalDeviationRms', 0) > .001, initial",
    "assert qa.get('warpGeometry') is True and qa.get('normalDeviationRms', 0) > .001 and qa.get('meshResolution') == '128x256+explicit-cups' and qa.get('colonyForm') == 'hemispherical-or-helmet-shaped' and qa.get('surfaceProfile') == 'usually-smooth' and qa.get('coralliteTopology') == 'outer-blend-rim-inner-filled-center' and qa.get('microDisplacementSpace') == 'explicit-surface-normal-cup-mesh' and qa.get('microRadialOnly') is False and qa.get('microTangentialLeakRms', 1) < 1e-9 and qa.get('microNormalDisplacementRms', 0) > .002 and qa.get('baseSurfaceMicroNoise') is False and qa.get('cupCount', 0) > 1000 and qa.get('cupSides') == 12 and qa.get('cupVertexCount', 0) > 40000 and qa.get('cupTriangleCount', 0) > 50000, initial",
    'explicit cup topology',
)
replace_once(
    "assert qa.get('visualAcceptance') is False and qa.get('productionReady') is False, initial",
    "assert build.get('microDisplacementSpace') == 'explicit-surface-normal-cup-mesh' and build.get('microRadialOnly') is False and build.get('baseSurfaceMicroNoise') is False, initial\n        assert qa.get('visualAcceptance') is False and qa.get('productionReady') is False, initial",
    'build marker contract',
)

# Species-level shape and evidence manifest checks.
anchor = "assert qa.get('baseAnchorError', 1) < 1e-6, initial"
insert = """assert qa.get('baseAnchorError', 1) < 1e-6, initial
        ext=qa.get('extent') or [0,0,0]
        assert len(ext)==3 and ext[1]>0 and 1.8 < ext[0]/ext[1] < 2.65 and abs(ext[0]-ext[2])/max(ext[0],ext[2],1e-6) < .08, initial
        assert (root/'PALAU_OCCURRENCE_EVIDENCE.json').is_file(), 'Palau occurrence evidence missing'
        evidence=json.loads((root/'PALAU_OCCURRENCE_EVIDENCE.json').read_text(encoding='utf-8'))
        assert evidence.get('species')=='Porites lutea' and evidence.get('regionalStatus')=='CONFIRMED', evidence
        assert evidence.get('site')=='Ulong Channel' and evidence.get('depthM')==12, evidence
        assert evidence.get('localGameSiteStatus')=='UNRESOLVED' and evidence.get('ecologicalPlacementReady') is False, evidence"""
replace_once(anchor, insert, 'shape and evidence checks')

# Keep a full workbench screenshot and a dedicated surface close-up at every
# viewport.  The functional A/B probes also use the close-up view.
replace_once(
    "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')",
    "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')\n        evaluate(\"setView('micro');true\")\n        time.sleep(.8)\n        closeup = capture(f'QA_CLOSEUP_{label.upper()}.png', True)\n        evaluate(\"setView('persp');true\")\n        time.sleep(.25)",
    'closeup capture',
)
replace_once(
    "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full),",
    "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full), 'closeupScreenshotBytes': len(closeup), 'cupCount': qa['cupCount'], 'cupVertexCount': qa['cupVertexCount'], 'cupTriangleCount': qa['cupTriangleCount'],",
    'result cup evidence',
)
replace_once(
    'evaluate("camera.dist=4.4;camera.yaw=.72;camera.pitch=.34;true");time.sleep(.5)',
    'evaluate("setView(\'micro\');true");time.sleep(.8)',
    'functional closeup view',
)

# Probe the explicit cup mesh, not the removed continuous displacement field.
replace_once(
    'microRms:q.microDisplacementRms,microCoverage:q.microCoveragePct,warpRms:q.warpDisplacementRms',
    'microRms:q.microDisplacementRms,microCoverage:q.microCoveragePct,microNormalRms:q.microNormalDisplacementRms,microTangentialLeak:q.microTangentialLeakRms,microSpace:q.microDisplacementSpace,cupCount:q.cupCount,cupVertices:q.cupVertexCount,cupTriangles:q.cupTriangleCount,baseSurfaceMicroNoise:q.baseSurfaceMicroNoise,warpRms:q.warpDisplacementRms',
    'functional probe fields',
)
replace_once(
    "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0, (micro0,micro1)",
    "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0 and abs(micro0['microNormalRms']) < 1e-10 and micro0['cupCount'] == 0, (micro0,micro1)",
    'microscope zero gate',
)
replace_once(
    "assert micro1['microRms'] > .015 and micro1['microCoverage'] > 70, (micro0,micro1)",
    "assert micro1['microRms'] > .004 and micro1['microCoverage'] > 20 and micro1['microNormalRms'] > .006 and micro1['microTangentialLeak'] < 1e-9 and micro1['microSpace'] == 'explicit-surface-normal-cup-mesh' and micro1['cupCount'] > 1000 and micro1['cupVertices'] > 40000 and micro1['cupTriangles'] > 50000 and micro1['baseSurfaceMicroNoise'] is False, (micro0,micro1)",
    'microscope one gate',
)
replace_once(
    "assert micro0['signature'] != micro1['signature'] and mdiff['changedPixelPct'] > .8 and mdiff['changedRegionMeanRgb'] > 5, (micro0,micro1,mdiff)",
    "assert micro0['signature'] != micro1['signature'] and mdiff['changedPixelPct'] > 1.2 and mdiff['changedRegionMeanRgb'] > 5, (micro0,micro1,mdiff)",
    'microscope visible difference',
)
replace_once(
    "defaults={'microDepth':.72,'warp':.24,'lobes':.52,'saturation':1.0}",
    "defaults={'microDepth':.62,'warp':.12,'lobes':.16,'saturation':.92}",
    'P07 defaults',
)

replace_once(
    "build['functionalGates']={'noaaMassiveClassification':True,'anchoredBase':True,'uniformSpeciesColor':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}",
    "build['functionalGates']={'noaaMassiveClassification':True,'palauRegionalOccurrenceEvidence':True,'localPlacementStillUnresolved':True,'anchoredBase':True,'uniformSpeciesColor':True,'usuallySmoothBase':True,'explicitCoralliteCups':True,'cupMeshDisappearsAtMicroscopeZero':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}",
    'P07 functional gate manifest',
)

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
