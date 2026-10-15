from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'qa'
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
frames=[]
for i in range(60):
    canvas=Image.new('RGB',(1000,656),'#080b0a')
    draw=ImageDraw.Draw(canvas)
    for k,style in enumerate(['medium','long']):
        im=Image.open(P/f'motion-{style}'/f'{i:03d}.png').convert('RGB')
        # Real WebGL canvas frames; only rescale for the side-by-side evidence.
        im.thumbnail((500,600),Image.Resampling.LANCZOS)
        canvas.paste(im,(k*500+(500-im.width)//2,42))
        draw.text((k*500+25,12),'男士中长发 · 基准 14 cm' if k==0 else '长发 · 基准 34 cm',font=font,fill='#d9e3d1')
    draw.text((25,628),'相同发根轻摇输入 / 实际三维连续帧 / 两种长度分别求解',font=small,fill='#91a08f')
    frames.append(canvas.quantize(colors=160,method=Image.Quantize.MEDIANCUT))
frames[0].save(P/'motion-comparison.gif',save_all=True,append_images=frames[1:],duration=42,loop=0,optimize=False)
print('Saved motion-comparison.gif from actual rendered frames')
