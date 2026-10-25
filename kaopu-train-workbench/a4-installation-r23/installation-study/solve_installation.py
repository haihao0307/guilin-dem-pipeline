"""Joint inferred installation feasibility, NOT historical calibration.
Baseline stays unchanged. All constraints/thresholds and unknowns are explicit.
"""
from pathlib import Path
import numpy as np,json
P=Path(__file__).parent
phase=np.linspace(0,2*np.pi,1441);crank=.3302;B=np.stack([crank*np.sin(phase),crank*np.cos(phase)],1);axle=np.array([0,2.2098]);clearance=.005;pin_offset=1.25;rod_r=.045;axle_r=.1
rows=[];failures={};
for beta in np.linspace(.08,.20,121):
 u=np.array([np.sin(beta),np.cos(beta)]);h=B@u;perp=B[:,0]*u[1]-B[:,1]*u[0]
 for L in np.linspace(3.1,3.9,161):
  st=h+np.sqrt(L*L-perp*perp);S=st[:,None]*u;V=S-B;t=np.clip(np.sum((axle-B)*V,axis=1)/np.sum(V*V,axis=1),0,1);dist=np.linalg.norm(B+t[:,None]*V-axle,axis=1);margin=float(dist.min()-rod_r-axle_r)
  guide_overlap=np.minimum(4,st+.17)-np.maximum(3,st-.17);min_overlap=float(guide_overlap.min())
  # Piston must fit full stroke in retained half-depth .4 cylinder with .025 piston half-depth.
  cylinder_lo=float((st+pin_offset+.025-.4).max());cylinder_hi=float((st+pin_offset-.025+.4).min());behind_upper=4.75/np.cos(beta);cylinder_hi=min(cylinder_hi,behind_upper-1e-6)
  ok=margin>=clearance and min_overlap>=.25 and cylinder_lo<=cylinder_hi
  if ok:
   C=float(np.clip(L+pin_offset,cylinder_lo,cylinder_hi));score=((beta-.11)/.03)**2+((L-3.5)/.3)**2+((C-4.75)/.2)**2
   rows.append({'beta_rad':float(beta),'beta_deg':float(np.degrees(beta)),'rod_length_m':float(L),'cylinder_station_interval_m':[cylinder_lo,cylinder_hi],'selected_centered_station_m':C,'middle_cylinder_center_yz_m':[float(1.016+C*np.sin(beta)),float(C*np.cos(beta))],'rod_axle_min_clearance_m':margin,'min_guide_contact_overlap_m':min_overlap,'preference_score_not_evidence':float(score)})
rows.sort(key=lambda x:x['preference_score_not_evidence']);report={'status':'inferred_feasible_family_not_a_selected_historical_fix','baseline':{'beta_rad':.11,'rod_length_m':3.5,'cylinder_axis_station_m':4.75,'unchanged':True},'grid':{'beta_rad':[.08,.20,121],'rod_length_m':[3.1,3.9,161],'phase_samples':1441},'constraints':{'crank_radius_m':crank,'leading_axle_z_m':2.2098,'cylinder_axis_goes_through_D2':True,'minimum_rod_axle_clearance_m_design_assumption':clearance,'fixed_rod_envelope_radius_m_inferred':rod_r,'fixed_leading_axle_radius_m_inferred':axle_r,'middle_cylinder_behind_outside_station_m':4.75,'middle_cylinder_above_outside':True,'piston_small_end_offset_m_inferred':pin_offset,'cylinder_half_length_m_inferred':.4,'piston_half_depth_m_inferred':.025,'guide_station_range_m_inferred':[3,4],'slipper_half_station_length_m_inferred':.17,'minimum_guide_overlap_m_design_assumption':.25},'feasible_count':len(rows),'best_by_explicit_minimum_change_preference':rows[:12],'feasible_ranges':{'beta_rad':[min(x['beta_rad']for x in rows),max(x['beta_rad']for x in rows)],'rod_length_m':[min(x['rod_length_m']for x in rows),max(x['rod_length_m']for x in rows)]},'not_verified':['cylinder saddle mounting faces and load path','all frame/boiler/pipe/valve clearances','actual60009 inclination or connecting rod length','suspension movement or stress','global continuous swept collision certificate'],'interpretation':'Feasible means only these sampled coupled constraints. It is not sufficient for a finished locomotive. No baseline field or documentary station changed.'};(P/'INSTALLATION_FEASIBILITY.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:report[k]for k in ['feasible_count','feasible_ranges','best_by_explicit_minimum_change_preference']},indent=2)[:3500])
