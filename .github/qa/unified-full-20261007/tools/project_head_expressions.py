"""Bounded diagnostic projection; measures representability, never copies PCA indices.

All desired fields come from actual native Anny/MHR forwards and the recorded
surface map. The least-squares GNM projection is a candidate comparison, not a
semantic acceptance. Unrepresented channels and residuals remain in the report.
"""
from pathlib import Path
import json,time
import numpy as np
from scipy.linalg import eigh
R=Path(__file__).resolve().parent.parent;P=R/'research/head-channels';G=R/'research/geometry';F=R/'research/registration'
m=json.loads((P/'manifest.json').read_text());n=m['gnm']['vertices'];k=m['gnm']['expressions']
b=np.fromfile(P/'gnm-expression-basis.i8','i1').reshape(k,n,3).astype(float)
b*=np.fromfile(P/'gnm-expression-scales.f32','<f4')[:,None,None]
b=b[:,:,[0,2,1]]*np.array([1,-1,1])
outer=np.array(json.loads((G/'gnm-outer-mask.json').read_text())['outerSkin'])
B=b[:,outer].reshape(k,-1).T;gram=B.T@B
values,vectors=eigh(gram);keep=values>values.max()*1e-10
inverse=(vectors[:,keep]/values[keep])@vectors[:,keep].T
report={'method':'Least-squares projection of actual native source fields onto GNM383, using neutral semantic surface correspondence','pseudoinverseRelativeEigenvalueCutoff':1e-10,'observedGNMBasisRank':int(keep.sum()),'outerVertices':len(outer),'accepted':False,'sources':{}}
for source in ['anny','mhr']:
    reg=np.load(F/f'{source}-outer-default-neutral-registration.npz');assert np.array_equal(outer,reg['sourceNativeIDs'])
    labels=m['sources'][source]['labels'];nv=m['sources'][source]['vertices'];d=np.fromfile(P/f'{source}-expression-deltas.f32','<f4').reshape(len(labels),nv,3).astype(float)
    if source=='mhr':d=d[:,:,[0,2,1]]*np.array([.01,-.01,.01])
    mapped=(d[:,reg['targetNativeTriangleVertices']]*reg['barycentric'][None,:,:,None]).sum(2)
    mapped=mapped@np.linalg.inv(reg['sourceToTargetMatrix'][:3,:3]).T
    coefficients=(inverse@(B.T@mapped.reshape(len(labels),-1).T)).T
    fitted=(coefficients@B.T).reshape(len(labels),len(outer),3)
    full=(coefficients@b.reshape(k,-1)).reshape(len(labels),n,3)
    rows=[]
    for i,label in enumerate(labels):
        magnitude=np.linalg.norm(mapped[i],axis=1);active=magnitude>.0001;err=np.linalg.norm(fitted[i]-mapped[i],axis=1)*1000
        rows.append({'label':label,'mappedResponseVerticesOver0_1mm':int(active.sum()),'mappedMaxMM':float(magnitude.max()*1000),'projectionActiveRMSMM':float(np.sqrt(np.mean(err[active]**2)))if active.any()else None,'projectionActiveP95MM':float(np.quantile(err[active],.95))if active.any()else None,'projectionMaxMM':float(err.max()),'maxAbsGNMCoefficient':float(np.abs(coefficients[i]).max())})
    coefficients.astype('<f4').tofile(P/f'{source}-projected-gnm-coefficients.f32');mapped.astype('<f4').tofile(P/f'{source}-direct-outer-deltas.f32');full.astype('<f4').tofile(P/f'{source}-projected-full-deltas.f32')
    report['sources'][source]=rows
(P/'projection-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'basisRank':int(keep.sum()),'sources':{s:{'maxProjectionMM':max(r['projectionMaxMM']for r in rows),'maxAbsCoefficient':max(r['maxAbsGNMCoefficient']for r in rows),'emptyOuterResponses':[r['label']for r in rows if not r['mappedResponseVerticesOver0_1mm']]}for s,rows in report['sources'].items()}},indent=2))
