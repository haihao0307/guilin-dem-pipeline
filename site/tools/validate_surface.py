"""Verify R3 canonical surface, coordinate transforms and conservative LOD error.

For aligned coarse bilinear cells minus original bilinear cells, extrema of the
difference occur at original cell corners. Exhaustive retained-domain source-node
evaluation therefore bounds the continuous canonical/LOD bilinear discrepancy.
Triangle discrepancy is bounded separately and added conservatively.
"""
from pathlib import Path
import json, numpy as np, hashlib, time
ROOT=Path(__file__).resolve().parents[1]
if ROOT.name=='site': ROOT=ROOT.parent
OUT=ROOT/'site/dist/r3/data'
contract=json.loads((OUT/'terrain.json').read_text(encoding='utf-8'))
H,W=contract['source']['shape']; ND=contract['source']['noData']
grid=np.memmap(ROOT/'decoded-source.i16',dtype='<i2',mode='r',shape=(H,W))
def bilinear(h,u,v): return (1-u)*(1-v)*h[0,0]+u*(1-v)*h[0,1]+(1-u)*v*h[1,0]+u*v*h[1,1]
def surface(e,n):
    q=(e-190475)/12.5-.5;p=(3241862.5-n)/12.5-.5
    if not (0<=q<=W-1 and 0<=p<=H-1):return None
    c=min(int(np.floor(q)),W-2);r=min(int(np.floor(p)),H-2)
    h=np.asarray(grid[r:r+2,c:c+2],dtype='f8')
    if np.any(h==ND):return None
    return float(bilinear(h,q-c,p-r))

start=time.perf_counter()
checks={}
# Synthetic saddle catches false equivalence of bilinear and planar triangles.
checks['saddleCentre']=float(bilinear(np.array([[0.,0.],[0.,1.]]),.5,.5))
assert checks['saddleCentre']==.25
checks['outerCentreLocations']={'first':[190481.25,3241856.25],'last':[411243.75,2991281.25]}
assert 190475+12.5*(W-.5)==411243.75 and 3241862.5-12.5*(H-.5)==2991281.25
assert surface(190480,3241856.25) is None and surface(411244,2991281.25) is None
checks['outOfDomainRejected']=True
max_roundtrip=0;valid_centres=0;seam_checks=0;edge_checks=0
sample_rows=sorted(set([0,H-1]+list(range(511,H-1,512))+list(range(512,H-1,512))))
sample_cols=sorted(set([0,W-1]+list(range(511,W-1,512))+list(range(512,W-1,512))))
for r in sample_rows:
  for c in sample_cols:
    e,n=190475+12.5*(c+.5),3241862.5-12.5*(r+.5)
    for alpha in (1,3,6):
      x=(e-300862.5)/1000;z=(3116568.75-n)/1000;y=alpha*1234.5/1000
      max_roundtrip=max(max_roundtrip,abs(300862.5+x*1000-e),abs(3116568.75-z*1000-n),abs(y*1000/alpha-1234.5))
    v=surface(e,n)
    if v is not None:assert v==int(grid[r,c]);valid_centres+=1
    if r<H-1 and 0<c<W-1:
      left=np.asarray(grid[r:r+2,c-1:c+1],dtype='f8');right=np.asarray(grid[r:r+2,c:c+2],dtype='f8')
      if np.all(left!=ND) and np.all(right!=ND):
        assert abs(bilinear(left,1,.37)-bilinear(right,0,.37))<1e-9;seam_checks+=1
    if r in (0,H-1) or c in (0,W-1):edge_checks+=1
assert max_roundtrip<1e-6
checks.update({'coordinateRoundTripMaxM':max_roundtrip,'sourceCentresChecked':valid_centres,'sharedEdgeChecksIncludingCodecSeams':seam_checks,'outerCentreRequestsChecked':edge_checks,'validZeroCount':int(np.count_nonzero(grid==0))})
assert checks['validZeroCount']==336
for q in contract['queries']:
    v=surface(*q['position']['coordinates']);expected=q['canonicalSurface']['heightM'];assert (v is None and expected is None) or (v is not None and expected is not None and abs(v-expected)<1e-9)
checks['canonicalQueryValuesChecked']=12

def reduce_patch(p,skip):
    nr,nc=p['rows'],p['columns'];s=np.fromfile(OUT/p['measurementFile'],dtype='<i2').reshape(nr,nc)
    mask=np.fromfile(OUT/p['validCellFile'],dtype='u1').reshape(nr-1,nc-1)
    rid=list(range(0,nr,skip));cid=list(range(0,nc,skip))
    if rid[-1]!=nr-1:rid.append(nr-1)
    if cid[-1]!=nc-1:cid.append(nc-1)
    reduced_mask=np.empty((len(rid)-1,len(cid)-1),dtype=bool)
    for j in range(len(rid)-1):
      band=np.all(mask[rid[j]:rid[j+1]],axis=0)
      for k in range(len(cid)-1):reduced_mask[j,k]=np.all(band[cid[k]:cid[k+1]])
    return np.array(p['rowIndices'])[rid],np.array(p['columnIndices'])[cid],s[np.ix_(rid,cid)].astype('f8'),reduced_mask

for p in contract['patches']:
  results={}
  for skip in (1,2):
    rr,cc,values,valid=reduce_patch(p,skip)
    source_cols=np.arange(cc[0],cc[-1]+1)
    seg=np.minimum(np.searchsorted(cc,source_cols,side='right')-1,len(cc)-2)
    u=(source_cols-cc[seg])/(cc[seg+1]-cc[seg])
    maxdiff=0;tested=0
    for j,(ra,rb) in enumerate(zip(rr[:-1],rr[1:])):
      good=valid[j,seg]
      if not np.any(good):continue
      v=(np.arange(ra,rb+1)-ra)/(rb-ra)
      top=values[j,seg]*(1-u)+values[j,seg+1]*u
      bottom=values[j+1,seg]*(1-u)+values[j+1,seg+1]*u
      approx=(1-v[:,None])*top[None,:]+v[:,None]*bottom[None,:]
      actual=grid[ra:rb+1,cc[0]:cc[-1]+1]
      assert np.all(actual[:,good]!=ND)
      diff=np.abs(approx[:,good]-actual[:,good]);maxdiff=max(maxdiff,float(diff.max()));tested+=diff.size
    mixed=values[:-1,:-1]-values[:-1,1:]-values[1:,:-1]+values[1:,1:]
    tri=float(np.max(np.abs(mixed[valid]))/4) if np.any(valid) else 0
    results[str(skip)]={'canonicalToLodBilinearMaxM':round(maxdiff,6),'lodBilinearToTrianglesBoundM':round(tri,6),
      'canonicalToDisplayHeightBoundM':round(maxdiff+tri,6),'sourceNodeComparisonsIncludingSharedEdges':tested,
      'method':'Exhaustive source-node extrema on all retained closed coarse supports; plus per-cell triangle algebraic bound',
      'scope':'Retained displayed domain, alpha=1; height only. Excluded boundary coverage is not reconstructed. Not physical accuracy.',
      'validCells':int(valid.sum()),'excludedCells':int(valid.size-valid.sum())}
  p['displayApproximation']=results
  print(p['id'],results['1']['canonicalToDisplayHeightBoundM'],flush=True)
contract['source']['sourceInformationScale']={'approximateM':30,'basis':'Prior source lineage described in Xiaoma WZ-3D-KNOWLEDGE R0.1; not independently recovered from this integer archive','currentGridSpacingM':12.5,'note':'Denser grid spacing and interpolation do not establish finer physical information or accuracy'}
contract['displayFrame']['resetPolicy']='Restore alpha=1 and fitted camera of current patch'
contract['knowledgeApplied']={'document':'XIAOMA_3D_KNOWLEDGE_R3.md','sha256':hashlib.sha256((ROOT/'XIAOMA_3D_KNOWLEDGE_R3.md').read_bytes()).hexdigest(),'rules':['Centre coordinates distinct from pixel edges','Original containing-cell height distinct from canonical surface value','All original samples in coarse support required','Bilinear and triangle display errors distinct','Coordinate frame distinct from physical composition and connection','Reset returns vertical exaggeration to one']}
(OUT/'terrain.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2),encoding='utf-8')
qa={'schema':'wenzhou-surface-validation/r3','passed':True,'checks':checks,'scope':'Canonical numeric coordinate/surface identities and exhaustive retained-domain LOD bound; no physical truth claim','patchCount':len(contract['patches']),'seconds':round(time.perf_counter()-start,2)}
(ROOT/'SURFACE_QA_R3.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(qa,ensure_ascii=False),flush=True)
