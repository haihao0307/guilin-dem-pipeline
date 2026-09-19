from pathlib import Path
import json,numpy as np
from audit_glb_batch import *
from material_observer import Observer,filtered,srgb
results=[]
def check(name,fn):
 try:v=fn();results.append({'name':name,'pass':True,'value':v})
 except Exception as e:results.append({'name':name,'pass':False,'error':str(e)})
def ok(v):assert bool(v)
def constant(m):return Observer({'materials':[m]},b'').at(0,np.array([[.25,.25]]))
check('all seven GLB headers accessors indices and embedded images read',lambda:ok(all(not a['accessorProblems']and not a['externalDependencies']and all('problem'not in p for p in a['images'])and all(p['indicesInBounds']for m in a['meshes']for p in m['primitives'])for a in json.loads((ROOT/'audit/BATCH_AUDIT.json').read_text())['files'])))
check('black bass byte identity with prior reference',lambda:ok(json.loads((ROOT/'audit/BATCH_AUDIT.json').read_text())['largemouthMatchesEarlierSHA']))
check('tuna same 603 accessor values different image variants',lambda:ok(json.loads((ROOT/'qa/TUNA_COMPARISON.json').read_text())['accessorValuesExact']and not json.loads((ROOT/'audit/BATCH_AUDIT.json').read_text())['tunaByteIdentical']))
check('sRGB midpoint conversion known value',lambda:ok(abs(float(srgb(np.array([.5]))[0])-.21404114048223255)<1e-12))
im=np.array([[[0,0,0,0],[255,255,255,255]]],np.uint8)
check('sRGB decode happens before filtering alpha stays linear',lambda:ok(np.allclose(filtered(im,np.array([[.5,.5]]),True),[[.5,.5,.5,.5]])))
check('opaque coverage ignores supplied alpha',lambda:ok(constant({'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,.03]}})[0]['effective_alpha'][0]==1))
check('blend coverage preserves supplied alpha',lambda:ok(constant({'alphaMode':'BLEND','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,.03]}})[0]['effective_alpha'][0]==.03))
check('mask threshold is inclusive',lambda:ok(constant({'alphaMode':'MASK','alphaCutoff':.5,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,.5]}})[0]['effective_alpha'][0]==1))
check('specular-glossiness tagged and not silently metallic',lambda:ok('metalness'not in constant({'extensions':{'KHR_materials_pbrSpecularGlossiness':{'glossinessFactor':.3}}})[0]and np.allclose(constant({'extensions':{'KHR_materials_pbrSpecularGlossiness':{'glossinessFactor':.3}}})[0]['roughness_from_glossiness'],.7)))
def channel_test():
 import io
 from PIL import Image
 pic=np.array([[[64,128,192,32]]],np.uint8);bb=io.BytesIO();Image.fromarray(pic).save(bb,format='PNG');raw=bb.getvalue()
 d={'images':[{'bufferView':0}],'bufferViews':[{'byteLength':len(raw)}],'textures':[{'source':0}], 'materials':[{'pbrMetallicRoughness':{'metallicRoughnessTexture':{'index':0}}},{'extensions':{'KHR_materials_pbrSpecularGlossiness':{'specularGlossinessTexture':{'index':0}}}}]}
 ob=Observer(d,raw);a,_=ob.at(0,np.array([[.5,.5]]));b,_=ob.at(1,np.array([[.5,.5]]));assert np.allclose(a['roughness'],128/255);assert np.allclose(a['metalness'],192/255);assert np.allclose(b['glossiness'],32/255);assert np.allclose(b['specular_F0_linear'][0],srgb(pic[0,0,:3]/255))
check('MR uses G/B while SG uses linear A and sRGB RGB',channel_test)
check('missing normal texture retains specified default normal',lambda:ok(np.allclose(constant({})[0]['normal_tangent'],[[0,0,1]])))
check('clearcoat factor kept separate',lambda:ok(constant({'extensions':{'KHR_materials_clearcoat':{'clearcoatFactor':1,'clearcoatRoughnessFactor':.57}}})[0]['clearcoat_roughness'][0]==.57))
def reject_nan():
 try:filtered(im,np.array([[float('nan'),0]]));raise AssertionError('not rejected')
 except ValueError:pass
check('nonfinite UV rejected',reject_nan)
def koi_motion():
 d,b,_=glb(INPUT_DIR/'koi_fish(1).glb');pr=d['meshes'][0]['primitives'][0];pos=accessor(d,b,pr['attributes']['POSITION']);anim=d['animations'][0];ch=anim['channels'][0];s=anim['samplers'][ch['sampler']];ts=accessor(d,b,s['input']).ravel();w=accessor(d,b,s['output']).reshape(len(ts),len(pr['targets']));targets=np.stack([accessor(d,b,t['POSITION'])for t in pr['targets']]);samples=np.array([pos+np.einsum('k,kij->ij',w[i],targets)for i in [0,len(ts)//3,len(ts)*2//3,len(ts)-1]]);assert not d.get('skins');assert np.isfinite(samples).all();movement=float(np.max(np.linalg.norm(samples[1:]-samples[0],axis=2)));assert movement>1e-4;return {'targets':len(targets),'weightsShape':list(w.shape),'maxPoseDifferenceSourceUnits':movement,'zeroBonesDoesNotMeanNoMotion':True}
check('koi morph animation actually reconstructs four distinct timed poses',koi_motion)
receipt={'tests':results,'passed':sum(x['pass']for x in results),'failed':sum(not x['pass']for x in results),'scope':'reference intake and typed material observation; not full native fitting or visual acceptance'}
(ROOT/'qa/INTAKE_TESTS.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2));print(json.dumps(receipt,ensure_ascii=False,indent=2));assert receipt['failed']==0
