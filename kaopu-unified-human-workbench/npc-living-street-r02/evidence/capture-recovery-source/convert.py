"""Bounded CMU capture conversion. No meshes or measured finger-motion claims.
The old 16_57 conversion is independently reproduced on every captured body joint.
"""
from pathlib import Path
import json,re,hashlib,urllib.request
import numpy as np
from scipy.spatial.transform import Rotation
ROOT=Path(__file__).resolve().parent
RAW=ROOT/'source'

def skeleton(path):
    text=path.read_text();bones={};parents={}
    for chunk in re.findall(r'\bbegin\s+(.*?)\bend\b',text.split(':bonedata')[1].split(':hierarchy')[0],re.S):
        d={s.split()[0]:s.split()[1:] for s in chunk.splitlines() if s.strip()}
        bones[d['name'][0]]={'direction':np.array(d['direction'],float),'length':float(d['length'][0]),'axis':np.array(d['axis'][:3],float),'dof':d.get('dof',[])}
    for line in text.split(':hierarchy')[1].splitlines():
        a=line.split()
        if a and a[0] not in ['begin','end']:
            for child in a[1:]:parents[child]=a[0]
    return bones,parents

def motion(path):
    frames=[]
    for line in path.read_text().splitlines():
        a=line.split()
        if not a or a[0].startswith(('#',':')):continue
        if a[0].isdigit():frames.append({})
        else:frames[-1][a[0]]=np.array(a[1:],float)
    return frames

def positions(bones,parents,frames,names):
    C={k:Rotation.from_euler('xyz',v['axis'],degrees=True).as_matrix() for k,v in bones.items()};order=[]
    while len(order)<len(bones):
        old=len(order)
        for name in bones:
            if name not in order and (parents[name]=='root' or parents[name] in order):order.append(name)
        if len(order)==old:raise ValueError('Cyclic source skeleton')
    out=[];unit=.0254/.45
    for frame in frames:
        M={'root':Rotation.from_euler('xyz',frame['root'][3:],degrees=True).as_matrix()};P={'root':frame['root'][:3]*unit}
        for name in order:
            b=bones[name];angles=np.zeros(3)
            # CMU says its finger/thumb channels are unmeasured. Ignore them.
            if not name.endswith(('thumb','fingers')):
                for d,v in zip(b['dof'],frame.get(name,[])):angles['xyz'.index(d[-1])]=v
            R=Rotation.from_euler('xyz',angles,degrees=True).as_matrix();M[name]=M[parents[name]]@C[name]@R@C[name].T
            P[name]=P[parents[name]]+M[name]@b['direction']*b['length']*unit
        out.append([P[n] for n in names])
    return np.asarray(out)

def contact_windows(mask):
    a=mask.copy()
    # Close only short internal gaps, then discard sub-40ms impulses.
    for i in range(1,len(a)-4):
        if a[i-1] and not a[i]:
            ids=np.flatnonzero(a[i:i+4])
            if len(ids):a[i:i+ids[0]]=True
    changes=np.diff(np.r_[False,a,False].astype(int));return [{'startFrame':int(s),'endFrame':int(e-1)} for s,e in zip(np.flatnonzero(changes==1),np.flatnonzero(changes==-1)) if e-s>=5]

def choose_cycle(P,names,kind):
    ix={n:i for i,n in enumerate(names)};hip=(P[:,ix['lhipjoint']]+P[:,ix['rhipjoint']])*.5
    joint_names=['lfemur','ltibia','ltoes','rfemur','rtibia','rtoes','lhumerus','lradius','rhumerus','rradius','thorax','head']
    rel=P[:,[ix[n] for n in joint_names]]-hip[:,None,:];vel=np.gradient(rel,axis=0)*120
    speed=np.linalg.norm(np.gradient(hip[:,[0,2]],axis=0)*120,axis=1);mean=np.median(speed)
    lo,hi=(95,180) if kind=='walk' else (52,110)
    candidates=[]
    for a in range(24,len(P)-lo-10):
        for b in range(a+lo,min(a+hi,len(P)-8)):
            travel=np.linalg.norm((hip[b]-hip[a])[[0,2]])
            if travel<(.65 if kind=='walk' else .9) or min(speed[a],speed[b])<mean*.65:continue
            error=np.mean((rel[a]-rel[b])**2)+.0005*np.mean((vel[a]-vel[b])**2)+.001*(speed[a]-speed[b])**2
            candidates.append((error,a,b))
    if not candidates:raise ValueError('No defensible full-stride cycle: '+kind)
    error,a,b=min(candidates)
    return {'startFrame':a,'endFrame':b,'tailBlendFrames':min(18,(b-a)//6),'sourcePositionScore':error,'method':'same-limb full-stride pose plus velocity agreement; overlap with recorded pre-start frames, not end-stop replay','periodSeconds':(b-a)/120}

def convert(clip,label,kind,names):
    subject=clip.split('_')[0];b,p=skeleton(RAW/(subject+'.asf'));f=motion(RAW/(clip+'.amc'));P=positions(b,p,f,names);ix={n:i for i,n in enumerate(names)}
    heights=np.concatenate([P[:,ix[s+k],1] for s in ['l','r'] for k in ['foot','toes']]);floor=float(np.quantile(heights,.012));contacts={}
    for s in ['l','r']:
        foot=P[:,ix[s+'foot']];toe=P[:,ix[s+'toes']];gap=np.minimum(foot[:,1],toe[:,1])-floor
        v1=np.linalg.norm(np.gradient(foot[:,[0,2]],axis=0)*120,axis=1);v2=np.linalg.norm(np.gradient(toe[:,[0,2]],axis=0)*120,axis=1)
        speed=np.minimum(v1,v2);mask=(gap<.045)&(speed<(.9 if kind=='run' else .6))
        contacts[s]=contact_windows(mask)
        if not contacts[s]:raise ValueError('No support evidence '+clip+' '+s)
    packet={'schema':'cmu-captured-source-positions/1','clip':clip,'label':label,'sourceURL':'http://mocap.cs.cmu.edu/subjects/'+subject+'/'+clip+'.amc','sourceSkeleton':'http://mocap.cs.cmu.edu/subjects/'+subject+'/'+subject+'.asf','licenceReference':'https://mocap.cs.cmu.edu/','credit':'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.','sourceAMC_SHA256':hashlib.sha256((RAW/(clip+'.amc')).read_bytes()).hexdigest(),'sourceASF_SHA256':hashlib.sha256((RAW/(subject+'.asf')).read_bytes()).hexdigest(),'fps':120,'names':names,'points':P.round(8).tolist(),'floorY':floor,'contacts':contacts,'contactMethod':'source foot/toe height and planar velocity; small-gap closure; target support requires separate verification','fingerCapture':False}
    if kind in ['walk','run']:packet['cycle']=choose_cycle(P,names,kind)
    # Upper-body native retarget reference chosen from the least moving upright
    # source frame, not arbitrarily from an elevated stretch endpoint.
    vector=P[:,ix['thorax']]-((P[:,ix['lhipjoint']]+P[:,ix['rhipjoint']])*.5)
    packet['referenceFrame']=int(np.argmax(vector[:,1]/np.maximum(1e-6,np.linalg.norm(vector,axis=1))))
    (ROOT/(clip+'-SOURCE.json')).write_text(json.dumps(packet,separators=(',',':')))
    return {'clip':clip,'label':label,'frames':len(P),'duration':(len(P)-1)/120,'cycle':packet.get('cycle'),'contacts':contacts,'sourceAMC_SHA256':packet['sourceAMC_SHA256']}

def main():
    RAW.mkdir(exist_ok=True)
    for clip in ['143_01','143_32','143_25','143_30']:
        dest=RAW/(clip+'.amc')
        if not dest.exists():
            url='http://mocap.cs.cmu.edu/subjects/143/'+clip+'.amc'
            with urllib.request.urlopen(url,timeout=60) as r:dest.write_bytes(r.read())
    ref=json.loads((ROOT.parent/'full/activity-r01/16_57-SOURCE.json').read_text());names=ref['names'];b,p=skeleton(RAW/'16.asf');test=positions(b,p,motion(RAW/'16_57.amc'),names)
    measured=[i for i,n in enumerate(names) if not n.endswith(('thumb','fingers'))];error=float(np.max(np.abs(test[:,measured]-np.asarray(ref['points'])[:,measured])))
    assert error<1e-9,('Recorded body conversion disagrees',error)
    records=[convert(*args,names) for args in [('143_32','Walk','walk'),('143_01','Run','run'),('143_25','Waving','gesture'),('143_30','Stretch And Yawn','gesture')]]
    (ROOT/'SOURCE_REPORT.json').write_text(json.dumps({'bodyReproductionMaxErrorM':error,'fingerThumbMotionIgnored':True,'records':records,'terms':'CMU permits inclusion in products but not direct resale of original/converted data. This is a non-sale interactive workbench, not a motion dataset for sale.'},indent=2))
    print(json.dumps(records,indent=2))
if __name__=='__main__':main()
