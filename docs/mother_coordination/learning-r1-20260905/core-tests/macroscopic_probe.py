"""CPU analysis of a scalar expression from Yohei Nishitsuji's
Macroscopic microscope, quoted in his Codrops article dated 2025-02-18.

The full artistic shader, ray marcher, and runtime are not reproduced here.
Formula evaluation, derivative checks, and the constrained patch are study code.
No observed terrain, rendered picture, or production asset is used.
"""
from __future__ import annotations
import json
import math
import platform
from datetime import datetime, timezone
import numpy as np

SOURCE = ('https://tympanus.net/codrops/2025/02/18/'
          'rendering-the-simulation-theory-exploring-fractals-glsl-and-the-nature-of-reality/')


def points(values: np.ndarray) -> np.ndarray:
    p = np.asarray(values, dtype=np.float64)
    if p.ndim != 2 or p.shape[1] != 3 or not np.isfinite(p).all():
        raise ValueError('A finite N by 3 coordinate array is required')
    return p


def kernel(p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """C(u,v,w)=cos(cos(w)cos(u)+cos(v)^2+cos(v)cos(u)).

    This is an algebraic expansion of the published inner scalar expression.
    Returned derivatives are with respect to the three local coordinates.
    """
    p = points(p)
    cu, cv, cw = np.cos(p).T
    su, sv, sw = np.sin(p).T
    a = cu * (cw + cv) + cv * cv
    sa = np.sin(a)
    grad = np.column_stack((sa*su*(cw+cv), sa*sv*(cu+2*cv), sa*sw*cu))
    return np.cos(a), grad


def detail(p: np.ndarray, count: int) -> tuple[np.ndarray, np.ndarray]:
    """A finite sum, using scale 2**j and coefficient 2**(-j).
    Derivative chain-rule scale cancels the reciprocal coefficient.
    """
    p = points(p)
    if type(count) is not int or not 1 <= count <= 17:
        raise ValueError('This study supports 1 through 17 finite scales')
    value = np.zeros(len(p))
    grad = np.zeros_like(p)
    for j in range(count):
        scale = float(2**j)
        term, derivative = kernel(p * scale)
        value += term / scale
        grad += derivative
    return value, grad


def log_spherical(q: np.ndarray, t: float) -> np.ndarray:
    """Analyse the coordinate map separately from the original ray marcher.

    The constant -1 in the second coordinate represents the apparent prefix
    decrement in the article. Its typography is not treated as a verified
    original shader build; it does not affect the radial scaling identity.
    """
    q = points(q)
    if not math.isfinite(t):
        raise ValueError('Finite time required')
    radius = np.linalg.norm(q, axis=1)
    if np.any(radius <= 1e-9) or np.any(np.hypot(q[:,0], q[:,1]) <= 1e-9):
        raise ValueError('Origin and angular pole excluded from this test')
    return np.column_stack((np.log2(radius)-2-.3*t,
                            -q[:,2]/radius-1,
                            np.arctan2(q[:,0], q[:,1])))


def run() -> dict:
    rng = np.random.default_rng(20260906)
    p = rng.uniform(-2.1, 2.3, (4096, 3))
    full, grad17 = detail(p, 17)
    coarse, grad8 = detail(p, 8)
    bound = sum(2.0**(-j) for j in range(8,17))
    tail = np.abs(full-coarse)
    assert np.max(tail) <= bound + 1e-14

    # Verify the analytic derivative only on moderate scales to control
    # finite-difference cancellation and truncation error.
    check_points = p[:64]
    analytic = detail(check_points,3)[1]
    eps = 1e-6
    numeric = np.empty_like(analytic)
    for axis in range(3):
        d = np.zeros(3); d[axis]=eps
        numeric[:,axis] = (detail(check_points+d,3)[0]-detail(check_points-d,3)[0])/(2*eps)
    derivative_error=float(np.max(np.abs(numeric-analytic)))
    assert derivative_error < 1e-7

    # Exact radial magnification/time relation of the coordinate map.
    q = rng.uniform(.2, 2.0, (128,3)) * np.array([1.,-1.,1.])
    t=.7
    elapsed=10/3  # 0.3 * elapsed == 1 to floating precision
    scale=2.0**(.3*elapsed)
    a=log_spherical(q,t)
    b=log_spherical(scale*q,t+elapsed)
    map_error=float(np.max(np.abs(a-b)))
    field_error=float(np.max(np.abs(detail(a,17)[0]-detail(b,17)[0])))
    assert map_error < 1e-13 and field_error < 1e-11

    # A synthetic, fixed-vertex height patch. Protection is demonstrated only
    # at its explicit border and central line; no all-view silhouette claim.
    axis=np.linspace(-10,10,65)
    x,z=np.meshgrid(axis,axis,indexing='xy')
    base=30+40*np.exp(-(x/7)**2-(z/9)**2)+.3*x
    local=np.column_stack((x.ravel()/7+.31, np.full(x.size,.37),z.ravel()/11-.83))
    mask=(1-(x/10)**2)*(1-(z/10)**2)*(x/10)**2
    amplitude=.25  # metres for THIS synthetic example only
    normalizer=sum(2.0**(-j) for j in range(17)) # fixed, not enabled-count-dependent
    displacement=amplitude*mask*detail(local,17)[0].reshape(x.shape)/normalizer
    final=base+displacement
    protect=(np.abs(x)==10)|(np.abs(z)==10)|(x==0)
    protected_error=float(np.max(np.abs(final[protect]-base[protect])))
    assert protected_error == 0
    assert float(np.max(np.abs(displacement))) <= amplitude+1e-15
    assert np.array_equal(detail(local,17)[0], detail(local[::-1],17)[0][::-1])

    # Counterexample: applying detail everywhere does change the protected line.
    ungated=amplitude*detail(local,17)[0].reshape(x.shape)/normalizer
    wrong_protected_change=float(np.max(np.abs(ungated[protect])))
    assert wrong_protected_change > 1e-3

    rejected=[]
    for name, op in (
        ('nonfinite_coordinates',lambda:detail(np.array([[0,math.nan,0]]),3)),
        ('invalid_count',lambda:detail(p,0)),
        ('mapping_origin',lambda:log_spherical(np.zeros((1,3)),0)),
        ('angular_pole',lambda:log_spherical(np.array([[0.,0.,1.]]),0)),
    ):
        try: op()
        except ValueError: rejected.append(name)
        else: raise AssertionError(name)

    return {
        'executed_at':datetime.now(timezone.utc).isoformat(),
        'runtime':{'python':platform.python_version(),'numpy':np.__version__},
        'source':SOURCE,
        'finite_scale_count':17,
        'scale_values': [2**j for j in range(17)],
        'scalar_comparison':{'sample_count':len(p),
            'eight_to_seventeen_max_change':float(tail.max()),
            'eight_to_seventeen_rms_change':float(np.sqrt(np.mean(tail**2))),
            'analytic_tail_bound':bound,
            'gradient_difference_rms':float(np.sqrt(np.mean(np.sum((grad17-grad8)**2,axis=1)))),
            'gradient_difference_max':float(np.max(np.linalg.norm(grad17-grad8,axis=1))),
            'units':'dimensionless local-coordinate field, not metres or rendered normals'},
        'analytic_gradient_check':{'points':64,'scales':3,'step':eps,'max_error':derivative_error},
        'radial_map_check':{'points':128,'radial_factor':scale,'time_increment':elapsed,
            'map_max_error':map_error,'scalar_max_error':field_error,
            'scope':'coordinate map only; full camera and brightness not tested'},
        'synthetic_patch':{'vertices':int(x.size),'declared_amplitude_metres':amplitude,
            'observed_max_displacement_metres':float(np.max(np.abs(displacement))),
            'protected_samples':int(protect.sum()),'protected_max_change_metres':protected_error,
            'ungated_counterexample_max_change_metres':wrong_protected_change,
            'reverse_query_exact':True,
            'scope':'synthetic field only, no real mountain, collision or silhouette acceptance'},
        'rejected_cases':rejected,
        'rendering':{'original_shader_run':False,'gpu_tested':False,
            'browser_webgl2_context':False,'reason':'System Chromium launched but getContext(webgl2) returned null'},
        'production_modified':False,
        'limits':['No shader image generated or matched to the author work',
                  'No proof of isotropy, geology, safe ray-marching distance or exact SDF',
                  'No claim that nested cosines have strictly separated spectral bands',
                  'Finite tests verify only the declared formulas and synthetic inputs',
                  'Scalar truncation bound does not bound full render or world-space error']
    }

if __name__=='__main__':
    print(json.dumps(run(),ensure_ascii=False,indent=2,allow_nan=False))
