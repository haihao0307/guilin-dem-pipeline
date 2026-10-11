"""Original bounded shared-shape/independent-expression least squares.
Inputs are verified native finite differences and private image observations.
No upstream model or implementation is imported. Holdout coordinates are absent.
"""
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation

TRAIN_IDS=(36,39,42,45,30,31,35,48,54,62,66)
MOUTH_IDS=(48,54,62,66)

def project_saved(world,camera):
    w=np.asarray(world,float)
    P=np.asarray(camera['projection']).reshape(4,4).T
    W=np.asarray(camera['cameraWorld']).reshape(4,4).T
    q=np.c_[w,np.ones(len(w))]@(P@np.linalg.inv(W)).T
    if np.any(q[:,3]<=0) or not np.isfinite(q).all():raise ValueError('Nonpositive camera depth')
    ndc=q[:,:3]/q[:,3,None];width,height=camera['canvas']
    canvas=np.c_[(ndc[:,0]+1)*width/2,(1-ndc[:,1])*height/2]
    scale,dx,dy=camera['photoToCanvas']
    return (canvas-[dx,dy])/scale

class NativeResponse:
    def __init__(self, rows, cameras, actions, shared_axis='mouth-trans-up'):
        self.ids=tuple(cameras); self.cameras=cameras;self.actions=actions; self.axis=shared_axis
        rows={r['id']:r for r in rows};self.base={};self.shape={};self.expression={};self.all_shape={}
        for photo in self.ids:
            xyz=lambda suffix:np.array([q['world'] for q in rows[photo+'/'+suffix]['landmarks']],float)
            self.base[photo]=xyz('base');self.all_shape[photo]={}
            for axis in ['mouth-trans-up','mouth-upperlip-height-incr','mouth-upperlip-volume-incr','mouth-cupidsbow-width-incr']:
                self.all_shape[photo][axis]=(xyz(axis+'/1')-xyz(axis+'/-1'))/.2
            self.shape[photo]=self.all_shape[photo][shared_axis]
            self.expression[photo]=np.stack([(xyz(axis+'/1')-xyz(axis+'/-1'))/.08 for axis in ['mouthSmileLeft','mouthSmileRight']],axis=0)
        self.scales=np.array([.20]+[.08]*(2*len(self.ids)))
        self.lower=np.full(len(self.scales),-1.);self.upper=np.full(len(self.scales),1.)
        for k,photo in enumerate(self.ids):
            for j,axis in enumerate(['mouthSmileLeft','mouthSmileRight']):
                a=actions[photo][axis];i=1+k*2+j;self.lower[i]=max(-1.,-a/.08);self.upper[i]=min(1.,(.35-a)/.08)
    def world(self,photo,x):
        k=self.ids.index(photo);d=np.asarray(x)*self.scales
        return self.base[photo]+d[0]*self.shape[photo]+np.einsum('i,ijk->jk',d[1+2*k:3+2*k],self.expression[photo])
    def predict(self,photo,x,cameras=None):return project_saved(self.world(photo,x),(cameras or self.cameras)[photo])
    def normalized_residual(self,x,observations,cameras=None):
        out=[]
        for photo in self.ids:
            o=observations[photo];uv=self.predict(photo,x,cameras);target=np.array([o[str(i)][:2]for i in TRAIN_IDS]);error=np.array([o[str(i)][2]for i in TRAIN_IDS])[:,None]
            out.extend(((uv[list(TRAIN_IDS)]-target)/error).ravel())
        return np.array(out)
    def solve(self,observations,allow_shared=True,cameras=None):
        n=len(self.scales);active=np.arange(n)if allow_shared else np.arange(1,n)
        def expand(v):
            x=np.zeros(n);x[active]=v;return x
        def loss(v):
            x=expand(v);return np.r_[self.normalized_residual(x,observations,cameras),.2*x]
        fit=least_squares(loss,np.zeros(len(active)),bounds=(self.lower[active],self.upper[active]),loss='soft_l1',f_scale=1.,xtol=1e-11,ftol=1e-11,gtol=1e-11,max_nfev=250)
        x=expand(fit.x);return {'x':x.tolist(),'delta':(x*self.scales).tolist(),'cost':float(fit.cost),'success':bool(fit.success),'activeBounds':[int(i)for i in active if abs(x[i]-self.lower[i])<1e-5 or abs(x[i]-self.upper[i])<1e-5],'scope':'Conditional fit under saved camera, with reading boxes used as loss scales, not statistical sigma.'}
    def per_photo_metrics(self,x,observations,cameras=None):
        result={}
        for photo in self.ids:
            p=self.predict(photo,x,cameras);o=observations[photo]; result[photo]={}
            for name,ids in [('training',TRAIN_IDS),('mouthTraining',MOUTH_IDS)]:
                target=np.array([o[str(i)][:2]for i in ids]);err=np.array([o[str(i)][2]for i in ids])[:,None];d=p[list(ids)]-target
                result[photo][name]={'rmsPixelDistance':float(np.sqrt(np.mean(np.sum(d*d,axis=1)))),'weightedRMS':float(np.sqrt(np.mean((d/err)**2))),'outsideReadingBoxCoordinates':int(np.sum(np.abs(d)>err)),'residualPixels':d.tolist()}
        return result
    def identifiability(self,observations):
        shape=[];nuisance=[];blocks=[]
        for k,photo in enumerate(self.ids):
            p=self.base[photo];cam=self.cameras[photo];err=np.repeat([observations[photo][str(i)][2]for i in TRAIN_IDS],2)
            project=lambda w:project_saved(w,cam)[list(TRAIN_IDS)].ravel()
            s=(project(p+.1*self.shape[photo])-project(p-.1*self.shape[photo]))/.2*.2/err;shape.extend(s)
            cols=[]
            for e in self.expression[photo]:cols.append((project(p+.04*e)-project(p-.04*e))/.08*.08/err)
            center=p[list(TRAIN_IDS)].mean(0)
            for axis in np.eye(3):
                cols.append((project((p-center)@Rotation.from_rotvec(axis*.01).as_matrix().T+center)-project((p-center)@Rotation.from_rotvec(-axis*.01).as_matrix().T+center))/.02*np.deg2rad(2)/err)
                cols.append((project(p+axis*.001)-project(p-axis*.001))/.002*.002/err)
            # Focal change about the saved principal point; this does not assume known intrinsics.
            foc=[]
            for sign in [-1,1]:
                c=dict(cam);P=np.array(cam['projection']).reshape(4,4).T.copy();P[0,0]*=1+sign*.01;P[1,1]*=1+sign*.01;c['projection']=P.T.ravel().tolist();foc.append(project_saved(p,c)[list(TRAIN_IDS)].ravel())
            cols.append((foc[1]-foc[0])/.02*.2/err)
            for axis in np.eye(2):cols.append(np.tile(axis*5.,len(TRAIN_IDS))/err)
            blocks.append(np.stack(cols,axis=1))
        n=sum(b.shape[0]for b in blocks);m=sum(b.shape[1]for b in blocks);N=np.zeros((n,m));r=c=0
        for b in blocks:N[r:r+b.shape[0],c:c+b.shape[1]]=b;r+=b.shape[0];c+=b.shape[1]
        S=np.array(shape);U,s,_=np.linalg.svd(N,full_matrices=False);rank=np.sum(s>s.max()*1e-9);res=S-U[:,:rank]@(U[:,:rank].T@S)
        return {'shapeAllowedStep':.2,'shapeWeightedNorm':float(np.linalg.norm(S)),'afterCameraExpressionProjectionNorm':float(np.linalg.norm(res)),'independentNormFraction':float(np.linalg.norm(res)/np.linalg.norm(S)),'nuisanceRank':int(rank),'nuisanceColumns':m,'nuisanceSingularValues':s.tolist(),'meaning':'Linear local sensitivity after removing nuisance response span. Not a confidence interval, physical identifiability proof or likeness score.'}
