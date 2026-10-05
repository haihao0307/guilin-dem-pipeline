"""Append a real-rendered Human card to the byte-pinned five-case home."""
from pathlib import Path
import base64
import hashlib
import json
import runpy

HERE = Path(__file__).parent
ROOT = HERE.parent
URL = 'gnm-groom-editor/experiment.html'
PREVIEW = ROOT / 'references/previews/gnm-human-render.jpg'
# Only the new anchor needs these rules. Its contents use the existing preview,
# copy and title classes, including their established responsive styles.
STYLE = '''<style id="gnmCatalogCardStyle">
.gnm-catalog-card{position:relative;display:block;padding:0;overflow:hidden;text-align:left;border:1px solid #3a4735;border-radius:18px;background:#1b241b;transition:border-color .18s,transform .18s;min-width:0;color:inherit;font:inherit;text-decoration:none}
.gnm-catalog-card:hover{background:#1f291e;border-color:#9db58a;transform:translateY(-2px)}
.gnm-catalog-card:focus-visible{outline:2px solid #c1dfa2;outline-offset:3px}
@media(max-width:650px){.gnm-catalog-card{border-radius:13px}}

.ten24-local-task{margin:18px 0 6px;padding:14px 16px;border:1px solid #635c39;border-radius:12px;background:#242419;display:flex;gap:10px 18px;align-items:center;flex-wrap:wrap}.ten24-local-task strong{color:#e8e9cd}.ten24-local-task span{color:#d6c991;font-size:13px}.ten24-local-task a{margin-left:auto;color:#c1dfa2;font-size:13px}
</style>'''
PINNED = {
    'kuko-anemone-candidate.html': '5d5f6dc5c1f7af152740a7afae59c47e460260cc76102d6e66bba830c8644c41',
    'kuko-anemone-standalone.html': 'f451240e602d955537c871c6df2893083b3e05a7e7addf72ddca818f420e6600',
    'KAOPU-毛发工作台-五案例.html': 'f451240e602d955537c871c6df2893083b3e05a7e7addf72ddca818f420e6600',
}


def augment(before, preview):
    """Add only scoped CSS and an independent card after all five registrations."""
    source = 'data:image/jpeg;base64,' + base64.b64encode(preview).decode()
    card = ('<a id="catalogGnmExperiment" class="gnm-catalog-card" href="' + URL + '" '
            'aria-label="打开原男性 R9 毛发编辑页">'
            '<span class="catalog-preview"><img src="' + source + '" '
            'alt="人工作台中实际渲染的人头与头发" width="640" height="603"></span>'
            '<span class="catalog-card-copy"><span class="catalog-card-title">原男性 <span>R9 Groom</span></span>'
            '<span class="catalog-card-description">发型 · 发色 · 眉毛 · 胡须</span>'
            '<span class="catalog-open">打开原男性毛发编辑</span></span></a>')
    local_task = '<section id="ten24LocalTask" class="ten24-local-task"><strong>指定原女性 · TEN24</strong><span>待本地原件接入 · 未完成</span><a href="../handoffs/ten24-original-local/index.html">本地任务与原件核验 ↗</a></section>'
    # Append within the existing final script, preserving its complete source
    # and the five-script contract. No renderer or lifecycle handler is wrapped.
    extra = ('\n/* Independent Human homepage card. */\n(function () {\n'
             "  'use strict';\n"
             "  const grid = document.querySelector('#catalogHome .catalog-grid');\n"
             "  if (grid && !document.getElementById('catalogGnmExperiment')) {\n"
             "    grid.insertAdjacentHTML('beforeend', " + json.dumps(card, ensure_ascii=False) + ");\n"
             "    grid.insertAdjacentHTML('afterend', " + json.dumps(local_task, ensure_ascii=False) + ");\n"
             "  }\n})();\n")
    text = before.decode()
    assert 'catalogGnmExperiment' not in text, 'Input must be the pinned five-case home'
    # The frozen frame template also contains a literal </head>; only the first
    # occurrence belongs to the host document.
    assert '</head>' in text and text.count('</script></body>') == 1
    after = text.replace('</head>', STYLE + '</head>', 1)
    after = after.replace('</script></body>', extra + '</script></body>', 1)
    # Removing the two insertions must recover every original byte, including
    # all five object runtimes, their embedded assets and their catalog order.
    assert after.replace(STYLE, '', 1).replace(extra, '', 1).encode() == before
    return after.encode()


def main():
    runpy.run_path(str(HERE / 'build-five-cases.py'))
    preview = PREVIEW.read_bytes()
    records = []
    for filename, expected in PINNED.items():
        p = ROOT / 'dist' / filename
        before = p.read_bytes()
        assert hashlib.sha256(before).hexdigest() == expected, filename
        after = augment(before, preview)
        p.write_bytes(after)
        records.append({'file': filename, 'baselineSha256': expected,
                        'sha256': hashlib.sha256(after).hexdigest(), 'bytes': len(after),
                        'originalBytesPreserved': True})
    receipt = {'entryUrl': URL,
               'changes': ['sixth Human image card', 'card-only scoped CSS'],
               'preview': {'file': str(PREVIEW.relative_to(ROOT)), 'bytes': len(preview),
                           'sha256': hashlib.sha256(preview).hexdigest(),
                           'source': 'Actual GNM hair-studio canvas capture; cropped and resized only'},
               'objectRuntimeChanges': False, 'files': records}
    (HERE / 'qa/gnm-home-build.json').write_text(json.dumps(receipt, indent=2))
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
