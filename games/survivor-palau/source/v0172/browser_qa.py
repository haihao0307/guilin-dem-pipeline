"""Run the proven V0170 handline QA against V0172, then assert visual readability metrics."""
from pathlib import Path
import sys

BASE = Path('games/survivor-palau/source/v0170/browser_qa.py').read_text()
BASE = BASE.replace(
    "ROOT = Path('games/survivor-palau/releases/v0.1.7.0')",
    "ROOT = Path('games/survivor-palau/releases/v0.1.7.2')",
    1,
)
BASE = BASE.replace(
    "assert '0.1.7.0' in page.evaluate('PalauExperience.version')",
    "assert '0.1.7.2' in page.evaluate('PalauExperience.version')",
    1,
)
marker = """        r['checks']['visibleBite'] = {
            'candidateDistanceM': visible_bite['fishing']['candidateDistanceM'],
            'lineEndDepthM': visible_bite['telemetry']['lineEndDepthM'],
        }
"""
injected = marker + """        visual = page.evaluate('PalauExperience.observationVisualMetrics()')
        overlay = page.evaluate(\"\"\"(()=>{const e=document.getElementById('pilotLensOverlay'),s=getComputedStyle(e),b=e.getBoundingClientRect();return{hidden:e.hidden,display:s.display,visibility:s.visibility,opacity:Number(s.opacity),width:b.width,height:b.height}})()\"\"\")
        visual['overlayState'] = overlay
        visual['overlayVisible'] = page.locator('#pilotLensOverlay').is_visible()
        r['checks']['visualReadability'] = visual
        save()
        assert visual['solidLensCount'] == 0, visual
        assert visual['lensFrame'] == 'thin-screen-space', visual
        assert visual['targetRangeM'] <= 9.0, visual
        assert visual['cameraFocusXZErrorM'] < .25, visual
        assert visual['candidateFishLengthPx'] >= 22.0, visual
        assert visual['baitDiameterPx'] >= 10.0, visual
        assert visual['overlayVisible'] and overlay['opacity'] > .9 and overlay['visibility'] == 'visible', visual
"""
assert BASE.count(marker) == 1
BASE = BASE.replace(marker, injected, 1)
sys.argv = [sys.argv[0]]
exec(compile(BASE, __file__ + ':v0170-base', 'exec'), {'__name__': '__main__', '__file__': __file__})
