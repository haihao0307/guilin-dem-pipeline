"""Original CPU-only counterexamples for a procedural-field source review.
No downloaded application code or production assets are executed.
"""
from __future__ import annotations
import json
import math
import platform


def divergence(field, x: float, y: float, h: float = 1e-5) -> float:
    return ((field(x+h, y)[0]-field(x-h, y)[0])
            + (field(x, y+h)[1]-field(x, y-h)[1]))/(2*h)


def area(points: list[tuple[float, float]]) -> float:
    return abs(sum(x*y2-y*x2 for (x,y),(x2,y2)
                   in zip(points, points[1:]+points[:1]))) * 0.5


def run() -> dict:
    a = 0.5
    # psi(u,v)=u*v. Its planar curl is (u,-v).
    # W(x,y)=(x+a*x*y,y). naively sampling curl(psi) at W loses the chain rule.
    naive = lambda x,y: (x+a*x*y, -y)
    # phi=psi(W)=x*y+a*x*y*y; use its derivatives in final coordinates.
    potential_first = lambda x,y: (x+2*a*x*y, -y-a*y*y)
    grid = [(i/10, j/10) for i in range(1,12) for j in range(1,12)]
    good_errors = [abs(divergence(potential_first,x,y)) for x,y in grid]
    bad_expected_errors = [abs(divergence(naive,x,y)-a*y) for x,y in grid]
    assert max(good_errors) < 1e-8
    assert max(bad_expected_errors) < 1e-8
    assert abs(divergence(naive,0.4,0.7)-0.35) < 1e-8
    composition = {
        "points":len(grid),"warp_parameter":a,
        "naive_divergence_at_0_4_0_7":divergence(naive,0.4,0.7),
        "potential_first_divergence_at_0_4_0_7":divergence(potential_first,0.4,0.7),
        "max_potential_first_divergence_residual":max(good_errors),
        "max_naive_vs_analytic_divergence_error":max(bad_expected_errors),
        "minimum_warp_jacobian_in_test_grid":min(1+a*y for _,y in grid)
    }

    # v=(y,-x) has div(v)=0 and exact rotation preserves area.
    # Euler's discrete map has determinant 1+dt^2, not 1.
    original = [(-0.5,-0.5),(0.5,-0.5),(0.5,0.5),(-0.5,0.5)]
    T = 2*math.pi
    integration = []
    for steps in (60,120,600):
        dt = T/steps
        eu = original.copy()
        midpoint = original.copy()
        exact = original.copy()
        for _ in range(steps):
            eu = [(x+dt*y,y-dt*x) for x,y in eu]
            # Implicit midpoint for this linear system; explicit closed-form solve.
            c = (1-dt*dt/4)/(1+dt*dt/4)
            s = dt/(1+dt*dt/4)
            midpoint = [(c*x+s*y,-s*x+c*y) for x,y in midpoint]
            exact = [(math.cos(dt)*x+math.sin(dt)*y,
                      -math.sin(dt)*x+math.cos(dt)*y) for x,y in exact]
        expected = (1+dt*dt)**steps
        assert abs(area(eu)-expected) < 1e-10
        assert abs(area(midpoint)-1) < 1e-10
        assert abs(area(exact)-1) < 1e-10
        integration.append({"steps":steps,"elapsed":T,"euler_area":area(eu),
                            "implicit_midpoint_area":area(midpoint),"exact_area":area(exact)})

    # f_K(x)=sum_{i=0}^{K-1} 2^-i sin(2^i x).
    # Each unnormalised octave contributes 1 to derivative at x=0.
    octaves=[]
    for K in (1,2,4,8):
        def f(x):
            return sum(2**(-i)*math.sin(2**i*x) for i in range(K))
        eps=1e-7
        derivative=(f(eps)-f(-eps))/(2*eps)
        weight_sum=sum(2**(-i) for i in range(K))
        assert abs(derivative-K)<1e-8
        octaves.append({"layers":K,"derivative_at_zero":derivative,
                        "amplitude_sum":weight_sum,
                        "normalized_derivative_at_zero":derivative/weight_sum})

    # A display-frame based alpha decrement, reflecting the reviewed examples.
    # These are ideal update-count calculations; no browser benchmark.
    dt_rows=[]
    for fps in (30,60,120):
        raw = 1.0
        rate = 1.0
        for _ in range(fps):
            raw -= 0.005
            rate -= 0.3/fps
        assert abs(rate-0.7)<1e-12
        dt_rows.append({"fps":fps,"seconds":1,"alpha_per_frame":raw,
                        "alpha_per_second":rate,"one_birth_per_frame_count":fps})

    return {"execution_date":"2026-09-06","runtime":platform.python_version(),
            "test_type":"self_authored_CPU_analytic_counterexamples",
            "groups_passed":4,"composition":composition,"integration":integration,
            "octave_derivatives":octaves,"per_frame_update":dt_rows,
            "limits":["Smooth analytic fields; no real noise or original demo code executed",
                      "Planar stream-function construction only; not a 3D surface-flow validation",
                      "Midpoint area result is for this linear example; no generic solver guarantee",
                      "Aligned phases illustrate a possible derivative extreme, not typical noise statistics",
                      "No GPU, browser, visual, performance or production test"]}


if __name__ == '__main__':
    print(json.dumps(run(),ensure_ascii=False,indent=2,allow_nan=False))
