from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import hashlib,json
P=Path(__file__).resolve().parents[1];frames=[];records=[];font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',12)
for j in range(24):
 out=Image.new('RGB',(800,400),'#f7f7f2');d=ImageDraw.Draw(out);d.text((18,8),'MEDIUM  /  Native character + wind',(50,60,40),font=font);d.text((418,8),'LONG  /  Native character + wind',(50,60,40),font=font)
 for k,style in enumerate(['medium','long']):
  f=P/'qa'/f'wind-{style}-{j:02d}.png';im=Image.open(f).convert('RGB');im.thumbnail((380,350),Image.Resampling.LANCZOS);out.paste(im,(k*400+(380-im.width)//2,32+(350-im.height)//2));records.append({'file':str(f.relative_to(P)).replace('\\','/'),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'simulationTime':(j+1)*4/30})
 frames.append(out.quantize(colors=96))
frames[0].save(P/'qa/wind-comparison.gif',save_all=True,append_images=frames[1:],duration=130,loop=0,optimize=True)
(P/'qa/frame-manifest.json').write_text(json.dumps({'sourceHashes':json.loads((P/'BUILD_MANIFEST.json').read_text())['files'],'realWebGLFrames':True,'simulationSecondsBetweenFrames':4/30,'playback':'130 ms per frame; simulation time, not wall-clock performance','frames':records},indent=2),encoding='utf-8')
print('GIF bytes', (P/'qa/wind-comparison.gif').stat().st_size)
