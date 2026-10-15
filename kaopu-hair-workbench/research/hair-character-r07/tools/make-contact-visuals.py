from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
P=Path(__file__).resolve().parents[1];F=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',27);S=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19)
def fit(path,size):
 im=Image.open(P/path).convert('RGB');im.thumbnail(size);out=Image.new('RGB',size,'white');out.paste(im,((size[0]-im.width)//2,(size[1]-im.height)//2));return out
out=Image.new('RGB',(1800,930),'white');d=ImageDraw.Draw(out)
for i,(name,label) in enumerate([('medium','偏分中长发'),('long','中分披肩长发')]):
 out.paste(fit(f'qa/r07-{name}-overview.png',(880,840)),(10+i*900,65));d.text((30+i*900,20),label,(42,58,44),font=F)
d.text((30,904),'R07 · 当前实际浏览器画面',(89,101,88),font=S);out.save(P/'qa/r07-contact-overview.jpg',quality=93)
frames=[]
for i in range(24):
 im=Image.open(P/f'qa/far-run-{i:02d}.png').convert('RGB');w,h=im.size
 # Fixed crop of the real distant camera, enlarged only for inspection.
 im=im.crop((int(w*.27),int(h*.30),int(w*.73),int(h*.88)));im.thumbnail((690,690));frame=Image.new('RGB',(720,750),'white');frame.paste(im,((720-im.width)//2,50+(690-im.height)//2));d=ImageDraw.Draw(frame);d.text((22,12),'远处跑步 · 实际画面局部放大',(42,58,44),font=S);frames.append(frame.quantize(colors=96,dither=Image.Dither.NONE))
frames[0].save(P/'qa/r07-far-motion.gif',save_all=True,append_images=frames[1:],duration=50,loop=0,optimize=True,disposal=2)
record={'sourceHashes':json.loads((P/'BUILD_MANIFEST.json').read_text(encoding='utf-8'))['files'],'actualBrowserFrames':True,'imageSynthesisUsed':False,'artifacts':{f:hashlib.sha256((P/f).read_bytes()).hexdigest() for f in ['qa/r07-contact-overview.jpg','qa/r07-far-motion.gif']}}
(P/'qa/contact-artifacts.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8');print('Contact overview and distant-motion GIF created')

from PIL import ImageChops,ImageStat
comparison=[]
for style in ['medium','long']:
 a=Image.open(P/f'qa/cache-{style}-memo.png').convert('RGB');b=Image.open(P/f'qa/cache-{style}-direct.png').convert('RGB');diff=ImageChops.difference(a,b);stats=ImageStat.Stat(diff);mask=a.convert('L').point(lambda x:255 if x<80 else 0);dark=ImageStat.Stat(diff,mask)
 comparison.append({'style':style,'meanAbsoluteRGB255':sum(stats.mean)/3,'rmsRGB255':sum(stats.rms)/3,'darkPixelMeanAbsoluteRGB255':sum(dark.mean)/3,'memoSHA256':hashlib.sha256((P/f'qa/cache-{style}-memo.png').read_bytes()).hexdigest(),'directSHA256':hashlib.sha256((P/f'qa/cache-{style}-direct.png').read_bytes()).hexdigest()})
(P/'qa/cache-visual-difference.json').write_text(json.dumps({'sourceHashes':record['sourceHashes'],'sameBuildActualBrowserCaptures':True,'cases':comparison},ensure_ascii=False,indent=2),encoding='utf-8')
