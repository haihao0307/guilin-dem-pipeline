from pathlib import Path
import json,numpy as np,gzip,hashlib,time
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import splu
from scipy.sparse.csgraph import dijkstra
R=Path(__file__).resolve().parent;O=R/'research';c=json.loads((R/'baseline/kaopu-unified-human-workbench/assets/canonical.json').read_text());F=np.array(c['faces']).reshape(-1,3);P=np.fromfile(O/'young-final.bin',dtype='<f4').reshape(-1,3).astype(float);N=len(P);BC=len(c['annyRecipes']);protected=np.array(c['protectedHeadIndices'])+BC
E=np.unique(np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),axis=1),axis=0);length=np.linalg.norm(P[E[:,0]]-P[E[:,1]],axis=1);graph=coo_matrix((np.tile(length,2),(np.r_[E[:,0],E[:,1]],np.r_[E[:,1],E[:,0]])),shape=(N,N)).tocsr();ring=np.array(c['bodyRing']+c['headRing']);distance=dijkstra(graph,directed=False,indices=ring,min_only=True)
U=np.flatnonzero((distance<.030)&~np.isin(np.arange(N),protected));A=coo_matrix((np.ones(len(E)*2),(np.r_[E[:,0],E[:,1]],np.r_[E[:,1],E[:,0]])),shape=(N,N)).tocsr();degree=np.asarray(A.sum(1)).ravel();adj=[A.indices[A.indptr[i]:A.indptr[i+1]]for i in range(N)]
rows=np.unique(np.concatenate([U,*[adj[i]for i in U]]));known=np.unique(np.concatenate([rows,*[adj[i]for i in rows]]));known=np.setdiff1d(known,U);print('unknown',len(U),'boundary',len(known),'rows',len(rows),flush=True)
reports=[]
for mode in ['uniform','cotangent']:
 if mode=='uniform':L=diags(np.ones(N))-diags(1/np.maximum(degree,1))@A;W=np.ones(len(rows))
 else:
  rr=[];cc=[];vv=[];area=np.zeros(N)
  for k in range(3):
   i,j,h=F[:,k],F[:,(k+1)%3],F[:,(k+2)%3];a=P[j]-P[i];b=P[h]-P[i];cross=np.linalg.norm(np.cross(a,b),axis=1);cot=np.einsum('ij,ij->i',a,b)/np.maximum(cross,1e-16);rr.extend([j,h]);cc.extend([h,j]);vv.extend([cot*.5,cot*.5]);np.add.at(area,i,cross/6)
  C=coo_matrix((np.concatenate(vv),(np.concatenate(rr),np.concatenate(cc))),shape=(N,N)).tocsr();L=diags(np.asarray(C.sum(1)).ravel())-C;W=1/np.maximum(area[rows],1e-10)
 L=L[rows];Q=(L.T@diags(W)@L).tocsc();Q0=Q[U][:,U].tocsc();QB=Q[U][:,known].toarray();lu=splu(Q0);M=lu.solve(-QB);assert np.isfinite(M).all();print(mode,'rowsum error',abs(M.sum(1)-1).max(),'coefmax',abs(M).max(),flush=True)
 M=M.astype('<f4');payload=U.astype('<u4').tobytes()+known.astype('<u4').tobytes()+M.tobytes();meta={'schema':'kaopu-neck-local-biharmonic/1','mode':mode,'unknownCount':len(U),'boundaryCount':len(known),'topologySha256':c['topologySha256'],'bandGeodesicMetres':.030,'unknown':U.tolist(),'boundary':known.tolist(),'float32RowsumMaxError':float(abs(M.sum(1,dtype=float)-1).max())};(O/f'neck-{mode}.bin').write_bytes(payload);(O/f'neck-{mode}.json').write_text(json.dumps(meta));(O/f'neck-{mode}.bin.gz').write_bytes(gzip.compress(payload,mtime=0))
 for age in ['young','child','old']:
  V=np.fromfile(O/f'{age}-final.bin',dtype='<f4').reshape(-1,3).copy();before=V.copy();V[U]=(M.astype(float)@V[known].astype(float)).astype('<f4');V.tofile(O/f'{age}-{mode}.bin');outside=np.setdiff1d(np.arange(N),U);assert np.array_equal(V[outside],before[outside]);assert np.array_equal(V[protected],before[protected]);reports.append({'mode':mode,'age':age,'maxDisplacementMM':float(np.linalg.norm(V-before,axis=1).max()*1000),'outsideBandExact':True,'protectedFaceExact':True,'bytes':len(payload),'compressedBytes':(O/f'neck-{mode}.bin.gz').stat().st_size})
(O/'neck-probe-report.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))
