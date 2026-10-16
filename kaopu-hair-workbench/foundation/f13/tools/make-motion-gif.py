from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
p=Path(__file__).resolve().parents[1]
record=json.loads((p/'evidence/motion-frames.json').read_text())
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',17)
frames=[]
for f in record['frames']:
 im=Image.open(p/'evidence'/f['file']).convert('RGB').crop((22,86,1074,978)).resize((720,610),Image.Resampling.LANCZOS)
 frame=Image.new('RGB',(720,642),'#f4f3eb');frame.paste(im,(0,32));d=ImageDraw.Draw(frame);d.text((15,6),'F13 · 跑步 · 实际网页连续帧',font=font,fill='#365e4e');frames.append(frame)
palette=frames[0].quantize(colors=240)
encoded=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
encoded[0].save(p/'evidence/motion-review.gif',save_all=True,append_images=encoded[1:],duration=100,loop=0,optimize=False,disposal=2)
print('motion-review.gif', (p/'evidence/motion-review.gif').stat().st_size)
