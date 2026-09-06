"""Original mathematical counterexamples, not the supplied sketches or a fluid solver."""
import json
import math
import platform


def divergence(v, x, y, h=1e-5):
    return ((v(x+h, y)[0]-v(x-h, y)[0])
            + (v(x, y+h)[1]-v(x, y-h)[1])) / (2*h)


def normalize(v):
    def result(x, y):
        a, b = v(x, y)
        length = math.hypot(a, b)
        if length == 0:
            raise ValueError('A zero vector has no unit direction')
        return a/length, b/length
    return result


def ridge(u, recentered=False):
    if not math.isfinite(u) or not 0 <= u <= 1:
        raise ValueError('This adapter requires a declared finite [0,1] input')
    signed = 2*u-1 if recentered else u
    return (1-abs(signed))**2


def run():
    # psi=x*x*y => v=(psi_y,-psi_x). Analytic divergence is exactly zero.
    raw = lambda x, y: (x*x, -2*x*y)
    unit = normalize(raw)
    expected_unit_div = 2/(5*math.sqrt(5))
    raw_div = divergence(raw, 1, 1)
    unit_div = divergence(unit, 1, 1)
    assert abs(raw_div) < 1e-8
    assert abs(unit_div-expected_unit_div) < 1e-8
    grid = [(0.5+i*0.15, 0.25+j*0.125) for i in range(11) for j in range(11)]
    max_raw = max(abs(divergence(raw, x, y)) for x, y in grid)
    assert max_raw < 1e-7
    # A special control: this circular field remains solenoidal after normalization.
    circular = normalize(lambda x, y: (y, -x))
    circular_div = divergence(circular, 1, 1)
    assert abs(circular_div) < 1e-8

    # psi=y, spatial amplitude a=1+.2*x; modulate psi before curl, not v afterwards.
    after = lambda x, y: (1+0.2*x, 0.0)
    before = lambda x, y: (1+0.2*x, -0.2*y)
    div_after, div_before = divergence(after, 1, 1), divergence(before, 1, 1)
    assert abs(div_after-0.2) < 1e-9 and abs(div_before) < 1e-9

    # Zero divergence alone imposes no wall boundary condition.
    uniform = lambda x, y: (1.0, 0.0)
    wall_div = divergence(uniform, 1, 0)
    normal_flux = uniform(1, 0)[0]  # unit circle outer normal at (1,0) is (1,0)
    assert wall_div == 0 and normal_flux == 1

    # Closed coordinate path: deterministic smooth test function, NOT OpenSimplex.
    def test_field(x, y, t):
        z, w = 1.2*math.cos(t), 1.2*math.sin(t)
        return math.sin(x+0.7*z)*math.cos(y-0.4*w)+0.2*math.sin(z+w)
    period = 2*math.pi
    points = [(i*0.17, j*0.23) for i in range(5) for j in range(5)]
    loop_error = max(abs(test_field(x,y,0)-test_field(x,y,period)) for x,y in points)
    def slope(x,y,t):
        h = 1e-5
        return (test_field(x,y,t+h)-test_field(x,y,t-h))/(2*h)
    slope_error = max(abs(slope(x,y,0)-slope(x,y,period)) for x,y in points)
    assert loop_error < 1e-12 and slope_error < 1e-8
    # Time-periodic forcing still causes nonperiodic accumulated position.
    n = 4096
    drift = sum((1+0.5*math.sin((i+0.5)*period/n))*period/n for i in range(n))
    assert abs(drift-period) < 1e-11

    # Two sites: actual distance to their bisector x=0 is abs(x).
    worley = []
    for y in (0., 2., 10.):
        x = 0.2
        distances = sorted((math.hypot(x+1,y), math.hypot(x-1,y)))
        worley.append({'point':[x,y], 'F2_minus_F1':distances[1]-distances[0],
                       'distance_to_bisector':abs(x)})
    assert max(r['F2_minus_F1'] for r in worley)-min(r['F2_minus_F1'] for r in worley) > 0.3

    values = (0., .25, .5, .75, 1.)
    ridges = [{'u':u,'unadapted':ridge(u),'recentered':ridge(u,True)} for u in values]
    assert ridges[2]['unadapted'] == .25 and ridges[2]['recentered'] == 1
    assert ridges[0]['recentered'] == ridges[-1]['recentered'] == 0
    for invalid in (-.1, 1.1, float('nan')):
        try:
            ridge(invalid, True)
        except ValueError:
            pass
        else:
            raise AssertionError('Bad range accepted')

    # A decorative coordinate warp is not automatically invertible.
    jac_small = 1+0.75*math.cos(math.pi)
    jac_large = 1+1.5*math.cos(math.pi)
    assert jac_small > 0 and jac_large < 0
    return {
        'execution_date':'2026-09-06','python':platform.python_version(),
        'test_groups':7,'status':'all assertions passed for these defined cases',
        'curl_normalization':{'raw_divergence_at_1_1':raw_div,
          'unit_divergence_at_1_1':unit_div,'analytic_unit_divergence':expected_unit_div,
          'max_raw_divergence_121_points':max_raw,
          'special_circular_control_divergence':circular_div},
        'amplitude_order':{'after_curl_divergence':div_after,'before_curl_divergence':div_before},
        'wall_counterexample':{'divergence':wall_div,'normal_flux':normal_flux},
        'loop_embedding':{'points':len(points),'max_value_seam_error':loop_error,
          'max_derivative_seam_error':slope_error,'periodic_velocity_particle_drift':drift},
        'worley_distance_difference':worley,'ridge_range_adapter':ridges,
        'domain_warp':{'jacobian_at_pi_amplitude_0_75':jac_small,
                       'jacobian_at_pi_amplitude_1_5':jac_large},
        'limits':['Analytic substitutes, no Perlin/OpenSimplex/noise-library execution',
          'Not a reconstruction of the supplied screenshots or complete source',
          'No GPU, browser, physical fluid, terrain calibration, or production tests',
          'No measured FPS or software adoption claim']}


if __name__ == '__main__':
    print(json.dumps(run(),ensure_ascii=False,indent=2,allow_nan=False))
