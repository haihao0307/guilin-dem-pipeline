from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1];evidence=root/'evidence';runtime=json.loads((root/'BUILD_MANIFEST.json').read_text(encoding='utf-8'))['htmlSHA256'];review=json.loads((evidence/'upper11-viewer-checks.json').read_text(encoding='utf-8'));domains=json.loads((evidence/'rest10-viewer-checks.json').read_text(encoding='utf-8'))
if review['runtimeSHA256']!=runtime or domains['runtimeSHA256']!=runtime:raise RuntimeError('Cannot assemble stale screenshots')
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',22);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',17);sourceHashes={};outputs={}
def tile(name,size):
 p=evidence/name;sourceHashes[name]=hashlib.sha256(p.read_bytes()).hexdigest();return Image.open(p).convert('RGB').crop((22,190,1074,978)).resize(size,Image.Resampling.LANCZOS)
def save(im,name):
 p=evidence/name;im.save(p);outputs[name]=hashlib.sha256(p.read_bytes()).hexdigest()
labels={'front':'正面','left':'左侧','right':'右侧','back':'背面','top':'顶部','oblique':'斜侧'}
for index,views in enumerate([['front','left','back'],['right','top','oblique']],1):
 im=Image.new('RGB',(1200,1540),'#f4f5ed');draw=ImageDraw.Draw(im);draw.text((15,10),'固定 R10 · 同机位对照',font=font,fill='#355547');draw.text((615,10),'当前 R13 · 整体尚未验收',font=font,fill='#355547')
 for row,view in enumerate(views):
  for col,state in enumerate(['before','after']):
   im.paste(tile(f'upper11-{state}-{view}.png',(592,444)),(col*600+4,row*493+48));draw.text((col*600+15,row*493+458),labels[view],font=font,fill='white')
 draw.text((15,1514),'稀疏导向结构：保留顶部根向与圆度，继续耳周束群；整头自然度、质感、物理和公网加载仍未验收。',font=small,fill='#355547');save(im,f'upper11-review-overview-{index}.png')
im=Image.new('RGB',(1440,1160),'#f4f5ed');draw=ImageDraw.Draw(im)
for row,mode in enumerate(['zones','active','directions']):
 for col,view in enumerate(['left','right','back']):
  im.paste(tile(f'rest10-domain-{mode}-{view}.png',(476,357)),(col*480+2,row*386+25));draw.text((col*480+10,row*386+2),labels[view]+' · '+{'zones':'批准生长域','active':'启用毛囊','directions':'根向'}[mode],font=small,fill='#355547')
save(im,'upper11-domain-overview.png');save(tile('upper11-after-oblique.png',(1052,788)),'upper11-current-oblique.png')
(evidence/'upper11-overview-sources.json').write_bytes(json.dumps({'runtimeSHA256':runtime,'sourceImages':sourceHashes,'outputs':outputs,'operation':'Cropped and resized source screenshots for QA comparison; rendered content unchanged. Visual judgment is separate.'},ensure_ascii=False,indent=2).encode('utf-8'))
print(json.dumps({'runtimeSHA256':runtime,'outputs':list(outputs)}))
