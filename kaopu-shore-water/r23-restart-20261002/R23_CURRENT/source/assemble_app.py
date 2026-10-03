from pathlib import Path

root = Path(__file__).parent
parts = sorted(root.glob('app.part*.js'))
if not parts:
    raise SystemExit('No app.part*.js files found')
(root / 'app.js').write_text(
    ''.join(p.read_text(encoding='utf-8') for p in parts),
    encoding='utf-8',
)
print('assembled', root / 'app.js')
