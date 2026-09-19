"""Typed source observations for the supplied batch. Not a production material
converter: specular-glossiness is preserved, not silently coerced into metallicity.
Level-0 bilinear texture observations; not a mip-filtered renderer match.
"""
from __future__ import annotations
import json,io
from pathlib import Path
import numpy as np
from PIL import Image
from audit_glb_batch import glb,accessor,payload,NAMES,ROOT,INPUT_DIR

def srgb(x): return np.where(x<=.04045,x/12.92,((x+.055)/1.055)**2.4)

def filtered(im,uv,color=False):
 if uv.ndim!=2 or uv.shape[1]!=2 or not np.isfinite(uv).all():raise ValueError('finite UV2 required')
 h,w=im.shape[:2];xy=np.mod(uv,1)*[w,h]-.5;idx=np.floor(xy).astype(int);f=xy-idx;out=np.zeros((len(uv),4))
 for ox,oy in [(0,0),(1,0),(0,1),(1,1)]:
  v=im[(idx[:,1]+oy)%h,(idx[:,0]+ox)%w].astype(float)/255
  if color:v[:,:3]=srgb(v[:,:3])
  weight=(f[:,0] if ox else 1-f[:,0])*(f[:,1] if oy else 1-f[:,1]);out+=v*weight[:,None]
 return out

class Observer:
 def __init__(self,d,b):self.d,self.b,self.images=d,b,{}
 def tex(self,slot,uv,default,color=False):
  if slot is None:return np.broadcast_to(np.array(default,float),(len(uv),4)).copy()
  if slot.get('texCoord',0)!=0 or slot.get('extensions'):raise ValueError('unsupported UV set/texture transform: do not silently sample')
  t=self.d['textures'][slot['index']];si=t.get('sampler');s=self.d.get('samplers',[])[si]if si is not None else {}
  if s.get('wrapS',10497)!=10497 or s.get('wrapT',10497)!=10497 or s.get('magFilter',9729)!=9729:raise ValueError('this observer supports repeat/linear only')
  index=t['source']
  if index not in self.images:self.images[index]=np.asarray(Image.open(io.BytesIO(payload(self.d,self.b,self.d['images'][index]))).convert('RGBA'))
  return filtered(self.images[index],uv,color)
 def at(self,material_index,uv):
  m=self.d['materials'][material_index]if material_index is not None else {};ext=m.get('extensions',{})
  unsupported=set(ext)-{'KHR_materials_pbrSpecularGlossiness','KHR_materials_specular','KHR_materials_clearcoat'}
  if unsupported:raise ValueError('unsupported material extensions '+repr(unsupported))
  sg=ext.get('KHR_materials_pbrSpecularGlossiness');result={}
  if sg is not None:
   rgba=self.tex(sg.get('diffuseTexture'),uv,[1]*4,True)*sg.get('diffuseFactor',[1]*4)
   v=self.tex(sg.get('specularGlossinessTexture'),uv,[1]*4,True)
   result.update(diffuse_linear=rgba[:,:3],specular_F0_linear=v[:,:3]*sg.get('specularFactor',[1]*3),glossiness=v[:,3]*sg.get('glossinessFactor',1))
   result['roughness_from_glossiness']=1-result['glossiness'];mode='specular-glossiness'
  else:
   p=m.get('pbrMetallicRoughness',{});rgba=self.tex(p.get('baseColorTexture'),uv,[1]*4,True)*p.get('baseColorFactor',[1]*4)
   v=self.tex(p.get('metallicRoughnessTexture'),uv,[1]*4)
   result.update(base_color_linear=rgba[:,:3],roughness=v[:,1]*p.get('roughnessFactor',1),metalness=v[:,2]*p.get('metallicFactor',1));mode='metallic-roughness'
   sp=ext.get('KHR_materials_specular',{})
   result['specular_weight']=self.tex(sp.get('specularTexture'),uv,[1]*4)[:,3]*sp.get('specularFactor',1)
   result['specular_color_linear']=self.tex(sp.get('specularColorTexture'),uv,[1]*4,True)[:,:3]*sp.get('specularColorFactor',[1]*3)
  normal=self.tex(m.get('normalTexture'),uv,[.5,.5,1,1])[:,:3]*2-1
  normal[:,:2]*=m.get('normalTexture',{}).get('scale',1)
  nl=np.linalg.norm(normal,axis=1,keepdims=True)
  if np.any(nl<1e-12):raise ValueError('degenerate sampled normal')
  result['normal_tangent']=normal/nl
  em=self.tex(m.get('emissiveTexture'),uv,[1]*4,True)[:,:3]*m.get('emissiveFactor',[0]*3)
  result['emissive_linear']=em
  ao=self.tex(m.get('occlusionTexture'),uv,[1]*4)[:,0];strength=m.get('occlusionTexture',{}).get('strength',1);result['occlusion']=1+strength*(ao-1)
  cc=ext.get('KHR_materials_clearcoat',{});result['clearcoat']=self.tex(cc.get('clearcoatTexture'),uv,[1]*4)[:,0]*cc.get('clearcoatFactor',0);result['clearcoat_roughness']=self.tex(cc.get('clearcoatRoughnessTexture'),uv,[1]*4)[:,1]*cc.get('clearcoatRoughnessFactor',0)
  result['source_alpha']=rgba[:,3];am=m.get('alphaMode','OPAQUE')
  result['effective_alpha']=np.ones(len(uv))if am=='OPAQUE' else (rgba[:,3]>=m.get('alphaCutoff',.5)).astype(float)if am=='MASK' else rgba[:,3]
  if am not in ('OPAQUE','MASK','BLEND'):raise ValueError('unknown alphaMode')
  if any(not np.isfinite(a).all()for a in result.values()):raise ValueError('nonfinite material observation')
  return result,{'workflow':mode,'alphaMode':am,'alphaCutoff':m.get('alphaCutoff',.5)if am=='MASK'else None,'doubleSided':m.get('doubleSided',False),'normalTexturePresent':'normalTexture'in m,'materialName':m.get('name'),'roughnessFromGlossiness':sg is not None,'sourceExtensions':ext,'scope':'observed source encoding, not measured real-fish optics'}

def run_batch():
 receipts=[]
 for index,name in enumerate(NAMES):
  d,b,_=glb(INPUT_DIR/name);obs=Observer(d,b);rng=np.random.default_rng(260919);rec={'filename':name,'parts':[]}
  for mi,m in enumerate(d['meshes']):
   for pi,pr in enumerate(m['primitives']):
    if pr.get('mode',4)!=4:raise ValueError('triangle source observer only')
    pos=accessor(d,b,pr['attributes']['POSITION']);uv=accessor(d,b,pr['attributes']['TEXCOORD_0']);fa=accessor(d,b,pr['indices']).reshape(-1,3)
    area=np.linalg.norm(np.cross(pos[fa[:,1]]-pos[fa[:,0]],pos[fa[:,2]]-pos[fa[:,0]]),axis=1)*.5
    ids=rng.choice(len(fa),2048,p=area/area.sum());z=rng.random((2048,2));r=np.sqrt(z[:,0]);weights=np.array([1-r,r*(1-z[:,1]),r*z[:,1]]).T
    UV=np.einsum('nk,nkj->nj',weights,uv[fa[ids]]);P=np.einsum('nk,nkj->nj',weights,pos[fa[ids]])
    data,info=obs.at(pr.get('material'),UV);data['source_position_observations']=P;data['source_uv_observations']=UV
    np.savez_compressed(ROOT/'audit'/f'upload-{index+1:02}'/f'material-observations-{mi}-{pi}.npz',**data)
    info.update(mesh=mi,primitive=pi,samples=len(P),channels=list(data),colorMean=data.get('base_color_linear',data.get('diffuse_linear')).mean(0).tolist(),alphaQuantiles=np.quantile(data['effective_alpha'],[0,.1,.5,.9,1]).tolist());rec['parts'].append(info)
  receipts.append(rec)
 (ROOT/'qa/MATERIAL_REPLAY.json').write_text(json.dumps({'level':'reference intake only','files':receipts,'samples':sum(p['samples']for r in receipts for p in r['parts']),'nativeDistillationAccepted':False},ensure_ascii=False,indent=2));print([(x['filename'],[(p['workflow'],p['alphaMode'])for p in x['parts']])for x in receipts])
if __name__=='__main__':run_batch()
