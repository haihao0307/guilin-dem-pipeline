"""Read exact own retained GLSL constructor coefficients; no geometry sampling."""
from pathlib import Path
import re, json, math, hashlib, argparse, os
import numpy as np
HERE=Path(__file__).resolve().parent
args=argparse.ArgumentParser(description=__doc__);args.add_argument('--model',default=os.environ.get('A4_MODEL_DIR',str(HERE/'../r24')));MODEL=Path(args.parse_args().model).resolve();SCENE=MODEL/'scene.js'
s=json.loads(SCENE.read_text().split('=',1)[1].rstrip(';\n '));src=s['sources']['motion']
point_functions={'E':'eccentric_pin_pin','J':'expansion_tail_pin','U':'combination_upper_pin','L':'combination_lower_pin','V':'valve_crosshead_pin','C':'crosshead_drop_pin','A':'radius_lift_pickup_pin','H':'lift_top_pin','T':'trunnion_inner_journal','D':'die_block','B':'return_crank','K':'lifting_arm'}
result={};observations={'scene_sha256':hashlib.sha256(SCENE.read_bytes()).hexdigest(),'source':'r24 SCENE.sources.motion; own inferred analytic candidate; not historical geometry','sides':{}}
for side in ['left','right']:
    fs={m[0]:m[1] for m in re.findall(r'float motion_valve_'+side+r'_(\w+)\(vec3 p\) \{ (.*?) \}',src)}
    vecs=lambda name:[list(map(float,x.split(','))) for x in re.findall(r'vec3\(([^()]*)\)',fs[name])]
    pts={name:np.array(vecs(fn)[0][1:]) for name,fn in point_functions.items()}
    Q=np.array(list(map(float,re.findall(r'vec4\(([^()]*)\)',fs['expansion_link_slotted_cheeks'])[0].split(',')))).reshape(2,2)
    q=Q@(pts['D']-pts['T']);sigma=math.atan2(q[0],2.3-q[1]);result[side]={k:v.tolist() for k,v in pts.items()};result[side]['Q']=Q.tolist();result[side]['sigma']=sigma
    measurements={a+b:float(np.linalg.norm(pts[b]-pts[a])) for a,b in [('B','E'),('E','J'),('T','J'),('D','U'),('A','D'),('A','U'),('A','H'),('K','H'),('L','U'),('L','V'),('U','V'),('C','L')]}
    observations['sides'][side]={'point_constructor_observations':{k:{'function':'motion_valve_'+side+'_'+f,'vec3_constructor_index':0,'xyz':vecs(f)[0],'yz':pts[k].tolist(),'source_line':src[:src.index('float motion_valve_'+side+'_'+f+'(')].count('\n')+1} for k,f in point_functions.items()},'measured_pin_distances_m':measurements,'slot':{'world_to_local_Q':Q.tolist(),'radius':2.3,'halfAngle':.2,'innerSlotHalfWidth':.017,'outerCheekHalfWidth':.045,'dieRadius':.015,'sigma':sigma},'inferredEccentricRadiusM':float(np.linalg.norm(pts['E']-[1.016,0])),'referenceEccentricAngleRad':math.atan2(pts['E'][0]-1.016,pts['E'][1])}
(HERE/'reference-endpoints.json').write_text(json.dumps(result,indent=2)+'\n');(HERE/'SOURCE_OBSERVATIONS.json').write_text(json.dumps(observations,indent=2)+'\n')
print('Extracted exact source constructors and measurements for both outside sides.')
