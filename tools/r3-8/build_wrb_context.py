#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from osgeo import gdal

ROWS=1003
COLS=884
BOUNDS=[190250.0,2991250.0,411250.0,3242000.0]
NODATA_I16=-32768
NODATA_U8=255
NODATA_U16=65535
SOURCE_PROJ='+proj=igh +lat_0=0 +lon_0=0 +datum=WGS84 +units=m +no_defs'
SOURCE_RELEASE_TAG='wenzhou-r3.7-soilgrids-evidence-20260911'
SOURCE_RELEASE_WRB_SHA256='a32110ba7bdf94c95e61486e7514c8a856957350ca25caedf444ef2fe5d97b30'
LEGEND_SOURCE='https://files.isric.org/soilgrids/latest/data/wrb/MostProbable/MostProbable.rat.json'

CLASSES=[
 'Acrisols','Albeluvisols','Alisols','Andosols','Arenosols','Calcisols','Cambisols','Chernozems','Cryosols','Durisols',
 'Ferralsols','Fluvisols','Gleysols','Gypsisols','Histosols','Kastanozems','Leptosols','Lixisols','Luvisols','Nitisols',
 'Phaeozems','Planosols','Plinthosols','Podzols','Regosols','Solonchaks','Solonetz','Stagnosols','Umbrisols','Vertisols'
]


def sha(path:Path)->str:
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()


def read(path:Path)->tuple[np.ndarray,list[float]]:
 ds=gdal.Open(str(path),gdal.GA_ReadOnly)
 if ds is None:raise RuntimeError(f'cannot open {path}')
 if [ds.RasterYSize,ds.RasterXSize]!=[ROWS,COLS]:raise RuntimeError(f'shape mismatch {path}: {ds.RasterYSize}x{ds.RasterXSize}')
 arr=ds.GetRasterBand(1).ReadAsArray()
 gt=list(ds.GetGeoTransform());ds=None
 return np.asarray(arr,dtype=np.int16),gt


def write_bytes(path:Path,data:np.ndarray)->dict:
 path.write_bytes(data.tobytes(order='C'))
 return {'path':path.name,'bytes':path.stat().st_size,'sha256':sha(path),'dtype':str(data.dtype)}


def main()->int:
 ap=argparse.ArgumentParser();ap.add_argument('--stage',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
 stage=args.stage;out=args.output;out.mkdir(parents=True,exist_ok=True)
 manifest=json.loads((stage/'PAYLOAD_MANIFEST.json').read_text(encoding='utf-8'))
 if not manifest.get('passed') or manifest.get('payloadCount')!=65:raise RuntimeError('WRB source manifest gate failed')

 mask_i16,_=read(stage/'aligned_context/LOCKED_DOMAIN_MASK_EPSG32651_250M.tif')
 mask=mask_i16>0
 probability=[];probability_files=[];geotransform=None
 for code,name in enumerate(CLASSES):
  arr,gt=read(stage/f'aligned_context/wrb/{name}_EPSG32651_250M.tif')
  if geotransform is None:geotransform=gt
  elif gt!=geotransform:raise RuntimeError(f'grid transform mismatch: {name}')
  valid=arr!=NODATA_I16
  clean=np.where(valid,arr,0)
  if clean.min()<0 or clean.max()>254:raise RuntimeError(f'WRB probability score out of uint8 range: {name} {clean.min()}..{clean.max()}')
  probability.append(clean.astype(np.int16,copy=False))
  u8=np.where(mask&valid,clean,NODATA_U8).astype(np.uint8)
  rec=write_bytes(out/f'wrb-prob-{code:02d}-{name.lower()}.u8',u8)
  rec.update({'code':code,'name':name,'role':'estimated-occurrence-probability-score','nodata':NODATA_U8})
  probability_files.append(rec)
 stack=np.stack(probability,axis=0)
 sums=stack.sum(axis=0,dtype=np.int32)
 maxima=stack.max(axis=0)
 derived=stack.argmax(axis=0).astype(np.uint8)
 valid_domain=mask&(sums>0)

 archived,gt_mp=read(stage/'aligned_context/wrb/MostProbable_EPSG32651_250M.tif')
 if gt_mp!=geotransform:raise RuntimeError('MostProbable aligned transform mismatch')
 native=stage/'source_native/wrb/MostProbable_EPSG152160.tif'
 warped=gdal.Warp('',str(native),format='MEM',srcSRS=SOURCE_PROJ,dstSRS='EPSG:32651',outputBounds=BOUNDS,xRes=250,yRes=250,resampleAlg='near',outputType=gdal.GDT_Int16,dstNodata=NODATA_I16)
 if warped is None:raise RuntimeError('nearest-neighbour categorical audit warp failed')
 nearest=np.asarray(warped.GetRasterBand(1).ReadAsArray(),dtype=np.int16);warped=None
 if nearest.shape!=(ROWS,COLS):raise RuntimeError(f'nearest audit shape {nearest.shape}')
 nearest_equal=bool(np.array_equal(nearest,archived))
 if not nearest_equal:raise RuntimeError(f'archived MostProbable differs from independent nearest reprojection at {int(np.count_nonzero(nearest!=archived))} pixels')

 official=np.where(valid_domain,archived,NODATA_U8).astype(np.uint8)
 derived_out=np.where(valid_domain,derived,NODATA_U8).astype(np.uint8)
 max_out=np.where(valid_domain,maxima,NODATA_U8).astype(np.uint8)
 sum_out=np.where(valid_domain,sums,NODATA_U16).astype('<u2')
 disagreement=np.where(valid_domain,(official!=derived_out).astype(np.uint8),NODATA_U8).astype(np.uint8)
 mismatch=int(np.count_nonzero(valid_domain&(official!=derived_out)))
 valid_count=int(np.count_nonzero(valid_domain))
 ratio=(mismatch/valid_count) if valid_count else 0.0

 outputs={
  'officialMostProbable':write_bytes(out/'wrb-most-probable-official.u8',official),
  'postAlignmentArgmax':write_bytes(out/'wrb-argmax-after-probability-alignment.u8',derived_out),
  'maxProbabilityScore':write_bytes(out/'wrb-max-probability-score.u8',max_out),
  'sumProbabilityScore':write_bytes(out/'wrb-sum-probability-score.u16le',sum_out),
  'classificationDisagreement':write_bytes(out/'wrb-classification-disagreement.u8',disagreement),
 }
 for key in ['officialMostProbable','postAlignmentArgmax']:
  outputs[key].update({'nodata':NODATA_U8,'classCodes':'0..29'})
 outputs['maxProbabilityScore'].update({'nodata':NODATA_U8,'unit':'source probability score'})
 outputs['sumProbabilityScore'].update({'nodata':NODATA_U16,'unit':'sum of aligned source probability scores; diagnostic only'})
 outputs['classificationDisagreement'].update({'nodata':NODATA_U8,'meaning':'0=same,1=official nearest categorical differs from argmax after probability alignment'})

 class_counts=[]
 for code,name in enumerate(CLASSES):
  class_counts.append({'code':code,'name':name,'officialValidPixelCount':int(np.count_nonzero(valid_domain&(official==code))),'derivedArgmaxValidPixelCount':int(np.count_nonzero(valid_domain&(derived_out==code)))})

 report={
  'schema':'wenzhou-r3.8-wrb-browser-context/r1',
  'source':{
   'provider':'ISRIC World Soil Information','product':'SoilGrids WRB probability / MostProbable','permanentReleaseTag':SOURCE_RELEASE_TAG,'releaseWrbAssetSha256':SOURCE_RELEASE_WRB_SHA256,'legendSource':LEGEND_SOURCE,
  },
  'grid':{'crs':'EPSG:32651','resolutionM':250,'rows':ROWS,'columns':COLS,'bounds':BOUNDS,'geotransform':geotransform},
  'legend':[{'code':i,'name':n} for i,n in enumerate(CLASSES)],
  'probabilityLayers':probability_files,
  'outputs':outputs,
  'audit':{
   'archivedAlignedMostProbableEqualsIndependentNearestReprojection':nearest_equal,
   'validLockedDomainProbabilityPixels':valid_count,
   'officialVsPostAlignmentArgmaxMismatchPixels':mismatch,
   'officialVsPostAlignmentArgmaxMismatchRatio':ratio,
   'interpretation':'MostProbable-nearest and post-alignment probability argmax are different operator orders. The disagreement is preserved as evidence; neither representation silently overwrites the other.',
   'probabilityScoreSumPercentiles':[float(x) for x in np.percentile(sums[valid_domain],[0,1,5,50,95,99,100])] if valid_count else [],
   'maxProbabilityScorePercentiles':[float(x) for x in np.percentile(maxima[valid_domain],[0,1,5,50,95,99,100])] if valid_count else [],
  },
  'classCounts':class_counts,
  'truthBoundary':{
   'sourceIdentity':'model_prediction_external_observation','canonicalTruth':False,'fieldClassificationTruth':False,'mayReplaceFieldSurvey':False,'mayOverrideCanonicalDem':False,'individualObjectTruth':False,'productionReady':False,
  },
  'displayPolicy':{
   'officialMostProbableUsesCategoricalNearestSemantics':True,'probabilitySurfacesAreContinuousEvidence':True,'postAlignmentArgmaxIsDerivedAuditLayer':True,'heightDisplacement':False,'fieldBoundaryGeneration':False,
  }
 }
 p=out/'wrb-context.json';p.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'passed':True,'validPixels':valid_count,'mismatchPixels':mismatch,'mismatchRatio':ratio,'probabilityFiles':len(probability_files),'outputBytes':sum(x['bytes'] for x in probability_files)+sum(x['bytes'] for x in outputs.values()),'manifestSha256':sha(p)},ensure_ascii=False,indent=2))
 return 0

if __name__=='__main__':raise SystemExit(main())
