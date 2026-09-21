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

# The full scene can run below 0.4 FPS in SwiftShader. Drive the real hold/release button from the
# authoritative in-game held state, confirm each pointer transition before advancing a frame, and
# predict the maximum next-frame tension rise. This changes only QA input timing, never game rules.
old_reel = '''def reel_to_end(page, expect='caught', timeout_s=240):
    box = page.locator('#actionFish').bounding_box()
    assert box
    page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    held = False
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        s = page.evaluate('({...PalauExperience.fishing})')
        if s['phase'] != 'reel':
            break
        if expect == 'broken':
            desired = True
        else:
            # SwiftShader may render below one frame per second. Decide once per actual frame and
            # leave enough headroom for the next capped 0.5 s gameplay step; polling stale tension
            # at 150 ms otherwise holds through several unseen updates and creates a false break.
            desired = s['tension'] < (.44 if held else .16)
        if desired != held:
            (page.mouse.down if desired else page.mouse.up)()
            held = desired
        frame = page.evaluate('OceanMotherR018.qa.frames')
        page.wait_for_function(
            "(f)=>OceanMotherR018.qa.frames>f || PalauExperience.fishing.phase!=='reel'",
            arg=frame,
            timeout=20000,
            polling=100,
        )
    if held:
        page.mouse.up()
    end = page.evaluate('({...PalauExperience.fishing})')
    assert end['phase'] == expect, end
    return end
'''
new_reel = '''def reel_to_end(page, expect='caught', timeout_s=240):
    box = page.locator('#actionFish').bounding_box()
    assert box
    page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    held = False
    history = []
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        s = page.evaluate('({...PalauExperience.fishing})')
        if s['phase'] != 'reel':
            break
        actual_held = bool(s['held'])
        history.append({
            'frame': page.evaluate('OceanMotherR018.qa.frames'),
            'tension': s['tension'],
            'progress': s['progress'],
            'actualHeld': actual_held,
        })
        if expect == 'broken':
            desired = True
        else:
            # At the capped 0.5 s gameplay step, one held frame can add at most 0.19 tension.
            # Release before 0.24 and restart only below 0.08, leaving a wide safety margin.
            desired = s['tension'] < (.24 if actual_held else .08)
        if desired != actual_held:
            (page.mouse.down if desired else page.mouse.up)()
            held = desired
            page.wait_for_function(
                "(v)=>PalauExperience.fishing.phase!=='reel'||PalauExperience.fishing.held===v",
                arg=desired,
                timeout=5000,
                polling=50,
            )
        else:
            held = actual_held
        frame = page.evaluate('OceanMotherR018.qa.frames')
        page.wait_for_function(
            "(f)=>OceanMotherR018.qa.frames>f || PalauExperience.fishing.phase!=='reel'",
            arg=frame,
            timeout=20000,
            polling=100,
        )
    if held or page.evaluate("PalauExperience.fishing.held"):
        page.mouse.up()
    end = page.evaluate('({...PalauExperience.fishing})')
    r['checks']['reelControl_' + expect] = {'history': history[-96:], 'end': end}
    save()
    assert end['phase'] == expect, end
    return end
'''
assert BASE.count(old_reel) == 1
BASE = BASE.replace(old_reel, new_reel, 1)

# Pause in the same JavaScript turn that first observes the transient bite. At sub-1 FPS, a later
# Playwright call can arrive after the bite has already become "missed", producing false evidence.
first_bite_wait = """        page.wait_for_function("PalauExperience.fishing.phase==='bite'", timeout=180000, polling=100)
"""
atomic_bite_wait = """        page.wait_for_function(
            \"\"\"()=>{if(PalauExperience.fishing.phase!=='bite')return false;document.getElementById('uiPause').click();return PalauExperience.fishing.phase==='bite'}\"\"\",
            timeout=180000,
            polling=100,
        )
"""
assert BASE.count(first_bite_wait) == 2
BASE = BASE.replace(first_bite_wait, atomic_bite_wait, 1)
pause_before_snapshot = """        page.evaluate("document.getElementById('uiPause').click()")
        snapshot(page, 'desktop-visible-bite', settle_frames=0)
"""
assert BASE.count(pause_before_snapshot) == 1
BASE = BASE.replace(pause_before_snapshot, """        snapshot(page, 'desktop-visible-bite', settle_frames=0)
""", 1)

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
injected = marker + """        bite_ui = page.evaluate(\"\"\"(()=>({phase:PalauExperience.fishing.phase,title:document.getElementById('fishTitle').textContent,help:document.getElementById('fishHelp').textContent,action:document.getElementById('actionFish').textContent,pause:document.getElementById('uiPause').textContent}))()\"\"\")
        r['checks']['visibleBiteUI'] = bite_ui
        assert bite_ui['phase'] == 'bite' and '游走' not in bite_ui['title'], bite_ui
        visual = page.evaluate('PalauExperience.observationVisualMetrics()')
        page.wait_for_function(
            \"\"\"()=>{const e=document.getElementById('pilotLensOverlay'),s=getComputedStyle(e);return !e.hidden&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>.9}\"\"\",
            timeout=45000,
            polling=50,
        )
        overlay = page.evaluate(\"\"\"(()=>{const e=document.getElementById('pilotLensOverlay'),s=getComputedStyle(e),b=e.getBoundingClientRect();return{hidden:e.hidden,display:s.display,visibility:s.visibility,opacity:Number(s.opacity),width:b.width,height:b.height}})()\"\"\")
        gear = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.telemetry))')
        visual['overlayState'] = overlay
        visual['overlayVisible'] = page.locator('#pilotLensOverlay').is_visible()
        r['checks']['visualReadability'] = visual
        r['checks']['surfaceLineNearPlane'] = {
            'originRangeM': gear.get('surfaceLineOriginRangeM'),
            'radiusM': gear.get('surfaceLineRadiusM'),
            'visible': gear.get('surfaceLineVisible'),
        }
        save()
        assert visual['solidLensCount'] == 0, visual
        assert visual['lensFrame'] == 'thin-screen-space', visual
        assert visual['targetRangeM'] <= 9.0, visual
        assert visual['cameraFocusXZErrorM'] < .25, visual
        assert visual['candidateFishLengthPx'] >= 22.0, visual
        assert visual['baitDiameterPx'] >= 10.0, visual
        assert visual['overlayVisible'] and overlay['opacity'] > .9 and overlay['visibility'] == 'visible', visual
        assert gear.get('surfaceLineOriginRangeM', 0) >= .9, gear
        assert gear.get('surfaceLineRadiusM', 1) <= .004, gear
        assert gear.get('surfaceLineVisible') is True, gear
"""
assert BASE.count(marker) == 1
BASE = BASE.replace(marker, injected, 1)

caught_snapshot = """        snapshot(page, 'desktop-caught')
"""
caught_checks = caught_snapshot + """        caught_visual = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.telemetry))')
        r['checks']['caughtGeometryPlacement'] = {
            'caughtFishRangeM': caught_visual.get('caughtFishRangeM'),
            'surfaceLineVisible': caught_visual.get('surfaceLineVisible'),
        }
        save()
        assert caught_visual.get('caughtFishRangeM', 0) >= 1.2, caught_visual
        assert caught_visual.get('surfaceLineVisible') is False, caught_visual
"""
assert BASE.count(caught_snapshot) == 1
BASE = BASE.replace(caught_snapshot, caught_checks, 1)

broken_snapshot = """            snapshot(page, 'desktop-line-broken')
"""
broken_checks = broken_snapshot + """            broken_visual = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.telemetry))')
            r['checks']['brokenGeometryRemoved'] = {
                'surfaceLineVisible': broken_visual.get('surfaceLineVisible'),
                'brokenLineVisible': broken_visual.get('brokenLineVisible'),
            }
            save()
            assert broken_visual.get('surfaceLineVisible') is False, broken_visual
            assert broken_visual.get('brokenLineVisible') is False, broken_visual
"""
assert BASE.count(broken_snapshot) == 1
BASE = BASE.replace(broken_snapshot, broken_checks, 1)

sys.argv = [sys.argv[0]]
exec(compile(BASE, __file__ + ':v0170-base', 'exec'), {'__name__': '__main__', '__file__': __file__})
