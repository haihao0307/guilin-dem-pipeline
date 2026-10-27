"""Analytic wheelset teaching profiles, not source fits or finished tread standards.
Nominal radii/axle spacing documentary; spoke count/profiles/lateral position inferred.
"""
import numpy as np
CONFIG={'axles_z':[5.7912,3.8862,2.2098,0,-2.2098,-5.1054], 'radii':[.4826,.4826,1.016,1.016,1.016,.5588], 'contact_x':.7175,'tire_half_width':.07,'flange_width':.024,'flange_height':.025,'tire_depth':.065,'hub_radius_fraction':.17,'spoke_counts':[12,12,20,20,20,12],'spoke_half_depth':.035,'shaft_radius':.07,'driver_journal_radius':.10,
 'status':'own inferred editable wheel centres and tyre/flange profiles; not an as-built A4 profile or verified spoke count',
 'teacher_photo':'https://blog.railwaymuseum.org.uk/wp-content/uploads/sites/9/2016/07/wc-6june-Malcolm-Bateman-and-Malcolm-Hutton-removing-paint-from-the-leading-coupled-wheelset.jpg',
 'photo_verified':'Viewed actual official NRM image: separate tyre/rim, tapered spokes, hub, stepped axle; count not independently verified',
 'inferred':['spoke counts','spoke profile','tyre width/taper/flange','lateral wheel registration','hub profile','balance-weight shapes omitted pending evidence'],
 'documentary':['1935 nominal wheel diameters','1935 longitudinal six-axle chain']}

def fields(points,theta=0,c=CONFIG):
 p=np.atleast_2d(points).astype(float);out={}
 for i,(z,r)in enumerate(zip(c['axles_z'],c['radii'])):
  yy=p[:,1]-r;zz=p[:,2]-z;rho=np.hypot(yy,zz);ang=np.arctan2(yy,zz)-theta
  for side in [-1,1]:
   x=side*c['contact_x'];xx=p[:,0]-x;depth=abs(xx);name=f'axle{i}_'+('left'if side<0 else'right')
   # Radius is nominal tread, not source outer flange radius.
   tyre=np.maximum(np.maximum(rho-r,(r-c['tire_depth'])-rho),depth-c['tire_half_width'])
   flange_x=x-side*(c['tire_half_width']-c['flange_width']/2)
   flange=np.maximum(np.maximum(rho-(r+c['flange_height']),(r-c['tire_depth'])-rho),abs(p[:,0]-flange_x)-c['flange_width']/2)
   hubr=r*c['hub_radius_fraction'];hub=np.maximum(rho-hubr,depth-.085)
   n=c['spoke_counts'][i];period=2*np.pi/n;fold=(ang+period/2)%period-period/2;along=rho*np.cos(fold);across=rho*np.sin(fold);u=np.clip((along-hubr)/(r-c['tire_depth']-hubr),0,1);halfwidth=.05*(1-u)+.022*u
   spokes=np.maximum.reduce([abs(across)-halfwidth,hubr*.8-along,along-(r-c['tire_depth']*.5),depth-c['spoke_half_depth']])
   out[name+'_tyre']=tyre;out[name+'_flange']=flange;out[name+'_hub']=hub;out[name+'_spokes']=spokes
  if i!=3:out[f'axle{i}_straight_axle']=np.maximum(rho-(c['driver_journal_radius']if i in [2,4]else c['shaft_radius']),abs(p[:,0])-c['contact_x'])
 # D2 centre deliberately absent: driving_crank_assembly owns journals, webs and offset pin.
 return out
