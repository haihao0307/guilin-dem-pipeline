"""PASS means the preserved historical baseline still reproduces its failures.
It says nothing about R30 candidate clearance or historical accuracy.
"""
from pathlib import Path
import subprocess,sys,json,math,hashlib
P=Path(__file__).resolve().parent
r=subprocess.run([sys.executable,str(P/'test_swept_collision.py')],cwd=P,capture_output=True,text=True)
assert r.returncode==1, 'Historical negative control must report its known failure, not pass or crash: '+r.stderr
q=json.loads((P/'SWEEP_COLLISION_QA.json').read_text())
assert q['status']=='FAIL_WHOLE_CHAIN_ACCEPTANCE' and q['pass'] is False
assert q['source_geometry_modified'] is False
assert q['source_sha256']['scene.js']=='8053c0c615d7ff045f267d217ae2576d3a8d1d4a4ec958e06540a0133473b8da'
a=q['middle_rod_leading_axle'];b=q['baseline_outside_crankpin_attachment']
assert a['target_pair']==['drive/middle_main_rod_with_open_eyes','wheel/axle2_straight_axle']
assert a['phase_samples']==3601 and a['field_confirmed_intersection_samples']==745
assert a['worst_sample']['intersection_confirmed']
assert math.isclose(a['worst_sample']['surface_margin_m'],-.028736256515188005,abs_tol=1e-12)
assert math.isclose(b['axial_gap_m'],.0075,abs_tol=1e-12)
assert all(w['air_gap_confirmed'] for w in b['witnesses'])
report=dict(status='PASS_HISTORICAL_NEGATIVE_CONTROL',baselineFailureReproduced=True,baselineSourceUntouched=True,baselineCollisionMargin_m=a['worst_sample']['surface_margin_m'],baselinePinGap_m=b['axial_gap_m'],underlyingExitCode=r.returncode,scope='R20/R22 original baseline only. Current candidate is independently classified; no whole clearance or final acceptance is implied.',currentCandidateAcceptance='NOT_TESTED_BY_THIS_NEGATIVE_CONTROL')
(P/'BASELINE_NEGATIVE_CONTROL_QA.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
