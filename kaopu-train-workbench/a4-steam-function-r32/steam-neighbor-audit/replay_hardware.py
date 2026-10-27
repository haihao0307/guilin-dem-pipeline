"""Regenerate actual 31-field native JS values in memory and independently replay.
Usage: python3 replay_hardware.py. Needs Python+NumPy+Node, no network/browser.
"""
import json,subprocess,hashlib
from pathlib import Path
import numpy as np
from steam_scalar import compile_node
H=Path(__file__).resolve().parent;C=json.load(open(H/'CURRENT_STEAM_AST.json'));F=json.load(open(H/'FROZEN22_STEAM_AST.json'));native=json.loads(subprocess.check_output(['node',str(H/'generate_native_samples.js')],text=True));assert native['sourceHash']==C['sourceHash'];P={p['id']:p for p in C['parts']};old={p['id']:p for p in F['parts']}
assert {p['id']:p['ast'] for p in native['parts']}=={id:p['ast'] for id,p in P.items()};assert native['hostCuts']==C['hostCuts']==F['hostCuts'];assert native['domains']==C['domains']==F['domains']
unchanged=[];flanges=[];holes=0
for id,p in old.items():
 n=P[id]['ast'];o=p['ast']
 if n==o:unchanged.append(id);continue
 assert 'joint_flange' in id and o['op']==n['op']=='subtract' and o['a']==n['a'] and n['b']['op']=='union' and n['b']['nodes'][0]==o['b'];assert len(n['b']['nodes'])==5
 for cut in n['b']['nodes'][1:]:
  assert cut['op']=='cylinder' and cut['r']==.004;q=(np.array(cut['a'])+np.array(cut['b']))/2;assert compile_node(o,.126)(q)<0 and compile_node(n,.126)(q)>0;holes+=1
 flanges.append(id)
added=[id for id in P if id not in old];assert len(unchanged)==16 and len(flanges)==6 and len(added)==9
funcs={(b,id):compile_node(p['ast'],b) for b in [.11,.126,.16] for id,p in P.items()};errors=[abs(funcs[(s['beta'],s['id'])](np.array(s['xyz']))-s['value']) for s in native['samples']];assert max(errors)<1e-10
metal=0
for p in native['parts']:
 if p['id'] not in added:continue
 for q in p['diagnosticWitnesses']:assert funcs[(.126,p['id'])](np.array(q))<-1e-7;metal+=1
assert metal==60
out={'status':'PASS actual 31-field source / AST inheritance / hardware witness replay','sourceHash':C['sourceHash'],'nativeSamples':len(errors),'maximumIndependentCpuError':max(errors),'unchangedOriginalASTs':len(unchanged),'subtractOnlyChangedFlanges':len(flanges),'addedHardware':len(added),'actualOpenedFlangeHoleCenters':holes,'finiteHardwareMetalWitnesses':metal,'unchangedOriginalHostCuts':len(C['hostCuts']),'allOriginalDomainsIdentical':True,'limitations':'Finite scalar replay and AST identity only; not thread contact, preload, strength, browser, GPU or whole-clearance certification.'};(H/'HARDWARE_REPLAY_RESULT.json').write_text(json.dumps(out,separators=(',',':'))+'\n');print(json.dumps(out,indent=2))
