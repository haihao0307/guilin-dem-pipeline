"""Derive browser observations from hash-locked releases; never modify terrain."""
from pathlib import Path
import argparse, hashlib, json, zipfile, copy
import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.warp import reproject, Resampling
from rasterio.transform import Affine
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
DEPTHS = ['0-5cm','5-15cm','15-30cm','30-60cm','60-100cm','100-200cm']

def sha(b): return hashlib.sha256(b).hexdigest()
def save(p, obj): p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--evidence',type=Path,required=True); args=ap.parse_args()
    locks=json.loads((ROOT/'handoffs/wenzhou-r3-8-current-full-20260912/02_SOURCE_LOCKS.json').read_text(encoding='utf-8'))
    wanted=['physical_texture','chemical_carbon','hydraulic','JRC_GSW']
    archives={}
    for key in wanted:
        lock=next(x for x in locks['permanentEvidenceReleases'] if key in x['asset'])
        p=args.evidence/lock['asset']
        with p.open('rb') as f: digest=hashlib.file_digest(f,'sha256').hexdigest()
        assert p.stat().st_size==lock['bytes'] and digest==lock['sha256'],p
        archives[key]=zipfile.ZipFile(p)
    base=json.loads((ROOT/'site/dist/r3-7/data/soil/soil-context.json').read_text(encoding='utf-8'))
    out=ROOT/'site/dist/r3-8/data/soil'; out.mkdir(parents=True,exist_ok=True)
    profile=copy.deepcopy(base); profile['schema']='wenzhou-r3.8-soil-profile/r1';profile.pop('depth');profile['depths']=DEPTHS
    profile['mask']['path']='../../../r3-7/data/soil/'+profile['mask']['path']
    profile['layers']=[]
    groups={p:'physical_texture' for p in ['clay','sand','silt','bdod','cfvo']}
    groups.update(soc='chemical_carbon',phh2o='chemical_carbon',wv0033='hydraulic')
    for depth in DEPTHS:
        for old in base['layers']:
            rec=copy.deepcopy(old);rec['depth']=depth
            if depth=='0-5cm': rec['path']='../../../r3-7/data/soil/'+old['path']
            else:
                name=f"aligned_context/{rec['property']}/{rec['property']}_{depth}_{rec['statistic']}_EPSG32651_250M.tif"
                data=archives[groups[rec['property']]].read(name)
                with MemoryFile(data) as mem:
                    with mem.open() as ds:
                        assert ds.crs.to_epsg()==32651 and list(ds.transform.to_gdal())==rec['geotransform']
                        assert ds.shape==(rec['rows'],rec['columns']) and ds.nodata==rec['noData']
                        a=ds.read(1).astype('<i2')
                b=a.tobytes();rec['path']=old['path'].replace('0-5cm',depth);(out/rec['path']).write_bytes(b)
                v=a[a!=rec['noData']];q=np.percentile(v,[2,5,50,95,98])
                rec.update(bytes=len(b),sha256=sha(b),sourceAlignedTifSha256=sha(data))
                rec['statisticsRaw']={'validCount':int(v.size),'noDataCount':int(a.size-v.size),'minRaw':int(v.min()),'maxRaw':int(v.max()),**dict(zip(['p02Raw','p05Raw','p50Raw','p95Raw','p98Raw'],map(float,q)))}
            profile['layers'].append(rec)
    save(out/'soil-context.json',profile)

    z=archives['JRC_GSW'];acq=json.loads(z.read(next(n for n in z.namelist() if n.endswith('JRC_GSW_V1_5_ACQUISITION.json'))))
    out=ROOT/'site/dist/r3-8/data/water';out.mkdir(parents=True,exist_ok=True)
    water={'schema':'wenzhou-r3.8-historical-water/r1','sourceIdentity':'historical_satellite_observation','provider':'EC JRC/Google','product':'Global Surface Water V1.5','sourceReleaseTag':'wenzhou-r3.4-environment-evidence-20260910','sourceZipSha256':next(x['sha256'] for x in locks['permanentEvidenceReleases'] if 'JRC_GSW' in x['asset']),'sourceNativeResolutionM':30,'displayResolutionM':250,'sampling':'nearest from archived aligned 30 m; sparse display sampling, not area aggregation; small water features can be omitted','grid':{'crs':base['crs'],'rows':base['rows'],'columns':base['columns'],'bounds':base['bounds'],'geotransform':base['layers'][0]['geotransform']},'layers':[],'truthBoundary':{'canonicalTruth':False,'currentWaterLevel':False,'mayOverrideCanonicalDem':False,'mayReplaceCoastline':False,'mayReplaceRiverNetwork':False},'documentation':'https://global-surface-water.appspot.com/download','attribution':'Source: EC JRC/Google'}
    gt=Affine.from_gdal(*water['grid']['geotransform'])
    for r in acq['records']:
        n=next(n for n in z.namelist() if n.endswith('/'+r['aligned']['path']))
        b=z.read(n); assert sha(b)==r['aligned']['sha256']
        a=np.full((base['rows'],base['columns']),255,dtype='u1')
        with MemoryFile(b) as mem:
            with mem.open() as ds:
                assert ds.crs.to_epsg()==32651
                reproject(rasterio.band(ds,1),a,src_transform=ds.transform,src_crs=ds.crs,src_nodata=255,dst_transform=gt,dst_crs='EPSG:32651',dst_nodata=255,resampling=Resampling.nearest)
        qml=(args.evidence/(r['product']+'.qml')).read_bytes()
        palette=[dict(e.attrib) for e in ET.fromstring(qml).iter('paletteEntry')]
        p=out/(r['product']+'.u8');p.write_bytes(a.tobytes())
        rec={k:r[k] for k in ['product','role','period','kind']};rec.update(path=p.name,bytes=p.stat().st_size,sha256=sha(p.read_bytes()),sourceAlignedTifSha256=sha(b),nodata=255,palette=palette,symbologySha256=sha(qml),symbologySource=f"https://storage.googleapis.com/global-surface-water/downloads_ancillary/{r['product']}.qml",rawValues=sorted(map(int,np.unique(a))),caveat=r.get('caveat',''))
        water['layers'].append(rec)
    save(out/'water-context.json',water)
    for z in archives.values():z.close()
    print(json.dumps({'passed':True,'soilLayers':len(profile['layers']),'waterLayers':len(water['layers']),'soilBytes':sum(r['bytes'] for r in profile['layers']),'waterBytes':sum(r['bytes'] for r in water['layers'])}))
if __name__=='__main__':main()
