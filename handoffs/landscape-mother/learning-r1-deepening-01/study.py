"""Isolated terrain reasoning probes; no production assets or renderer.
Run: python study.py --output RESULTS.json
Requires Python >=3.10 and NumPy. See PLAN.md for predeclared predictions.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import platform
import time
import tracemalloc
from pathlib import Path
import numpy as np

CHECKS: list[dict] = []
METRICS: dict = {}


def check(name: str, condition: bool, scope: str) -> None:
    CHECKS.append({'name': name, 'passed': bool(condition), 'scope': scope})


def close(actual, expected, tolerance: float = 1e-10) -> bool:
    a, e = np.asarray(actual), np.asarray(expected)
    return bool(np.all(np.isfinite(a)) and np.all(np.abs(a-e) <= tolerance))


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    length = np.linalg.norm(v)
    if not np.isfinite(length) or length <= 1e-15:
        raise ValueError('A finite nonzero vector is required')
    return v/length


def rotation_z(degrees: float):
    a = math.radians(degrees)
    return np.array([[math.cos(a), -math.sin(a), 0],
                     [math.sin(a), math.cos(a), 0], [0, 0, 1.]])


def field(p):
    return np.sin(12.3*p[:, 0]+1.7*p[:, 1]) + .3*np.cos(5.2*p[:, 2])


def numerical_gradient(fn, point, eps=1e-6):
    point = np.asarray(point, dtype=np.float64)
    eye = np.eye(3)*eps
    return np.array([(fn(point+step)-fn(point-step))/(2*eps) for step in eye])


def geometry_hash(a):
    return hashlib.sha256(np.asarray(a, dtype='<f8').tobytes()).hexdigest()


def run() -> dict:
    CHECKS.clear()
    METRICS.clear()
    start = time.perf_counter()
    tracemalloc.start()

    # Physical derivatives, unrelated to observed DEM detail or resolution.
    correct, wrong = [], []
    for dx in [.5, 1., 2.]:
        x = np.arange(-10., 10.+dx/2, dx)
        h = x.copy()
        correct.append(float(np.mean((h[2:]-h[:-2])/(2*dx))))
        wrong.append(float(np.mean((h[2:]-h[:-2])/2)))
    theta = math.degrees(math.atan(.5))
    check('physical_slope_spacing', close(correct, [1, 1, 1], 1e-9), 'analytic plane')
    check('wrong_spacing_control_detected', not close(wrong, [1, 1, 1]), 'deliberate bug')
    check('horizontal_scale_changes_angle', close(theta, 26.56505117707799, 1e-9), 'analytic scale')
    # Illustration of the documented node-specific 3-voxel clamp, no solver execution.
    effective = [max(2., 3*dx) for dx in [.5, 1., 2.]]
    check('documented_feature_clamp_example', close(effective, [2, 3, 6]), 'formula only; not Houdini run')
    eps = 1e-6
    wave = lambda x: .02*math.sin(100*x)
    derivative = (wave(eps)-wave(-eps))/(2*eps)
    check('small_amplitude_large_gradient', abs(derivative-2.) < 1e-6, 'analytic sinusoid')
    METRICS['scale'] = {'spacing_m': [.5,1.,2.], 'correct_slopes':correct,
        'wrong_index_slopes':wrong, 'wide_slope_angle_deg':theta,
        'illustrated_effective_feature_size_m':effective,
        'noise_amplitude_m':.02, 'noise_gradient_at_origin':derivative}

    # Sign convention: solid < 0. This function is not claimed an exact SDF.
    def tunnel(p):
        sphere = np.linalg.norm(p)-10.
        cylinder = np.hypot(p[0], p[1])-3.
        return max(sphere, -cylinder)
    roots = [-10.,-3.,3.,10.]
    probes = [-11.,-8.,0.,8.,11.]
    signs = [bool(tunnel(np.array([0., y, 0.])) < 0) for y in probes]
    check('tunnel_four_boundary_roots', close([tunnel(np.array([0.,y,0.])) for y in roots], [0]*4), 'analytic CSG')
    check('tunnel_empty_middle_solid_roof_floor', signs == [False,True,False,True,False], 'analytic CSG')
    top_base_inside = -10 < 0 < 10
    check('top_bottom_height_model_fills_void', top_base_inside and not signs[2], 'representation counterexample')
    METRICS['tunnel'] = {'vertical_roots_m':roots, 'sample_y_m':probes,
                          'inside_solid':signs, 'top_bottom_boundary_count':2}
    counts = []
    for dx in [1., .1]:
        q = np.linspace(0.,1.,int(round(1/dx))+1)
        points = np.stack(np.meshgrid(q,q,q,indexing='ij'), axis=-1)
        counts.append(int(np.count_nonzero(np.linalg.norm(points-.5,axis=-1) < .2-1e-12)))
    check('subvoxel_feature_missed', counts[0] == 0 and counts[1] > 0, 'point-sampling example, not VDB rasterizer')
    METRICS['sampling'] = {'spacing_m':[1.,.1], 'strict_interior_samples':counts}

    c = .75
    union = lambda p: min(np.linalg.norm(p-np.array([c,0,0]))-1,
                          np.linalg.norm(p+np.array([c,0,0]))-1)
    true_distance = math.sqrt(1-c*c)
    raw_distance = -float(union(np.zeros(3)))
    check('boolean_union_boundary_correct', abs(union(np.array([0,true_distance,0]))) < 1e-12, 'analytic intersecting spheres')
    check('boolean_union_not_exact_distance', abs(true_distance-raw_distance) > .4, 'exact-distance counterexample')
    # At x=0 the exposed nearest boundary is the intersection circle.
    METRICS['distance'] = {'union_min_magnitude':raw_distance,
        'analytic_nearest_boundary_distance':true_distance,
        'absolute_error':true_distance-raw_distance}

    A = rotation_z(37.) @ np.diag([2.,1.,.5])
    invA = np.linalg.inv(A)
    n = unit([1,1,1])
    t1, t2 = np.array([1.,-1.,0]), np.array([1.,1.,-2.])
    ngood, nbad = unit(invA.T@n), unit(A@n)
    good = [float(np.dot(ngood,A@t)) for t in [t1,t2]]
    bad = [float(np.dot(nbad,A@t)) for t in [t1,t2]]
    check('inverse_transpose_normal', close(good,[0,0]), 'affine plane')
    check('ordinary_vector_normal_bug_detected', max(abs(v) for v in bad) > .1, 'deliberate bug')
    axes = np.diag([2.,1.,.5])
    phi = lambda p: np.linalg.norm(np.linalg.solve(axes,p))-1.
    gradient_lengths = [float(np.linalg.norm(numerical_gradient(phi,axes@q))) for q in np.eye(3)]
    check('affine_implicit_not_world_sdf', close(gradient_lengths,[.5,1,2],1e-7), 'analytic ellipsoid')
    reflect = np.diag([-1.,1.,1.])
    reflected_cross = unit(np.cross(reflect@np.array([1.,0,0]), reflect@np.array([0.,1,0])))
    reflected_normal = unit(np.linalg.inv(reflect).T@np.array([0.,0,1.]))
    mirrored_dot = float(np.dot(reflected_cross,reflected_normal))
    check('mirror_requires_winding_policy', close(mirrored_dot,-1.) and close(np.dot(-reflected_cross,reflected_normal),1.), 'triangle orientation')
    try:
        np.linalg.inv(np.diag([1.,0.,1.]))
        rejected = False
    except np.linalg.LinAlgError:
        rejected = True
    check('singular_transform_rejected', rejected, 'invalid input')
    METRICS['normals'] = {'correct_tangent_dot':good, 'wrong_tangent_dot':bad,
        'scaled_field_gradient_lengths':gradient_lengths, 'mirrored_winding_dot':mirrored_dot}

    # Reproduce the coordinator's numeric case, then extend with a predeclared seed.
    reports = []
    for seed, scales in [(20260905, [[1.,1.,1.]]),
                          (20260906, [[1.,1.,1.],[2.,2.,2.],[.5,2.,1.5],[-1.,1.,1.]])]:
        q = (np.random.default_rng(seed).random((64,3))-.5)*[2.,.1,.4]
        reference = field(q)
        errors, differences = [], []
        for angle in [0,15,45,90,135,180]:
            for scale in scales:
                M = rotation_z(angle)@np.diag(scale)
                for t in [np.zeros(3),np.array([.37,-.21,.13])]:
                    p = q@M.T+t
                    recovered = np.linalg.solve(M,(p-t).T).T
                    errors.append(float(np.max(np.abs(field(recovered)-reference))))
                    differences.append(float(np.max(np.abs(field(p)-reference))))
        check(f'local_field_roundtrip_{seed}', max(errors)<1e-12, '64-point numeric sample')
        check(f'world_field_legitimate_change_{seed}', sum(v>1e-12 for v in differences)==len(errors)-1, 'world-attached field')
        reports.append({'seed':seed,'cases':len(errors),'max_local_error':max(errors),
                        'world_changed_cases':sum(v>1e-12 for v in differences)})
    METRICS['coordinates'] = reports

    # Scope is a constant-density two-cell ledger. No erosion physics is implied.
    initial, delta = np.array([10.,0.]), np.array([-1.,1.])
    full = initial+delta
    errors = [float(np.sum(initial+np.array(mask)*delta)-np.sum(initial))
              for mask in [[1,1],[0,1],[1,0],[0,0]]]
    check('transport_ledger_conserves', close(np.sum(full),np.sum(initial)), 'unit-area cells')
    check('postmask_breaks_transport_balance', close(errors,[0,1,-1,0]), 'counterexample, not vendor solver')
    METRICS['mask_ledger'] = {'cell_area_m2':1,'transport_m3':1,'postmask_volume_error_m3':errors}

    # Isolate the ledge fragment from the V016 archived app.js; no complete rerender.
    def ledge(a,y,seed=11):
        return (math.sin(y*.74+a*1.9+seed*1.371)*.008
                + math.sin(y*1.57-a*3.2+seed*2.173)*.004)
    jumps = [abs(ledge(0,y)-ledge(2*math.pi,y)) for y in [44.,85.,126.]]
    periodic = lambda a,y: math.sin(y*.74+a*2+11*1.371)*.008+math.sin(y*1.57-a*3+11*2.173)*.004
    periodic_error = max(abs(periodic(0,y)-periodic(2*math.pi,y)) for y in [44.,85.,126.])
    check('v016_ledge_nonperiodicity_detected', max(jumps)>1e-3, 'archived formula in float64; not renderer')
    check('periodic_positive_control', periodic_error < 1e-10, 'test control only, not replacement terrain')
    METRICS['v016_ledge'] = {'height_samples_m':[44.,85.,126.],
        'seam_jumps_dimensionless':jumps, 'periodic_control_error':periodic_error}

    # Explicit field-context example: each displacement is 0.5 * its input position.
    q = np.array([[1.,2.,3.],[4.,5.,6.]])
    current = q+.5*q
    current_twice, captured_twice = current+.5*current, current+.5*q
    check('current_vs_captured_context', close(current_twice,2.25*q) and close(captured_twice,2*q), 'analytic context')
    original_hash = geometry_hash(q)
    a = field(q)
    wet_display = a*.6
    check('material_only_keeps_geometry', original_hash==geometry_hash(q) and not close(a,wet_display), 'lab array only')
    METRICS['context'] = {'current_twice_factor':2.25,'captured_twice_factor':2.,
                          'geometry_sha256':original_hash}
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return {'schema':'landscape-r1-deepening-numeric/1',
        'environment':{'python':platform.python_version(),'numpy':np.__version__,
                       'platform':platform.system(),'precision':'float64'},
        'checks':CHECKS.copy(),'passed':sum(c['passed'] for c in CHECKS),
        'total':len(CHECKS),'metrics':METRICS.copy(),
        'elapsed_seconds':time.perf_counter()-start,
        'tracemalloc_peak_bytes':peak,
        'measurement_limit':'tracemalloc is Python-tracked allocation, not process RSS or GPU memory',
        'code_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'production_assets_loaded':False,'production_scene_changed':False,
        'native_software_executed':False,'browser_executed':False,
        'visualAcceptance':False,'productionReady':False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path('RESULTS.json'))
    args=parser.parse_args()
    result=run()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':result['passed'],'total':result['total'],
                      'metrics':result['metrics'],'elapsed_seconds':result['elapsed_seconds']},
                     ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['passed']==result['total'] else 1)
