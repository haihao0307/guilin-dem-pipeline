"""Replay exact recorded failures and resolved host openings; no new search.
Usage: python3 replay_compact.py. Requires Python 3 + NumPy, not SciPy/browser.
"""
import json,math
from pathlib import Path
import numpy as np
import retained_scalar as R
from steam_scalar import compile_node
H=Path(__file__).resolve().parent;C=json.load(open(H/'CURRENT_STEAM_AST.json'));W=json.load(open(H/'WITNESSES.json'));OLD=json.load(open(H/'ORIGINAL_FAILURE_AST.json'));P={p['id']:p for p in C['parts']};out=[]
for w in W['cases']:
 beta=w['beta'];R.middleInclination=beta;p=np.array(w['xyz']);m=W['matrixPool'][w['matrix']];raw=R.scalar(w['oldPart'],np.array(m['inverseRows'])@p+np.array(m['inverseOffset']));cut=compile_node(C['hostCuts'][w['oldPart']]['ast'],beta)(p) if w['oldPart'] in C['hostCuts'] else math.inf;modified=max(raw,-cut);kind=w['kind'];r={'id':w['id'],'kind':kind,'beta':beta,'theta':w['theta'],'xyz':w['xyz'],'retainedField':raw,'modifiedField':modified}
 if kind=='solid_pair_regression':
  previous=compile_node(OLD['part']['ast'],beta)(p);current=compile_node(P['steam_path/middle_front_working_passage']['ast'],beta)(p);assert previous<-1e-7 and raw<-1e-7 and current>1e-7;r.update(previousNewSolidField=previous,currentNewSolidField=current,result='recorded_collision_resolved')
 elif kind=='lumen_intrusion_regression':
  lumen=compile_node(C['domains']['lumen/'+w['prior']['route']],beta)(p);assert raw<-1e-7 and lumen<-1e-7 and modified>1e-7;r.update(lumenField=lumen,result='recorded_lumen_intrusion_resolved')
 elif kind=='proposed_waypoint_only':
  assert abs(raw-w['retainedCylinderField'])<1e-11
  if raw<0:assert cut>0
  r.update(currentCylinderCutField=cut,result='design_warning_preserved_not_a_final_candidate_collision')
 elif kind=='actual_host_opening':
  assert raw<-1e-7 and cut<-1e-7 and modified>1e-7
  assert max(abs(raw-w['expected']['retainedHostField']),abs(cut-w['expected']['candidateHostCutField']),abs(modified-w['expected']['modifiedHostField']))<1e-9
  r.update(hostCutField=cut,result='real_host_metal_opened')
 elif kind=='declared_metal_port_interface':
  current=compile_node(P[w['newPart']]['ast'],beta)(p);assert current<-1e-7 and modified<-1e-7;assert max(abs(current-w['expectedFieldValues'][0]),abs(modified-w['expectedFieldValues'][1]))<1e-9;r.update(newSolidField=current,result='specific_metal_port_interface_only_not_general_overlap_exemption')
 else:raise ValueError(kind)
 out.append(r)
result={'status':'PASS recorded evidence replay','candidateFileSHA256':C['sourceHash'],'records':len(out),'limitations':'No new collision search, mesh, point cloud, pressure solve, browser/GPU check or continuous proof.','results':out}
(H/'REPLAY_RESULT.json').write_text(json.dumps(result,separators=(',',':'))+'\n');print(json.dumps({k:v for k,v in result.items() if k!='results'},indent=2))
