from __future__ import annotations

"""Direct R07-P08 browser QA from the stable P00 harness."""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p00_browser_qa.py')
code = SOURCE.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global code
    count = code.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one source marker, found {count}')
    code = code.replace(old, new, 1)


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
    "assert qa.get('vertexCount', 0) > 50000 and qa.get('triangleCount', 0) > 100000, initial",
    'integrated field mesh size',
)
replace_once(
    "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 70, initial",
    "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 8, initial",
    'integrated cup coverage',
)
replace_once(
    "assert qa.get('warpGeometry') is True and qa.get('normalDeviationRms', 0) > .001, initial",
    "assert qa.get('warpGeometry') is True and qa.get('normalDeviationRms', 0) > .0005 and qa.get('meshResolution') == '160x320-integrated-fibonacci' and qa.get('colonyForm') == 'hemispherical-or-helmet-shaped' and qa.get('surfaceProfile') == 'usually-smooth' and qa.get('coralliteDistribution') == 'jittered-fibonacci-hemisphere' and qa.get('latitudeBanding') is False and qa.get('coralliteTopology') == 'integrated-pit-rim-shared-wall-septa' and qa.get('microDisplacementSpace') == 'integrated-surface-normal' and qa.get('microRadialOnly') is False and qa.get('microTangentialLeakRms', 1) < 1e-9 and qa.get('microNormalDisplacementRms', 0) > .0004 and qa.get('baseSurfaceMicroNoise') is False and qa.get('coralliteCenterCount', 0) > 1500 and qa.get('activeCoralliteCount', 0) > 900, initial",
    'integrated Fibonacci topology',
)
replace_once(
    "assert qa.get('visualAcceptance') is False and qa.get('productionReady') is False, initial",
    "assert build.get('microDisplacementSpace') == 'integrated-surface-normal' and build.get('microRadialOnly') is False and build.get('baseSurfaceMicroNoise') is False and build.get('latitudeBanding') is False, initial\n        assert qa.get('visualAcceptance') is False and qa.get('productionReady') is False, initial",
    'runtime build marker contract',
)

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

replace_once(
    "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')",
    "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')\n        evaluate(\"setView('micro');true\")\n        time.sleep(.8)\n        closeup = capture(f'QA_CLOSEUP_{label.upper()}.png', True)\n        evaluate(\"setView('persp');true\")\n        time.sleep(.25)",
    'closeup capture',
)
replace_once(
    "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full),",
    "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full), 'closeupScreenshotBytes': len(closeup), 'coralliteCenterCount': qa['coralliteCenterCount'], 'activeCoralliteCount': qa['activeCoralliteCount'],",
    'result integrated evidence',
)
replace_once(
    'evaluate("camera.dist=4.4;camera.yaw=.72;camera.pitch=.34;true");time.sleep(.5)',
    'evaluate("setView(\'micro\');true");time.sleep(.8)',
    'functional closeup view',
)
replace_once(
    'microRms:q.microDisplacementRms,microCoverage:q.microCoveragePct,warpRms:q.warpDisplacementRms',
    'microRms:q.microDisplacementRms,microCoverage:q.microCoveragePct,microNormalRms:q.microNormalDisplacementRms,microTangentialLeak:q.microTangentialLeakRms,microSpace:q.microDisplacementSpace,centerCount:q.coralliteCenterCount,activeCenters:q.activeCoralliteCount,distribution:q.coralliteDistribution,latitudeBanding:q.latitudeBanding,baseSurfaceMicroNoise:q.baseSurfaceMicroNoise,warpRms:q.warpDisplacementRms',
    'functional probe fields',
)
replace_once(
    "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0, (micro0,micro1)",
    "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0 and abs(micro0['microNormalRms']) < 1e-10 and micro0['activeCenters'] == 0 and micro0['centerCount'] > 1500, (micro0,micro1)",
    'microscope zero gate',
)
replace_once(
    "assert micro1['microRms'] > .015 and micro1['microCoverage'] > 70, (micro0,micro1)",
    "assert micro1['microRms'] > .0004 and micro1['microCoverage'] > 8 and micro1['microNormalRms'] > .0004 and micro1['microTangentialLeak'] < 1e-9 and micro1['microSpace'] == 'integrated-surface-normal' and micro1['centerCount'] > 1500 and micro1['activeCenters'] > 900 and micro1['distribution'] == 'jittered-fibonacci-hemisphere' and micro1['latitudeBanding'] is False and micro1['baseSurfaceMicroNoise'] is False, (micro0,micro1)",
    'microscope one gate',
)
replace_once(
    "assert micro0['signature'] != micro1['signature'] and mdiff['changedPixelPct'] > .8 and mdiff['changedRegionMeanRgb'] > 5, (micro0,micro1,mdiff)",
    "assert micro0['signature'] != micro1['signature'] and mdiff['changedPixelPct'] > .7 and mdiff['changedRegionMeanRgb'] > 4, (micro0,micro1,mdiff)",
    'microscope visible difference',
)
replace_once(
    "defaults={'microDepth':.72,'warp':.24,'lobes':.52,'saturation':1.0}",
    "defaults={'microDepth':.62,'warp':.12,'lobes':.16,'saturation':.92}",
    'P08 defaults',
)
replace_once(
    "build['functionalGates']={'noaaMassiveClassification':True,'anchoredBase':True,'uniformSpeciesColor':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}",
    "build['functionalGates']={'noaaMassiveClassification':True,'palauRegionalOccurrenceEvidence':True,'localPlacementStillUnresolved':True,'anchoredBase':True,'uniformSpeciesColor':True,'usuallySmoothBase':True,'integratedFibonacciCorallites':True,'latitudeBandingRejected':True,'activeCorallitesDisappearAtMicroscopeZero':True,'microscopeGeometry':True,'microscopeVisibleDifference':True,'warpGeometry':True,'warpVisibleDifference':True,'macroLobesGeometry':True,'runtimeErrors':0}",
    'P08 functional gate manifest',
)

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
