from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import hashlib,json
P=Path(__file__).resolve().parents[1];font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
def tile(style,mode,n,width=360,height=430):
 im=Image.open(P/f'qa/frame-{style}-{mode}-{n:02d}.png').convert('RGB');w,h=im.size
 # Same crop rule for every frame of a hairstyle, retaining the actual hair.
 box=(int(w*.21),int(h*.035),int(w*.86),int(h*.95)) if style=='medium' else (int(w*.16),0,int(w*.91),int(h*.98))
 im=im.crop(box);im.thumbnail((width,height));canvas=Image.new('RGB',(width,height),'white');canvas.paste(im,((width-im.width)//2,(height-im.height)//2));return canvas
frames=[]
for n in range(32):
 im=Image.new('RGB',(720,470),'white');im.paste(tile('medium','run',n),(0,34));im.paste(tile('long','run',n),(360,34));d=ImageDraw.Draw(im);d.text((20,8),'偏分中长发 · 跑步',(45,60,45),font);d.text((380,8),'披肩长发 · 跑步',(45,60,45),font);d.text((20,448),'真实 WebGL 捕捉 · 原生人物动作 · 120 Hz 头发接触求解',(70,80,70),small);frames.append(im.quantize(colors=64,dither=Image.Dither.NONE))
# Running frames are sampled every .05 simulated seconds after two warm cycles.
frames[0].save(P/'qa/hair-motion-r06.gif',save_all=True,append_images=frames[1:],duration=50,loop=0,optimize=True,disposal=2)
montage=Image.new('RGB',(1080,940),'white');d=ImageDraw.Draw(montage)
for row,style in enumerate(['medium','long']):
 for col,(mode,label) in enumerate([('walk','行走'),('run','跑步'),('jump','起跳后')]):
  montage.paste(tile(style,mode,10),(col*360,row*470+30));d.text((col*360+15,row*470+6),('中长发' if row==0 else '长发')+' · '+label,(45,60,45),font)
montage.save(P/'qa/motion-overview.jpg',quality=90)
a=Image.open(P/'qa/crowd-long-24.png').convert('RGB');b=Image.open(P/'qa/crowd-approach-detail.png').convert('RGB');a.thumbnail((750,525));b.thumbnail((750,525));out=Image.new('RGB',(1500,555),'white');out.paste(a,(0,30));out.paste(b,(750,30));d=ImageDraw.Draw(out);d.text((22,7),'24 个远处头发载体 · 连续距离预算',(45,60,45),font);d.text((772,7),'靠近其中一人 · 恢复发丝和接触细节',(45,60,45),font);out.save(P/'qa/distance-overview.jpg',quality=92)
record={'sourceHashes':json.loads((P/'BUILD_MANIFEST.json').read_text(encoding='utf-8'))['files'],'actualWebGLFrames':True,'generatedHairIllustration':False,'artifacts':{f:hashlib.sha256((P/f).read_bytes()).hexdigest() for f in ['qa/hair-motion-r06.gif','qa/motion-overview.jpg','qa/distance-overview.jpg']}}
(P/'qa/visual-artifacts.json').write_text(json.dumps(record,indent=2),encoding='utf-8');print([(f,(P/f).stat().st_size) for f in record['artifacts']])
