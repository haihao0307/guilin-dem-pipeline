"""Original observation adapter. No external model, detector or teacher execution.

Only visible, reviewed arcs are admitted. Pixel tolerances are reading ranges,
not statistical standard deviations. Intermediate quadrature adds integration
samples, never additional independent photo evidence.
"""
from dataclasses import dataclass
import numpy as np

@dataclass(frozen=True)
class ArcObservations:
    pixels: np.ndarray
    normals: np.ndarray
    weights: np.ndarray
    tolerance: np.ndarray
    parts: np.ndarray
    names: np.ndarray

def observed_arcs(curves, spacing=8.):
    if not np.isfinite(spacing) or spacing <= 0:
        raise ValueError('Positive integration spacing required')
    rows=[]
    for c in curves:
        if c['usage']=='exclude' or not c['silhouette_eligible'] or c['weight']<=0 or not c['points_xy']:
            continue
        p=np.asarray(c['points_xy'],float)
        tol=float(c['tolerance_px']); confidence=float(c['weight']); part=c['part']
        if p.ndim!=2 or p.shape[1]!=2 or not np.isfinite(p).all() or len(p)<2 or not np.isfinite([tol,confidence]).all() or tol<=0:
            raise ValueError('Invalid reviewed curve')
        if part not in ['image_left_arc','image_right_arc','chin']:
            raise ValueError('Unknown physical face region')
        for a,b in zip(p[:-1],p[1:]):
            tangent=b-a; length=float(np.linalg.norm(tangent))
            if length<1e-9: continue
            normal=np.array([-tangent[1],tangent[0]])/length
            axis=1 if part=='chin' else 0
            sign=-1 if part=='image_left_arc' else 1
            if normal[axis]*sign<0: normal=-normal
            count=max(1,int(np.ceil(length/spacing)))
            for t in (np.arange(count)+.5)/count:
                rows.append((a+t*tangent,normal,length/count,tol,part,c['name'],confidence))
    if not rows:
        return ArcObservations(np.empty((0,2)),np.empty((0,2)),np.empty(0),np.empty(0),np.empty(0,dtype=object),np.empty(0,dtype=object))
    parts=np.array([r[4] for r in rows],dtype=object)
    length=np.array([r[2] for r in rows]); conf=np.array([r[6] for r in rows])
    weights=np.empty(len(rows))
    # One budget for a physical region, including separated visible fragments.
    # Midpoint quadrature has no duplicate shared-endpoint observations.
    for part in set(parts):
        sel=parts==part
        weights[sel]=length[sel]*conf[sel]/length[sel].sum()
    return ArcObservations(np.stack([r[0] for r in rows]),np.stack([r[1] for r in rows]),weights,np.array([r[3] for r in rows]),parts,np.array([r[5] for r in rows],dtype=object))

def closest_support(samples, observed, max_distance=80.):
    indices=[]; gaps=[]
    for target,part in zip(observed.pixels,observed.parts):
        ids=np.flatnonzero((samples.regions==part)&(samples.kinds=='silhouette'))
        if not len(ids):raise ValueError('No visible native silhouette for '+part)
        ds=np.linalg.norm(samples.pixels[ids]-target,axis=1)
        k=int(np.argmin(ds))
        if ds[k]>max_distance:raise ValueError('Correspondence outside explicit gate')
        indices.append(ids[k]);gaps.append(ds[k])
    return np.array(indices),np.array(gaps)

def normal_errors(projected, observed):
    p=np.asarray(projected,float)
    if p.shape!=observed.pixels.shape or not np.isfinite(p).all():raise ValueError('Invalid projection')
    return np.einsum('ni,ni->n',p-observed.pixels,observed.normals)

def summary(errors, observed):
    out={}
    for part in sorted(set(observed.parts)):
        sel=observed.parts==part;e=np.asarray(errors)[sel];w=observed.weights[sel]
        out[part]={'integrationSamples':int(sel.sum()),'weightBudget':float(w.sum()),'signedMeanPixels':float(np.average(e,weights=w)), 'rmsPixels':float(np.sqrt(np.average(e*e,weights=w))), 'maxAbsPixels':float(np.max(np.abs(e))), 'outsideReadingBandWeight':float(w[np.abs(e)>observed.tolerance[sel]].sum()/w.sum())}
    return out
