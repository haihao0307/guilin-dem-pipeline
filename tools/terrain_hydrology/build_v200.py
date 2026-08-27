#!/usr/bin/env python3
"""Build the direct three-region high-precision terrain and hydrology workbench."""
from __future__ import annotations
import argparse, gzip, hashlib, json, math, shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import numpy as np
import rasterio
from PIL import Image, ImageDraw
from rasterio.features import rasterize
from rasterio.warp import transform_geom
from rasterio.windows import Window

GUILIN_REL=Path('DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/web/assets/fine-regions/guilin-old-city')
GUILIN_WATER_REL=Path('DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/waterways_osm.geojson')
WENZHOU_COG_REL=Path('projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif')
WENZHOU_RIVERS_REL=Path('projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson')
WENZHOU_COAST_REL=Path('projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_COASTLINE_EPSG32651.geojson')
KUNMING_RIVERS_REL=Path('kunming-osm-hydrology-v001/data/rivers.f32.gz')
KUNMING_AREAS_REL=Path('kunming-osm-hydrology-v001/data/water_areas.f32.gz')
WENZHOU_SHA='8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e'
KUNMING_SHA='9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2'
KUNMING_SOURCE_SHA='af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50'

def sha256(path:Path)->str:
    d=hashlib.sha256()
    with path.open('rb') as h:
        for chunk in iter(lambda:h.read(8*1024*1024),b''): d.update(chunk)
    return d.hexdigest()

def write_json(path:Path,payload:Any)->None:
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def assert_close(actual:float,expected:float,tolerance:float=1e-6)->None:
    if abs(float(actual)-float(expected))>tolerance: raise SystemExit(f'value mismatch: expected {expected}, got {actual}')

def encode_height(elevation:np.ndarray,valid:np.ndarray):
    values=elevation[valid]
    if values.size==0: raise SystemExit('slice contains no valid elevation')
    minimum,maximum,mean,std=map(float,(values.min(),values.max(),values.mean(),values.std()))
    scale=max(maximum-minimum,1e-6)/65535.0
    encoded=np.zeros(elevation.shape,dtype='<u2')
    encoded[valid]=np.round((elevation[valid]-minimum)/scale).clip(0,65535).astype(np.uint16)
    return encoded,{'min':minimum,'max':maximum,'mean':mean,'std':std,'offset':minimum,'scale':scale}

def shifted(array:np.ndarray,dy:int,dx:int,fill):
    result=np.full_like(array,fill)
    sy0,sy1=max(0,-dy),array.shape[0]-max(0,dy)
    sx0,sx1=max(0,-dx),array.shape[1]-max(0,dx)
    dy0,dy1=max(0,dy),result.shape[0]-max(0,-dy)
    dx0,dx1=max(0,dx),result.shape[1]-max(0,-dx)
    result[dy0:dy1,dx0:dx1]=array[sy0:sy1,sx0:sx1]
    return result

def terrain_diagnostics(elevation:np.ndarray,valid:np.ndarray,spacing:float):
    safe=elevation.astype(np.float64).copy(); fill=float(np.nanmedian(safe[valid])); safe[~valid]=fill
    best=np.zeros(safe.shape,dtype=np.float32); downstream=np.full(safe.shape,-1,dtype=np.int32)
    rows,cols=np.indices(safe.shape); flat=(rows*safe.shape[1]+cols).astype(np.int32)
    for dy,dx in ((-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)):
        neighbor=shifted(safe,dy,dx,fill); nvalid=shifted(valid.astype(np.uint8),dy,dx,0).astype(bool)
        distance=spacing*(math.sqrt(2.0) if dx and dy else 1.0); drop=(safe-neighbor)/distance
        candidate=valid & nvalid & (drop>best); target=shifted(flat,dy,dx,-1)
        best[candidate]=drop[candidate]; downstream[candidate]=target[candidate]
    accumulation=np.zeros(safe.size,dtype=np.float32); vf=valid.ravel(); accumulation[vf]=1.0
    indices=np.flatnonzero(vf); order=np.argsort(safe.ravel()[vf])[::-1]; down=downstream.ravel()
    for index in indices[order]:
        target=int(down[index])
        if target>=0: accumulation[target]+=accumulation[index]
    accumulation=accumulation.reshape(safe.shape); log=np.log1p(accumulation); positive=log[valid]
    p98,p995=float(np.quantile(positive,.98)),float(np.quantile(positive,.995)); maximum=float(positive.max())
    minor=np.clip((log-p98)/max(.01,maximum-p98),0,1); major=np.clip((log-p995)/max(.01,maximum-p995),0,1)
    gy,gx=np.gradient(safe,spacing,spacing); slope=np.hypot(gx,gy)
    lap=shifted(safe,-1,0,fill)+shifted(safe,1,0,fill)+shifted(safe,0,-1,fill)+shifted(safe,0,1,fill)-4.0*safe
    cs=max(.01,float(np.quantile(np.abs(lap[valid]),.98))); curvature=np.clip(np.abs(lap)/cs,0,1)
    wet=np.clip(minor*(1.0-np.clip(slope/1.25,0,1)),0,1)
    for field in (major,minor,curvature,wet): field[~valid]=0
    return {'major':major.astype(np.float32),'minor':minor.astype(np.float32),'curvature':curvature.astype(np.float32),'wet':wet.astype(np.float32)}

def geometry_bounds(geometry):
    coordinates=geometry.get('coordinates')
    if coordinates is None:return None
    stack=[coordinates]; xs=[]; ys=[]
    while stack:
        item=stack.pop()
        if isinstance(item,(list,tuple)) and len(item)>=2 and isinstance(item[0],(int,float)) and isinstance(item[1],(int,float)):
            xs.append(float(item[0])); ys.append(float(item[1]))
        elif isinstance(item,(list,tuple)): stack.extend(item)
    return (min(xs),min(ys),max(xs),max(ys)) if xs else None

def intersects(a,b): return not (a[2]<b[0] or a[0]>b[2] or a[3]<b[1] or a[1]>b[3])

def dilate(mask:np.ndarray,radius:int):
    result=mask.copy()
    for dy in range(-radius,radius+1):
        for dx in range(-radius,radius+1):
            if dx*dx+dy*dy<=radius*radius: result=np.maximum(result,shifted(mask,dy,dx,0))
    return result

def rasterize_geojson(path,source_crs,target_crs,target_bounds,out_shape,transform,default_line_role='minor'):
    zeros=lambda:np.zeros(out_shape,dtype=np.uint8)
    if not path.is_file(): return zeros(),zeros(),zeros(),zeros(),{'waterAreas':0,'mainRivers':0,'minorRivers':0,'coastline':0}
    payload=json.loads(path.read_text(encoding='utf-8')); areas=[]; main=[]; minor=[]; coast=[]
    counts={'waterAreas':0,'mainRivers':0,'minorRivers':0,'coastline':0}
    for feature in payload.get('features',[]):
        geometry=feature.get('geometry')
        if not geometry: continue
        if source_crs!=target_crs:
            try: geometry=transform_geom(source_crs,target_crs,geometry,precision=3)
            except Exception: continue
        bounds=geometry_bounds(geometry)
        if bounds is None or not intersects(bounds,target_bounds): continue
        props=feature.get('properties') or {}; gtype=geometry.get('type',''); waterway=str(props.get('waterway') or '').lower(); natural=str(props.get('natural') or '').lower(); water=str(props.get('water') or '').lower()
        if 'Polygon' in gtype or natural=='water' or water: areas.append((geometry,255)); counts['waterAreas']+=1
        elif waterway in {'river','canal','tidal_channel'}: main.append((geometry,255)); counts['mainRivers']+=1
        elif waterway: minor.append((geometry,255)); counts['minorRivers']+=1
        elif default_line_role=='main': main.append((geometry,255)); counts['mainRivers']+=1
        elif default_line_role=='coast': coast.append((geometry,255)); counts['coastline']+=1
        else: minor.append((geometry,255)); counts['minorRivers']+=1
    def burn(shapes):
        return rasterize(shapes,out_shape=out_shape,transform=transform,fill=0,dtype='uint8',all_touched=True) if shapes else zeros()
    return dilate(burn(areas),1),dilate(burn(main),2),dilate(burn(minor),1),dilate(burn(coast),1),counts

def rasterize_kunming_binary(pages_root,out_shape,width_m,height_m):
    area_image=Image.new('L',(out_shape[1],out_shape[0]),0); main_image=Image.new('L',(out_shape[1],out_shape[0]),0); minor_image=Image.new('L',(out_shape[1],out_shape[0]),0)
    area_draw,main_draw,minor_draw=ImageDraw.Draw(area_image),ImageDraw.Draw(main_image),ImageDraw.Draw(minor_image)
    def pixel(x,z): return ((x/width_m+.5)*(out_shape[1]-1),(.5-z/height_m)*(out_shape[0]-1))
    area_triangles=river_segments=0; areas_path=pages_root/KUNMING_AREAS_REL; rivers_path=pages_root/KUNMING_RIVERS_REL
    if areas_path.is_file():
        with gzip.open(areas_path,'rb') as h: values=np.frombuffer(h.read(),dtype='<f4').reshape(-1,4)
        for start in range(0,len(values)-2,3):
            tri=values[start:start+3]; xs,zs=tri[:,0],tri[:,2]
            if xs.max()<-width_m/2 or xs.min()>width_m/2 or zs.max()<-height_m/2 or zs.min()>height_m/2: continue
            area_draw.polygon([pixel(float(row[0]),float(row[2])) for row in tri],fill=255); area_triangles+=1
    if rivers_path.is_file():
        with gzip.open(rivers_path,'rb') as h: values=np.frombuffer(h.read(),dtype='<f4').reshape(-1,9)
        for start in range(0,len(values)-5,6):
            segment=values[start:start+6]; first=segment[:2][:,[0,2]].mean(axis=0); second=segment[4:6][:,[0,2]].mean(axis=0)
            if max(first[0],second[0])<-width_m/2 or min(first[0],second[0])>width_m/2 or max(first[1],second[1])<-height_m/2 or min(first[1],second[1])>height_m/2: continue
            cls=float(segment[:,8].mean()); draw=main_draw if cls<1.6 else minor_draw; line_width=4 if cls<.6 else (3 if cls<1.6 else 2)
            draw.line([pixel(*first),pixel(*second)],fill=255,width=line_width); river_segments+=1
    return np.asarray(area_image,dtype=np.uint8),np.asarray(main_image,dtype=np.uint8),np.asarray(minor_image,dtype=np.uint8),{'waterAreaTriangles':area_triangles,'riverSegments':river_segments}

def save_preview(path,elevation,valid,hydrology,spacing):
    safe=elevation.astype(np.float64).copy(); fill=float(np.nanmedian(safe[valid])); safe[~valid]=fill; minimum,maximum=float(safe[valid].min()),float(safe[valid].max())
    normalized=np.clip((safe-minimum)/max(1e-6,maximum-minimum),0,1); gy,gx=np.gradient(safe,spacing,spacing)
    normal=np.dstack((-gx,np.ones_like(safe),gy)); normal/=np.linalg.norm(normal,axis=2,keepdims=True)+1e-9; light=np.array([-.52,.78,.35]); diffuse=np.clip((normal*light).sum(axis=2),0,1); shade=.56+.46*diffuse
    low,middle,high=np.array([.25,.23,.18]),np.array([.44,.36,.25]),np.array([.61,.54,.43]); color=np.zeros((*safe.shape,3)); lm=normalized<.5
    color[lm]=low+(middle-low)*(normalized[lm]/.5)[:,None]; color[~lm]=middle+(high-middle)*((normalized[~lm]-.5)/.5)[:,None]; color*=shade[...,None]
    strength=np.clip(hydrology[...,0]/255*.95+hydrology[...,1]/255*.85+hydrology[...,2]/255*.62,0,.92); water=np.array([.05,.38,.60]); color=color*(1-strength[...,None])+water*strength[...,None]
    color=np.clip(color,0,1); color[~valid]=np.array([.04,.06,.055]); Image.fromarray(np.round(color*255).astype(np.uint8),'RGB').save(path,compress_level=4)

def assemble_hydrology(elevation,valid,spacing,real_area,real_main,real_minor,coast):
    d=terrain_diagnostics(elevation,valid,spacing); rgba=np.zeros((*elevation.shape,4),dtype=np.uint8); rgba[...,0]=real_area
    rgba[...,1]=np.maximum(real_main,np.round(d['major']*145).astype(np.uint8)); rgba[...,2]=np.maximum(real_minor,np.round(d['minor']*95).astype(np.uint8)); rgba[...,3]=np.maximum(coast,np.round(np.maximum(d['wet'],d['curvature']*.35)*135).astype(np.uint8)); rgba[~valid]=0
    return rgba,{'derivedFlowDiagnostic':True,'derivedFlowAuthoritative':False,'realAreaPixels':int(np.count_nonzero(real_area)),'realMainRiverPixels':int(np.count_nonzero(real_main)),'realMinorRiverPixels':int(np.count_nonzero(real_minor)),'coastOrWetPixels':int(np.count_nonzero(rgba[...,3]))}

def write_region_assets(output_root,region_id,elevation,valid,spacing,hydrology):
    d=output_root/'assets'/region_id; d.mkdir(parents=True,exist_ok=True); encoded,stats=encode_height(elevation,valid)
    hp,mp,yp,pp=d/'height_u16.bin',d/'mask_u8.bin',d/'hydrology.png',d/'preview.png'; encoded.tofile(hp); valid.astype(np.uint8).tofile(mp); Image.fromarray(hydrology,'RGBA').save(yp,compress_level=4); save_preview(pp,elevation,valid,hydrology,spacing)
    return {'root':f'./assets/{region_id}','height':hp.name,'mask':mp.name,'hydrology':yp.name,'preview':pp.name,'hashes':{'height':sha256(hp),'mask':sha256(mp),'hydrology':sha256(yp),'preview':sha256(pp)},'statistics':stats}

def build_guilin(repo_root,output_root):
    source_dir=repo_root/GUILIN_REL; m=json.loads((source_dir/'terrain-manifest.json').read_text(encoding='utf-8')); sw,sh=int(m['gridWidth']),int(m['gridHeight'])
    source=np.fromfile(source_dir/m['heightBinary'],dtype='<u2').reshape(sh,sw); mask=np.fromfile(source_dir/m['maskBinary'],dtype=np.uint8).reshape(sh,sw).astype(bool); xo,yo=(sw-800)//2,(sh-800)//2
    raw=source[yo:yo+800,xo:xo+800]; valid=mask[yo:yo+800,xo:xo+800]; elevation=float(m['minimumElevation'])+raw.astype(np.float32)/65535.0*(float(m['maximumElevation'])-float(m['minimumElevation'])); elevation[~valid]=np.nan
    b=m['bounds']; bounds=(float(b[0]+xo*12.5),float(b[3]-(yo+800)*12.5),float(b[0]+(xo+800)*12.5),float(b[3]-yo*12.5)); transform=rasterio.transform.from_bounds(*bounds,800,800)
    area,main,minor,coast,counts=rasterize_geojson(repo_root/GUILIN_WATER_REL,'EPSG:4326','EPSG:32649',bounds,(800,800),transform,'minor'); hydro,hstats=assemble_hydrology(elevation,valid,12.5,area,main,minor,coast); assets=write_region_assets(output_root,'guilin',elevation,valid,12.5,hydro); stats=assets.pop('statistics')
    return {'id':'guilin','code':'GUILIN','title':'桂林真实喀斯特地貌','subtitle':'桂林古城中心 10 km × 10 km，12.5 m 原像元整数窗口','truthLabel':'12.5 m 已验证真实裁片','sourceSummary':'桂林 12.5 m 高程二进制，中心 800 × 800 原像元','lineage':'由已验证的 guilin-old-city 1132 × 1132 高程源按整数像元裁切，没有重采样和合成填洞。','knowledgePath':'knowledge/terrain-hydrology/guilin/inbox/','world':{'widthMeters':10000,'heightMeters':10000},'grid':{'width':800,'height':800,'spacingMeters':[12.5,12.5]},'bounds':list(bounds),'crs':'EPSG:32649','encoding':{'offset':stats['offset'],'scale':stats['scale']},'elevation':{k:stats[k] for k in ('min','max','mean','std')},'assets':assets,'render':{'cardMesh':257,'focusMesh':800},'hydrology':{'summary':'现代 OSM 水系参考与地形汇流诊断分层显示','sourceRole':'modern reference and derived diagnostic','vectorCounts':counts,**hstats},'source':{'path':str(GUILIN_REL/m['heightBinary']),'grid':[sw,sh],'validFraction':float(valid.mean()),'resampled':False},'exactMetricSlice':True}

def read_window(dataset,xo,yo):
    window=Window(xo,yo,800,800); a=dataset.read(1,window=window,masked=False).astype(np.float32); valid=np.isfinite(a)
    if dataset.nodata is not None: valid &= a!=np.float32(dataset.nodata)
    a[~valid]=np.nan; return a,valid,tuple(float(v) for v in rasterio.windows.bounds(window,dataset.transform)),dataset.window_transform(window)

def build_wenzhou(root,output_root):
    source=root/WENZHOU_COG_REL; actual=sha256(source)
    if actual!=WENZHOU_SHA: raise SystemExit(f'Wenzhou COG SHA mismatch: {actual}')
    with rasterio.open(source) as ds:
        if str(ds.crs)!='EPSG:32651' or (ds.width,ds.height)!=(11866,11866): raise SystemExit('unexpected Wenzhou COG contract')
        assert_close(ds.res[0],12.5); assert_close(ds.res[1],12.5); xo=round((308808.152694-ds.bounds.left)/12.5); yo=round((ds.bounds.top-3134127.610786)/12.5); elevation,valid,bounds,transform=read_window(ds,xo,yo)
    area,main,minor,coast,counts=rasterize_geojson(root/WENZHOU_RIVERS_REL,'EPSG:32651','EPSG:32651',bounds,(800,800),transform,'minor'); _,_,_,coastline,cc=rasterize_geojson(root/WENZHOU_COAST_REL,'EPSG:32651','EPSG:32651',bounds,(800,800),transform,'coast'); coast=np.maximum(coast,coastline)
    for k,v in cc.items(): counts[k]=counts.get(k,0)+v
    hydro,hstats=assemble_hydrology(elevation,valid,12.5,area,main,minor,coast); assets=write_region_assets(output_root,'wenzhou',elevation,valid,12.5,hydro); stats=assets.pop('statistics')
    return {'id':'wenzhou','code':'WENZHOU','title':'温州清江山海地貌','subtitle':'清江镇中心 10 km × 10 km，权威 12.5 m COG 原像元窗口','truthLabel':'12.5 m 权威 COG 精确裁片','sourceSummary':'温州清江 22000 km² 权威陆地 COG，中心 800 × 800 原像元','lineage':'Git LFS 权威 COG 经过 SHA256、CRS、网格和像元间距验证后，只读裁出精确窗口。','knowledgePath':'knowledge/terrain-hydrology/wenzhou/inbox/','world':{'widthMeters':10000,'heightMeters':10000},'grid':{'width':800,'height':800,'spacingMeters':[12.5,12.5]},'bounds':list(bounds),'crs':'EPSG:32651','encoding':{'offset':stats['offset'],'scale':stats['scale']},'elevation':{k:stats[k] for k in ('min','max','mean','std')},'assets':assets,'render':{'cardMesh':257,'focusMesh':800},'hydrology':{'summary':'真实 OSM 河道与海岸参考叠加地形汇流诊断','sourceRole':'modern OSM reference and derived diagnostic','vectorCounts':counts,**hstats},'source':{'path':str(WENZHOU_COG_REL),'sha256':actual,'grid':[11866,11866],'validFraction':float(valid.mean()),'resampled':False},'exactMetricSlice':True}

def build_kunming(tif,pages_root,output_root):
    actual=sha256(tif)
    if actual!=KUNMING_SHA: raise SystemExit(f'Kunming TIFF SHA mismatch: {actual}')
    with rasterio.open(tif) as ds:
        if str(ds.crs)!='EPSG:32648' or (ds.width,ds.height)!=(5892,8095): raise SystemExit('unexpected Kunming TIFF contract')
        assert_close(ds.res[0],12.5); assert_close(ds.res[1],12.5); elevation,valid,bounds,_=read_window(ds,(ds.width-800)//2,(ds.height-800)//2)
    area,main,minor,counts=rasterize_kunming_binary(pages_root,(800,800),10000,10000); coast=np.zeros((800,800),dtype=np.uint8); hydro,hstats=assemble_hydrology(elevation,valid,12.5,area,main,minor,coast); assets=write_region_assets(output_root,'kunming',elevation,valid,12.5,hydro); stats=assets.pop('statistics')
    return {'id':'kunming','code':'KUNMING','title':'昆明高原盆地地貌','subtitle':'昆明权威无压缩裁片中心 10 km × 10 km，12.5 m 原像元窗口','truthLabel':'12.5 m 权威无压缩裁片','sourceSummary':'昆明无压缩 float32 权威裁片，中心 800 × 800 原像元','lineage':'从 draft Release 的锁定 TIFF 按整数像元窗口裁切。Y 方向因源网格为奇数行，窗口中心向北对齐 6.25 m。','knowledgePath':'knowledge/terrain-hydrology/kunming/inbox/','world':{'widthMeters':10000,'heightMeters':10000},'grid':{'width':800,'height':800,'spacingMeters':[12.5,12.5]},'bounds':list(bounds),'crs':'EPSG:32648','encoding':{'offset':stats['offset'],'scale':stats['scale']},'elevation':{k:stats[k] for k in ('min','max','mean','std')},'assets':assets,'render':{'cardMesh':257,'focusMesh':800},'hydrology':{'summary':'昆明现代 OSM 河湖参考与地形汇流诊断分层显示','sourceRole':'modern OSM reference and derived diagnostic','vectorCounts':counts,**hstats},'source':{'file':tif.name,'sha256':actual,'sourceBaselineSha256':KUNMING_SOURCE_SHA,'grid':[5892,8095],'validFraction':float(valid.mean()),'resampled':False},'exactMetricSlice':True}

def main():
    p=argparse.ArgumentParser(); p.add_argument('--repo-root',required=True,type=Path); p.add_argument('--wenzhou-root',required=True,type=Path); p.add_argument('--pages-root',required=True,type=Path); p.add_argument('--kunming-tif',required=True,type=Path); p.add_argument('--output',required=True,type=Path); a=p.parse_args()
    repo,wenzhou,pages,tif,out=map(Path,(a.repo_root,a.wenzhou_root,a.pages_root,a.kunming_tif,a.output)); repo,wenzhou,pages,tif,out=repo.resolve(),wenzhou.resolve(),pages.resolve(),tif.resolve(),out.resolve()
    if out.exists(): shutil.rmtree(out)
    shutil.copytree(repo/'web/terrain-hydrology-workbench-v200',out)
    regions=[build_guilin(repo,out),build_wenzhou(wenzhou,out),build_kunming(tif,pages,out)]; generated=datetime.now(timezone.utc).isoformat()
    manifest={'schema':'terrain-hydrology-workbench@2.0.0','generatedAt':generated,'title':'三地区高精度真实地貌与水系工作台','directPublicPath':'/terrain-hydrology-workbench-v200/','scope':['terrain','terrace','hydrology'],'excludedRuntimeScope':['trees','shrubs','grass','crops','canopy'],'regions':regions,'release':{'truthOverwrite':False,'syntheticGapFill':False,'sourceResampling':False,'derivedHydrologyAuthoritative':False,'visualAcceptance':False,'productionReady':False}}
    write_json(out/'manifest.json',manifest)
    evidence={'schema':'terrain-hydrology-workbench-build-evidence@2.0.0','generatedAt':generated,'regionChecks':[{'id':r['id'],'grid':r['grid'],'exactMetricSlice':r['exactMetricSlice'],'sourceResampled':r['source']['resampled'],'validFraction':r['source']['validFraction'],'assetHashes':r['assets']['hashes']} for r in regions],'pageChecks':{'singleDirectPage':True,'queryRoutingRequired':False,'intermediateSelectionPage':False,'runtimeExternalDependencies':0}}
    write_json(out/'build-evidence.json',evidence); print(json.dumps(evidence,ensure_ascii=False,indent=2)); return 0

if __name__=='__main__': raise SystemExit(main())
