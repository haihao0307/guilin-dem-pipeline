"""Add a discoverable, independent GNM experiment to the frozen five-case home."""
from pathlib import Path
import hashlib, json, runpy

HERE = Path(__file__).parent
ROOT = HERE.parent
runpy.run_path(str(HERE / 'build-five-cases.py'))
URL = 'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/qa/gnm-study/'
MARKER = '<p>打开工作台，观察细节，调整自己的作品</p></div><div class="catalog-grid">'
LINK = '<a id="catalogGnmExperiment" class="catalog-experiment-link" href="' + URL + '">GNM 人头与接发实验 · 联网</a>'
STYLE = '.catalog-experiment-link{display:inline-flex;align-items:center;min-height:44px;margin-top:10px;padding:0 14px;border:1px solid #59704d;border-radius:9px;color:#d3e3c6;background:#263020;font-size:13px;text-decoration:none}.catalog-experiment-link:hover{border-color:#a7bd92;background:#303e28}.catalog-experiment-link:focus-visible{outline:2px solid #c1dfa2;outline-offset:3px}'
PINNED = {
    'kuko-anemone-candidate.html': '5d5f6dc5c1f7af152740a7afae59c47e460260cc76102d6e66bba830c8644c41',
    'kuko-anemone-standalone.html': 'f451240e602d955537c871c6df2893083b3e05a7e7addf72ddca818f420e6600',
    'KAOPU-毛发工作台-五案例.html': 'f451240e602d955537c871c6df2893083b3e05a7e7addf72ddca818f420e6600',
}
records = []
for filename, expected in PINNED.items():
    p = ROOT / 'dist' / filename
    before = p.read_bytes()
    assert hashlib.sha256(before).hexdigest() == expected, filename
    text = before.decode()
    assert text.count(MARKER) == 1, filename
    text = text.replace(MARKER, MARKER.replace('</p></div>', '</p>' + LINK + '</div>'))
    text = text.replace('</style>', STYLE + '</style>', 1)
    after = text.encode()
    p.write_bytes(after)
    records.append({'file': filename, 'baselineSha256': expected,
                    'sha256': hashlib.sha256(after).hexdigest(), 'bytes': len(after)})
receipt = {'entryUrl': URL, 'changes': ['one homepage link', 'link-only scoped CSS'],
           'objectRuntimeChanges': False, 'files': records}
(HERE / 'qa/gnm-home-build.json').write_text(json.dumps(receipt, indent=2))
print(json.dumps(receipt))
