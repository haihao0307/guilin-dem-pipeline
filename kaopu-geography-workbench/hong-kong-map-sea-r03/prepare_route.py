from pathlib import Path
import json,copy,numpy as np
from scipy.interpolate import PchipInterpolator
R=Path(__file__).resolve().parent
D=json.loads((R.parent/'hong-kong-map-sea-r02/data/scene.json').read_text()); O=D['origin']
modern=json.loads((R.parent/'hk-dem-recovery/osm-hunghom-lowu-v69-epsg2326.json').read_text())['xy']
def smooth(points):
 p=np.array(points); keep=np.r_[True,np.linalg.norm(np.diff(p,axis=0),axis=1)>.1];p=p[keep];d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(p,axis=0),axis=1))];t=np.linspace(0,d[-1],max(2,int(d[-1]/25)+1));q=PchipInterpolator(d,p,axis=0)(t);return [[round(e-O[0],3),round(O[1]-n,3)] for e,n in q]
def route(title,pts,role='surface',basis='story candidate'):
 return {'kind':'story','role':role,'title':title,'basis':basis,'points':smooth(pts),'controls_epsg2326':pts,'notEngineeringAlignment':True}
clock=[835477.171,817175.985];hung=[836816.072,818233.555];second=[837440,821150];city=[837651.106,821494.676];sha=[839790,829760]
# Salisbury / Chatham Road corridor verified in the official East Rail Extension EIA;
# exact historic centreline has not been recovered, so control coordinates are authored.
south=[clock,[835680,817160],[835960,817230],[836185,817380],[836410,817680],[836610,817980],hung,[836810,818650],[836665,819210],[836745,819820],[837100,820500],second,[837510,821340],[837675,821530],[837810,821620],[837905,821920],[837960,822350],[837920,822910]]
tunnel=[south[-1],[837331.595,823676.131],[837460,825400]]
# Connect to the established Sha Tin railway corridor, but preserve the user's relocated station.
southnorth=[tunnel[-1],[837525,825700],[837650,826100],[837860,826500]]
oldish=[p for p in modern if 826680<p[1]<829500]
southnorth+=oldish+[sha]+[p for p in modern if 830050<p[1]<831920]
# The only bridge candidate is the crossing already implicit in the user's R02 blue sketch.
# Keep it within its former water interval instead of inventing a new remote bridge.
coast=[southnorth[-1],[839230,832140],[838980,832325],[838680,832500],[838400,832690],[838080,833000],[837809,833412]]
bridge=[coast[-1],[837460,833850],[837110,834290],[836747,834668]]
# Tai Po Market is an authored north-bank relocation (Lam Tsuen River); not the museum or modern station.
taipo=[835520,835680]
north=[bridge[-1],[836400,834985],[836000,835340],taipo,[835130,835950],[834620,836135],[834140,836370]]+[p for p in modern if p[1]>836520]
D['routes']=[route('旧九龙—红磡：旧线走廊意向（梳士巴利道／漆咸道）',south[:8],basis='Official EIA supports corridor; authored approximate coordinates, not surveyed historic line'),route('红磡保留—第二大棚站—城寨弧形低速展示',south[7:],basis='Latest user fictional route'),route('狮子山正下方隧道投影',tunnel,'tunnel'),route('狮子山北口—沙田候选—大学：尽量贴既有铁路走廊',southnorth,basis='1915 official map confirms broad old corridor; current OSM used as geometric aid, not an exact historic trace'),route('大学—跨湾桥南端：贴西岸旧线走廊意向',coast,basis='Historic coast corridor interpretation, candidate geometry'),route('R02 蓝线原位跨湾桥候选',bridge,'bridge',basis='Existing user R02 crossing; not an identified historical railway bridge'),route('跨湾桥—大埔墟换岸—罗湖：尽量沿既有走廊',north,basis='North-bank station is fictional relocation; remaining current OSM geometry follows broad historical corridor, historical metre-level validation incomplete')]+[r for r in D['routes'] if r['kind']!='story']
D['labels']=[p for p in D['labels'] if not any(k in p['text'] for k in ['田园候选','现代红磡','大埔','①','②','③'])]
def label(s,en,detail=False):D['labels'].append({'text':s,'point':[en[0]-O[0],O[1]-en[1]],'kind':'story','detail':detail})
for name,point,det in [('① 旧九龙站 · R05 同源构件',clock,False),('② 红磡站 · 保留候选',hung,False),('③ 第二大棚站 · 城寨之前',second,False),('④ 沙田站 · 马场／大学之间',sha,False),('⑤ 大埔墟 · 河对岸候选',taipo,False),('跨湾桥候选 · 沿 R02 蓝线',[837270,834100],False)]:label(name,point,det)
D['stations']=[st for st in D['stations'] if st['id'] in ['second','shatin']]
for id,title,en,yaw in [('hung_hom','红磡站 · 布局候选',hung,.08),('tai_po_market','大埔墟 · 河对岸布局候选',taipo,1.0)]:
 d=[30*np.cos(yaw),-30*np.sin(yaw)];D['stations'].append({'id':id,'label':title,'center_epsg2326':en,'point':[en[0]-O[0],O[1]-en[1]],'axis_yaw':yaw,'platform_anchors_epsg2326':[[en[0]+a*d[0],en[1]+a*d[1]] for a in [-1,1]],'planningOnly':True})
D['views'].update(kowloon={'target':[clock[0]-O[0],18,O[1]-clock[1]-30],'distance':380,'yaw':-.85,'pitch':-.30},vegetation={'target':[3331.595,435,3323.869],'distance':1700,'yaw':-.50,'pitch':-.22},taipo={'target':[2600,80,-7550],'distance':6700,'yaw':-.2,'pitch':-.7},detail={'target':[3350,340,3400],'distance':4200,'yaw':-.8,'pitch':-.55})
D['routePolicy']={'date':'2026-10-13','boundary':'unchanged R02','historicalSourceUrls':['https://www.kcrc.com/en/about-kcrc/history.html','https://www.amo.gov.hk/filemanager/amo/common/form/OTPPS-HIA.pdf#page=30','https://www.epd.gov.hk/eia/files/applications/en/pp_16/eia_1442/progress/action_3558/r0561203.htm','https://www.amo.gov.hk/en/historic-buildings/monuments/new-territories/monuments_29/index.html'],'alignmentStatus':'Broad old corridors checked; coordinates are a mixed authored concept and current OSM geometric reference, not a georeferenced historical survey.','bridgeStatus':'Existing R02 user crossing retained at the same Tolo Harbour water interval; name and engineering design not fixed.','taiPoBank':'Candidate placed north of Lam Tsuen River opposite the earlier southern urban reference. User may adjust.','retainedHungHom':'Kept explicitly per latest user request; coexists with old Kowloon in fiction despite real terminal relocation in 1975.'}
(R/'data/scene.json').write_text(json.dumps(D,ensure_ascii=False,separators=(',',':')))
(R/'research/ROUTE_BASIS.json').write_text(json.dumps(D['routePolicy'],ensure_ascii=False,indent=2))
print([(r['role'],len(r['points'])) for r in D['routes'] if r['kind']=='story'])
