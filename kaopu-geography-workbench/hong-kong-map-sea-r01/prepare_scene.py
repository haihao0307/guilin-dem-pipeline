from pathlib import Path
import numpy as np,json,shutil
from pyproj import Transformer
R=Path(__file__).resolve().parent;P=R.parent/'hk-dem-recovery-expanded';(R/'data').mkdir(exist_ok=True)
m=json.loads((P/'geographic_manifest.json').read_text());O=[834000,827000];tr=Transformer.from_crs(4326,2326,always_xy=True)
def loc(lon,lat):
 e,n=tr.transform(lon,lat);return[round(e-O[0],3),round(O[1]-n,3)]
def point(text,lon,lat,kind='reference',detail=False):return{'text':text,'point':loc(lon,lat),'kind':kind,'detail':detail}
labels=[point('船湾淡水湖 · 独立淡水水位',114.273,22.47),point('① 旧九龙钟楼 / 起点',114.1692,22.2935,'story'),point('② 巨型庙宇第二站 · 选址区',114.184,22.331,'story'),point('狮子山 · 穿山意向',114.1872,22.3522,'story'),point('③ 沙田候选区',114.202,22.4025,'story'),point('田园候选 · 位置未定',114.163,22.462,'story'),point('罗湖',114.113146,22.5281624,'story'),point('香港岛 · 对岸山体',114.183,22.267),point('大埔',114.171,22.451),point('城门河',114.2013,22.3916,detail=True),point('沙田马场',114.2072,22.4003,detail=True),point('香港中文大学',114.2068,22.4190,detail=True),point('大学站',114.2100,22.4134,detail=True),point('九龙城寨遗址',114.1903,22.3325,detail=True),point('启德旧机场区域',114.209,22.321,detail=True),point('庙街 / 天后庙',114.1700,22.3094,detail=True),point('现代红磡站',114.1821933,22.3030506,detail=True)]
# This is a diagrammatic idea from the user's latest route discussion, not an engineered alignment.
p=[(114.1692,22.2935),(114.170,22.307),(114.176,22.320),(114.184,22.331),(114.186,22.343),(114.1872,22.3522),(114.189,22.370),(114.196,22.389),(114.202,22.4025),(114.208,22.413),(114.201,22.426),(114.179,22.442),(114.163,22.462),(114.145,22.483),(114.139,22.492),(114.128,22.502),(114.119,22.511),(114.113146,22.5281624)]
pts=np.array([loc(*v) for v in p]);smooth=[]
for j in range(len(pts)-1):
 p0=pts[max(0,j-1)];p1=pts[j];p2=pts[j+1];p3=pts[min(len(pts)-1,j+2)]
 for t in np.linspace(0,1,12,endpoint=False):smooth.append((.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)).round(3).tolist())
smooth.append(pts[-1].tolist())
r=json.loads((R.parent/'hk-dem-recovery/osm-hunghom-lowu-v69-epsg2326.json').read_text());xy=r.get('coordinates',r.get('xy'))
assert xy is not None,r.keys()
routes=[{'kind':'story','title':'User story concept; revised second station—Lion Rock tunnel intention—Sha Tin river/racecourse/university zone; no engineering design','points':smooth},{'kind':'reference','title':'Modern East Rail Hung Hom to Lo Wu / OSM relation4248592v69 members current API; no track elevations','points':[[round(e-O[0],3),round(O[1]-n,3)]for e,n in xy]}]
def view(lon,lat,d,yaw,pitch):
 x,z=loc(lon,lat);return{'target':[x,150,z],'distance':d,'yaw':yaw,'pitch':pitch}
D={'width':m['width'],'height':m['height'],'step':30,'origin':O,'x0':m['geotransform'][0]+15,'y0':m['geotransform'][3]-15,'source':m,'datum':m['vertical_datum'],'labels':labels,'routes':routes,'views':{'overview':view(114.182,22.394,30000,-1.40,-.80),'harbour':view(114.185,22.315,14000,-.2,-.48),'harboursea':view(114.170,22.2935,800,0,-.022),'lion':view(114.19,22.361,15500,-.7,-.58),'shatin':view(114.201,22.402,11500,-.7,-.69)}}
D['views']['harboursea']['target'][1]=9
(R/'data/scene.json').write_text(json.dumps(D,ensure_ascii=False,separators=(',',':')))
shutil.copy2(P/'heights.npy',R/'data/heights.npy');shutil.copy2(P/'sea_land_mask.npy',R/'data/mask.npy');shutil.copy2(P/'geographic_manifest.json',R/'data/geographic_manifest.json')
print('prepared',m['width'],m['height'],len(xy))
