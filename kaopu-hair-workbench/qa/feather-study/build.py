from pathlib import Path
root=Path(__file__).parent
template=(root/'src/index.template.html').read_text()
result=template.replace('/*STUDY_STYLE*/',(root/'src/style.css').read_text()).replace('/*STUDY_SCRIPT*/',(root/'src/study.js').read_text())
(root/'index.html').write_text(result)
print(f'Built {len(result.encode())} bytes')
