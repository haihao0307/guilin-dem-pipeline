#!/usr/bin/env python3
"""Three synthetic terrain-relation checks. Not the video's node graph.
Standard-library CPU test only; does not simulate hydrology or render geometry.
"""
from __future__ import annotations
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

Point = tuple[float, float]
Segment = tuple[Point, Point]

def distance(p: Point, segments: list[Segment]) -> float:
    if not segments:
        raise ValueError('an empty geometry has no defined nearest distance')
    values = []
    for a, b in segments:
        vx, vy = b[0]-a[0], b[1]-a[1]
        length2 = vx*vx+vy*vy
        t = 0.0 if length2 == 0 else max(0.0, min(1.0, ((p[0]-a[0])*vx+(p[1]-a[1])*vy)/length2))
        values.append(math.hypot(p[0]-a[0]-t*vx, p[1]-a[1]-t*vy))
    return min(values)

def reachable(edges: list[tuple[str,str]], source: str, target: str) -> bool:
    seen: set[str] = set()
    todo = [source]
    while todo:
        a = todo.pop()
        if a == target:
            return True
        if a not in seen:
            seen.add(a)
            todo.extend(b for u,b in edges if u == a)
    return False

def main() -> dict:
    # 1. Explicitly chosen cumulative hierarchy, NOT recovered original weights.
    trunk = [((0.,-10.),(0.,10.))]
    all_branches = trunk+[((0.,0.),(4.,4.))]
    a, b = (0.,5.), (3.,3.)
    nearest = [distance(p,all_branches) for p in (a,b)]
    stacked = [(distance(p,trunk)+distance(p,all_branches))/2 for p in (a,b)]
    case1 = {'nearest_only_at_trunk_and_branch_m':nearest,
             'chosen_two_level_average_m':stacked,
             'interpretation':'Hierarchy distances can distinguish points collapsed by nearest-all distance. This does not establish real channel slopes or author weights.'}
    pass1 = nearest == [0.,0.] and stacked == [0.,1.5]
    # 2. Reverse all edge orientations: geometric support stays identical.
    positions = {'s':(4.,4.),'j':(0.,0.),'o':(0.,-10.)}
    forward = [('s','j'),('j','o')]
    reverse = [(b,a) for a,b in forward]
    seg1 = [(positions[a],positions[b]) for a,b in forward]
    seg2 = [(positions[a],positions[b]) for a,b in reverse]
    probes = [(1.,1.),(2.,-3.),(-1.,8.)]
    max_error = max(abs(distance(p,seg1)-distance(p,seg2)) for p in probes)
    case2 = {'max_nearest_distance_change_on_reversing_edges_m':max_error,
             'source_reaches_outlet_forward':reachable(forward,'s','o'),
             'source_reaches_outlet_reversed':reachable(reverse,'s','o'),
             'interpretation':'Proximity cannot determine connectivity direction; neither case contains hydraulic state.'}
    pass2 = max_error < 1e-12 and case2['source_reaches_outlet_forward'] and not case2['source_reaches_outlet_reversed']
    # 3. Two half-plane parcel labels and an invertible shear warp.
    # A real parcel mesh/polygon extraction is not implemented here.
    p = (-.1, math.pi/2)
    q = (p[0]+.3*math.sin(p[1]),p[1])
    label = lambda xy: int(xy[0] >= 0.)
    case3 = {'world_point':p,'shared_warped_domain_point':q,
             'geometry_label_in_warped_domain':label(q),
             'incorrect_shader_label_in_unwarped_domain':label(p),
             'consistent_shader_label_in_shared_domain':label(q),
             'interpretation':'Warping only one consumer can disagree on parcel identity. A shared domain fixes this constructed example, not all topology problems.'}
    pass3 = case3['geometry_label_in_warped_domain'] != case3['incorrect_shader_label_in_unwarped_domain'] and case3['geometry_label_in_warped_domain'] == case3['consistent_shader_label_in_shared_domain']
    checks = {'hierarchy_preserves_information_lost_by_nearest_all':pass1,
              'distance_is_not_directed_hydraulic_connectivity':pass2,
              'shared_domain_prevents_this_label_mismatch':pass3}
    return {'id':'KAOPU-TERRAIN-VIDEO-T01-20260916',
            'observed_at_utc':datetime.now(timezone.utc).isoformat(),
            'probe_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'evidence':'synthetic CPU counterexamples; no author-code reproduction',
            'checks':checks,'passed':sum(checks.values()),'total':len(checks),
            'cases':[case1,case2,case3],
            'not_tested':['author node graph','Blender rendering','hydrology','terrain geology','parcel polygon extraction','GPU/target device performance','Mother implementation or receipt']}

if __name__ == '__main__':
    result = main()
    text = json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text,encoding='utf-8')
    print(text)
    raise SystemExit(0 if result['passed'] == result['total'] else 1)
