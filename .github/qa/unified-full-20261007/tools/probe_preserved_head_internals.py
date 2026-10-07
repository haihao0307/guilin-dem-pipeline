"""Candidate native-field transfer with authored GNM cavities and dentition.

Exterior maps are fixed and layer constrained. Cavity deltas solve a fixed
positive graph Laplacian with exterior Dirichlet data. Jaw rigid motion is fit
to the chin's actual transferred field. This is a local quality probe, not a
claim that source dentition or all facial functionality has been reproduced.
"""
import os
os.environ.setdefault('MPLCONFIGDIR','/tmp/common-head-mpl')
from pathlib import Path
import argparse,json,numpy as np,trimesh
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import spsolve
R=Path(__file__).resolve().parent.parent;P=R/'research/head-channels';D=R/'research/geometry';F=R/'research/registration';parser=argparse.ArgumentParser();parser.add_argument('--version',default='r3');args=parser.parse_args();O=P/('semantic-'+args.version);O.mkdir(exist_ok=True)
m=json.loads((P/'manifest.json').read_text());v=np.fromfile(D/'gnm-vertices.f32','<f4').reshape(-1,3).astype(float)[:,[0,2,1]]*[1,-1,1];f=np.fromfile(D/'gnm-faces.u32','<u4').reshape(-1,3);comp=np.fromfile(D/'gnm-components.u32','<u4');region=np.fromfile(D/'gnm-regions.u32','<u4');mask=json.loads((D/'gnm-outer-mask.json').read_text());outer=np.array(mask['outerSkin']);sf=f[(comp[f]==0).all(1)];edges=np.unique(np.sort(np.concatenate([sf[:,[0,1]],sf[:,[1,2]],sf[:,[2,0]]]),axis=1),axis=0);weights=1/np.maximum(np.linalg.norm(v[edges[:,0]]-v[edges[:,1]],axis=1),1e-10);A=coo_matrix((np.r_[weights,weights],(np.r_[edges[:,0],edges[:,1]],np.r_[edges[:,1],edges[:,0]])),shape=(len(v),len(v))).tocsr();L=diags(np.asarray(A.sum(1)).ravel())-A
operators=[]
for name,ids in mask['preservedCavities'].items():
 ids=np.array(ids);boundary=np.setdiff1d(np.unique(A[ids].indices),ids);operator=-spsolve(L[ids][:,ids].tocsc(),L[ids][:,boundary].toarray());assert np.max(np.abs(operator.sum(1)-1))<1e-10;operators.append((name,ids,boundary,operator));np.savez_compressed(O/(name+'-extension.npz'),ids=ids,boundary=boundary,weights=operator.astype('<f4'))
def rigid(a,b):
 ca=a.mean(0);cb=b.mean(0);u,_,vt=np.linalg.svd((a-ca).T@(b-cb));r=vt.T@u.T
 if np.linalg.det(r)<0:vt[-1]*=-1;r=vt.T@u.T
 return r,cb-r@ca
rows=[]
for source in ['anny','mhr']:
 reg=np.load(F/f'{source}-semantic-{args.version}-neutral-registration.npz');assert np.array_equal(outer,reg['sourceNativeIDs']);labels=m['sources'][source]['labels'];nv=m['sources'][source]['vertices'];d=np.fromfile(P/f'{source}-expression-deltas.f32','<f4').reshape(len(labels),nv,3).astype(float)
 if source=='mhr':d=d[:,:,[0,2,1]]*[.01,-.01,.01]
 desired=(d[:,reg['targetNativeTriangleVertices']]*reg['barycentric'][None,:,:,None]).sum(2)@np.linalg.inv(reg['sourceToTargetMatrix'][:3,:3]).T
 full=np.zeros((len(labels),len(v),3));full[:,outer]=desired
 for _,ids,boundary,operator in operators:full[:,ids]=np.einsum('ib,abc->aic',operator,full[:,boundary])
 chin=np.flatnonzero(region==19)
 for i,label in enumerate(labels):
  rot,t=rigid(v[chin],v[chin]+full[i,chin]);lower=comp==4;full[i,lower]=v[lower]@rot.T+t-v[lower]
  # Tongue starts with the same inferred jaw motion. Independent Anny tongue
  # articulation will be a separate native component transfer, not this fit.
  tongue=comp==5;full[i,tongue]=v[tongue]@rot.T+t-v[tongue]
  rows.append({'source':source,'label':label,'exteriorMaxMM':float(np.linalg.norm(desired[i],axis=1).max()*1000),'jawRotationDegrees':float(np.degrees(np.arccos(np.clip((np.trace(rot)-1)/2,-1,1)))),'cavitiesFinite':bool(np.isfinite(full[i]).all()),'tongueIndependentDriverPresent':False,'eyeGazeDriverPresent':False})
 full.astype('<f4').tofile(O/f'{source}-full-deltas.f32');desired.astype('<f4').tofile(O/f'{source}-outer-deltas.f32')
 # Export real combinations; nonlinear rigid fitting occurs after combining
 # the source fields, rather than blending fitted rigid transforms.
 for case in [x for x in m['cases']if x['teacher']==source and 'adult-'in x['id']]:
  actions=case.get('actions',case.get('expression'));coeff=np.array([actions.get(n,0)for n in labels]);delta=np.zeros_like(v);delta[outer]=np.einsum('a,avc->vc',coeff,desired)
  for _,ids,boundary,operator in operators:delta[ids]=operator@delta[boundary]
  rot,t=rigid(v[chin],v[chin]+delta[chin]);lower=(comp==4)|(comp==5);delta[lower]=v[lower]@rot.T+t-v[lower];(v+delta).astype('<f4').tofile(O/(case['id']+'-gnm.f32'))
(O/'report.json').write_text(json.dumps({'stage':'component-preserving dynamic probe','cavityCount':sum(len(x[1])for x in operators),'cavityOperators':[{'name':n,'vertices':len(i),'boundary':len(b),'entries':w.size}for n,i,b,w in operators],'fixedSemanticMap':True,'runtimeNearestSearch':False,'accepted':False,'remaining':['Independent gaze/eye contact','Native Anny tongue articulation','Age and mixed extreme expressions','Cross-component intersections'],'channels':rows},indent=2));print({'cavityVertices':sum(len(x[1])for x in operators),'nativeSourceChannels':len(rows),'accepted':False})
