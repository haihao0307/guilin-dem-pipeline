"""R02 story world, reproducibly derived from the unmodified R01 source grid.
Edits are artistic terrain synthesis, not historic hydrography reconstruction.
"""
from pathlib import Path
import json, hashlib, copy
import numpy as np
from scipy import ndimage, sparse
from scipy.sparse.linalg import spsolve
from pyproj import Transformer

R=Path(__file__).resolve().parent
P=R.parent/'hong-kong-map-sea-r01/data'
S=json.loads((P/'scene.json').read_text())
H=np.load(P/'heights.npy').astype(np.float64)
M=np.load(P/'mask.npy').copy()
ORIGINAL_H=H.copy(); ORIGINAL_M=M.copy()
labels,n=ndimage.label(M==2)

def index(e,n):
    return round((S['y0']-n)/30),round((e-S['x0'])/30)

def fill_water(name, e,n):
    rr,cc=index(e,n); k=int(labels[rr,cc]); assert k>0,(name,rr,cc)
    area=labels==k
    # Dirichlet harmonic inpainting only inside the explicitly selected water body.
    # No neighbouring mountain samples are altered and there is no invented historical claim.
    cells=np.flatnonzero(area.ravel()); lookup=np.full(H.size,-1,np.int32);lookup[cells]=np.arange(len(cells))
    rows=[];cols=[];vals=[];b=np.zeros(len(cells));w=H.shape[1]
    for j,f in enumerate(cells):
        r,c=divmod(int(f),w); neighbors=[]
        for dr,dc in ((-1,0),(1,0),(0,-1),(0,1)):
            if 0<=r+dr<H.shape[0] and 0<=c+dc<w: neighbors.append((r+dr)*w+c+dc)
        rows.append(j);cols.append(j);vals.append(len(neighbors))
        for q in neighbors:
            z=lookup[q]
            if z>=0: rows.append(j);cols.append(int(z));vals.append(-1.)
            else:b[j]+=max(1.,float(H.ravel()[q]))
    v=spsolve(sparse.csr_matrix((vals,(rows,cols)),shape=(len(cells),len(cells))),b)
    H.ravel()[cells]=v;M.ravel()[cells]=1
    return {'name':name,'kind':'fictional dry terrain synthesis','sourceComponent':k,'cells':len(cells),'areaKm2':len(cells)*.0009,'method':'Harmonic interpolation inside original selected WBM water cells, using adjacent DSM boundary heights; exterior terrain samples unchanged','originalMedianHeightM':float(np.median(ORIGINAL_H[area])),'newMinMaxHeightM':[float(v.min()),float(v.max())]}

edits=[fill_water('船湾淡水湖 → 故事陆地',844678.6,837441.1),fill_water('城门河 → 故事谷地',838949.6,828050.9)]
MARK=json.loads((R/'research/markup_coordinates.json').read_text())
RAW_MARK=copy.deepcopy(MARK)
# Normalize hand-drawn intent to a small, coherent planning scene.
second=MARK['stations']['second']['epsg2326'];sha=[839790,829760]
def platforms(center,yaw=.48):
    d=np.array([np.cos(yaw),-np.sin(yaw)])*30
    return [(np.array(center)+v*d).round(3).tolist() for v in [-1,1]]
MARK['stations']=[{'id':'second','label':'② 第二大棚站 · 城寨之前','center_epsg2326':second,'axis_yaw':.48,'platform_anchors_epsg2326':platforms(second)}, {'id':'shatin','label':'③ 沙田站候选 · 双侧站台','center_epsg2326':sha,'axis_yaw':.48,'platform_anchors_epsg2326':platforms(sha),'approximateSketchIntent':True}]
ss=[p for p in RAW_MARK['routeSouth'] if p[1]<=822910]
ss[0]=[835477.171,817175.985]
# The latest named requirement is a tunnel below Lion Rock itself, so use that
# explicit mountain control within the sketch's stated mountain uncertainty.
tunnel=[ss[-1],[837331.595,823676.131],RAW_MARK['routeNorth'][0]]
north_route=[p for p in RAW_MARK['routeNorth'] if not 829650<p[1]<830200]
i=next(i for i,p in enumerate(north_route) if p[1]>sha[1]);north_route.insert(i,sha)
old=S['routes'][0]['points'];old_en=[[S['origin'][0]+p[0],S['origin'][1]-p[1]] for p in old]
tail=[p for p in old_en if p[1]>=837300]
MARK['routes']=[{'title':'Clock tower coast and old-line logic, then second station and walled-city low-speed display; interpreted from user sketches','role':'surface','points_epsg2326':ss},{'title':'Fictional tunnel intention directly below Lion Rock; map projection only, no engineering rail grade','role':'tunnel','points_epsg2326':tunnel},{'title':'User-drawn Sha Tin–Tai Po direction and rural–Lo Wu concept connection','role':'surface','points_epsg2326':north_route+tail}]
# A nearby gentle station axis is selected from the shared intent region, not
# a giant terrace joining both loosely drawn circles. Only a small footprint is graded.
station_grading=[]
YY,XX=np.indices(H.shape);EE=S['x0']+XX*30;NN=S['y0']-YY*30
for st in MARK['stations']:
    if st['id']!='shatin': continue
    center=np.array(st['center_epsg2326'],float);yaw=float(st.get('axis_yaw',.48));datum=9.
    X=EE-center[0];Y=NN-center[1];u=X*np.cos(yaw)-Y*np.sin(yaw);v=-X*np.sin(yaw)-Y*np.cos(yaw)
    beyond=np.maximum(np.maximum(np.abs(u)-50,0),np.maximum(np.abs(v)-155,0))
    weight=np.clip(1-beyond/30,0,1);weight=weight*weight*(3-2*weight);weight*=(M==1)&(np.abs(H-datum)<=6)
    old=H.copy();H=H*(1-weight)+datum*weight
    st['platform_common_datum_m']=datum;st['axis_yaw']=yaw
    station_grading.append({'station':st['id'],'kind':'small fictional common-height station footprint','centerEpsg2326':center.tolist(),'commonDatumM':datum,'affectedCells':int(np.count_nonzero(weight)),'maxHeightChangeM':float(np.max(np.abs(H-old))),'method':'100m x 310m core, 30m smooth fringe, eligible original land within 6m of the shared 9m datum only; no large hillside cut and no ocean filling','notEngineeringDesign':True})
west,south,east,north=MARK['bounds_epsg2326']
# Snap inward to the existing source cells; no new resampling or height scaling.
c0=max(0,int(np.ceil((west-S['x0'])/30)));c1=min(S['width']-1,int(np.floor((east-S['x0'])/30)))
r0=max(0,int(np.ceil((S['y0']-north)/30)));r1=min(S['height']-1,int(np.floor((S['y0']-south)/30)))
hc=H[r0:r1+1,c0:c1+1].astype('<f4');mc=M[r0:r1+1,c0:c1+1]
D=copy.deepcopy(S);D.update(width=hc.shape[1],height=hc.shape[0],x0=S['x0']+c0*30,y0=S['y0']-r0*30)
D['storyWorld']={'northAligned':True,'authority':'User sketch and explicit instructions 2026-10-13','boundsEpsg2326':[D['x0'],D['y0']-(D['height']-1)*30,D['x0']+(D['width']-1)*30,D['y0']],'boundaryRule':'All directors and writers keep stories inside this bounded world.','hydrologyEdits':edits,'stationGrading':station_grading,'notHistoricReconstruction':True,'unalteredReference':'../hong-kong-map-sea-r01/','markupFit':RAW_MARK,'planningAdjustments':{'shaTinSite':'Common intent region shifted 67m to nearby gentle land; paired platforms 60m apart, not 527m apart.','lionRock':'Named mountain control used for conceptual under-mountain segment, no rail grade claimed.'}}
D['originalSourceManifest']=copy.deepcopy(S['source'])
D['storyWorld']['excludedWaterBodies']=[{'name':'万宜水库（红框图上方水库）','method':'Outside the new story boundary; not loaded or synthesized'}]
D['source']=copy.deepcopy(S['source'])
outer=[D['x0']-15,D['y0']-(D['height']-1)*30-15,D['x0']+(D['width']-1)*30+15,D['y0']+15]
tr=Transformer.from_crs(2326,4326,always_xy=True)
D['source'].update(kind='Fictional story terrain derived from 30m modern DSM. Selected lake and river replaced by synthetic terrain; source remains separately in R01.',width=D['width'],height=D['height'],shape_rc=list(hc.shape),bounds_epsg2326=outer,geotransform=[outer[0],30,0,outer[3],0,-30],corner_lonlat=[list(tr.transform(e,n)) for e,n in [(outer[0],outer[1]),(outer[0],outer[3]),(outer[2],outer[3]),(outer[2],outer[1])]],array_order=f"C row-major, row0 north; E={D['x0']}+col*30; N={D['y0']}-row*30",height_resampling='R01 samples cropped without resampling; explicitly marked fictional lake/river interpolation and small station grading',mask_file='mask.npy',mask_raw_file='mask.u8',mask_values={'0':'Original WBM ocean','1':'Original land plus designated fictional water-removal areas','2':'Remaining original inland water'},mask_method='Original WBM with only designated water-removal cells converted to fictional land',qa={'height_min_m':float(hc.min()),'height_max_m':float(hc.max()),'height_nodata_count':int(np.count_nonzero(~np.isfinite(hc))),'mask_counts':{str(i):int(np.count_nonzero(mc==i)) for i in [0,1,2]}},coordinate_usage='X=E-East0, Z=N0-N, Y=source height except documented fictional edits; no vertical exaggeration',limitations=['30m background, not 0.5m near-field','No HKPD/EGM2008 vertical datum alignment','Not a historical reconstruction','Platform, route and tunnel markers are planning annotations, not engineered geometry'])
for k in ['water_class_file','water_class_raw_file','water_class_values','file_sha256']:D['source'].pop(k,None)

D['labels']=[p for p in S['labels'] if not any(x in p['text'] for x in ['船湾','城门河','巨型庙宇','沙田候选','大学站'])]
O=np.array(S['origin'])
def local(p):return [round(float(p[0]-O[0]),3),round(float(O[1]-p[1]),3)]
def smooth(points):
    a=np.array(points,float);out=[]
    for j in range(len(a)-1):
        p0,p1,p2,p3=a[max(0,j-1)],a[j],a[j+1],a[min(len(a)-1,j+2)]
        for t in np.linspace(0,1,12,endpoint=False):out.append((.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)).round(3).tolist())
    return out+[a[-1].tolist()]
D['routes']=[r for r in S['routes'] if r['kind']=='reference']
for route in MARK['routes']:
    D['routes'].insert(0,{'kind':'story','title':route['title'],'role':route.get('role','story'),'points':smooth([local(p) for p in route['points_epsg2326']])})
D['stations']=[]
for st in MARK['stations']:
    q={**st,'point':local(st['center_epsg2326'])};D['stations'].append(q)
    D['labels'].append({'text':st['label'],'point':q['point'],'kind':'story','detail':False})
for p in D['labels']:
    if '狮子山' in p['text']:p['text']='狮子山正下 · 隧道意向'
    if '田园候选' in p['text']:p['point']=local(north_route[-1])
D['labels']=[p for p in D['labels'] if west<=O[0]+p['point'][0]<=east and south<=O[1]-p['point'][1]<=north]
D['labels'].append({'text':'九龙城寨 · 低速穿行展示','point':local([837651.106,821494.676]),'kind':'story','detail':True})
cx=(D['storyWorld']['boundsEpsg2326'][0]+D['storyWorld']['boundsEpsg2326'][2])/2-O[0]
cz=O[1]-(D['storyWorld']['boundsEpsg2326'][1]+D['storyWorld']['boundsEpsg2326'][3])/2
span=max((D['width']-1)*30,(D['height']-1)*30)
D['views']['overview']={'target':[float(cx),120,float(cz)],'distance':float(span*1.28),'yaw':0,'pitch':-1.20}
D['views']['north']={**D['views']['overview'],'pitch':-1.48}
D['views']['overview'].update(target=[float(cx),120,float(cz+6000)],distance=30000.,pitch=-.75)
for st in D['stations']:
    if st['id']=='second':D['views']['station2']={'target':[st['point'][0],80,st['point'][1]],'distance':4200,'yaw':-.3,'pitch':-.65}
    if st['id']=='shatin':D['views']['shatin']={'target':[st['point'][0],100,st['point'][1]],'distance':6500,'yaw':-.65,'pitch':-.82}
D['views']['harbour']['yaw']=0
D['datum']='EGM2008 source; local heights artistically edited in explicitly marked story water-removal zones'
R.joinpath('data').mkdir(exist_ok=True)
np.save(R/'data/heights.npy',hc);np.save(R/'data/mask.npy',mc)
D['source']['file_sha256']={f:hashlib.sha256((R/'data'/f).read_bytes()).hexdigest() for f in ['heights.npy','mask.npy']}
(R/'data/scene.json').write_text(json.dumps(D,ensure_ascii=False,separators=(',',':')))
stats={'boundsEpsg2326':D['storyWorld']['boundsEpsg2326'],'gridShape':list(hc.shape),'edits':edits,'stationGrading':station_grading,'changedCellCount':int(np.count_nonzero(H!=ORIGINAL_H)),'storyGridSha256':hashlib.sha256(hc.tobytes()).hexdigest(),'referenceSourceSha256':hashlib.sha256(ORIGINAL_H.astype('<f4').tobytes()).hexdigest()}
(R/'qa/STORY_DATA_QA.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
print(json.dumps(stats,ensure_ascii=False))
