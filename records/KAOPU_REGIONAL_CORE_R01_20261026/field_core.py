"""Bounded observation fields. No inferred physical process or geometry is stored."""
from pathlib import Path
import json,hashlib,zlib,struct,math
import numpy as np
from pyproj import Transformer

def encode(array):
 a=np.ascontiguousarray(array.astype(array.dtype.newbyteorder('<'),copy=False))
 raw=a.tobytes();codec='raw-zlib';packed=zlib.compress(raw,6)
 if a.dtype.kind in 'ui':
  u=a.view(np.dtype('<u'+str(a.dtype.itemsize)));d=u.copy()
  d[...,1:]=u[...,1:]-u[...,:-1]
  d[...,1:,:]-=d[...,:-1,:].copy()
  candidate=zlib.compress(d.tobytes(),6)
  if len(candidate)<len(packed):codec='lorenzo2d-modular-zlib';packed=candidate
 h={'shape':list(a.shape),'dtype':a.dtype.str,'codec':codec,'raw_sha256':hashlib.sha256(raw).hexdigest()}
 hb=json.dumps(h,sort_keys=True,separators=(',',':')).encode()
 data=struct.pack('<I',len(hb))+hb+packed
 return hashlib.sha256(data).hexdigest(),data

def decode(data):
 n=struct.unpack('<I',data[:4])[0];h=json.loads(data[4:4+n]);dtype=np.dtype(h['dtype'])
 raw=zlib.decompress(data[4+n:]);a=np.frombuffer(raw,dtype=dtype).reshape(h['shape'])
 if h['codec']=='lorenzo2d-modular-zlib':
  u=a.view(np.dtype('<u'+str(dtype.itemsize)))
  a=np.cumsum(np.cumsum(u,axis=-2,dtype=np.uint64),axis=-1,dtype=np.uint64).astype(u.dtype).view(dtype)
 elif h['codec']!='raw-zlib':raise ValueError('Unknown codec')
 assert hashlib.sha256(a.tobytes()).hexdigest()==h['raw_sha256']
 return a

class RegionalWorld:
 def __init__(self,root):
  self.root=Path(root);self.catalog=json.loads((self.root/'CATALOG.json').read_text(encoding='utf-8'))
  self.fields={f['id']:f for f in self.catalog['fields']};self.cache={};self.field_cache={}
 def _blob(self,key):
  if key not in self.cache:
   if len(self.cache)>=8:self.cache.pop(next(iter(self.cache)))
   self.cache[key]=decode((self.root/'objects'/key[:2]/(key+'.kfield')).read_bytes())
  return self.cache[key]
 def select(self,property=None,depth=None,statistic=None,year=None,representation='aligned_context'):
  """Return explicit candidates; never silently pick a year or uncertainty layer."""
  requested={'property':property,'depth':depth,'statistic':statistic,'year':year}
  return [f['id']for f in self.fields.values()if(representation is None or f['representation']==representation)and all(v is None or f['semantics'].get(k)==v for k,v in requested.items())]
 def _assembled(self,f):
  first=next(iter(f['tiles'].values()));sample=self._blob(first['values'])
  a=np.zeros((sample.shape[0],*f['shape']),dtype=sample.dtype)
  for t in f['tiles'].values():
   v=self._blob(t['values']);a[:,t['row']:t['row']+v.shape[1],t['col']:t['col']+v.shape[2]]=v
  return a
 def _array(self,f):
  if f['id']in self.field_cache:return self.field_cache[f['id']]
  a=self._assembled(f)
  if f.get('value_mode')=='projection-residual':
   basis=self.fields[f['basis_field']];assert basis['representation']=='native_source'
   if f['storage_predictor']['operator']=='fixed-integer-source-cell-stencil-v1':
    prediction=predict_lookup(self._array(basis),self._blob(f['storage_predictor']['lookup_blob']),f,f['storage_predictor']['resampling'])
   else:prediction=predict(self._array(basis),basis,f,f['storage_predictor']['resampling'])
   u=np.dtype('<u'+str(prediction.dtype.itemsize))
   a=(prediction.view(u)+a).astype(u).view(prediction.dtype)
   assert hashlib.sha256(a.tobytes()).hexdigest()==f['reconstructed_sha256']
  if len(self.field_cache)>=2:self.field_cache.pop(next(iter(self.field_cache)))
  self.field_cache[f['id']]=a
  return a
 def query(self,field_id,easting,northing):
  f=self.fields[field_id];b=self.catalog['domain']['bounds']
  base={'field_id':field_id,'source':f['source'],'semantics':f['semantics'],'representation':f['representation']}
  if not(b[0]<=easting<b[2]and b[1]<=northing<b[3]):return {**base,'value':None,'reason':'outside_locked_domain'}
  if f['crs']is None:return {**base,'value':None,'reason':'unknown_reference_frame'}
  x,y=Transformer.from_crs('EPSG:32651',f['crs'],always_xy=True).transform(easting,northing)
  a,bx,c,d,e,fy=f['transform'];det=a*e-bx*d
  col=math.floor((e*(x-c)-bx*(y-fy))/det);row=math.floor((-d*(x-c)+a*(y-fy))/det)
  if not(0<=col<f['shape'][1]and 0<=row<f['shape'][0]):return {**base,'value':None,'reason':'outside_source_support'}
  key=f'{row//f["tile_size"]},{col//f["tile_size"]}';t=f['tiles'][key]
  masks=self._blob(t['masks']);rr=row-t['row'];cc=col-t['col']
  if f.get('value_mode')=='projection-residual':
   values=self._array(f);rr_value=row;cc_value=col
  else:values=self._blob(t['values']);rr_value=rr;cc_value=cc
  raw=values[:,rr_value,cc_value].tolist();valid=masks[:,rr,cc]>0
  result=[v if ok else None for v,ok in zip(raw,valid)]
  conventional=None;factor=f['semantics'].get('conversionFactor')
  if factor and f['semantics'].get('statistic')!='uncertainty':conventional=[None if v is None else v/factor for v in result]
  return {**base,'value':result[0]if len(result)==1 else result,'conventional_value':conventional,'source_cell':[row+f['source_window'][1],col+f['source_window'][0]],'reason':None if valid.all()else'source_nodata','query_rule':'cell containing position; categorical data never bilinearly interpolated; no claim of subcell truth'}
 def land(self,easting,northing):
  from shapely import from_wkb
  from shapely.geometry import Point
  b=self.catalog['domain']['bounds']
  if not(b[0]<=easting<=b[2]and b[1]<=northing<=b[3]):return {'land':None,'reason':'outside_locked_domain'}
  g=from_wkb(zlib.decompress((self.root/'coast/land-domain.wkb.z').read_bytes()))
  return {'land':bool(g.covers(Point(easting,northing))),'identity':'WZ-OSM-LAND-REGIONAL-R01','rule':'mapped planar land region membership','tidal_state':None,'physical_uncertainty_m':None}

def predict(source,basis,target,method):
 """Storage predictor only; exact residual, not this warp, defines retained facts."""
 from affine import Affine
 from rasterio.warp import reproject,Resampling
 result=np.empty((source.shape[0],*target['shape']),dtype=np.dtype(target['source_metadata']['dtypes'][0]))
 for b in range(source.shape[0]):
  reproject(source[b],result[b],src_transform=Affine(*basis['transform']),src_crs=basis['crs'],src_nodata=basis['source_metadata']['nodatavals'][b],dst_transform=Affine(*target['transform']),dst_crs=target['crs'],dst_nodata=target['source_metadata']['nodatavals'][b],resampling=getattr(Resampling,method),num_threads=1)
 return result

def predict_lookup(source,lookup,target,method):
 """Portable integer predictor: persisted source-cell stencil, no GDAL/PROJ warp."""
 r,c,wx,wy=(v.astype(np.int64)for v in lookup);Q=65535
 result=np.empty((source.shape[0],*target['shape']),dtype=np.dtype(target['source_metadata']['dtypes'][0]))
 for b in range(source.shape[0]):
  nd=target['source_metadata']['nodatavals'][b];fill=0 if nd is None else int(nd)
  if method=='nearest':
   rr=r+(wy>=32768);cc=c+(wx>=32768);valid=(rr>=0)&(rr<source.shape[1])&(cc>=0)&(cc<source.shape[2])
   value=source[b,np.clip(rr,0,source.shape[1]-1),np.clip(cc,0,source.shape[2]-1)].astype(np.int64)
  else:
   valid=(r>=0)&(r+1<source.shape[1])&(c>=0)&(c+1<source.shape[2]);r0=np.clip(r,0,source.shape[1]-1);r1=np.clip(r+1,0,source.shape[1]-1);c0=np.clip(c,0,source.shape[2]-1);c1=np.clip(c+1,0,source.shape[2]-1)
   v00=source[b,r0,c0].astype(np.int64);v01=source[b,r0,c1].astype(np.int64);v10=source[b,r1,c0].astype(np.int64);v11=source[b,r1,c1].astype(np.int64)
   value=(v00*(Q-wx)*(Q-wy)+v01*wx*(Q-wy)+v10*(Q-wx)*wy+v11*wx*wy+(Q*Q)//2)//(Q*Q)
  result[b]=np.where(valid,value,fill).astype(result.dtype)
 return result

if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser();p.add_argument('field');p.add_argument('easting',type=float);p.add_argument('northing',type=float);p.add_argument('--root',default=str(Path(__file__).parent));args=p.parse_args()
 w=RegionalWorld(args.root)
 print(json.dumps(w.land(args.easting,args.northing)if args.field=='land'else w.query(args.field,args.easting,args.northing),ensure_ascii=False,indent=2))
