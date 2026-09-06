"""Synthetic checks of a proposed world contract, not a world simulator.
All identities, ticks, positions, claims and lifecycle dates here are fixtures.
Python standard library only. No production data or historical claim is loaded.
"""
from __future__ import annotations
from dataclasses import dataclass
from math import cos, sin, isclose
import hashlib
import json
import platform
from datetime import datetime, timezone

Vec = tuple[float, float, float]

def rotate(v: Vec, yaw: float) -> Vec:
    c, s = cos(yaw), sin(yaw)
    return c*v[0]-s*v[1], s*v[0]+c*v[1], v[2]

def add(a: Vec, b: Vec) -> Vec:
    return tuple(x+y for x, y in zip(a, b))

def sub(a: Vec, b: Vec) -> Vec:
    return tuple(x-y for x, y in zip(a, b))

@dataclass(frozen=True)
class Stamp:
    world: str
    revision: str
    tick: int
    frame: str = 'fixture:earth-local'
    unit: str = 'm'

@dataclass(frozen=True)
class Pose:
    stamp: Stamp
    point: Vec
    yaw: float

def relative(a: Pose, b: Pose) -> tuple[Vec, float]:
    if a.stamp != b.stamp:
        raise ValueError('Transforms require the same world, revision, tick, frame and unit')
    return rotate(sub(b.point, a.point), -a.yaw), b.yaw-a.yaw

@dataclass(frozen=True)
class Claim:
    subject: str
    value: str
    valid_start: int
    valid_end: int
    recorded_at: int
    superseded_at: int | None
    kind: str
    source: str | None

def query_claims(claims: tuple[Claim, ...], subject: str, valid_tick: int, known_at: int) -> dict:
    visible = [c for c in claims if c.subject == subject
               and c.valid_start <= valid_tick < c.valid_end
               and c.recorded_at <= known_at
               and (c.superseded_at is None or known_at < c.superseded_at)]
    values = sorted({c.value for c in visible})
    status = 'unknown' if not values else 'conflicted' if len(values)>1 else 'supported_claim'
    return {'status': status, 'values': values}

def can_label_observed(c: Claim) -> bool:
    # Structural gate only. It does not verify that a source actually proves a claim.
    return c.kind == 'observed' and bool(c.source)

def existence(tick: int, created: int | None, destroyed: int | None) -> str:
    if created is not None and destroyed is not None and destroyed <= created:
        raise ValueError('Invalid bounded lifetime')
    if destroyed is not None and tick >= destroyed:
        return 'absent'
    if created is not None and tick < created:
        return 'not_yet_created'
    if created is None:
        return 'unknown'
    if destroyed is None:
        return 'unknown'  # No end date is not evidence of survival to this query time.
    return 'present'

def snapshot(poses: dict[str, Pose]) -> str:
    return hashlib.sha256(json.dumps({k:{'stamp':vars(v.stamp),'point':v.point,'yaw':v.yaw}
                                     for k,v in sorted(poses.items())},sort_keys=True).encode()).hexdigest()

def unique_ids(ids: list[str]) -> None:
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate object identity')

def merge_proposals(base_revision: str, proposals: list[tuple[str,str,str,float]]) -> dict:
    updates = {}
    for revision, writer, field, value in proposals:
        if revision != base_revision:
            raise ValueError('Stale base snapshot')
        if field in updates:
            raise ValueError('Conflicting writers require an explicit joint resolver')
        updates[field] = value
    return dict(sorted(updates.items()))

def must_reject(fn) -> None:
    try:
        fn()
    except ValueError:
        return
    raise AssertionError('Expected explicit rejection')

def run() -> dict:
    groups = []
    error = 0.0
    # A moving/turning parent carries an attached marker at a fixed local offset.
    local = (1.2, -0.7, 0.35)
    for tick, point, yaw in ((10,(2.,3.,4.),.3),(17,(20.,-8.,2.),1.1)):
        stamp = Stamp('fixture:world', 'r1', tick)
        parent = Pose(stamp, point, yaw)
        child = Pose(stamp, add(point, rotate(local,yaw)), yaw+.2)
        observed, angle = relative(parent, child)
        error = max(error,max(abs(a-b) for a,b in zip(observed,local)))
        assert all(isclose(a,b,abs_tol=1e-12) for a,b in zip(observed,local))
        assert isclose(angle,.2,abs_tol=1e-12)
        assert all(isclose(a,b,abs_tol=1e-12) for a,b in zip(add(parent.point,rotate(observed,parent.yaw)),child.point))
    groups.append('moving_parent_local_world_roundtrip')

    stamp = Stamp('fixture:world','r1',20)
    a=Pose(stamp,(1.,2.,3.),.25); b=Pose(stamp,(5.,-1.,3.5),.75)
    origin=(1e5,-1e5,20.)
    ar=Pose(stamp,sub(a.point,origin),a.yaw); br=Pose(stamp,sub(b.point,origin),b.yaw)
    assert all(isclose(x,y,abs_tol=1e-10) for x,y in zip(relative(a,b)[0],relative(ar,br)[0]))
    groups.append('common_origin_rebase_relative_invariance')

    for altered in (Stamp('fixture:other','r1',20),Stamp('fixture:world','r2',20),
                    Stamp('fixture:world','r1',21),Stamp('fixture:world','r1',20,'other'),
                    Stamp('fixture:world','r1',20,unit='cm')):
        must_reject(lambda altered=altered:relative(a,Pose(altered,b.point,b.yaw)))
    groups.append('reject_five_incompatible_transform_contexts')

    unique_ids(['fixture:person','fixture:dog'])
    poses={'fixture:person':a,'fixture:dog':a} # same reference point does not merge identities
    before=snapshot(poses)
    for _ in range(20):
        relative(poses['fixture:person'],poses['fixture:dog'])
    assert before==snapshot(poses)
    must_reject(lambda:unique_ids(['fixture:person','fixture:person']))
    groups.append('identity_independent_of_position_and_readonly_queries')

    old=Claim('fixture:artifact','site-A',10,20,100,200,'observed','fixture:document-A')
    new=Claim('fixture:artifact','site-B',10,20,200,None,'observed','fixture:document-B')
    claims=(old,new)
    assert query_claims(claims,'fixture:artifact',15,150)['values']==['site-A']
    assert query_claims(claims,'fixture:artifact',15,250)['values']==['site-B']
    assert query_claims(claims,'fixture:artifact',15,50)['status']=='unknown'
    assert query_claims(claims,'fixture:artifact',20,250)['status']=='unknown'
    groups.append('separate_historical_validity_and_knowledge_revision')

    dissent=Claim('fixture:artifact','site-C',10,20,210,None,'observed','fixture:document-C')
    assert query_claims(claims+(dissent,),'fixture:artifact',15,250)['status']=='conflicted'
    assert query_claims(claims,'fixture:unrecorded',15,250)['status']=='unknown'
    for kind in ('inferred','generated','unknown'):
        c=Claim('fixture:grass','green',0,100,10,None,kind,'fixture:reference')
        assert not can_label_observed(c)
    assert not can_label_observed(Claim('x','x',0,1,0,None,'observed',None))
    groups.append('retain_conflicts_unknowns_and_generated_provenance')

    assert existence(9,10,80)=='not_yet_created'
    assert existence(60,10,80)=='present' # retirement at 50 is not destruction
    assert existence(80,10,80)=='absent'
    assert existence(90,10,None)=='unknown'
    assert existence(15,None,None)=='unknown'
    must_reject(lambda:existence(100,80,10))
    groups.append('lifecycle_end_is_not_retirement_or_missing_evidence')

    proposals=[('r1','weather','fixture:wind',3.0),('r1','material','fixture:wetness',.2)]
    assert merge_proposals('r1',proposals)==merge_proposals('r1',list(reversed(proposals)))
    must_reject(lambda:merge_proposals('r1',proposals+[('r1','other','fixture:wind',4.)]))
    must_reject(lambda:merge_proposals('r2',proposals))
    groups.append('snapshot_consistent_writes_require_explicit_conflict_resolution')

    return {'created_at':datetime.now(timezone.utc).isoformat(), 'python':platform.python_version(),
            'passed_groups':len(groups),'groups':groups,'pose_max_error':error,
            'all_data_synthetic':True,'production_runtime_integrated':False,
            'physics_or_chemistry_solved':False,'historical_source_verified_by_test':False,
            'limitations':['Rigid yaw and translation only; no full 3D geodesy, deformation or contact solver',
                          'Integer fixture ticks only; no historical calendar, clock synchronization or uncertain date solver',
                          'Evidence labels and references are structural checks, not proof of historical truth',
                          'No distributed execution, security, conflict adjudication or production performance test']}

if __name__=='__main__':
    print(json.dumps(run(),ensure_ascii=False,indent=2,allow_nan=False))
