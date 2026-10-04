from pathlib import Path
root=Path(__file__).parent
html=(root/'src/index.template.html').read_text().replace('/*STUDY_SCRIPT*/',(root/'src/study.js').read_text())
(root/'index.html').write_text(html)
print(f'Built {len(html.encode())} bytes')
