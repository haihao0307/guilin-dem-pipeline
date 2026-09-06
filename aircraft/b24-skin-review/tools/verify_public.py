"""Verify the live public review page; no source or aircraft edits."""
from pathlib import Path
import hashlib, json, os, shutil, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = 'https://haihao0307.github.io/guilin-dem-pipeline/aircraft/b24-skin-review/'
OUT = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'b24-evidence-qa'
OUT.mkdir(parents=True, exist_ok=True)
checks = []
def check(name, value):
    checks.append({'name': name, 'passed': bool(value)})
    if not value:
        raise AssertionError(name)
def get(path):
    with urllib.request.urlopen(BASE + path, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError('HTTP ' + str(response.status))
        return response.read()

try:
    error = None
    for attempt in range(12):
        try:
            manifest = json.loads(get('assets/manifest.json'))
            if manifest['sourceSHA256'] != '541c3dcfb98ab590cdb1bc90d6ddcdfe80bce2a4b937f3bccefab0c7efe8be0d':
                raise RuntimeError('unexpected source')
            break
        except Exception as exc:
            error = exc
            time.sleep(10)
    else:
        raise RuntimeError('Public manifest unavailable') from error
    check('public source hash is the locked original', manifest['sourceSHA256'] == '541c3dcfb98ab590cdb1bc90d6ddcdfe80bce2a4b937f3bccefab0c7efe8be0d')
    check('only four intended images published', [x['id'] for x in manifest['publishedImages']] == [2,5,7,9])
    for item in manifest['publishedImages']:
        data = get(item['path'])
        check('public image bytes ' + str(item['id']), len(data) == item['bytes'])
        check('public image SHA256 ' + str(item['id']), hashlib.sha256(data).hexdigest() == item['sha256'])
    viewports = []
    with sync_playwright() as p:
        executable = shutil.which('google-chrome') or shutil.which('chromium')
        opts = {'headless': True, 'args': ['--no-sandbox']}
        if executable:
            opts['executable_path'] = executable
        browser = p.chromium.launch(**opts)
        for width, height in [(1440,960),(390,844)]:
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
            page = context.new_page()
            errors = []; failures = []
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.on('requestfailed', lambda req: failures.append(req.url))
            response = page.goto(BASE, wait_until='networkidle', timeout=60000)
            check(f'{width} public HTTP 200', response.status == 200)
            page.wait_for_function('window.__B24_SOURCE_REVIEW__ && document.getElementById("image").complete && document.getElementById("image").naturalWidth===1024', timeout=30000)
            check(f'{width} no horizontal page overflow', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            for value in ['2','5','7','9']:
                page.select_option('#sheet', value)
                page.wait_for_function('(id)=>{const el=document.getElementById("image");return el.src.endsWith("original-atlas-"+id.padStart(2,"0")+".jpg")&&el.complete&&el.naturalWidth===1024;}', arg=value)
                check(f'{width} actual image selection {value}', page.locator('#image').evaluate('(el)=>el.naturalWidth===1024&&el.naturalHeight===1024'))
            page.click('#two')
            check(f'{width} 200 percent width', page.locator('#image').evaluate('(el)=>Math.abs(el.getBoundingClientRect().width-2048)<1'))
            page.click('#one')
            check(f'{width} original pixel width', page.locator('#image').evaluate('(el)=>Math.abs(el.getBoundingClientRect().width-1024)<1'))
            page.click('#pixel')
            check(f'{width} pixel inspection toggle', page.locator('#pixel').get_attribute('aria-pressed') == 'true')
            page.click('#pixel');page.click('#fit');page.select_option('#sheet','2')
            page.wait_for_function('document.getElementById("image").complete && document.getElementById("image").src.endsWith("02.jpg")')
            check(f'{width} fit stays inside viewport', page.locator('#image').evaluate('(el)=>el.getBoundingClientRect().width<=document.getElementById("stage").clientWidth+1'))
            check(f'{width} no runtime errors', not errors)
            check(f'{width} no failed requests', not failures)
            page.screenshot(path=str(OUT / f'public-{width}.png'), full_page=False)
            viewports.append({'width':width,'height':height,'pageErrors':errors,'failedRequests':failures})
            context.close()
        browser.close()
    report={'url':BASE,'passed':True,'checks':checks,'count':len(checks),'viewports':viewports,'geometryOrLiveryValidation':False,'historicalSeamAcceptance':False}
except Exception as exc:
    report={'url':BASE,'passed':False,'checks':checks,'count':len(checks),'error':repr(exc)}
    (OUT/'public-browser-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    raise
(OUT/'public-browser-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
