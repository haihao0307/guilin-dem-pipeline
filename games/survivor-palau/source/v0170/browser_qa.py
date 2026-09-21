"""Real Chromium/WebGL QA for Palau V0.1.7.0.

Screenshots are internal evidence only. SwiftShader measurements are not player-device FPS.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib
import json
import math
import shutil
import sys
import time
import traceback

ROOT = Path('games/survivor-palau/releases/v0.1.7.0')
OUT = ROOT / 'evidence'
OUT.mkdir(parents=True, exist_ok=True)
URL = sys.argv[1] if len(sys.argv) > 1 else (ROOT / 'index.html').resolve().as_uri()
PUBLIC = URL.startswith('https:')
REPORT = ROOT / ('PUBLIC_BROWSER_QA.json' if PUBLIC else 'BROWSER_QA.json')
r = {
    'passed': False,
    'url': URL,
    'normalQuality': True,
    'softwareRenderer': True,
    'physicalPhoneTested': False,
    'visualAcceptancePending': True,
    'consoleErrors': [],
    'pageErrors': [],
    'requestFailures': [],
    'views': [],
    'checks': {},
}


def save():
    REPORT.write_text(json.dumps(r, ensure_ascii=False, indent=2))


def wait_frames(page, n=3, timeout=120000):
    start = page.evaluate('OceanMotherR018.qa.frames')
    page.wait_for_function('(f)=>OceanMotherR018.qa.frames>=f', arg=start + n, timeout=timeout, polling=200)


def snapshot(page, name, settle_frames=2):
    if settle_frames:
        wait_frames(page, settle_frames)
    page.screenshot(path=str(OUT / (('public-' if PUBLIC else '') + name + '.png')), timeout=90000)
    r['views'].append({
        'name': name,
        'qa': page.evaluate('({...OceanMotherR018.qa})'),
        'survival': page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.telemetry))'),
    })
    save()


def connect(page):
    page.on('console', lambda m: r['consoleErrors'].append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: r['pageErrors'].append(str(e)))
    page.on('requestfailed', lambda q: r['requestFailures'].append({'url': q.url, 'failure': q.failure}))
    response = page.goto(URL, wait_until='domcontentloaded', timeout=90000)
    if PUBLIC:
        assert response and response.status == 200
    page.wait_for_function(
        '()=>window.OceanMotherR018?.qa?.ready && window.PalauExperience?.survival?.ready',
        timeout=150000,
        polling=250,
    )
    wait_frames(page)
    qa = page.evaluate('({...OceanMotherR018.qa})')
    assert qa['webgl2'] and not qa['errors'] and qa.get('glError', 0) == 0, qa
    assert '0.1.7.0' in page.evaluate('PalauExperience.version')
    story = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.story))')
    gear = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.gear))')
    assert story['date'] == '1944-11-21'
    assert story['minuteByMinuteReenactment'] is False
    assert gear['elasticSpear'] is False and gear['hawaiianSling'] is False and gear['mechanicalSpeargun'] is False


def click(page, selector):
    page.locator(selector).click(timeout=45000, no_wait_after=True)


def pairwise_non_overlapping(boxes):
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            overlap_x = min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x'])
            overlap_y = min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y'])
            if overlap_x > 1 and overlap_y > 1:
                return False
    return True


def reel_to_end(page, expect='caught', timeout_s=240):
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


try:
    with sync_playwright() as pw:
        chrome = shutil.which('google-chrome') or shutil.which('chromium')
        assert chrome
        browser = pw.chromium.launch(
            executable_path=chrome,
            headless=False,
            args=[
                '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader',
                '--enable-unsafe-swiftshader', '--allow-file-access-from-files',
            ],
        )
        page = browser.new_page(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
        connect(page)
        snapshot(page, 'desktop-overview')

        click(page, '#uiMore')
        click(page, '#uiPilotStory')
        assert page.locator('#storySheet').is_visible()
        assert '1944 年 11 月 21 日' in page.locator('#storySheet').inner_text()
        click(page, '#storyClose')

        click(page, '#actionObserve')
        page.wait_for_function('PalauExperience.survival.observation.active===true', timeout=45000)
        wait_frames(page, 4)
        obs = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival))')
        assert obs['telemetry']['visibleFishCount'] >= 10
        assert abs(obs['telemetry']['cameraSurfaceOffsetM']) < .20
        assert obs['fishing']['autoCatch'] is False
        r['checks']['surfaceObservationEntry'] = {
            'visibleFishCount': obs['telemetry']['visibleFishCount'],
            'cameraSurfaceOffsetM': obs['telemetry']['cameraSurfaceOffsetM'],
        }
        snapshot(page, 'desktop-surface-observation')

        # Hold the legitimate low-profile interaction until an actual wave overtops the short tube.
        brace = page.locator('#braceObserve')
        brace_box = brace.bounding_box()
        assert brace_box
        page.mouse.move(brace_box['x'] + brace_box['width'] / 2, brace_box['y'] + brace_box['height'] / 2)
        page.mouse.down()
        page.wait_for_function('PalauExperience.survival.telemetry.snorkelSubmerged===true', timeout=45000, polling=100)
        submerged = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.observation))')
        page.wait_for_timeout(450)
        breath_after = page.evaluate('PalauExperience.survival.observation.breath')
        page.mouse.up()
        assert submerged['snorkelClearanceM'] < 0 and breath_after < 1
        r['checks']['realWaveTubeOvertop'] = {
            'clearanceM': submerged['snorkelClearanceM'],
            'breathAfter': breath_after,
        }

        fog_before = page.evaluate('PalauExperience.survival.observation.fog')
        click(page, '#wipeLens')
        fog_after = page.evaluate('PalauExperience.survival.observation.fog')
        disturbance = page.evaluate('PalauExperience.survival.observation.actionDisturbance')
        assert fog_after < fog_before and disturbance >= .8
        r['checks']['wipeLensTradeoff'] = {'fogBefore': fog_before, 'fogAfter': fog_after, 'disturbance': disturbance}

        click(page, '#actionFish')
        page.wait_for_function("PalauExperience.fishing.phase==='ready'", timeout=45000, polling=100)
        inventory_after_start = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.inventory))')
        assert inventory_after_start['bait'] == 4
        click(page, '#actionFish')
        page.wait_for_function("PalauExperience.fishing.phase==='waiting'", timeout=90000, polling=100)
        page.wait_for_function("PalauExperience.fishing.phase==='bite'", timeout=180000, polling=100)
        visible_bite = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival))')
        assert visible_bite['fishing']['candidateDistanceM'] < .65
        assert visible_bite['fishing']['baitVisible'] and visible_bite['fishing']['hookVisible']
        assert visible_bite['telemetry']['lineEndDepthM'] < -.35
        r['checks']['visibleBite'] = {
            'candidateDistanceM': visible_bite['fishing']['candidateDistanceM'],
            'lineEndDepthM': visible_bite['telemetry']['lineEndDepthM'],
        }
        # Freeze the transient bite through the real pause control while evidence is captured.
        # This prevents SwiftShader actionability/screenshot latency from consuming the player's
        # reaction window; the actual fishing thresholds and bite duration remain unchanged.
        page.evaluate("document.getElementById('uiPause').click()")
        snapshot(page, 'desktop-visible-bite', settle_frames=0)
        page.evaluate("document.getElementById('uiPause').click();document.getElementById('actionFish').click()")
        page.wait_for_function("PalauExperience.fishing.phase==='reel'", timeout=45000, polling=100)
        caught = reel_to_end(page, 'caught')
        inv_caught = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.inventory))')
        assert caught['catches'] == 1 and inv_caught['fishFood'] == 1
        r['checks']['reelReleaseClickGuard'] = {'phaseAfterRelease': caught['phase'], 'catches': caught['catches']}
        snapshot(page, 'desktop-caught')

        if not PUBLIC:
            # Recast through the real UI, then deliberately ignore tension to verify finite gear loss.
            before_break = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.inventory))')
            click(page, '#actionFish')
            page.wait_for_function("PalauExperience.fishing.phase==='waiting'", timeout=90000, polling=100)
            page.wait_for_function("PalauExperience.fishing.phase==='bite'", timeout=180000, polling=100)
            page.evaluate("document.getElementById('actionFish').click()")
            page.wait_for_function("PalauExperience.fishing.phase==='reel'", timeout=45000, polling=100)
            reel_to_end(page, 'broken')
            after_break = page.evaluate('JSON.parse(JSON.stringify(PalauExperience.survival.inventory))')
            assert after_break['hooks'] == before_break['hooks'] - 1
            assert after_break['lineSegments'] == before_break['lineSegments'] - 1
            r['checks']['finiteGearLoss'] = {'before': before_break, 'after': after_break}
            snapshot(page, 'desktop-line-broken')

        page.close()
        save()

        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        page = mobile.new_page()
        connect(page)
        boxes = page.evaluate("['actionSail','actionFish','actionExplore','actionObserve'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return{id,x:b.x,y:b.y,w:b.width,h:b.height};})")
        assert all(b['x'] >= 0 and b['x'] + b['w'] <= 390 and b['y'] >= 0 and b['y'] + b['h'] <= 844 and b['h'] >= 44 for b in boxes), boxes
        assert pairwise_non_overlapping(boxes), boxes
        r['checks']['mobileActionBoxes'] = boxes
        click(page, '#actionObserve')
        page.wait_for_function('PalauExperience.survival.observation.active===true', timeout=45000)
        card_box = page.locator('#observeCard').bounding_box()
        assert card_box and card_box['x'] >= 0 and card_box['x'] + card_box['width'] <= 390 and card_box['y'] >= 0 and card_box['y'] + card_box['height'] <= 844
        snapshot(page, 'mobile-surface-observation')
        page.close()
        mobile.close()
        browser.close()

    r['passed'] = not r['consoleErrors'] and not r['pageErrors'] and not r['requestFailures']
except Exception as exc:
    r['failure'] = str(exc)
    r['traceback'] = traceback.format_exc()
finally:
    save()
    print(json.dumps(r, ensure_ascii=False, indent=2), flush=True)

assert r['passed'], r.get('failure', 'browser errors')
