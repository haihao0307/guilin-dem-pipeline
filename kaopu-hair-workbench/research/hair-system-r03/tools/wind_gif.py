from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1];Q=P/'qa'
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',10)
for detail,count,name in [(False,96,'wind-comparison.gif'),(True,144,'wind-tip-comparison.gif')]:
 frames=[]
 for i in range(0,count,2):
  c=Image.new('RGB',(560,320),'white');d=ImageDraw.Draw(c)
  for k,style in enumerate(['medium','long']):
   directory=('wind-tip-' if detail else 'wind-')+style
   im=Image.open(Q/directory/f'{i:03d}.png').convert('RGB');im.thumbnail((280,250),Image.Resampling.LANCZOS);c.paste(im,(k*280+(280-im.width)//2,34));d.text((k*280+16,10),'男士中长发 · 14 cm' if k==0 else '长发 · 34 cm',font=font,fill='#4d5747')
  label=('发梢近景 · ' if detail else '整体 · ')+('微风吹动' if i<96 else '关闭风力 · 自然回落')+' / 发根固定 / 实际三维连续帧'
  d.text((16,299),label,font=small,fill='#647259');frames.append(c.quantize(colors=48,method=Image.Quantize.MEDIANCUT))
 frames[0].save(Q/name,save_all=True,append_images=frames[1:],duration=84,loop=0,optimize=True)
 print(name,(Q/name).stat().st_size);del frames
m=json.loads((P/'BUILD_MANIFEST.json').read_text(encoding='utf-8'))
files=['medium-full.png','medium-black.png','long-full.png','long-black.png','long-wind-tip.png','wind-comparison.gif','wind-tip-comparison.gif']
(Q/'frame-manifest.json').write_text(json.dumps({'sourceHashes':m['files'],'frames':'actual WebGL frames, resized only; 24 fps simulation steps; no desktop mouse control','files':{f:hashlib.sha256((Q/f).read_bytes()).hexdigest() for f in files}},indent=2),encoding='utf-8')
