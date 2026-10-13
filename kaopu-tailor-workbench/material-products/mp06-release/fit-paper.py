import json,numpy as np,time,sys
from scipy.optimize import minimize
from pathlib import Path
start=time.time();root=Path(sys.argv[1]);look=sys.argv[2];d=json.loads((root/'fitting'/f'{look}-input.json').read_text());receipt=[]
for row in d['rows']:
 p=np.array(row['positions']).reshape(-1,3);off=0
 for pan in row['packet']['spec']['panels']:
  old=np.array(pan['uvMm'])/1000;u0=old.copy();xyz=p[off:off+len(old)];off+=len(old);tri=np.array(pan['triangles']);edges=np.unique(np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1),axis=0);a,b=edges.T;target=np.linalg.norm(xyz[a]-xyz[b],axis=1);inv=1/np.maximum(target,1e-5);ta,tb,tc=tri.T;U=u0[tb]-u0[ta];V=u0[tc]-u0[ta];area=U[:,0]*V[:,1]-U[:,1]*V[:,0];sgn=np.sign(area);scale=np.maximum(abs(area),1e-8)
  def fn(flat):
   u=flat.reshape(-1,2);du=u[a]-u[b];length=np.maximum(np.linalg.norm(du,axis=1),1e-9);r=(length-target)*inv;g=np.zeros_like(u);gr=du*(2*r*inv/length)[:,None];np.add.at(g,a,gr);np.add.at(g,b,-gr)
   U=u[tb]-u[ta];V=u[tc]-u[ta];A=sgn*(U[:,0]*V[:,1]-U[:,1]*V[:,0]);pen=np.minimum(0,A/scale-.03);coef=2*pen*sgn/scale*5
   gb=np.column_stack([V[:,1],-V[:,0]])*coef[:,None];gc=np.column_stack([-U[:,1],U[:,0]])*coef[:,None];np.add.at(g,tb,gb);np.add.at(g,tc,gc);np.add.at(g,ta,-gb-gc)
   reg=(u-u0)*.01;g+=2*reg*.01
   return (r@r+5*(pen@pen)+np.sum(reg*reg)),g.ravel()
  opt=minimize(fn,u0.ravel(),jac=True,method='L-BFGS-B',options={'maxiter':500,'gtol':1e-7,'ftol':1e-10,'maxcor':15});u=opt.x.reshape(-1,2);lens=np.linalg.norm(u[a]-u[b],axis=1);rat=target/lens;U=u[tb]-u[ta];V=u[tc]-u[ta];cross=(U[:,0]*V[:,1]-U[:,1]*V[:,0])*sgn
  receipt.append({'panel':pan['id'],'minRatio':float(min(rat)),'maxRatio':float(max(rat)),'flips':int(np.sum(cross<=0)),'iterations':opt.nit,'converged':bool(opt.success),'residual':float(opt.fun)});print(receipt[-1],flush=True);pan['uvMm']=(u*1000).tolist()
assert all(r['flips']==0 and r['maxRatio']<=1.35 for r in receipt),'Cannot flatten new rest drape safely'
d['paperFit']={'method':'R05 rest drape edge metric flattening with original panel orientation and seam graph','receipt':receipt,'wallSeconds':time.time()-start,'sourcePaperUnchanged':False}
for row in d['rows']:
 row['packet']['r05Fit']={'parentPaperSHA256':row['packet']['binding'].get('paperSHA256'),'sourceBody':'9b6644b3210e5ee5f9b4e7fbb583dec98e90b285','method':d['paperFit']['method'],'oldPaperUnchanged':False,'samePanelCount':True,'sameSeamGraph':True,'tailoringCalibration':'engineering fit, not manufacturing certification'}
 row['packet']['record']['staticGate']={'passed':False,'reason':'new R05 fit requires new coupled contact solve'}
(root/'fitting'/f'{look}.json').write_text(json.dumps(d,separators=(',',':')));print('DONE',time.time()-start)
