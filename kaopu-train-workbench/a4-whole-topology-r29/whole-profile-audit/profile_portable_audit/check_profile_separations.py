"""Restricted all-beta/all-time disjointness from captured analytic AST support.
This is not a whole-train or mechanical acceptance test.
"""
import json,math
from pathlib import Path
H=Path(__file__).resolve().parent;pack=json.load(open(H/'COVER_EXPORT.json'));parts={p['id']:p for p in pack['parts']};P=pack['parameters'];C=P['chest']
def min_x(s):
 k=s['kind']
 if k=='cylinder':return s['range'][0] if s['axis']==0 else s['center'][0]-s['radius']
 if k=='box':return s['lo'][0]
 if k=='plane':return s['offset'] if s['normal']==[-1,0,0] else -math.inf
 if k=='difference':return min_x(s['base'])
 if k=='union':return min(map(min_x,s['children']))
 if k=='intersection':return max(map(min_x,s['children']))
 raise ValueError(k)
rows=[]
for id,p in parts.items():
 if p['source']!='installation' or id.split('/')[-1] in ['chest_wall','common_casting_web']:continue
 a=min_x(p['shape']);rows.append({'id':id,'minimumXBound':a,'powerOuterWallXGap':a-.26})
assert min(x['powerOuterWallXGap'] for x in rows)>0
web=parts['middle_topology/common_casting_web']['shape'];assert web['kind']=='difference';outer=web['base'];assert outer['kind']=='webOuter'
power_bore=next(v for v in web['voids'] if v['kind']=='tiltedCylinder');valve_bore=next(v for v in web['voids'] if v['kind']=='cylinder' and v['radius']==C['boreRadius'])
assert power_bore['range'][0]<outer['axialRange'][0]<outer['axialRange'][1]<power_bore['range'][1]
assert valve_bore['range'][0]<outer['range'][0]<outer['range'][1]<valve_bore['range'][1]
assert power_bore['radius']>=.23495 and valve_bore['radius']>=C['sealRadius']
rear_gap=outer['range'][0]-C['rear'];front_gap=C['front']-outer['range'][1];assert min(rear_gap,front_gap)>0
out={'status':'restricted analytic separation established, no whole-train acceptance','allBetaDomain':[.11,.16],'allTime':True,'powerCylinderInvariantMaxAbsX':.26,'minimumNewCoverHardwareToPowerCylinderXGap':min(x['powerOuterWallXGap'] for x in rows),'staticPartsCovered':len(rows),'rows':rows,'webRearCoverZGap':rear_gap,'webFrontCoverZGap':front_gap,'webPowerBoreRadius':power_bore['radius'],'webValveBoreRadius':valve_bore['radius'],'webPowerAxisSupport':outer['axialRange'],'webWorldZSupport':outer['range'],'webStrictlyExcludesBothCoaxialMovingBoreContents':True,'noPositiveSealOperatingClearanceClaimed':True,'reason':'New removable covers and fastening/gland/guide/packing bodies lie strictly outside X=.26, invariant under power-cylinder inclination and slider motion. Web Z support is strictly between the removable covers. Web subtraction cutters contain its entire axial support, so negative web values require radius outside both bores.','limitations':['Dimensions and rear flat are inferred.','Not pressure, steam-event, strength, serviceability or historical validation.','No negative witness from minimization is a clearance certificate.']}
json.dump(out,open(H/'PROFILE_STATIC_SEPARATION.json','w'),indent=2);print(json.dumps({k:v for k,v in out.items() if k!='rows'},indent=2))
