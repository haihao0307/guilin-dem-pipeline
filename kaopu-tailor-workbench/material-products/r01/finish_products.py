"""Final appearance integration. Exact old source guard; no original garment or source workbench writes."""
from pathlib import Path
from PIL import Image
import hashlib,json,io
P=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(name,data):(P/name).write_text(json.dumps(data,ensure_ascii=False,indent=2))
f=P/'app.mjs';text=f.read_text();assert sha(f.read_bytes())=='0db9087089c0d5755944f90723dbf3f511408307a970eac1bfbb1c7f091c225d','Unexpected reviewed runtime; do not patch'
def edit(old,new):
 global text
 assert text.count(old)==1,(old[:70],text.count(old));text=text.replace(old,new)
edit("import {LOOKS} from './looks.mjs';","import {LOOKS} from './looks.mjs';\nimport {mapPanelUV} from './panel-grain.mjs';")
edit('for(const [x,y]of panel.uvMm)uv.push(x*.001,-y*.001);','for(const [x,y]of panel.uvMm)uv.push(...mapPanelUV(panel.id,x,y));')
edit("for(const p of it.packet.spec.panels)for(const [x,y]of p.uvMm){uvError=Math.max(uvError,Math.abs(uv[offset++]-Math.fround(x*.001)),Math.abs(uv[offset++]-Math.fround(-y*.001)));}","for(const p of it.packet.spec.panels)for(const [x,y]of p.uvMm){const [u,v]=mapPanelUV(p.id,x,y);uvError=Math.max(uvError,Math.abs(uv[offset++]-Math.fround(u)),Math.abs(uv[offset++]-Math.fround(v)));}")
edit("m.userData={materialID:id,sourceVersion:info.sourceVersion,tileMM:info.tileMM,physicalPropertiesCalibrated:false};","m.userData={materialID:id,sourceVersion:info.sourceVersion,tileMM:info.tileMM,physicalPropertiesCalibrated:false,grain:'native cutting axes; sleeves rigidly rotated, never stretched'};")
f.write_text(text)
lock=json.loads((P/'SOURCE_LOCK.json').read_text());lock['garmentUV']='Original millimetre cutting coordinates converted to metres. Torso/trouser Y is wale direction; left/right sleeve cut panels use opposite rigid 90-degree rotations to align wales with arm length. No cutting edge lengths, solver grain axes, body or garment positions are changed.';lock['manufacturingGrainCertified']=False;save('SOURCE_LOCK.json',lock)
materials=json.loads((P/'materials.json').read_text());rows=[]
for m in materials:
 for name,ref in m['files'].items():
  f=P/ref['path'];original=f.read_bytes();assert sha(original)==ref['sha256'],ref['path']
  im=Image.open(io.BytesIO(original)).convert('RGBA');raw=im.tobytes();assert im.getextrema()[3]==(255,255)
  packed=im.convert('RGB')
  if name in ['roughness','ao']:
   gray=packed.getchannel('R');assert Image.merge('RGB',(gray,gray,gray)).tobytes()==packed.tobytes();packed=gray
  buf=io.BytesIO();packed.save(buf,format='PNG',compress_level=6);data=buf.getvalue()
  if len(data)>len(original):data=original
  decoded=Image.open(io.BytesIO(data)).convert('RGBA');assert decoded.size==(2048,2048) and decoded.tobytes()==raw,'Lossless packing changed material pixels'
  f.write_bytes(data);ref['originalExportSHA256']=ref['sha256'];ref['sha256']=sha(data);ref['decodedRGBA_SHA256']=sha(raw)
  rows.append({'path':ref['path'],'originalBytes':len(original),'packedBytes':len(data),'originalSHA256':sha(original),'packedSHA256':sha(data),'decodedRGBA_SHA256':sha(raw),'decodedPixelsIdentical':True})
  print('PACKED',ref['path'],len(original),'->',len(data),flush=True)
save('materials.json',materials)
save('TEXTURE_PACK_REPORT.json',{'passed':True,'maps':len(rows),'originalBytes':sum(r['originalBytes'] for r in rows),'packedBytes':sum(r['packedBytes'] for r in rows),'resolution':[2048,2048],'decodedRGBAIdentical':True,'quantization':False,'resampling':False,'sourceOpticalAlgorithmChanged':False,'rows':rows})
save('INTEGRATION_PATCH.json',{'originalRuntimeSHA256':'0db9087089c0d5755944f90723dbf3f511408307a970eac1bfbb1c7f091c225d','runtimeSHA256':sha((P/'app.mjs').read_bytes()),'garmentCoordinateChanges':False,'physicalGrainChanges':False,'appearanceUV':'Rigid panel-axis rotations with edge lengths preserved','losslessTexturePacking':True,'privateSourceTransferred':False})
f=P/'release.py';t=f.read_text();old="'native/identity.json']";assert t.count(old)==1;t=t.replace(old,"'native/identity.json','panel-grain.mjs','PANEL_GRAIN_REPORT.json','TEXTURE_PACK_REPORT.json','INTEGRATION_PATCH.json']");f.write_text(t)
print('FINAL_METRIC_APPEARANCE_ADAPTER_READY')
