from pathlib import Path
from PIL import Image
import io, base64, re, subprocess, hashlib

root = Path(__file__).resolve().parents[1]
src = root / 'source'

# Reassemble the app source when the repository copy stores it in reviewable parts.
app_path = src / 'app.js'
if not app_path.exists():
    parts = sorted(src.glob('app.part*.js'))
    if not parts:
        raise SystemExit('Missing app.js and app.part*.js')
    app_path.write_text(''.join(p.read_text(encoding='utf-8') for p in parts), encoding='utf-8')

def dataimg(path, width=1440, quality=88):
    im = Image.open(path).convert('RGB')
    im.thumbnail((width, width))
    f = io.BytesIO()
    im.save(f, format='JPEG', quality=quality, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(f.getvalue()).decode()

s = (src / 'template.html').read_text(encoding='utf-8')
for key, t in [('08', '08'), ('24', '24'), ('40', '40')]:
    s = s.replace('__FRAME' + key + '__', dataimg(root / 'evidence' / ('teacher_' + t + '.jpg')))
    s = s.replace('__THUMB' + key + '__', dataimg(root / 'evidence' / ('teacher_' + t + '.jpg'), 210, 62))
s = s.replace('__OBSERVATIONS__', (src / 'observations.json').read_text(encoding='utf-8'))
s = s.replace('__APP__', app_path.read_text(encoding='utf-8'))
video = root / 'evidence' / 'teacher_preview.mp4'
s = s.replace('__VIDEO__', base64.b64encode(video.read_bytes()).decode() if video.exists() else '')

p = root / 'KAOPU_SHORE_RESTART_R23.html'
p.write_text(s, encoding='utf-8')
for i, js in enumerate(re.findall(r'<script>(.*?)</script>', s, re.S)):
    t = src / f'check_{i}.js'
    t.write_text(js, encoding='utf-8')
    r = subprocess.run(['node', '--check', str(t)], capture_output=True, text=True)
    t.unlink()
    if r.returncode:
        raise SystemExit(r.stderr)
print('built', p, len(s.encode()), hashlib.sha256(p.read_bytes()).hexdigest())
