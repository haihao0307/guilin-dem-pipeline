"""Central driving crank axle and three rod eyes, independently generated fields.
Replaces incorrect continuous straight D2 centre. This is a parameterised teaching
assembly, not manufacturing geometry, exact A4 crank phasing or stress validation.
"""
import numpy as np
CONFIG={'axis_y':1.016,'crank_radius':.3302,'inner_phase':1.7,'phases':[0,1.7,4.3],'inclinations':[0,.11,0],'lateral':[-.82,0,.82],'rod_length':3.5,
 'inner_pin_radius':.10795,'inner_pin_half_length':.0762,'outer_pin_radius':.06985,'shaft_radius':.10,'web_x':.1012,'web_half_thickness':.025,'web_radius':.125,'wheel_x':.78,
 'small_pin_radius':.046,'small_bore_radius':.050,'small_bushing_outer':.065,'bushing_wall':.009,'running_clearance':.001,'rod_eye_margin':.023,'rod_half_width':.045,'inner_rod_half_thickness':.055,'outside_rod_half_thickness':.022,
 'evidence':{'inner_pin_radius_and_length':'The Engineer 1935 p320 Crank pins Inside 8.5in by6in, visually read from enlarged original; radius=.10795m, half-length=.0762m','outer_pin_radius':'1935 outside crank pin5.5in diameter, radius.06985m; not coupling pin','crank_radius':'1935 26in stroke /2','topology':'NRM update5 identifies inside big-end crank webs and removable temporary crank-axle support'},
 'inferred':['actual crank phases','inclination','rod length','all lateral registration','web outline and thickness','axle journal profile','clearance','rod body and eye profile','small pin diameter','bushing dimensions'],
 'coupling_lateral':.91,'coupling_pin_radius':.04,'coupling_bore_radius':.041,'coupling_eye_outer':.075,'coupling_half_thickness':.012,'coupling_stack_offset':.018,'driver_axle_z':[2.2098,0,-2.2098],
 'source_model_used':False}

def cylx(p,yz,x,half,r):return np.maximum(np.linalg.norm(p[:,1:]-np.array(yz),axis=1)-r,abs(p[:,0]-x)-half)
def flat_capsule(p,a,b,x,half,r):
 v=np.array(b)-np.array(a);q=p[:,1:]-a;t=np.clip((q@v)/(v@v),0,1)
 return np.maximum(np.linalg.norm(q-t[:,None]*v,axis=1)-r,abs(p[:,0]-x)-half)
def pose(t,i,c=CONFIG):
 a=t+c['phases'][i];inc=c['inclinations'][i];r=c['crank_radius'];L=c['rod_length'];b=np.array([r*np.sin(a),r*np.cos(a)]);u=np.array([np.sin(inc),np.cos(inc)]);h=b@u;perp=b[0]*u[1]-b[1]*u[0];s=u*(h+np.sqrt(L*L-perp*perp));return b+[c['axis_y'],0],s+[c['axis_y'],0]
def fields(points,t,c=CONFIG):
 p=np.atleast_2d(points).astype(float);origin=np.array([c['axis_y'],0]);b,_=pose(t,1,c);wx=c['web_x'];wh=c['web_half_thickness'];span=c['wheel_x']-(wx+wh);sol={}
 shafts=[cylx(p,origin,sgn*((wx+wh)+span/2),span/2,c['shaft_radius']) for sgn in [-1,1]]
 webs=[flat_capsule(p,origin,b,sgn*wx,wh,c['web_radius']) for sgn in [-1,1]]
 sol['D2_two_side_axle_journals']=np.min(shafts,axis=0);sol['D2_inside_crank_webs']=np.min(webs,axis=0);sol['D2_offset_crank_pin']=cylx(p,b,0,c['inner_pin_half_length'],c['inner_pin_radius'])
 for i,label in enumerate(['left','middle','right']):
  b,s=pose(t,i,c);x=c['lateral'][i];half=c['inner_rod_half_thickness']if i==1 else c['outside_rod_half_thickness'];pr=c['inner_pin_radius']if i==1 else c['outer_pin_radius'];sr=c['small_pin_radius'];small_bore=c['small_bore_radius'];small_outer=c['small_bushing_outer'];gap=c['running_clearance'];bw=c['bushing_wall'];margin=c['rod_eye_margin'];rb=np.linalg.norm(p[:,1:]-b,axis=1);rs=np.linalg.norm(p[:,1:]-s,axis=1)
  body=flat_capsule(p,b,s,x,half,c['rod_half_width']);eye=np.minimum(cylx(p,b,x,half,pr+gap+bw+margin),cylx(p,s,x,half,small_outer+margin));rod=np.minimum(body,eye);rod=np.maximum(rod,-np.minimum(rb-(pr+gap+bw),rs-small_outer))
  bigbush=np.maximum(np.maximum(rb-(pr+gap+bw),(pr+gap)-rb),abs(p[:,0]-x)-half);smallbush=np.maximum(np.maximum(rs-small_outer,small_bore-rs),abs(p[:,0]-x)-half)
  sol[label+'_main_rod_with_open_eyes']=rod;sol[label+'_big_end_bushing']=bigbush;sol[label+'_small_end_bushing']=smallbush;sol[label+'_small_pin']=cylx(p,s,x,half+.015,sr)
  if i!=1:
   sign=-1 if i==0 else 1;couplex=sign*c['coupling_lateral'];endx=c['coupling_lateral']+c['coupling_stack_offset']+c['coupling_half_thickness']+.01
   # Stepped crank pin joins wheel-side journal, main-rod bearing and coupling-rod journal.
   start=.76;step=abs(x)+half+.008
   sol[label+'_main_crank_pin']=cylx(p,b,sign*(start+step)/2,(step-start)/2,pr)
   sol[label+'_coupling_crank_pin_step']=cylx(p,b,sign*(step+endx)/2,(endx-step)/2,c['coupling_pin_radius'])
   centres=[b+np.array([0,z])for z in c['driver_axle_z']]
   for k,centre in enumerate(centres):
    if k!=1:sol[label+f'_coupling_pin_{k}']=cylx(p,centre,sign*(start+endx)/2,(endx-start)/2,c['coupling_pin_radius'])
   for k,(aa,bb)in enumerate(zip(centres[:-1],centres[1:])):
    couplex=sign*(c['coupling_lateral']+(-1 if k==0 else 1)*c['coupling_stack_offset'])
    da=np.linalg.norm(p[:,1:]-aa,axis=1);db=np.linalg.norm(p[:,1:]-bb,axis=1)
    body=flat_capsule(p,aa,bb,couplex,c['coupling_half_thickness'],.03)
    ends=np.minimum(cylx(p,aa,couplex,c['coupling_half_thickness'],c['coupling_eye_outer']),cylx(p,bb,couplex,c['coupling_half_thickness'],c['coupling_eye_outer']))
    sol[label+f'_coupling_rod_{k}']=np.maximum(np.minimum(body,ends),-np.minimum(da-c['coupling_bore_radius'],db-c['coupling_bore_radius']))
 return sol
