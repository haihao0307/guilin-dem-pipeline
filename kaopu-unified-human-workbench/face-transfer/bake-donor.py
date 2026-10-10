"""Extract reusable surface BANDS, never a copied facial identity or full albedo.
The same licensed scan used in the eye laboratory supplies the fine-scale data.
UV crops were inspected on its source atlas; their dimensions are not pore-depth
measurements. Output channels and amplification remain artistic fit parameters.
"""
import base64, hashlib, io, json, os, pathlib, urllib.request
import numpy as np
from PIL import Image, ImageFilter
ROOT=pathlib.Path(__file__).resolve().parent
SHA='5be35195ad40d57507f7ab1785e4eecda6c648de'
BASE=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{SHA}/skin-quality-lab/r01/assets/hires/'
SOURCES={'microheight-4k.png':'6ea15108bb848c726d337ffb6c16c1397a2883f80b7a9d2383ca563f5f12b01b','albedo-4k.jpg':'4fc7297835e2081cb914d1a8507fc837687102eed7bd3c6bed25b72960a09e08'}
images={}
for name,expected in SOURCES.items():
    local=os.environ.get('DONOR_ASSETS')
    data=(pathlib.Path(local)/name).read_bytes() if local else urllib.request.urlopen(BASE+name,timeout=90).read()
    if hashlib.sha256(data).hexdigest()!=expected: raise ValueError('Donor input SHA mismatch: '+name)
    images[name]=Image.open(io.BytesIO(data)).convert('L')
# Source image origin is top-left. Forehead, cheek, nose, thin eyelid, vermilion.
patches=[('forehead',[.435,.170,.505,.230]),('cheek',[.375,.335,.425,.395]),('nose',[.480,.337,.514,.394]),('eyelid',[.397,.287,.439,.310]),('lip',[.464,.456,.521,.476])]
T=128
atlas=np.zeros((T,T*len(patches),4),dtype=np.uint8)
y,x=np.mgrid[0:T,0:T];w=np.minimum.reduce([x,y,T-1-x,T-1-y])/10.;w=np.clip(w,0,1);w=w*w*(3-2*w)
meta=[]
def band(a):
    a=a-a.mean();s=max(float(a.std()),1e-5)
    return np.clip(.5+.11*np.clip(a/s,-4,4)*w,0,1)
for i,(name,uv) in enumerate(patches):
    box=tuple(round(v*4096) for v in uv)
    h=images['microheight-4k.png'].crop(box).resize((T,T),Image.Resampling.LANCZOS)
    c=images['albedo-4k.jpg'].crop(box).resize((T,T),Image.Resampling.LANCZOS)
    a=np.asarray(h,dtype=np.float64);g1=np.asarray(h.filter(ImageFilter.GaussianBlur(1.3)),dtype=np.float64);g6=np.asarray(h.filter(ImageFilter.GaussianBlur(6)),dtype=np.float64)
    micro=band(a-g1);meso=band(g1-g6);pigment=band(np.asarray(c,dtype=np.float64)-np.asarray(c.filter(ImageFilter.GaussianBlur(7)),dtype=np.float64))
    channels=np.stack([micro,meso,pigment,np.clip(.5+(micro-.5)*.65+(meso-.5)*.35,0,1)],axis=2)
    atlas[:,i*T:(i+1)*T,:]=np.round(channels*255).astype(np.uint8)
    meta.append({'region':name,'inputCropPixels':box,'outputPixels':[T,T],'microStdInput':float((a-g1).std()),'mesoStdInput':float((g1-g6).std())})
buf=io.BytesIO();Image.fromarray(atlas,'RGBA').save(buf,format='PNG',optimize=True);png=buf.getvalue()
provenance={'schema':'kaopu/face-band-transfer@1','sourceCommit':SHA,'sources':SOURCES,'creator':'Lee Perry-Smith / Infinite 3D Head Scan','license':'CC BY 3.0 Unported','sourceDistribution':'Pixar RenderMan Photorealistic Head tutorial','cropCoordinateOrigin':'top left','changes':'cropped, resampled to128px, Gaussian frequency separation, mean removed, bounded normalization, periodic edge taper; no original complete face color or identity mesh','channels':['micro height','meso height','pigment variation','roughness modulation'],'patches':meta,'pngSHA256':hashlib.sha256(png).hexdigest(),'pngBytes':len(png),'medicalCalibration':False,'samePersonsPoresRecovered':False}
(ROOT/'assets').mkdir(exist_ok=True)
(ROOT/'assets'/'face-bands.png').write_bytes(png)
(ROOT/'DONOR-PROVENANCE.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2))
(ROOT/'DonorTiles.generated.mjs').write_text('export const DONOR_TILES='+json.dumps({'uri':'data:image/png;base64,'+base64.b64encode(png).decode(),'provenance':provenance},ensure_ascii=False)+';\n')
print(json.dumps({'bytes':len(png),'SHA256':provenance['pngSHA256'],'patches':meta}))
