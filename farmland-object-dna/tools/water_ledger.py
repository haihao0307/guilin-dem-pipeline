"""Atomic finite-volume accounting for *supplied* flux proposals.

Research core: not a channel discharge solver. Every volume is integrated over
one explicit interval in m3. A source authority supplies a finite budget; rain,
evaporation and seepage are explicit transfers to/from named external accounts.
No terrain, crop, weather, water-right or renderer state is created here.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import fsum, isfinite
from typing import Mapping, Sequence


@dataclass(frozen=True)
class SnapshotKey:
    world_id: str
    frame: str
    revision: str
    time_s: int


@dataclass(frozen=True)
class Transfer:
    id: str
    source: str
    target: str
    volume_m3: float


def _volume(value: float, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) or value < 0:
        raise ValueError(f"{name}: finite nonnegative m3 required; unknown is not zero")


def advance(
    *, snapshot: SnapshotKey, expected_snapshot: SnapshotKey, end_time_s: int,
    storage_m3: Mapping[str, float], source_budgets_m3: Mapping[str, float],
    receivers: Sequence[str], allowed_edges: Sequence[tuple[str, str]],
    transfers: Sequence[Transfer],
) -> dict:
    """Return a new proposal without mutating inputs; reject invalid work atomically.

    All outgoing flux draws from the committed starting storage/budget. Incoming
    water can be forwarded on the next step, never recursively in this step.
    Insufficient storage rejects the proposal (no silent clipping or lost water).
    Integrators must reduce their step or recompute their fluxes on rejection.
    """
    if snapshot != expected_snapshot:
        raise ValueError("stale or incompatible world/frame/revision/time snapshot")
    if any(not isinstance(x, str) or not x.strip() for x in (
        snapshot.world_id, snapshot.frame, snapshot.revision
    )):
        raise ValueError("world/frame/revision required")
    if type(snapshot.time_s) is not int or type(end_time_s) is not int or end_time_s <= snapshot.time_s:
        raise ValueError("integer seconds and strictly increasing interval required")
    field_ids, source_ids, sink_ids = set(storage_m3), set(source_budgets_m3), set(receivers)
    if not field_ids or len(sink_ids) != len(receivers):
        raise ValueError("storage required; receiver ids must be unique")
    if field_ids & source_ids or field_ids & sink_ids or source_ids & sink_ids:
        raise ValueError("storage/source/receiver identities must be distinct")
    all_ids = field_ids | source_ids | sink_ids
    if any(not isinstance(i, str) or not i.strip() for i in all_ids):
        raise ValueError("account ids must be nonempty strings")
    for key, value in list(storage_m3.items()) + list(source_budgets_m3.items()):
        _volume(value, key)
    edges = set(allowed_edges)
    if len(edges) != len(allowed_edges):
        raise ValueError("duplicate allowed edge")
    for a, b in edges:
        if a not in field_ids | source_ids or b not in field_ids | sink_ids or a == b:
            raise ValueError("invalid directed transfer edge")
    incoming = {i: [] for i in all_ids}
    outgoing = {i: [] for i in all_ids}
    seen = set()
    for t in transfers:
        if not isinstance(t.id, str) or not t.id.strip() or t.id in seen:
            raise ValueError("transfer ids must be unique and nonempty")
        seen.add(t.id)
        _volume(t.volume_m3, t.id)
        if (t.source, t.target) not in edges:
            raise ValueError(f"{t.id}: transfer lacks declared path")
        outgoing[t.source].append((t.id, t.volume_m3))
        incoming[t.target].append((t.id, t.volume_m3))
    # Sort by stable transaction identity: input array order has no semantics.
    total_in = {i: fsum(v for _, v in sorted(incoming[i])) for i in sorted(all_ids)}
    total_out = {i: fsum(v for _, v in sorted(outgoing[i])) for i in sorted(all_ids)}
    for i in all_ids:
        _volume(total_in[i], i)
        _volume(total_out[i], i)
    for i, budget in list(storage_m3.items()) + list(source_budgets_m3.items()):
        if total_out[i] > budget:
            raise ValueError(f"{i}: outgoing water exceeds committed storage or accepted supply")
    next_storage = {
        i: fsum([storage_m3[i], -total_out[i], total_in[i]]) for i in sorted(field_ids)
    }
    for i, v in next_storage.items():
        _volume(v, i)
    external_in = fsum(total_out[i] for i in sorted(source_ids))
    external_out = fsum(total_in[i] for i in sorted(sink_ids))
    residual = fsum(list(next_storage.values()) + [-v for v in storage_m3.values()] + [-external_in, external_out])
    tolerance = 1e-6 + 1e-9 * max(external_in, external_out)
    if not isfinite(residual) or abs(residual) > tolerance:
        raise ValueError("global water budget failed")
    return {
        "world_id": snapshot.world_id, "frame": snapshot.frame,
        "base_revision": snapshot.revision, "interval_s": [snapshot.time_s, end_time_s],
        "storage_m3": next_storage,
        "accounts": {i: {"in_m3": total_in[i], "out_m3": total_out[i]} for i in sorted(all_ids)},
        "source_unused_m3": {i: source_budgets_m3[i] - total_out[i] for i in sorted(source_ids)},
        "external_in_m3": external_in, "external_out_m3": external_out,
        "mass_balance_error_m3": residual, "tolerance_m3": tolerance,
        "transfer_count": len(transfers), "status": "research_proposal_not_committed",
        "hydraulicFeasibility": "not_evaluated", "productionReady": False,
    }
