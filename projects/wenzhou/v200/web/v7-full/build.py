"""Build a numerical full-domain research viewer without image or mesh assets.
800 m overview is a source-node selection, never promoted to the full DEM.
"""
from pathlib import Path
import argparse,gzip,hashlib,json,shutil,subprocess,sys
import numpy as np
import shapely
from shapely.geometry import Polygon,LineString
from shapely.strtree import STRtree

def sha(b): return hashlib.sha256(b).hexdigest()
def put(p,obj): p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main(root,out):
    out.mkdir(parents=True,exist_ok=True);(out/'data').mkdir(exist_ok=True)
    inp=root/'data';m=json.loads((inp/'SOURCE_OVERVIEW.json').read_text())
    packed=(inp/'overview800.i16.gz').read_bytes();raw=gzip.decompress(packed)
    assert sha(packed)==m['heightSha256'] and sha(raw)==m['heightValuesSha256']
    assert sha(raw)=='fd45294da32b5c0069647b848eb44478755d9da73a308ac60cc2b21e493e882a'
    H,W=281,276
    delta=np.frombuffer(raw,dtype='<i2').reshape(H,W)
    a=delta.astype(np.int64).cumsum(0).cumsum(1).astype('<i2')
    raw=a.tobytes()
    assert sha(raw)=='c24a874e8adb1d076cc863e7d84b6964111fe27174c096fca7b9e3223a999746'
    packed=gzip.compress(raw,compresslevel=9,mtime=0)
    m['heightSha256']=sha(packed);m['heightValuesSha256']=sha(raw)
    m['heightEncoding']='gzip little-endian Int16 values; modular deltas decoded during build'
    marine_p=(inp/'marine800.u8.gz').read_bytes();marine_raw=gzip.decompress(marine_p)
    assert sha(marine_p)=='a5e34d3e2e09b704a76b415222a44f3ef02294de3fb59efc3433827197c7fbcd'
    assert sha(marine_raw)=='bcb8c0cf2047f72f167d801a2792b15aeea52b9a964159fee2318498228eaf2e'
    marine=np.frombuffer(marine_raw,dtype='u1').reshape(H,W).astype(bool)
    vpath=inp/'vectors.json.gz'
    v=json.loads(gzip.decompress(vpath.read_bytes()))
    assert v['riverCount']==6797 and v['reservoirsExcluded']==571 and v['manualBridges']==0
    assert v['sourceHashes']['WENZHOU_COASTLINE_EPSG32651.geojson']=='f805bf3fd993639452c2cc79c548357bedd4d6dfb91204688f6f113de3be7eb6'
    assert v['sourceHashes']['WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson']=='be9ff893b26a24dad9808aac5b76625997c0f8b747b0721424b094449115c297'
    X,Y=np.meshgrid(187912.5+(np.array(m['sourceCols'])+.5)*12.5,3243587.5-(np.array(m['sourceRows'])+.5)*12.5)
    water=shapely.union_all([Polygon(r[0],r[1:]) for r in v['inlandRiverWater']]);shapely.prepare(water)
    river=shapely.intersects_xy(water,X,Y)
    cls=np.zeros((H,W),dtype='u1');cls[river]=2;cls[marine]=1;cls[(a==-32768)&~marine&~river]=255
    segments=[]
    for line in v['coastlines']:
        segments.extend(LineString([p,q]) for p,q in zip(line,line[1:]) if p!=q)
    tree=STRtree(segments);indices,dist=tree.query_nearest(shapely.points(X.ravel(),Y.ravel()),return_distance=True,all_matches=False)
    shore=np.zeros(H*W,dtype='<u2');shore[indices[0]]=np.minimum(65535,np.rint(dist)).astype('<u2')
    files={'data/overview800.i16.gz':packed,'data/classes.u8.gz':gzip.compress(cls.tobytes(),mtime=0),'data/shore.u16.gz':gzip.compress(shore.tobytes(),mtime=0),'data/vectors.json.gz':vpath.read_bytes()}
    for name,b in files.items(): (out/name).write_bytes(b)
    for name in ['index.html','runtime.js','shaders.js','math.js']:
        shutil.copyfile(root/name,out/name)
        text=(out/name).read_text()
        for token in ['sampler2D','TextureLoader','data:image/','QINGJIANG','wenzhou-v111']: assert token not in text,(name,token)
    m.update({'version':'v7-full-review-r3','previewScope':'complete V200 bounding domain, sampled overview only','sourceCommit':__import__('os').environ.get('GITHUB_SHA','local-unpublished'),'files':{n:{'sha256':sha(b),'bytes':len(b)} for n,b in files.items()},'classesPath':'data/classes.u8.gz','shorePath':'data/shore.u16.gz','vectorsPath':'data/vectors.json.gz','masterSeed':270831,'seedAlgorithm':'coordinate-hash21-v1','motherPolicyVersion':'1.0.0','motherRuntimeIntegration':'partial-preview; original strict schema and validator not received','marineSource':{'name':'WENZHOU_V200_OCEAN_SURFACE_CLEAN_UNION_100M_CANDIDATE_COG.tif','sourceSha256':'befdf93122ce5221b461d46006b510e47b3944e955860e292d0b19830b98f7f3','archive':'WENZHOU_V200_WATER_COAST_BATHY_TIDE_REVIEW_2026-08-29_v1.2.zip','status':'V200 prior sourced OSM and GEBCO coastal review candidate, not promoted truth','sampleRule':'original scalar classification sampled at the exact overview coordinates; no color image input'},'seaBedStatus':'not loaded; no invented depths','verticalDatumStatus':'unbound; tide and water elevation illustrative','controlsUnits':{'lightIntensity':'dimensionless linear multiplier','lightColor':'linear RGB preset','tide':'illustrative meters relative to preview plane','solverStep':'seconds'},'classCounts':{str(k):int((cls==k).sum()) for k in np.unique(cls)},'visualApproved':False,'productionApproved':False})
    put(out/'manifest.json',m)
    put(out/'DATA_QA.json',{'passed':True,'scope':'source-node selection and file identities only','heightValuesSha256':sha(raw),'grid':[W,H],'nativeSpacingM':12.5,'overviewSpacingM':800,'displaySourceNodes':H*W,'originalSourceValuesChanged':False,'fullNativeStoreOnline':False,'sourceDeleted':False,'marineInputIdentityVerified':True,'coastDistanceMethod':'nearest original OSM segment; meter units; rounded to uint16','classCounts':m['classCounts'],'riverSourceParts':6797,'reservoirsExcluded':571,'manualRivers':0,'visualApproved':False,'productionApproved':False})
    print(json.dumps({'site':str(out),'grid':[W,H],'overviewSpacingM':800,'classCounts':m['classCounts']},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('root',type=Path);p.add_argument('out',type=Path);a=p.parse_args();main(a.root,a.out)
