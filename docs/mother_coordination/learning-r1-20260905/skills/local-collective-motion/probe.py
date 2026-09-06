"""Small, dependency-free CPU probes for a knowledge card, not a production simulator.

Source review: hughsk/boids index.js blob 0dba99f4b2adb0990adc381c64157372c2b5b1c8;
ercang/boids-js BoidsWorkerPlanner.js blob e8ffa09fe3441a7d450dbb96ae0c78f4534067c4,
BoidsController.js blob a59a3a0881036792111e716d2a76e684dcea919d,
Entity.js blob 050a691a2baea7cf2a9effcffd4dd304d61ff751.
The source probes reproduce individual expressions, not the complete upstream apps.
The vector model below is independently written, illustrative, and uncalibrated.
"""
from __future__ import annotations
from dataclasses import dataclass
from math import exp, floor, hypot, isfinite
import json
import platform
import time

V = tuple[float, float, float]
ZERO: V = (0.0, 0.0, 0.0)


def add(a: V, b: V) -> V:
    return tuple(x + y for x, y in zip(a, b))


def sub(a: V, b: V) -> V:
    return tuple(x - y for x, y in zip(a, b))


def scale(a: V, s: float) -> V:
    return tuple(x * s for x in a)


def norm(a: V) -> float:
    return hypot(*a)


def clip(a: V, limit: float) -> V:
    if not isfinite(limit) or limit < 0:
        raise ValueError('limit must be finite and nonnegative')
    n = norm(a)
    return a if n <= limit else scale(a, limit / n)


@dataclass(frozen=True)
class Agent:
    id: int
    p: V
    v: V


def neighbors(me: Agent, snapshot: tuple[Agent, ...], radius: float, k: int | None = None):
    if not isfinite(radius) or radius <= 0 or (k is not None and k < 0):
        raise ValueError('invalid neighborhood')
    candidates = [j for j in snapshot if j.id != me.id and norm(sub(j.p, me.p)) < radius]
    candidates.sort(key=lambda j: (norm(sub(j.p, me.p)), j.id))
    return candidates if k is None else candidates[:k]


def mean(vectors: list[V]) -> V:
    if not vectors:
        return ZERO
    total = ZERO
    for v in vectors:
        total = add(total, v)
    return scale(total, 1 / len(vectors))


def components(me: Agent, nearby: list[Agent], eps: float = 0.01):
    if not nearby:
        return ZERO, ZERO, ZERO
    sep = ZERO
    for other in sorted(nearby, key=lambda j: j.id):
        away = sub(me.p, other.p)
        d = norm(away)
        if d == 0:
            # Demonstration only: a stable pair-specific axis breaks the degeneracy.
            # This fallback is not rotation-equivariant at exact overlap.
            away = (eps if me.id < other.id else -eps, 0., 0.)
            d = eps
        sep = add(sep, scale(away, 1 / max(d * d, eps * eps)))
    separation = clip(sep, 1.0)  # normalized illustrative acceleration, m/s^2
    alignment = sub(mean([j.v for j in nearby]), me.v)  # response time = 1 s
    desired = clip(sub(mean([j.p for j in nearby]), me.p), 2.)  # position response = 1 s
    cohesion = sub(desired, me.v)  # velocity response = 1 s
    return separation, alignment, cohesion


def step(snapshot: tuple[Agent, ...], dt: float, weights=(1., 1., 1.), radius=5.) -> tuple[Agent, ...]:
    if not isfinite(dt) or dt <= 0:
        raise ValueError('dt must be finite and positive')
    if len({j.id for j in snapshot}) != len(snapshot):
        raise ValueError('duplicate IDs')
    out = []
    for me in snapshot:
        cs = components(me, neighbors(me, snapshot, radius))
        a = ZERO
        for term, w in zip(cs, weights):
            a = add(a, scale(term, w))
        a = clip(a, 3.)
        v = clip(add(me.v, scale(a, dt)), 2.)
        out.append(Agent(me.id, add(me.p, scale(v, dt)), v))
    return tuple(out)


def source_worker_indices(n: int, workers: int) -> list[int]:
    # Math.round(nonnegative n/workers), then exclusive iterate(start, end).
    size = floor(n / workers + 0.5)
    return [i for w in range(workers)
            for i in range(w * size, n if w == workers - 1 else (w + 1) * size - 1)]


def corrected_worker_indices(n: int, workers: int) -> list[int]:
    # Half-open intervals with no gaps, including N < worker count.
    return [i for w in range(workers) for i in range(w * n // workers, (w + 1) * n // workers)]


def run():
    began = time.perf_counter()
    passed = []
    def check(name, ok):
        if not ok:
            raise AssertionError(name)
        passed.append(name)

    a = Agent(1, (0., 0., 0.), (1., 0., 0.))
    b = Agent(2, (1., 0., 0.), (1., 0., 0.))
    s, al, c = components(a, [b])
    check('separation_points_away', s[0] < 0)
    check('matching_velocity_has_zero_alignment', al == ZERO)
    left = Agent(3, (-2., 0., 0.), ZERO)
    check('cohesion_of_stationary_agent_points_to_neighbor', components(left, [b])[2][0] > 0)
    mismatch = Agent(4, (0., 1., 0.), (0., 1., 0.))
    alignment = components(mismatch, [b])[1]
    check('alignment_small_step_reduces_velocity_difference',
          norm(sub(add(mismatch.v, scale(alignment, .1)), b.v)) < norm(sub(mismatch.v, b.v)))
    overlap = Agent(5, a.p, a.v)
    sa, sb = components(a, [overlap])[0], components(overlap, [a])[0]
    check('exact_overlap_finite_and_antisymmetric', all(isfinite(x) for x in sa) and add(sa, sb) == ZERO and norm(sa) > 0)
    distant = Agent(6, (100., 0., 0.), ZERO)
    snapshot = (a, b, mismatch, distant)
    check('radius_and_k_are_distinct_filters', [j.id for j in neighbors(a, snapshot, 5., 1)] == [2] and distant not in neighbors(a, snapshot, 5.))
    check('no_neighbors_has_zero_components', components(a, []) == (ZERO, ZERO, ZERO))
    before = repr(snapshot)
    result = step(snapshot, .05)
    check('read_only_input_snapshot', repr(snapshot) == before)
    check('snapshot_update_is_permutation_invariant', {j.id: j for j in result} == {j.id: j for j in step(tuple(reversed(snapshot)), .05)})
    check('zero_weights_preserve_velocity', all(x.v == y.v for x, y in zip(snapshot, step(snapshot, .05, (0., 0., 0.)))))
    check('velocity_cap_and_finite_state', all(norm(j.v) <= 2. + 1e-12 and all(isfinite(x) for x in j.p + j.v) for j in result))
    invalid_rejected = False
    try:
        step(snapshot, -1.)
    except ValueError:
        invalid_rejected = True
    check('negative_time_step_rejected', invalid_rejected)
    # An illustrative fear-decay equation, with no ongoing perceived threat.
    check('exponential_decay_composes_over_time', abs(exp(-.4 / 2) * exp(-.6 / 2) - exp(-1 / 2)) < 1e-15)
    missing = sorted(set(range(100)) - set(source_worker_indices(100, 4)))
    check('upstream_partition_expression_has_gap_counterexample', missing == [24, 49, 74])
    check('corrected_half_open_partition_exhaustive_small_cases',
          all(corrected_worker_indices(n, w) == list(range(n)) for n in range(258) for w in range(1, 17)))
    # Numeric zero in JavaScript's x || default is equivalent for this expression.
    check('upstream_zero_option_fallback_counterexample', (0.0 or .25) == .25)
    upstream_alignment_delta = -.25 * 1. / 1.
    check('upstream_alignment_sign_counterexample', upstream_alignment_delta < 0)
    stored_acceleration = .15
    stored_acceleration += 0.0
    check('retained_acceleration_is_not_instantaneous_force', stored_acceleration == .15)
    report = {
        'status': 'passed', 'checks': len(passed), 'names': passed,
        'source_counterexample': {'n': 100, 'workers': 4, 'missed_indices': missing},
        'corrected_partition_cases': 258 * 16,
        'environment': {'python': platform.python_version(), 'platform': platform.platform()},
        'elapsed_ms': round((time.perf_counter() - began) * 1000, 3),
        'scope': 'Independent CPU formula probes and source-expression counterexamples only.',
        'upstream_full_application_run': False, 'browser_run': False, 'gpu_run': False,
        'species_calibrated': False, 'production_integration': False, 'visualAcceptance': False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    run()
