"""Original CPU-only examples inspired by TouchDesigner documentation.
No TouchDesigner, browser, GPU, external code, or production data is used.
"""
from __future__ import annotations
import json
import math
import platform
from bisect import bisect_right
from dataclasses import dataclass
from itertools import cycle

TICK_HZ = 600
END_TICK = 1200
HALF_LIFE_SECONDS = 0.5
TOL = 1e-12


def schedule(pattern: tuple[int, ...]) -> list[int]:
    if not pattern or any(type(x) is not int or x <= 0 for x in pattern):
        raise ValueError("Positive integer step sizes required")
    ticks = [0]
    for step in cycle(pattern):
        ticks.append(min(END_TICK, ticks[-1] + step))
        if ticks[-1] == END_TICK:
            return ticks
    raise RuntimeError("Unreachable")


def decay_step(value: float, dt: float) -> float:
    if not math.isfinite(value) or not math.isfinite(dt) or dt < 0:
        raise ValueError("Finite state and nonnegative finite dt required")
    return value * math.exp(-math.log(2) * dt / HALF_LIFE_SECONDS)


@dataclass(frozen=True)
class Event:
    tick: int
    identity: str


class EventCursor:
    """Replay an already-captured log over (last_tick, now_tick].
    This checks forward intervals only, not network delivery or persistence.
    """
    def __init__(self, events: tuple[Event, ...]):
        if len({e.identity for e in events}) != len(events):
            raise ValueError("Duplicate event identity")
        if any(type(e.tick) is not int or e.tick <= 0 for e in events):
            raise ValueError("Positive integer event ticks required")
        self.events = tuple(sorted(events, key=lambda e: e.tick))
        self.times = [e.tick for e in self.events]
        self.now_tick = 0
        self.index = 0

    def advance(self, now_tick: int) -> list[str]:
        if type(now_tick) is not int or now_tick < self.now_tick:
            raise ValueError("Rewind needs an explicit checkpoint/reset policy")
        end_index = bisect_right(self.times, now_tick)
        emitted = [e.identity for e in self.events[self.index:end_index]]
        self.now_tick, self.index = now_tick, end_index
        return emitted


def run() -> dict:
    schedules = {f"{fps}_fps": schedule((TICK_HZ // fps,))
                 for fps in (15, 30, 60, 120)}
    schedules["irregular"] = schedule((7, 23, 10, 41, 19))
    expected = 2.0 ** (-(END_TICK / TICK_HZ) / HALF_LIFE_SECONDS)
    decay_rows = []
    for label, ticks in schedules.items():
        good = bad = 1.0
        for previous, current in zip(ticks, ticks[1:]):
            good = decay_step(good, (current - previous) / TICK_HZ)
            bad = decay_step(bad, 1.0 / 60.0)
        assert abs(good - expected) < TOL
        decay_rows.append({"schedule": label, "draw_intervals": len(ticks)-1,
                           "dt_based": good, "fixed_per_draw": bad})

    # Two edges of a 5 ms pulse fall between every tested uniform draw pair.
    edges = (Event(121, "pulse_on"), Event(124, "pulse_off"))
    event_rows = []
    for label, ticks in schedules.items():
        cursor = EventCursor(edges)
        received = []
        for current in ticks:
            received.extend(cursor.advance(current))
        assert received == ["pulse_on", "pulse_off"]
        assert cursor.advance(END_TICK) == []  # no replay on duplicate draw
        polled = sum(121 <= current < 124 for current in ticks)
        if label != "irregular":
            assert polled == 0
        event_rows.append({"schedule": label, "logged_edges_replayed": received,
                           "polls_seeing_active_pulse": polled})

    # Interpolation between two zero samples cannot reconstruct the hidden pulse.
    t0, t1, t_probe = 120, 130, 122
    v0, v1 = 0.0, 0.0
    reconstructed = v0 + (v1-v0) * (t_probe-t0) / (t1-t0)
    assert reconstructed == 0 and 121 <= t_probe < 124

    boundary = EventCursor((Event(600, "edge"),))
    assert boundary.advance(600) == ["edge"]
    assert boundary.advance(600) == []
    assert boundary.advance(1200) == []

    rejected = []
    for name, operation in (
        ("negative_dt", lambda: decay_step(1.0, -0.1)),
        ("nan_dt", lambda: decay_step(1.0, math.nan)),
        ("duplicate_event_id", lambda: EventCursor((Event(1,"x"), Event(2,"x")))),
        ("rewind_without_reset", lambda: boundary.advance(599)),
    ):
        try:
            operation()
        except ValueError:
            rejected.append(name)
        else:
            raise AssertionError("Expected rejection: " + name)

    # A work budget is not permission to erase elapsed time. Abstract example only.
    elapsed, budget = 0.6, 0.2
    whole = decay_step(1.0, elapsed)
    clipped = decay_step(1.0, budget)
    pending = elapsed
    value = 1.0
    batches = 0
    while pending > 1e-15:
        amount = min(budget, pending)
        value = decay_step(value, amount)
        pending -= amount
        batches += 1
    assert abs(value-whole) < TOL
    assert abs(clipped-whole) > 0.1

    return {
        "execution_date": "2026-09-06", "python": platform.python_version(),
        "runtime": "CPU Python standard library only",
        "decay_expected_at_2_seconds": expected, "decay": decay_rows,
        "events": event_rows,
        "hidden_pulse": {"duration_ms": 5.0,
                         "interpolated_value": reconstructed,
                         "actual_value_at_probe": 1.0},
        "exact_boundary_delivered_once": True,
        "invalid_inputs_rejected": rejected,
        "budget_example": {"elapsed_seconds": elapsed, "budget_seconds": budget,
                           "full_elapsed_state": whole, "clipped_state": clipped,
                           "debt_preserving_state": value, "batches": batches},
        "touchdesigner_executed": False, "gpu_executed": False,
        "production_adoption": False,
        "limits": ["Exponential decay has a closed form; not a general solver test",
                   "Events are already captured in an ideal in-memory ordered log",
                   "No clock drift, hardware input, transport, queue overflow, or rendering tested",
                   "Budget example is our algorithm, not a TouchDesigner implementation claim"]
    }


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, indent=2, allow_nan=False))
