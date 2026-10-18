from pathlib import Path
import json, hashlib
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
evidence = root / 'evidence'
review = json.loads((evidence / 'ear13-viewer-checks.json').read_text(encoding='utf-8'))
runtime = json.loads((root / 'BUILD_MANIFEST.json').read_text(encoding='utf-8'))['htmlSHA256']
if review['runtimeSHA256'] != runtime:
    raise RuntimeError('Cannot compose stale render evidence')
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 20)
small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
labels = {'left': '左侧', 'right': '右侧', 'back': '背面', 'front': '正面', 'top': '顶部', 'oblique': '斜侧'}
source_hashes, outputs = {}, {}

def tile(name, size=None):
    file = evidence / name
    source_hashes[name] = hashlib.sha256(file.read_bytes()).hexdigest()
    image = Image.open(file).convert('RGB').crop((22, 190, 1074, 978))
    return image.resize(size, Image.Resampling.LANCZOS) if size else image

def save(image, name):
    file = evidence / name
    image.save(file)
    outputs[name] = hashlib.sha256(file.read_bytes()).hexdigest()

for index, views in enumerate([['left', 'right', 'back'], ['front', 'top', 'oblique']], 1):
    image = Image.new('RGB', (1200, 1510), '#f4f5ed')
    draw = ImageDraw.Draw(image)
    draw.text((15, 10), '固定 R11 · 调整前', font=font, fill='#355547')
    draw.text((615, 10), '当前 R13 · 整体尚未验收', font=font, fill='#355547')
    for row, view in enumerate(views):
        for column, state in enumerate(['before', 'after']):
            image.paste(tile(f'ear13-{state}-{view}.png', (592, 444)), (column * 600 + 4, row * 480 + 42))
            draw.text((column * 600 + 12, row * 480 + 48), labels[view], font=small, fill='white')
    draw.text((15, 1480), '同机位完整导向发对照；根、顶部、刘海与切口保留。稀疏结构不是最终发丝覆盖。', font=small, fill='#355547')
    save(image, f'ear13-review-overview-{index}.png')

save(tile('ear13-after-oblique.png'), 'ear13-current-oblique.png')
image = Image.new('RGB', (1440, 1160), '#f4f5ed')
draw = ImageDraw.Draw(image)
for row, mode in enumerate(['zones', 'active', 'directions']):
    for column, view in enumerate(['left', 'right', 'back']):
        image.paste(tile(f'ear13-domain-{mode}-{view}.png', (476, 357)), (column * 480 + 2, row * 386 + 25))
        draw.text((column * 480 + 10, row * 386 + 2), labels[view] + ' · ' + {'zones': '批准生长域', 'active': '启用毛囊', 'directions': '根向'}[mode], font=small, fill='#355547')
save(image, 'ear13-domain-overview.png')
(evidence / 'ear13-overview-sources.json').write_bytes(json.dumps({
    'runtimeSHA256': runtime, 'sourceImages': source_hashes, 'outputs': outputs,
    'operation': 'Only crop and resize actual same-camera rendered pixels for comparison. No generated hair or retouching.'
}, ensure_ascii=False, indent=2).encode('utf-8'))
print(json.dumps({'runtimeSHA256': runtime, 'outputs': list(outputs)}))
