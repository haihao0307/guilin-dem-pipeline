"""Independent coupling of normal growth and local edge rest-metric growth.
Conceptual source: Horikawa's MIT HoudiniHowtos differential-growth restlength
control. This is an original geometric relaxation solver, not Vellum execution.
"""
import numpy as np,time,json
from pathlib import Path
from normal_growth import MeshGrowth
from triangle_collision import intersections

class ElasticGrowth(MeshGrowth):
 def initialize_metric(self,rate=.009):
  self.metric_rate=rate;self.metric_rest=np.linalg.norm(self.p[self.e[:,1]]-self.p[self.e[:,0]],axis=1)
  self.metric_backtracks=0;self.metric_transfers=0;self.metric_seconds=0
 def remesh(self):
  if not hasattr(self,'metric_rest'):return super().remesh()
  oldp=self.p.copy();length=np.linalg.norm(oldp[self.e[:,1]]-oldp[self.e[:,0]],axis=1);ratio=self.metric_rest/np.maximum(length,1e-12)
  strain=np.zeros(len(oldp));np.add.at(strain,self.e[:,0],ratio);np.add.at(strain,self.e[:,1],ratio);strain/=np.maximum(self.degree,1)
  self.material_strain=strain
  super().remesh()
  # Carry strain through actual edge splits/collapses. Euclidean nearest-point
  # transfers can confuse two nearby but unrelated folded tissue layers.
  transferred=self.material_strain
  self.metric_rest=np.linalg.norm(self.p[self.e[:,1]]-self.p[self.e[:,0]],axis=1)*np.clip(transferred[self.e].mean(axis=1),.85,1.35)
  self.metric_transfers+=1
 def step(self):
  start=time.monotonic();self.fields()
  if self.t%3==0:self.cast_exposure()
  # The present exposed, upward-facing tissue grows area faster than the side
  # walls. No final leaflet shapes or target vertices are supplied.
  active=np.clip(self.n[:,1],0,1)**2*self.exposure*np.clip(self.activity/.12,0,1)
  active[self.pin]=0
  edge_activity=active[self.e].mean(axis=1)
  lengths=np.linalg.norm(self.p[self.e[:,1]]-self.p[self.e[:,0]],axis=1)
  self.metric_rest=np.minimum(self.metric_rest*(1+self.metric_rate*edge_activity),lengths*1.35)
  original=self.p.copy();candidate=self.p.copy()
  for _ in range(5):
   delta=candidate[self.e[:,1]]-candidate[self.e[:,0]];length=np.linalg.norm(delta,axis=1);force=(length-self.metric_rest)/np.maximum(length,1e-12)*.12
   correction=np.zeros_like(candidate);np.add.at(correction,self.e[:,0],delta*force[:,None]);np.add.at(correction,self.e[:,1],-delta*force[:,None]);correction[self.pin]=0
   size=np.linalg.norm(correction,axis=1);correction*=np.minimum(1,self.detail*.08/np.maximum(size,1e-12))[:,None];candidate+=correction
  move=self.surface_contact_constraints(candidate-original);candidate=original+move
  oldtri=original[self.f];oldcross=np.cross(oldtri[:,1]-oldtri[:,0],oldtri[:,2]-oldtri[:,0]);active_faces=np.any(~self.pin[self.f],axis=1)
  for trial in range(8):
   bad=intersections(candidate,self.f,active_faces);newtri=candidate[self.f];newcross=np.cross(newtri[:,1]-newtri[:,0],newtri[:,2]-newtri[:,0]);turned=np.flatnonzero((np.sum(oldcross*newcross,axis=1)<=np.sum(oldcross*oldcross,axis=1)*.02)|(np.linalg.norm(newcross,axis=1)<self.detail*self.detail*.001))
   if not len(bad) and not len(turned):break
   indices=np.unique(self.f[np.concatenate((bad.ravel(),turned))]);move[indices]*=(.35 if trial<2 else 0);candidate=original+move;self.metric_backtracks+=len(bad)+len(turned)
  else:candidate=original
  self.p=candidate;self.metric_seconds+=time.monotonic()-start
  return super().step()
 def stats(self):
  out=super().stats()
  if hasattr(self,'metric_rest'):out.update(metric_rate=self.metric_rate,metric_backtracks=self.metric_backtracks,metric_transfers=self.metric_transfers,metric_seconds=self.metric_seconds,metric_model='locally increasing edge rest lengths; Jacobi relaxation; scalar strain propagated through mesh edge operations; not Vellum/FEM')
  return out
 def save(self,out):
  super().save(out)
  if hasattr(self,'metric_rest'):
   out=Path(out);d=json.loads(out.read_text());d['metric_rest']=self.metric_rest.tolist();d['metric_rate']=self.metric_rate;out.write_text(json.dumps(d,separators=(',',':')))
