# An isolated, exact three-expression candidate for a numeric regression.
from pathlib import Path
p=Path('station-matter.mjs');s=p.read_text()
a='let st=stationMemberState(h,p,resolveStationState(p));let g=evaluateStationGeometry(h,p,st);'
b='let state=resolveStationState(p);let st=stationMemberState(h,p,state);let g=evaluateStationGeometry(h,p,state);'
assert s.count(a)==1,'Expected original double-mapped implementation'
p.write_text(s.replace(a,b))
