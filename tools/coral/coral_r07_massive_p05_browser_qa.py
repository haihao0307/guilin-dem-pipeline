from __future__ import annotations

"""R07-P05 browser profile.

P05 keeps the P00-P04 browser harness but changes the expected biology and
truth contract: hemispherical/helmet-shaped Porites lutea, usually smooth at
colony scale, shallow filled corallites, confirmed Palau Archipelago occurrence
at Ulong Channel, and unresolved local placement at Airai / Stone Money Island.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p00_browser_qa.py')
code = SOURCE.read_text(encoding='utf-8')

replacements = {
    "assert qa.get('candidateSpecies') == 'Porites lutea morphology prototype', initial":
        "assert qa.get('candidateSpecies') == 'Porites lutea' and qa.get('assetStatus') == 'morphology prototype', initial",
    "assert qa.get('palauOccurrenceEvidence') == 'UNRESOLVED' and qa.get('ecologicalPlacementReady') is False, initial":
        "assert qa.get('palauArchipelagoOccurrenceEvidence') == 'NOAA_NCEI_CONFIRMED' and qa.get('palauEvidenceSite') == 'Ulong Channel' and qa.get('palauEvidenceDepthM') == 12 and qa.get('localSitePlacementEvidence') == 'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND' and qa.get('ecologicalPlacementReady') is False, initial",
    "assert qa.get('vertexCount', 0) > 8000 and qa.get('triangleCount', 0) > 15000, initial":
        "assert qa.get('vertexCount', 0) > 50000 and qa.get('triangleCount', 0) > 100000, initial",
    "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 70, initial":
        "assert qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 20, initial",
    "assert qa.get('warpGeometry') is True and qa.get('normalDeviationRms', 0) > .001, initial":
        "assert qa.get('warpGeometry') is True and qa.get('normalDeviationRms', 0) > .001 and qa.get('meshResolution') == '160x320' and qa.get('colonyForm') == 'hemispherical-or-helmet-shaped' and qa.get('surfaceProfile') == 'usually-smooth' and qa.get('coralliteTopology') == 'shallow-pit-fine-rim-filled-elements', initial",
    "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')":
        "full = capture(f'QA_SCREENSHOT_{label.upper()}.png')\n        evaluate(\"setView('micro');true\")\n        time.sleep(.8)\n        closeup = capture(f'QA_CLOSEUP_{label.upper()}.png', True)\n        evaluate(\"setView('persp');true\")\n        time.sleep(.25)",
    "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full),":
        "'baseAnchorError': qa['baseAnchorError'], 'screenshotBytes': len(full), 'closeupScreenshotBytes': len(closeup),",
    "evaluate(\"camera.dist=4.4;camera.yaw=.72;camera.pitch=.34;true\");time.sleep(.5)":
        "evaluate(\"setView('micro');true\");time.sleep(.8)",
    "assert micro1['microRms'] > .015 and micro1['microCoverage'] > 70, (micro0,micro1)":
        "assert micro1['microRms'] > .004 and micro1['microCoverage'] > 20, (micro0,micro1)",
    "assert micro0['signature'] != micro1['signature'] and mdiff['changedPixelPct'] > .8 and mdiff['changedRegionMeanRgb'] > 5, (micro0,micro1,mdiff)":
        "assert micro0['signature'] != micro1['signature'] and mdiff['changedPixelPct'] > 1.2 and mdiff['changedRegionMeanRgb'] > 5, (micro0,micro1,mdiff)",
    "defaults={'microDepth':.72,'warp':.24,'lobes':.52,'saturation':1.0}":
        "defaults={'microDepth':.44,'warp':.12,'lobes':.16,'saturation':.92}",
}
for old, new in replacements.items():
    if old not in code:
        raise RuntimeError(f'P05 QA source marker missing: {old}')
    code = code.replace(old, new, 1)

# Add the species-specific shape and evidence manifest checks immediately after
# the base-anchor assertion. This avoids weakening any of the existing P00-P04
# topology, image-difference, runtime-error, or performance gates.
anchor = "assert qa.get('baseAnchorError', 1) < 1e-6, initial"
insert = """assert qa.get('baseAnchorError', 1) < 1e-6, initial
        ext=qa.get('extent') or [0,0,0]
        assert len(ext)==3 and ext[1]>0 and 1.8 < ext[0]/ext[1] < 2.65 and abs(ext[0]-ext[2])/max(ext[0],ext[2],1e-6) < .08, initial
        assert (root/'PALAU_OCCURRENCE_EVIDENCE.json').is_file(), 'Palau occurrence evidence missing'
        evidence=json.loads((root/'PALAU_OCCURRENCE_EVIDENCE.json').read_text(encoding='utf-8'))
        assert evidence.get('species')=='Porites lutea' and evidence.get('regionalStatus')=='CONFIRMED', evidence
        assert evidence.get('site')=='Ulong Channel' and evidence.get('depthM')==12, evidence
        assert evidence.get('localGameSiteStatus')=='UNRESOLVED' and evidence.get('ecologicalPlacementReady') is False, evidence"""
if anchor not in code:
    raise RuntimeError('P05 QA anchor insertion point missing')
code = code.replace(anchor, insert, 1)

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
