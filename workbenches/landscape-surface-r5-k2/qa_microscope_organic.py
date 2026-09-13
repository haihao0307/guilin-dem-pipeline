from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, sys

url = sys.argv[1]
out = Path(os.environ.get('LM_EVIDENCE', '/tmp/landscape-r5-k2-evidence'))
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    response = page.goto(url, wait_until='domcontentloaded', timeout=60000)
    assert response and response.status == 200
    page.wait_for_function('window.__LM_ERROR__||(window.__LM_READY__&&window.__LM__.report.config.seed===83)', timeout=180000)
    assert page.evaluate('window.__LM_READY__===true'), page.evaluate('window.__LM_ERROR__||null')
    assert not errors, errors

    fingerprint = page.evaluate('window.__LM__.bufferFingerprint()')
    page.locator('#panelbtn').click()
    page.locator('#scope').evaluate("e=>{e.value=1.05;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    page.locator('#micro').evaluate("e=>{e.value=.82;e.dispatchEvent(new Event('input',{bubbles:true}))}")

    captures = []
    for view in ('cliff','cave','stone'):
        page.locator(f'[data-view="{view}"]').click()
        page.locator('[data-mode="0"]').click()
        page.wait_for_timeout(150)
        page.screenshot(path=str(out/f'organic-{view}-color.png'))
        captures.append(f'organic-{view}-color.png')
        page.locator('[data-mode="5"]').click()
        page.wait_for_timeout(150)
        audit = page.evaluate('window.__LM__.auditFrame()')
        assert audit['glError'] == 0 and audit['unique'] > 25 and audit['nonzeroSamples'] > 100, audit
        page.screenshot(path=str(out/f'organic-{view}-microscope.png'))
        captures.append(f'organic-{view}-microscope.png')

    assert page.evaluate('window.__LM__.bufferFingerprint()') == fingerprint
    assert not page.evaluate('window.__LM__.errors')
    result = {
        'passed': True,
        'captures': captures,
        'geometryFingerprint': fingerprint,
        'pageErrors': errors,
        'scope': 1.05,
        'micro': 0.82,
        'renderer': 'Chromium SwiftShader',
        'physicalPhone': False,
    }
    (out/'organic-closeup-qa.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    browser.close()
