"""DOM-only layout regression gate. No WebGL, geometry or FPS conclusions.

Import run_layout_matrix(browser, baseline_dir, candidate_dir, report, out).
Each source directory contains index.html and semantic-style.css. The caller
owns the permitted browser launch and writes the final report. Both variants
use their exact HTML/CSS but replace module boot with representative UI data.
"""
import hashlib
import json
import re
from pathlib import Path


CASES = [
    {"name": "desktop-1920-dpr1", "width": 1920, "height": 1080, "dpr": 1},
    {"name": "desktop-1920-dpr2", "width": 1920, "height": 1080, "dpr": 2},
    {"name": "large-2048-dpr1_25", "width": 2048, "height": 1536, "dpr": 1.25},
    {"name": "large-2048-dpr2", "width": 2048, "height": 1536, "dpr": 2},
    {"name": "desktop-1728-dpr1_5", "width": 1728, "height": 1190, "dpr": 1.5},
    {"name": "laptop-1366-dpr1_25", "width": 1366, "height": 768, "dpr": 1.25},
    {"name": "zoom125-equivalent", "width": 1536, "height": 864, "dpr": 1.25},
    {"name": "zoom150-equivalent", "width": 1280, "height": 720, "dpr": 1.5},
    {"name": "zoom200-equivalent", "width": 960, "height": 540, "dpr": 2},
    {"name": "short-desktop", "width": 900, "height": 600, "dpr": 2},
    {"name": "desktop-breakpoint", "width": 821, "height": 500, "dpr": 2},
    {"name": "stacked-breakpoint", "width": 820, "height": 600, "dpr": 2},
    {"name": "mobile", "width": 390, "height": 844, "dpr": 3},
]

POPULATE = """() => {
 const $ = id => document.getElementById(id);
 $('buildingButtons').replaceChildren(...['喇沙利道33號','龍總大廈','協記貨倉第二倉'].map(name => { const b=document.createElement('button'); b.textContent=name; return b; }));
 $('buildingName').textContent='喇沙利道33號';
 $('status').textContent='三栋同场景 · 3024×1666 实际渲染 · CSS 1512×833 · DPR 2 · 原生像素 · 1234 ms';
 $('counts').textContent='3 栋完整体系 · 225 个保留源面 · 1292 个独立命中身份 · 对象三角网格 0 · 图形场景 1';
 $('loading').hidden=true;
 $('displayInfo').textContent='3024×1666 · 原生像素 · 单一函数场景';
 for (const id of ['floor','objects']) { const option=document.createElement('option'); option.textContent='lowrise::original-building-component-with-a-long-identity-and-source-face:p112'; $(id).append(option); }
 for(let i=0;i<12;i++) { const article=document.createElement('div'); article.className='photo-card'; const figure=document.createElement('div'); figure.style.height='210px'; figure.textContent='Reference placeholder'; const p=document.createElement('p'); p.textContent='官方模型外观裁片，仅作源面参考，不是原始相机照片。 '.repeat(4); article.append(figure,p); $('photoGallery').append(article); }
 $('selected').textContent=JSON.stringify({objectId:123456,sourceIdentity:'a'.repeat(220),building:'lowrise'},null,2);
} """

MEASURE = """() => {
 const box = selector => { const e=document.querySelector(selector), r=e.getBoundingClientRect(), s=getComputedStyle(e); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,display:s.display,overflow:s.overflow,clientWidth:e.clientWidth,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight}; };
 const elements = Object.fromEntries(['main','article','#viewport','#view','#evidencePanel','.scene-toolbar','#fitView','#focusBuilding','#fullscreen','#status','#counts','article>.hint'].map(s=>[s,box(s)]));
 return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,canvasBuffer:[document.querySelector('#view').width,document.querySelector('#view').height],elements};
} """


def _violations(sample):
    failures = []
    desktop = sample['width'] > 820
    if sample['scrollWidth'] > sample['width'] + 1:
        failures.append('document-horizontal-overflow')
    if desktop and sample['scrollHeight'] > sample['height'] + 1:
        failures.append('desktop-document-vertical-overflow')
    selectors = ['#viewport', '#view', '#fitView', '#focusBuilding', '#fullscreen']
    if desktop:
        selectors += ['#evidencePanel', '#status', '#counts', 'article>.hint']
    for selector in selectors:
        rect = sample['elements'][selector]
        if rect['width'] <= 0 or rect['height'] <= 0:
            failures.append(selector + ':empty')
        if rect['x'] < -1 or rect['right'] > sample['width'] + 1:
            failures.append(selector + ':offscreen-x')
        if desktop and (rect['y'] < -1 or rect['bottom'] > sample['height'] + 1):
            failures.append(selector + ':offscreen-y')
    view = sample['elements']['#view']
    viewport = sample['elements']['#viewport']
    if any(abs(view[key] - viewport[key]) > 1 for key in ['x', 'y', 'width', 'height']):
        failures.append('canvas-css-does-not-match-viewport')
    return failures


def run_layout_matrix(browser, baseline_dir, candidate_dir, report, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    gate = {
        'scope': 'DOM-only exact HTML/CSS gate; module boot replaced, no geometry or FPS tested',
        'zoomCaveat': 'Zoom cases emulate the CSS viewport and devicePixelRatio of 125/150/200% zoom on a 1920×1080 display; they do not manipulate browser UI zoom.',
        'cases': CASES,
        'variants': {},
        'passed': False,
    }
    report['layoutMatrix'] = gate
    for label, source in [('baseline', Path(baseline_dir)), ('candidate', Path(candidate_dir))]:
        html_bytes = (source / 'index.html').read_bytes()
        css_bytes = (source / 'semantic-style.css').read_bytes()
        html = re.sub(r'<script\b[^>]*>.*?</script>', '', html_bytes.decode(), flags=re.S | re.I)
        html = re.sub(r'<link\b[^>]*rel=[\"\']stylesheet[\"\'][^>]*>', '', html, flags=re.I)
        html = html.replace('</head>', '<style>' + css_bytes.decode() + '</style></head>')
        variant = {'sha256': {'index.html': hashlib.sha256(html_bytes).hexdigest(), 'semantic-style.css': hashlib.sha256(css_bytes).hexdigest()}, 'cases': []}
        gate['variants'][label] = variant
        for case in CASES:
            context = browser.new_context(viewport={'width': case['width'], 'height': case['height']}, device_scale_factor=case['dpr'])
            page = context.new_page()
            page.set_content(html, wait_until='domcontentloaded')
            page.evaluate(POPULATE)
            case_result = {'name': case['name'], 'samples': []}
            variant['cases'].append(case_result)
            # Repeat backing-store updates, matching the application's actual
            # feedback path. They must not change CSS layout even at DPR > 1.
            for revision in range(5):
                page.evaluate("""() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))""")
                sample = page.evaluate(MEASURE)
                sample['revision'] = revision
                sample['violations'] = _violations(sample)
                case_result['samples'].append(sample)
                page.evaluate("""() => {const v=document.querySelector('#viewport').getBoundingClientRect(),c=document.querySelector('#view');c.width=Math.min(32768,Math.round(v.width*devicePixelRatio));c.height=Math.min(32768,Math.round(v.height*devicePixelRatio));}""")
            first = case_result['samples'][0]['elements']['#viewport']
            last = case_result['samples'][-1]['elements']['#viewport']
            case_result['cssStableAfterBackingResize'] = all(abs(first[k] - last[k]) <= 1 for k in ['x', 'y', 'width', 'height'])
            # Resize the same document without reloading. Zoom+window resize
            # regressions can be missed by fresh pages at each dimension.
            page.set_viewport_size({'width': 1024, 'height': 640})
            page.evaluate("""() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))""")
            resized = page.evaluate(MEASURE)
            resized['violations'] = _violations(resized)
            case_result['resized1024x640'] = resized
            page.set_viewport_size({'width': case['width'], 'height': case['height']})
            page.evaluate("""() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))""")
            restored = page.evaluate(MEASURE)
            restored['violations'] = _violations(restored)
            case_result['restored'] = restored
            # Also exercise non-native framebuffer warning without hiding it.
            page.evaluate("""() => {const p=document.querySelector('#resolutionWarning');p.hidden=false;p.textContent='当前设备目标 4096×3072 超过保守帧缓冲内存预算，输出 2811×2108。没有改变函数或几何精度。';}""")
            warning = page.evaluate(MEASURE)
            warning['violations'] = _violations(warning)
            case_result['budgetWarning'] = warning
            case_result['passed'] = case_result['cssStableAfterBackingResize'] and not any(s['violations'] for s in case_result['samples'] + [resized, restored, warning])
            if not case_result['passed'] or case['name'] in ('desktop-1920-dpr2', 'desktop-breakpoint', 'zoom200-equivalent'):
                filename = f'layout-{label}-{case["name"]}.png'
                page.screenshot(path=str(out / filename))
                case_result['screenshot'] = filename
            context.close()
    gate['passed'] = all(c['passed'] for c in gate['variants']['candidate']['cases'])
    gate['baselineFailureCases'] = [c['name'] for c in gate['variants']['baseline']['cases'] if not c['passed']]
    (out / 'layout-matrix.json').write_text(json.dumps(gate, ensure_ascii=False, indent=2))
    assert gate['passed'], ('R06 DOM-only layout regression', [c['name'] for c in gate['variants']['candidate']['cases'] if not c['passed']])
    return gate
