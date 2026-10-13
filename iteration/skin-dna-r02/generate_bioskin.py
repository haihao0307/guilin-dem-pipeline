"""Build-only BioSkin LUT. No face asset, inferred individual or NN on web client."""
import ast, hashlib, json, pathlib, urllib.request, io
import numpy as np
import torch
from scipy.interpolate import interp1d
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'kaopu-unified-human-workbench/skin-dna-r02'
OUT.mkdir(parents=True,exist_ok=True)
PIN='6cca1a76ac3f53077579c4249983ec91d855801d'
REMOTE='https://raw.githubusercontent.com/facebookresearch/BioSkin/'+PIN+'/'
FILES={'bioskin/bioskin.py':'ccec07b04445812623f6e0d7dc1aec7b24ef7d32','bioskin/spectrum/color_spectrum.py':'4367345bf59720517a7916bec9fc3b87e4a46c06','bioskin/parameters/params_io.py':'3ceb4a5f015b436716ca77453744e0f4c512091d','bioskin/parameters/parameter.py':'5fe827ce577d297988ac27dc042326126504637a','pretrained_models/BioSkin.pt':'25f5a9891f703697929c6923f1f6b674ae77f03d','pretrained_models/BioSkin.json':'b94a3d50a66526be222b9d3701ab68be737191ed','LICENSE':'a45a376fb0fcd4a3de06b6c096e62028929a2dcb'}
raw={};hashes={}
for path,sha in FILES.items():
    with urllib.request.urlopen(REMOTE+path,timeout=90) as r:b=r.read()
    assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==sha,path
    raw[path]=b;hashes[path]=hashlib.sha256(b).hexdigest()
# Execute only the reviewed upstream definitions, without UI/IO side effects.
ns={'torch':torch,'nn':torch.nn,'np':np,'interp1d':interp1d}
def definitions(path,names):
    tree=ast.parse(raw[path]);nodes=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in names]
    assert {n.name for n in nodes}==set(names)
    exec(compile(ast.Module(body=nodes,type_ignores=[]),path,'exec'),ns)
definitions('bioskin/bioskin.py',['Skin2ReflectanceNN'])
definitions('bioskin/spectrum/color_spectrum.py',['resample','create_xyz','create_matrix_xyz_to_lrgb','ColorSpectrum'])
params=json.loads(raw['pretrained_models/BioSkin.json'])
assert params['color_mode']=='spectral' and params['D_skin']==5
model=ns['Skin2ReflectanceNN'](params['H_enc'],params['H_dec'],params['D_rgb'],5,params['D_spec'])
weights=torch.load(io.BytesIO(raw['pretrained_models/BioSkin.pt']),map_location='cpu',weights_only=True)
weights={k.replace('module.',''):v for k,v in weights.items()}
model.load_state_dict(weights,strict=True);model.eval();torch.set_num_threads(2)
spectrum=ns['ColorSpectrum'](torch.device('cpu'),int((400/620)*params['D_spec']))
W,H=33,17
coords=np.array([[x/(W-1),y/(H-1)] for y in range(H) for x in range(W)],dtype=np.float32)
def predict(coords):
    c=torch.tensor(coords,dtype=torch.float32)
    physical=torch.stack([.005+.395*c[:,0]**2,.001+.0215*c[:,1],torch.full_like(c[:,0],.015),torch.full_like(c[:,0],.70),torch.full_like(c[:,0],.74)],dim=1)
    latent=physical.clone();latent[:,0]=physical[:,0]**(1/3);latent[:,1]=physical[:,1]**(1/4);latent[:,2]=(physical[:,2]-.001)/(.035-.001)
    with torch.no_grad():
        reflected=model(latent,'skin2reflectance')
        # Upstream output is BGR for OpenCV; Three expects linear RGB.
        rgb=spectrum.spectrum_to_rgb(reflected[:,:spectrum.xbar.numel()])[:,[2,1,0]]
    assert torch.isfinite(rgb).all() and rgb.min()>=0 and rgb.max()<=1
    return rgb.numpy().astype(np.float32)
rgb=predict(coords)
rng=np.random.default_rng(9823);held=rng.random((1024,2)).astype(np.float32);truth=predict(held)
grid=rgb.reshape(H,W,3)
def sample(uv):
    a=np.clip(uv,0,1)*[W-1,H-1];i=np.floor(a).astype(int);j=np.minimum(i+1,[W-1,H-1]);f=a-i
    return ((grid[i[:,1],i[:,0]]*(1-f[:,0,None])+grid[i[:,1],j[:,0]]*f[:,0,None])*(1-f[:,1,None])+(grid[j[:,1],i[:,0]]*(1-f[:,0,None])+grid[j[:,1],j[:,0]]*f[:,0,None])*f[:,1,None])
err=np.abs(sample(held)-truth)
assert float(err.max())<.004,err.max()
luma=grid@np.array([.2126,.7152,.0722]);assert np.max(np.diff(luma,axis=1))<.001
lut={'schema':'kaopu.bioskin-lut/1','width':W,'height':H,'colorSpace':'linear-sRGB','data':rgb.reshape(-1).tolist(),'sourceCommit':PIN}
(OUT/'BioSkinLUT.json').write_text(json.dumps(lut,separators=(',',':')))
(OUT/'BIOSKIN-LICENSE.txt').write_bytes(raw['LICENSE'])
proof={'source':REMOTE,'filesSHA256':hashes,'weightsOnly':True,'upstreamClassExecuted':'Skin2ReflectanceNN','upstreamColorConversion':'ColorSpectrum, BGR explicitly reordered RGB','grid':[W,H],'physicalMapping':{'melanin':'.005+.395*x^2','haemoglobin':'.001+.0215*y','thickness':.015,'oxygenation':.70,'melaninTypeRatio':.74},'fixedSliceNotFullFiveParameterModel':True,'heldOutSamples':len(held),'maxLinearChannelError':float(err.max()),'meanLinearChannelError':float(err.mean()),'outputRange':[float(rgb.min()),float(rgb.max())],'noImportedFaceAssets':True,'noMedicalMeasurement':True,'rgbNotSpectralSceneTransport':True,'lutSHA256':hashlib.sha256((OUT/'BioSkinLUT.json').read_bytes()).hexdigest()}
(OUT/'BIOSKIN_PROOF.json').write_text(json.dumps(proof,indent=2))
print(json.dumps(proof,indent=2))
