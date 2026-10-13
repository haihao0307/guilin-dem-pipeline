from pathlib import Path
import json,numpy as np
from PIL import Image
p=Path(__file__).resolve().parent;out=p/'runtime-tiles';out.mkdir(exist_ok=True)
def rgb(s):return np.array([int(s[i:i+2],16) for i in (1,3,5)],float)/255
N=512
for info in json.loads((p/'materials.json').read_text()):
 if info['family']=='leather':continue
 prm=info['parameters'];id=info['id'];knit=info['family']=='knit';base=rgb(prm.get('base-dye',info.get('geometry',{}).get('warpDye','#aaaabb')));contrast=rgb(prm.get('contrast-dye','#434343'))
 if knit:
  g=prm['gauge'];d=g*.35;oldhalf=.159154943092*g*.45+d*.52;target=.35+4*oldhalf+.55;depth=np.clip((target-.35-d*1.06)/(2*.159154943092*g),.65,2.8);R=d*.5;course=.716197243913;W=16*g;H=16*g*course
  highs=np.full((N,N),-1e6);lows=np.full((N,N),1e6);cfront=np.zeros((N,N,3));cback=cfront.copy();pat=prm['knit-pattern']
  def colour(col,row):
   x=col%16;y=row%16
   if not pat:return 0
   if pat==3:return int(y%8>=4)
   z=abs(x-7.5)+abs(y-7.5);return int(abs(z-6)<1.1 or ((x+y)%5<.5))
  for row in range(-2,19):
   for carrier in range(1 if pat==0 else 2):
    for t in np.linspace(-1,17,18*96,endpoint=False):
     u=t%1;a=2*np.pi*u;working=not pat or abs(colour(np.floor(t),row)-carrier)<.1
     x=(t+.238732414638*np.sin(2*a))*g;y=(row*course+.636619772368*np.cos(a))*g;z=-.159154943092*np.cos(2*a)*g*depth
     if not working:
      x=t*g;y=(row*course+.636619772368)*g;z=-.159154943092*g*depth
      for v in (u,1-u):
       if v<.3:
        f=np.clip(v/.3,0,1);q=f**4*(35+f*(-84+f*(70-20*f)));y-=.785398163397*v*v*(1-q)*g
     col=base if carrier==0 else contrast
     ix=int(x/W*N);iy=int(y/H*N);rx=int(np.ceil(R/W*N))+1;ry=int(np.ceil(R/H*N))+1
     xx=np.arange(ix-rx,ix+rx+1);yy=np.arange(iy-ry,iy+ry+1);dx=(xx+.5)*W/N-x;dy=(yy+.5)*H/N-y;r2=dx[None,:]**2+dy[:,None]**2;mask=r2<R*R;dz=np.sqrt(np.maximum(0,R*R-r2));X=xx%N;Y=yy%N;index=np.ix_(Y,X);front=z+dz;back=z-dz;fh=highs[index];fl=lows[index];win=mask&(front>fh);lose=mask&(back<fl);highs[index]=np.where(win,front,fh);lows[index]=np.where(lose,back,fl)
     for k in range(3):cfront[:,:,k][index]=np.where(win,col[k],cfront[:,:,k][index]);cback[:,:,k][index]=np.where(lose,col[k],cback[:,:,k][index])
  missing=highs<-1e5;coverage=float(1-missing.mean());highs[missing]=0;lows[missing]=0;cfront[missing]=base*.68;cback[missing]=base*.68
  pairs=[('outer',highs,cfront),('inner',-lows,cback)]
 else:
  g=info['geometry'];W=16*g['warpPitch'];H=16*g['weftPitch'];x=(np.arange(N)+.5)/N*16;y=x.copy();X,Y=np.meshgrid(x,y);draft=((np.floor(Y)-np.floor(X))%4)<3;warp=np.sqrt(np.maximum(0,1-((X%1-.5)/.49)**2));weft=np.sqrt(np.maximum(0,1-((Y%1-.5)/.45)**2));highs=np.where(draft,warp,weft)*g['thickness']*.42;weftcolor=rgb(g['weftDye']);colour=np.where(draft[:,:,None],base,weftcolor);pairs=[('outer',highs,colour),('inner',np.where(~draft,warp,weft)*g['thickness']*.42,np.where(~draft[:,:,None],base,weftcolor))];coverage=1
 for side,height,colour in pairs:
  dx=(np.roll(height,-1,1)-np.roll(height,1,1))/(2*W/N);dy=(np.roll(height,-1,0)-np.roll(height,1,0))/(2*H/N);normal=np.stack([-dx,-dy,np.ones_like(dx)],2);normal/=np.linalg.norm(normal,axis=2,keepdims=True)
  Image.fromarray(np.uint8(np.clip(colour,0,1)*255)).save(out/(id+'-'+side+'-color.png'))
  Image.fromarray(np.uint8((normal*.5+.5)*255)).save(out/(id+'-'+side+'-normal.png'))
 (out/(id+'.json')).write_text(json.dumps({'tileMM':[W,H],'source':'original public MP04 knit curve / 3:1 denim cross sections','coverage':coverage,'representation':'periodic unresolved material field; full original geometry remains available in detail mode','notFullR15Renderer':True}))
 print(id,coverage,flush=True)
