#!/usr/bin/env python3
"""New replay harness. Its presence is not evidence that a browser test was run."""
from pathlib import Path
import argparse, hashlib, json, shutil
from playwright.sync_api import sync_playwright


def run(html: Path, output: Path, executable: str | None) -> bool:
    report = {'format': 'ocean-r01811-recovery-rerun', 'htmlSha256': hashlib.sha256(html.read_bytes()).hexdigest(),
              'passed': False, 'hardwareGPUVerified': False, 'visualApproved': False,
              'productionApproved': False, 'cases': {}}
    with sync_playwright() as p:
        options = {'headless': True, 'args': ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']}
        if executable:
            options['executable_path'] = executable
        browser = p.chromium.launch(**options)
        try:
            for name, width, height, dpr in [('desktop',1920,1080,1),('mobile',390,844,2)]:
                case = {'passed': False, 'viewport': [width,height], 'dpr': dpr, 'errors': [], 'externalRequests': []}
                report['cases'][name] = case
                context = browser.new_context(viewport={'width':width,'height':height}, device_scale_factor=dpr)
                page = context.new_page()
                page.on('pageerror', lambda e: case['errors'].append(str(e)))
                page.on('request', lambda r: case['externalRequests'].append(r.url) if r.url.startswith(('https://','http://')) else None)
                try:
                    page.goto(html.resolve().as_uri(), wait_until='domcontentloaded', timeout=180000)
                    case['navigation'] = page.url
                    page.wait_for_function('window.__OCEAN_QA__?.ready && window.__OCEAN_QA__.completedFrames >= 2', timeout=300000)
                    case['initial'] = page.evaluate('({...window.__OCEAN_QA__})')
                    page.evaluate("document.getElementById('pause').click()")
                    page.evaluate("const e=document.getElementById('waveHeight'); e.value='1.17'; e.dispatchEvent(new Event('input',{bubbles:true}))")
                    before = page.evaluate('window.__OCEAN_GPU__.snapshot()')
                    page.evaluate('window.__OCEAN_GPU__.lose()')
                    page.wait_for_function('window.__OCEAN_QA__?.contextLost', timeout=30000)
                    page.evaluate('window.__OCEAN_GPU__.restore()')
                    page.wait_for_function('window.__OCEAN_QA__?.ready && window.__OCEAN_QA__.contextRestores >= 1', timeout=300000)
                    case['recovery'] = page.evaluate('({...window.__OCEAN_QA__})')
                    after = page.evaluate('window.__OCEAN_GPU__.snapshot()')
                    assert before == after, 'State changed during context recovery'
                    assert not case['errors'] and not case['externalRequests']
                    case['passed'] = True
                except Exception as exc:
                    case['failure'] = str(exc)
                finally:
                    context.close()
                    output.parent.mkdir(parents=True, exist_ok=True)
                    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
            report['passed'] = all(c['passed'] for c in report['cases'].values())
        finally:
            browser.close()
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report['passed']


if __name__ == '__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--html', type=Path, required=True)
    ap.add_argument('--output', type=Path, default=Path('recovery_rerun.json'))
    ap.add_argument('--executable', default=shutil.which('chromium') or shutil.which('google-chrome'))
    args=ap.parse_args()
    raise SystemExit(0 if run(args.html, args.output, args.executable) else 1)
