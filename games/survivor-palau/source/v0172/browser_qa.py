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

# Under sub-1 FPS software rendering, a transient reel state can be entered correctly and then
# missed by an asynchronous 100 ms poll. Read the result synchronously from the same real button
# click instead; this strengthens the assertion and records the exact before/after state.
first_reel_wait = """        page.evaluate("document.getElementById('uiPause').click();document.getElementById('actionFish').click()")
        page.wait_for_function("PalauExperience.fishing.phase==='reel'", timeout=45000, polling=100)
"""
first_reel_assert = """        reel_transition = page.evaluate(\"\"\"()=>{const before={...PalauExperience.fishing};document.getElementById('uiPause').click();const afterPause={...PalauExperience.fishing};document.getElementById('actionFish').click();return{before,afterPause,after:{...PalauExperience.fishing}}}\"\"\")
        r['checks']['biteToReelTransition'] = reel_transition
        save()
        assert reel_transition['after']['phase'] == 'reel', reel_transition
"""
assert BASE.count(first_reel_wait) == 1
BASE = BASE.replace(first_reel_wait, first_reel_assert, 1)

second_reel_wait = """            page.evaluate("document.getElementById('actionFish').click()")
            page.wait_for_function("PalauExperience.fishing.phase==='reel'", timeout=45000, polling=100)
"""
second_reel_assert = """            break_transition = page.evaluate(\"\"\"()=>{const before={...PalauExperience.fishing};document.getElementById('actionFish').click();return{before,after:{...PalauExperience.fishing}}}\"\"\")
            r['checks']['secondBiteToReelTransition'] = break_transition
            save()
            assert break_transition['after']['phase'] == 'reel', break_transition
"""
assert BASE.count(second_reel_wait) == 1
BASE = BASE.replace(second_reel_wait, second_reel_assert, 1)

marker = """        r['checks']['visibleBite'] = {
            'candidateDistanceM': visible_bite['fishing']['candidateDistanceM'],
            'lineEndDepthM': visible_bite['telemetry']['lineEndDepthM'],
        }
"""
injected = marker + """        visual = page.evaluate('PalauExperience.observationVisualMetrics()')
        page.wait_for_function(
            \"\"\"()=>{const e=document.getElementById('pilotLensOverlay'),s=getComputedStyle(e);return !e.hidden&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>.9}\"\"\",
            timeout=45000,
            polling=50,
        )
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
