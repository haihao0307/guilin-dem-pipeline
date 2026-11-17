"""Static display assets from frozen original topology, all skin weights and recipes.
No source character/recipe edits. No cloth-simulation or manufacturing claims.
"""
from pathlib import Path
import json,gzip,hashlib,os
import numpy as np
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
INTAKE=Path(os.environ.get('R03_INTAKE',str(ROOT)))
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name,d):(HERE/name).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def flatten(d,prefix=''):
    out={}
    for k,v in d.items():
        key=prefix+k
        if isinstance(v,dict) and 'v' in v:out[key]=v['v']
        elif isinstance(v,dict):out.update(flatten(v,key+'.'))
    return out
lib=read(HERE.parent/'r01/library.json');rows=[]
for old in lib['presets']:
    p=HERE.parent/'r01'/old['paperAsset'];paper=json.loads(gzip.decompress(p.read_bytes()))
    assert paper['recipeHash']==old['recipeHash']
    rows.append({**old,'kind':'original','values':flatten(paper['design']),'sourcePaperSHA256':sha(p)})
tops=[r for r in rows if r['category']=='上装'];bottoms=[r for r in rows if r['category'] in ['裤装','半裙']]
combos=[{'id':a['id']+'-'+b['id'],'name':a['name']+' × '+b['name'],'category':'上下装搭配','kind':'combination','sources':[a['id'],b['id']],'intent':'两套独立原设计的三维穿搭展示；纸样保持各自身份，不冒充合并制版或布料求解。'} for a in tops for b in bottoms]
assert len(rows)==60 and len(combos)==432
save('catalogue.json',{'schema':'kaopu-tailor-display-catalogue@3','baseline':'a9148f6860b9fa9f892b97456f4601c34ea95e04','originalCount':60,'combinationCount':432,'rows':rows,'combinations':combos,'originalLibrarySHA256':sha(HERE.parent/'r01/library.json'),'parameterController':'assistant-authored source recipes; not an autonomous remote service','physicalFitAccepted':False})
body=read(INTAKE/'body-anny-adult.json')
rig=read(INTAKE/'original-anny-rig.json') if (INTAKE/'original-anny-rig.json').exists() else json.loads(gzip.decompress((INTAKE/'original-anny-rig.json.gz').read_bytes()))
rest=np.array(rig['restVertices']).reshape(-1,3);neutral=np.array(rig['neutralBonePoses']).reshape(-1,4,4);restpose=np.array(rig['restBonePoses']).reshape(-1,4,4)
weights=np.array(rig['vertexBoneWeights']).reshape(len(rest),9);bi=np.array(rig['vertexBoneIndices']).reshape(len(rest),9)
labels=rig['boneLabels'];parents=rig['boneParents'];ground=rig['groundTranslationM']
C=np.array([[1.,0,0,0],[0,0,1,ground],[0,-1,0,0],[0,0,0,1]])
poses=C@neutral;sourceposes=poses.copy()
def descendants(root):
    result={root};changed=True
    while changed:
        old=len(result);result.update(i for i,p in enumerate(parents) if p in result);changed=old!=len(result)
    return sorted(result)
def rotate_between(a,b):
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);s=np.linalg.norm(v);c=np.dot(a,b)
    if s<1e-10:return np.eye(3)
    K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]])
    return np.eye(3)+K+K@K*((1-c)/(s*s))
def orient(bone,end,direction):
    i=labels.index(bone);j=labels.index(end);origin=poses[i,:3,3].copy();R=rotate_between(poses[j,:3,3]-origin,np.array(direction,float))
    D=np.eye(4);D[:3,:3]=R;D[:3,3]=origin-R@origin
    for k in descendants(i):poses[k]=D@poses[k]
    return {'bone':bone,'direction':direction,'descendants':len(descendants(i))}
operations=[]
for side,sign in [('L',1),('R',-1)]:
    operations.append(orient('upperarm01.'+side,'lowerarm01.'+side,[sign*.34,-.939,.01]))
    operations.append(orient('lowerarm01.'+side,'wrist.'+side,[sign*.20,-.979,.035]))
    operations.append(orient('upperleg01.'+side,'foot.'+side,[sign*.012,-1,0]))
rv=np.c_[rest,np.ones(len(rest))]
def skin(ps):
    mats=ps@np.linalg.inv(restpose);ans=np.zeros((len(rest),4))
    for k in range(9):ans+=np.einsum('nij,nj->ni',mats[bi[:,k]],rv)*weights[:,k,None]
    return ans[:,:3]
original=skin(sourceposes);measured=np.array(body['positionsMm'])*.001
error=float(np.max(np.linalg.norm(original-measured,axis=1)))*1000
assert error<.001,('original neutral mismatch millimetres',error)
xyz=skin(poses)
yshift=float(xyz[:,1].min());xyz[:,1]-=yshift;poses[:,1,3]-=yshift
armbones=descendants(labels.index('upperarm01.L'))+descendants(labels.index('upperarm01.R'))
armweight=np.sum(weights*np.isin(bi,armbones),axis=1)
torso=(armweight<.10)&(xyz[:,1]>.76)&(xyz[:,1]<1.59)
sections=[]
for y in np.linspace(.70,1.57,175):
    selected=xyz[torso & (np.abs(xyz[:,1]-y)<.021)]
    if not len(selected):selected=xyz[(np.abs(xyz[:,1]-y)<.035)&(armweight<.3)]
    if not len(selected):continue
    sections.append([float(y),float(np.max(np.abs(selected[:,0]))),float(np.max(selected[:,2])),float(np.min(selected[:,2]))])
a=np.array(sections)
for i in range(1,len(a)-1):
    sections[i][1]=float(np.max(a[i-1:i+2,1]));sections[i][2]=float(np.max(a[i-1:i+2,2]));sections[i][3]=float(np.min(a[i-1:i+2,3]))
def joint(s):return poses[labels.index(s),:3,3].tolist()
waist=1.13-yshift;shoulder=(joint('upperarm01.L')[1]+joint('shoulder01.L')[1])*.5
anchors={'waistY':waist,'shoulderY':shoulder,'shoulderX':joint('upperarm01.L')[0],'crotchY':.835-yshift,'armL':[joint(n+'.L') for n in ['upperarm01','upperarm02','lowerarm01','lowerarm02','wrist']],'armR':[joint(n+'.R') for n in ['upperarm01','upperarm02','lowerarm01','lowerarm02','wrist']],'legL':[joint(n+'.L') for n in ['upperleg01','lowerleg01','foot']],'legR':[joint(n+'.R') for n in ['upperleg01','lowerleg01','foot']]}
save('mannequin.json',{'schema':'kaopu-display-mannequin@1','positions':np.round(xyz,6).ravel().tolist(),'indices':np.array(body['triangles']).ravel().tolist(),'height':float(xyz[:,1].max()),'sections':np.round(sections,6).tolist(),'anchors':anchors})
save('MANNEQUIN_MANIFEST.json',{'sourceBodySHA256':sha(INTAKE/'body-anny-adult.json'),'sourceRigSHA256':sha(INTAKE/'original-anny-rig.json.gz'),'sourceModel':body['source'],'vertexCount':len(rest),'triangles':len(body['triangles']),'bones':len(labels),'influencesPerVertex':9,'neutralMaxErrorMm':error,'displayPoseOperations':operations,'groundTranslationOnlyM':yshift,'originalBodyAndRigModified':False,'originalTopologyPreserved':True,'scaleApplied':False,'dynamicWearCertified':False})
print('PREPARED',len(rows),len(combos),'mannequin',anchors,'sourceNeutralErrorMm',error)
