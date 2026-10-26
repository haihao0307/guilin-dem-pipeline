"""Fresh R3 numeric decoder. No imported historical implementation.

Persistent outputs are source-indexed measurements and validity support, not faces.
Lorenzo inverse follows the archive's declared modular finite-difference equation.
"""
from pathlib import Path
import hashlib, json, struct, zlib, time, platform
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if ROOT.name == 'site': ROOT = ROOT.parent
SRC = Path('G:/DEM/Wenzhou_Knowledge_Lab_R1_20260909/evidence/recovery/01_CANONICAL_COLD')
ARCHIVE = SRC / 'WENZHOU_FINAL_CANONICAL_R2_2_1.lorenzo.wzdem2'
INDEX = SRC / 'WENZHOU_FINAL_CANONICAL_R2_2_1.lorenzo.index.json'
EVIDENCE = Path('G:/DEM/Wenzhou_Knowledge_Lab_R2_20260909/site/public/data-r2-2/OBJECT_EVIDENCE_R2_2.json')
OUT = ROOT / 'site/dist/r3/data'
OUT.mkdir(parents=True, exist_ok=True)
def digest(p):
    with p.open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()
def write_json(p, v): p.write_text(json.dumps(v, ensure_ascii=False, indent=2), encoding='utf-8')
assert digest(ARCHIVE) == '8800c053608c5fa74eeebd2ce0d06c1bed54fd65274ed059d6e84fc2ec82a1dc'
assert digest(INDEX) == '44a1713aac3e8800d801d6d0984e92e56df537fe37012fd9975fcf595130ef9b'
assert digest(EVIDENCE) == '642290d1076bd700634c1c719c890819b5035a3841e24f9c86f5a171b1875482'
idx = json.loads(INDEX.read_text(encoding='utf-8-sig'))
h = idx['header']; H, W = h['height'], h['width']; ND = h['nodata']
start = time.perf_counter()
# Temporary decoded source grid stays outside the published site.
grid = np.memmap(ROOT / 'decoded-source.i16', dtype='<i2', mode='w+', shape=(H,W))
grid[:] = ND
checked = 0
with ARCHIVE.open('rb') as f:
    for e in idx['entries']:
        f.seek(e['offset'])
        head = f.read(52)
        tr, tc, th, tw, nv, nm, nd = struct.unpack('<4H3I', head[:20])
        assert (tr,tc,th,tw,nv,nm,nd) == (e['tileRow'],e['tileCol'],e['height'],e['width'],e['validPixels'],e['maskBytes'],e['dataBytes'])
        mask_bytes = zlib.decompress(f.read(nm))
        mask = np.unpackbits(np.frombuffer(mask_bytes,dtype='u1'),bitorder='little')[:th*tw].reshape(th,tw).astype(bool)
        delta = np.frombuffer(zlib.decompress(f.read(nd)),dtype='<u2').reshape(th,tw)
        decoded = delta.cumsum(axis=0,dtype=np.uint32).cumsum(axis=1,dtype=np.uint32).astype('<u2')
        assert hashlib.sha256(decoded.tobytes()+mask_bytes).hexdigest() == e['rawSha256'] == head[20:].hex()
        assert int(mask.sum()) == nv
        tile = decoded.view('<i2').copy(); tile[~mask] = ND
        r,c = e['rowOff'],e['colOff']; grid[r:r+th,c:c+tw] = tile
        checked += 1
grid.flush()
full_hash = digest(ROOT/'decoded-source.i16')
assert full_hash == '23b5bc71624b65889fb72cf353f74286652147b159d7aa774896f05058e52c19'
valid = grid != ND
minimum = int(grid[valid].min()); maximum = int(grid[valid].max())
peak_row,peak_col = map(int,np.unravel_index(np.argmax(grid),grid.shape))
queries = json.loads(EVIDENCE.read_text(encoding='utf-8-sig'))['objects']
for q in queries:
    m=q['measurements']['elevation']; assert int(grid[m['row'],m['col']]) == m['value']
assert int(valid.sum()) == 309716176
del valid

def nodes(first,last,step):
    a=np.arange(first,last+1,step,dtype=np.int32)
    return np.append(a,last).astype(np.int32) if a[-1]!=last else a

def measure_patch(ident,label,r0,r1,c0,c1,step):
    rows,cols=nodes(r0,r1,step),nodes(c0,c1,step)
    samples=np.asarray(grid[np.ix_(rows,cols)],dtype='<i2')
    # No cell may bridge a missing source sample, including unsampled interiors.
    support=np.empty((len(rows)-1,len(cols)-1),dtype='u1')
    for j,(ra,rb) in enumerate(zip(rows[:-1],rows[1:])):
        bad=np.any(grid[ra:rb+1,c0:c1+1]==ND,axis=0)
        prefix=np.concatenate(([0],np.cumsum(bad,dtype=np.int32)))
        support[j]=(prefix[cols[1:]-c0+1]-prefix[cols[:-1]-c0]==0)
    datafile=OUT/f'{ident}.i16'; maskfile=OUT/f'{ident}.support.u8'
    datafile.write_bytes(samples.tobytes()); maskfile.write_bytes(support.tobytes())
    v=samples[samples!=ND]
    return {'id':ident,'label':label,'rowIndices':rows.tolist(),'columnIndices':cols.tolist(),
      'rows':len(rows),'columns':len(cols),'measurementFile':datafile.name,'measurementSha256':digest(datafile),
      'validCellFile':maskfile.name,'validCellSha256':digest(maskfile),'stepM':step*12.5,
      'heightRangeM':[int(v.min()),int(v.max())] if len(v) else None,
      'validCells':int(support.sum()),'excludedCells':int(support.size-support.sum()),
      'boundaryPolicy':'Conservative: cell excluded when any original DEM sample in its closed support is NoData',
      'frame':'EPSG:32651','source':'canonical-dem-r1',
      'rule':'Display approximation from source-indexed retained samples; canonical terrain surface remains original-grid bilinear interpolation',
      'canonicalRule':'wz-dem-bilinear-centres-r1'}

def window(center,span,limit):
    low=max(0,min(center-span//2,limit-span-1)); return low,min(limit-1,low+span)

patches=[measure_patch('overview','全域',0,H-1,0,W-1,16)]
ra,rb=window(peak_row,1280,H);ca,cb=window(peak_col,1280,W)
patches.append(measure_patch('mountains','山地近景',ra,rb,ca,cb,2))
qrecords=[]
for n,q in enumerate(queries,1):
    m=q['measurements']['elevation']; ra,rb=window(m['row'],960,H); ca,cb=window(m['col'],960,W)
    ident=f'query-{n:02}'
    patches.append(measure_patch(ident,f'查询位置 {n:02}',ra,rb,ca,cb,4))
    E,N=q['position']['coordinates']; qc=(E-190475)/12.5-.5; qr=(3241862.5-N)/12.5-.5
    rr,cc=int(np.floor(qr)),int(np.floor(qc)); u,v=qc-cc,qr-rr
    corners=np.asarray(grid[rr:rr+2,cc:cc+2]); surface_valid=bool(corners.shape==(2,2) and np.all(corners!=ND))
    surface_height=float((1-v)*((1-u)*corners[0,0]+u*corners[0,1])+v*((1-u)*corners[1,0]+u*corners[1,1])) if surface_valid else None
    qrecords.append({'id':q['id'],'label':f'查询位置 {n:02}','patch':ident,'position':q['position'],
      'elevation':m,'soil':q['measurements']['soil'],
      'sourceCellHeightM':m['value'],'canonicalSurface':{'rule':'wz-dem-bilinear-centres-r1','heightM':surface_height,'status':'valid' if surface_valid else 'unknown','cellTopLeft':[rr,cc],'uv':[u,v],'cornerHeightsM':corners.tolist(),'meaning':'Derived interpolation, distinct from original containing-cell measurement'},
      'relation':{'kind':'data-query-support','physicalConnection':False,'physicalComposition':False,
      'sampling':'Elevation is from containing original cell; marker projection onto display surface is a temporary visual relation, not measured attachment'}})
contract={
 'schema':'wenzhou-bounded-measurement-surface/r3','version':'R3','object':{'id':'WZ-DEM-SURFACE-R3','kind':'terrain-model','compositionParent':None,'coordinateParentFrame':'EPSG:32651','connections':[],'connectionStatus':'No physical connection asserted'},
 'source':{'id':'canonical-dem-r1','sha256':digest(ARCHIVE),'indexSha256':digest(INDEX),'decodedGridSha256':full_hash,'shape':[H,W],'noData':ND,'units':'m','transform':h['transform'],'crs':'EPSG:32651','verticalDatum':None,'physicalUncertaintyM':None,'time':None,'sampling':'Cell centres, source row/column order preserved','sourceCellSpacingM':12.5},
 'surfaceContract':{'id':'wz-dem-bilinear-centres-r1','revision':1,'definition':'Canonical surface from original 12.5m centre-indexed measurements. Bilinear interpolation on each original valid four-corner cell. Retained coarse samples and render triangles are approximations, not replacements of that surface.','formula':'h=(1-u)(1-v)h00+u(1-v)h10+(1-u)v*h01+u*v*h11','domain':{'rowCentreIndices':[0,H-1],'columnCentreIndices':[0,W-1],'validity':'All four original corners required; no extrapolation','boundaryOwnership':'Internal boundaries choose increasing-index cell; last outer centre boundary chooses previous internal cell','continuity':'C0 on shared valid edges; derivatives may differ'},'physicalStatus':'DEM-derived terrain estimate, not surveyed true ground','discretization':'Render triangles are disposable numerical evaluation; neither topology nor triangles are persistent knowledge','normal':'Derived from display evaluation, not a measured field','missing':'Unknown, not sea and not zero elevation','outside':'No continuation beyond patch support','patchComposition':'Alternative approximations of one terrain model; patches overlap and are not separate physical objects'},
 'displayFrame':{'axes':['east','up','south'],'units':'km','originRule':'Patch horizontal bounds centre; vertical origin is archive numerical zero, not established sea level','equations':['x=(E-E0)/1000','y=h/1000','z=(N0-N)/1000'],'defaultVerticalExaggeration':1,'viewOnlyScale':'Optional 3x or 6x on y explicitly labelled; source measurements unchanged'},
 'unknowns':['Vertical datum','Independent physical measurement error','Single physical observation time','Hydrological connectivity','Actual water versus missing source area'],
 'patches':patches,'queries':qrecords,
 'qa':{'allEncodedTileHashesPassed':checked,'fullGridHashPassed':True,'validSourcePixels':309716176,'queryElevationChecks':12,'heightRangeM':[minimum,maximum],'peakCell':[peak_row,peak_col]},
}
write_json(OUT/'terrain.json',contract)
write_json(ROOT/'DEM_DECODE_QA_R3.json',{'schema':'wenzhou-r3-independent-decoder-qa','passed':True,'tileHashesPassed':checked,'wholeGridSha256':full_hash,'validPixels':309716176,'heightRangeM':[minimum,maximum],'queriesChecked':12,'elapsedSeconds':round(time.perf_counter()-start,3),'python':platform.python_version(),'numpy':np.__version__,'peakCell':[peak_row,peak_col],'scope':'Exact recovery of archived integer grid and stored validity; does not establish terrain truth, vertical datum or physical accuracy'})
print(json.dumps({'passed':True,'tiles':checked,'patches':len(patches),'peakCell':[peak_row,peak_col],'seconds':round(time.perf_counter()-start,2)},ensure_ascii=False))
