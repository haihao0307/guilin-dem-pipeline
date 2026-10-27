"""Algebraic body-disjointness from the exact max/subtraction expression.
This checks particular bore domains, never the entire train or physical fit.
"""
import json,re
from pathlib import Path
H=Path(__file__).resolve().parent;S=json.load(open(H/'sources.json'));P=json.load(open(H/'PARAMETERS.json'))
s=S['installation'];helper=re.search(r'float topologyWebOuter\(vec3 p\)\{([^{}]+)\}',s)[1];web=re.search(r'float topology_common_casting_web\(vec3 p\)\{return (.*?);\}',s)[1]
assert 'float axisZ=sin(middleInclination)*(p.y-1.016)+cos(middleInclination)*p.z;' in helper
zlo,zhi=map(float,re.search(r'max\(([.\d]+)-p.z,p.z-([.\d]+)\)',helper).groups());slo,shi=map(float,re.search(r'max\(([.\d]+)-axisZ,axisZ-([.\d]+)\)',helper).groups())
assert '-mCylZ(mLocal(p-vec3(0.,1.016,0.),sin(middleInclination),cos(middleInclination)),.23495,4.2,5.3)' in web
assert ',0.11430000000000000,4.2,5.3)' in web
assert 4.2<slo<shi<5.3 and 4.2<zlo<zhi<5.3
assert P['chest']['headCoreRadius']<=P['chest']['sealRadius']==.1143
out={'webWorldZSupport':[zlo,zhi],'webPowerAxisZSupport':[slo,shi],'subtractedBoreAxialRange':[4.2,5.3],'powerBoreRadius':.23495,'middleValveBoreRadius':.1143,'powerMovingMaximumRadius':.23495,'newValveMovingMaximumRadius':.1143,'powerBoreAndValveBoreExcludedForAllTimeAndBeta':True,'reason':'For negative web, both cylinder subtraction fields must be strictly positive. Its entire support is strictly inside both cutters axial intervals, so positivity can only come from radius outside each bore. The power piston/rings/rod and new valve heads/seals remain inside those radii under their respective coaxial motions. This proves absence of strict solid overlap, not a positive operating clearance for contacting seals.','scope':'Exact candidate web against coaxial power piston/rings/rod and new valve heads/seals only; no ports, thermodynamics, strength or whole acceptance.'}
json.dump(out,open(H/'WEB_BORE_EXCLUSION.json','w'),indent=2);print(json.dumps(out,indent=2))
