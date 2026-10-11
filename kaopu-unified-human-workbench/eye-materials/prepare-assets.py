"""Fetch ONLY the two selected natural human-eye assets, preserving attribution.
The PNGs are not upscaled. Derived sclera fields are artistic decompositions,
not measured biological maps or recovered physical reflectance.
"""
from pathlib import Path
import hashlib, io, json, urllib.request, zipfile
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
ROOT=Path(__file__).resolve().parent
URL='https://files2.makehumancommunity.org/asset_packs/system_eye_materials03/system_eye_materials03_cc-by.zip'
PACK_SHA='3da87263048bcc369ce816c40109344f8b1e0f884ab8a965f9d9cabcf8802179'
SOURCES={
 'Harvey_eye1.png':('eyes/materials/callharvey3d_harvey_eye1/Harvey_eye1.png','6cf688756e0867bcae6ce911b8a6a68e0fad0113998087506e41ca6cc642ba70'),
 'Harvey_eye2.png':('eyes/materials/callharvey3d_harvey_eye2/Harvey_eye2.png','ea78bf4b3bae42e463d6f809d7d02321ad768da5e8d16fba034d6067e9fb653e')}
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 assets=ROOT/'assets';assets.mkdir(parents=True,exist_ok=True)
 body=urllib.request.urlopen(URL,timeout=120).read()
 if sha(body)!=PACK_SHA:raise RuntimeError('Upstream pack changed: stop rather than silently accept new assets')
 z=zipfile.ZipFile(io.BytesIO(body));selected=[]
 for name,(entry,digest) in SOURCES.items():
  b=z.read(entry)
  if sha(b)!=digest:raise RuntimeError('Original texture digest mismatch: '+name)
  (assets/name).write_bytes(b);im=Image.open(io.BytesIO(b));assert im.size==(1024,1024)
  selected.append({'name':name,'originalEntry':entry,'sha256':digest,'bytes':len(b),'dimensions':list(im.size),'author':'callharvey3d','license':'CC-BY (version not stated on pack listing)','originalBytesPreserved':True})
 base=Image.open(assets/'Harvey_eye1.png').convert('RGB')
 rgb=np.asarray(base,dtype=np.float32)/255
 smooth=np.asarray(base.filter(ImageFilter.GaussianBlur(8)),dtype=np.float32)/255
 med=np.asarray(base.filter(ImageFilter.MedianFilter(7)),dtype=np.float32)/255
 clean=.65*smooth+.35*med
 yy,xx=np.mgrid[:1024,:1024];radial=np.minimum(np.hypot(xx-727.45,yy-310.44),np.hypot(xx-296.55,yy-715.56))/121.34
 sclera=np.clip((radial-1.025)/.07,0,1)*np.clip((2.9-radial)/.25,0,1)
 red=rgb[:,:,0]-.5*(rgb[:,:,1]+rgb[:,:,2]);low=ndimage.gaussian_filter(red,7)
 vessel=np.clip((red-low-.0015)/.046,0,1)**.82*sclera
 labels,count=ndimage.label(vessel>.11)
 sizes=np.bincount(labels.ravel());keep=sizes>=4;keep[0]=False
 support=keep[labels]
 # Stable component priorities turn density into actual spatial coverage,
 # rather than renaming the redness/intensity slider. Whole authored branches
 # (or source-image connected segments) are selected together.
 if support.any():
  _,indices=ndimage.distance_transform_edt(~support,return_indices=True)
  nearest=labels[indices[0],indices[1]]
  ranks=((nearest.astype(np.uint64)*2654435761)%65521)/65521.
  ranks=.035+ranks*.93
 else:ranks=np.ones_like(vessel)
 mask=np.stack([vessel,ndimage.gaussian_filter(vessel,.75),ranks,sclera],axis=-1)
 Image.fromarray(np.round(np.clip(clean,0,1)*255).astype('uint8'),'RGB').save(assets/'sclera-clean.png',optimize=True)
 Image.fromarray(np.round(np.clip(mask,0,1)*255).astype('uint8'),'RGBA').save(assets/'sclera-vessels.png',optimize=True)
 all_materials=sorted({Path(n).parent.name for n in z.namelist() if n.endswith('.mhmat')})
 provenance={'schema':'kaopu/eye-source-lock@1','sourcePage':'https://static.makehumancommunity.org/assets/assetpacks/system_eye_materials03.html','download':URL,'packSHA256':PACK_SHA,'included':selected,'excluded':[n for n in all_materials if n not in ['callharvey3d_harvey_eye1','callharvey3d_harvey_eye2']], 'licenseBoundary':'PNG assets follow the official CC-BY pack listing. Original .mhmat descriptors contain AGPL boilerplate and are NOT included, executed, relicensed or copied into the new shader. Shader, parameter adapter and preparation code are newly authored. Credit is retained for modified derivatives.', 'derivedMaps':{'method':'local chroma high-pass vessel mask; smoothed authored sclera background; connected-source-segment density priorities','measuredMaps':False,'upscaled':False,'sourceIrisApproxPixelsAcross':243,'sourceLimit':'1024 atlas contains two eyes: it is not a 4K/8K close-up iris scan'},'files':[{'path':p.name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}for p in sorted(assets.glob('*.png'))]}
 (ROOT/'SOURCE_LOCK.json').write_text(json.dumps(provenance,indent=2)+'\n')
 print(json.dumps(provenance,indent=2))
if __name__=='__main__':main()
