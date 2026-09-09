"""Research level-pool routing through ideal openings, using the R021 ledger.

This is not a Saint-Venant channel solver. Pools have horizontal water surfaces
and constant areas. Wetting fronts, momentum and erosion are not represented.
"""
from dataclasses import dataclass
from fractions import Fraction
from math import fsum

from hydraulic_sections import Opening, number
from water_ledger import SnapshotKey, Transfer, advance


@dataclass(frozen=True)
class Pool:
    id: str
    bed_m: float
    area_m2: float
    crest_m: float

    def __post_init__(self):
        if not isinstance(self.id, str) or not self.id.strip():
            raise ValueError("pool identity required")
        number(self.bed_m, "bed")
        number(self.crest_m, "crest")
        number(self.area_m2, "area", positive=True)
        if self.crest_m <= self.bed_m:
            raise ValueError("crest must be above bed")


def _euler_step(*, pools, openings, storage_m3, snapshot: SnapshotKey,
         expected_snapshot: SnapshotKey, end_time_s: int,
         source_budgets_m3=None, forcing_edges=(), forcing_transfers=(),
         evaluation_storage_m3=None):
    """Explicit one-snapshot proposal, conservative and invariant to list order.

    The limiter bounds each pair's equalization volume and each donor's storage,
    split by active degree. It prevents large-step head reversal for internal
    exchange. It is a numerical limiter, not a capacity or physical calibration.
    External forcing may change ordering; it is applied once by the same ledger.
    All limited links are exposed for step-refinement diagnostics.
    """
    if snapshot != expected_snapshot:
        raise ValueError("stale or incompatible snapshot")
    if type(snapshot.time_s) not in (int, Fraction) or type(end_time_s) not in (int, Fraction) or end_time_s <= snapshot.time_s:
        raise ValueError("increasing exact integer/rational-second interval required")
    dt = float(end_time_s - snapshot.time_s)
    by_id = {p.id: p for p in pools}
    if len(by_id) != len(pools) or set(storage_m3) != set(by_id):
        raise ValueError("unique pools and exact storage coverage required")
    for i, volume in storage_m3.items():
        number(volume, i, minimum=0)
    evaluation = storage_m3 if evaluation_storage_m3 is None else evaluation_storage_m3
    heads = {i: number(p.bed_m + evaluation[i]/p.area_m2, i) for i, p in by_id.items()}
    ids = set()
    raw = []
    degree = {i: 0 for i in by_id}
    for o in sorted(openings, key=lambda x: x.id):
        if not isinstance(o, Opening) or o.id in ids:
            raise ValueError("unique opening identities required")
        ids.add(o.id)
        if o.a not in by_id or o.b not in by_id:
            raise ValueError("opening references unknown pool")
        if o.invert_m < max(by_id[o.a].bed_m, by_id[o.b].bed_m):
            raise ValueError("opening invert below connected pool bed")
        q = o.discharge(heads[o.a], heads[o.b])
        raw.append((o, q))
        if q:
            degree[o.a] += 1
            degree[o.b] += 1
    transfers = list(forcing_transfers)
    if any(not t.id.startswith("forcing:") for t in forcing_transfers):
        raise ValueError("external forcing transfer ids require forcing: prefix")
    links = []
    for o, q in raw:
        a, b = (o.a, o.b) if q >= 0 else (o.b, o.a)
        requested = abs(q)*dt
        volume = 0.
        if q:
            equalize = abs(heads[a]-heads[b]) / (1/by_id[a].area_m2 + 1/by_id[b].area_m2)
            limit = .5 * min(equalize/max(degree[a], degree[b]), storage_m3[a]/degree[a])
            volume = min(requested, limit)
            if volume:
                transfers.append(Transfer("opening:"+o.id, a, b, volume))
        links.append({"id": o.id, "from": a, "to": b,
                      "raw_signed_q_m3_s": q,
                      "transferred_m3": volume,
                      "limited": volume < requested})
    edges = set(forcing_edges)
    for o in openings:
        edges.update(((o.a, o.b), (o.b, o.a)))
    result = advance(snapshot=snapshot, expected_snapshot=expected_snapshot,
                     end_time_s=end_time_s, storage_m3=storage_m3,
                     source_budgets_m3={} if source_budgets_m3 is None else source_budgets_m3,
                     receivers=(), allowed_edges=sorted(edges), transfers=transfers)
    next_heads = {i: by_id[i].bed_m+v/by_id[i].area_m2 for i, v in result["storage_m3"].items()}
    result.update(model="ideal_hydrostatic_level_pools_r022", links=links,
                  water_levels_m=next_heads,
                  freeboard_m={i: by_id[i].crest_m-h for i,h in next_heads.items()},
                  over_crest=[i for i,h in next_heads.items() if h > by_id[i].crest_m],
                  hydraulicFeasibility="ideal_model_only_not_regionally_calibrated")
    return result


def step(**kwargs):
    """Explicit midpoint in wet pools, with the R021 atomic committed-state budget.

    The Euler predictor is never committed. Its midpoint estimates hydraulic
    heads only; both passes draw from the original donor storage and apply the
    same forcing exactly once in their respective uncommitted proposal.
    Near dry cells/limiters, accuracy must be established by step refinement.
    """
    predictor = _euler_step(**kwargs)
    midpoint = {i: .5*(v+predictor["storage_m3"][i]) for i,v in kwargs["storage_m3"].items()}
    result = _euler_step(**kwargs, evaluation_storage_m3=midpoint)
    result["time_integrator"] = "explicit_midpoint_with_donor_and_head_limiter"
    return result


def shared_boundary_registry(cell_vertex_rings):
    """Build each semantic edge once, independent of cell order or ring winding.

    Vertex IDs must already be registered in a common spatial topology. This
    routine does not discover overlapping curves or mismatched subdivisions.
    """
    registry, references = {}, {}
    for cell, ring in sorted(cell_vertex_rings.items()):
        if not isinstance(cell, str) or not cell.strip():
            raise ValueError("cell identity required")
        if not isinstance(ring, (tuple, list)) or len(ring) < 3 or len(set(ring)) != len(ring):
            raise ValueError("open vertex ring requires >=3 unique vertex ids")
        references[cell] = []
        for a,b in zip(ring, ring[1:]+ring[:1]):
            if any(not isinstance(v, str) or not v.strip() for v in (a,b)):
                raise ValueError("vertex identities required")
            key = tuple(sorted((a,b)))
            registry.setdefault(key, []).append(cell)
            if len(registry[key]) > 2:
                raise ValueError("non-manifold boundary serves more than two fields")
            references[cell].append(key)
    return {"boundaries": [{"vertices": key, "served_fields": tuple(cells)}
                           for key,cells in sorted(registry.items())],
            "cell_references": references,
            "scope": "registered_topology_only_not_geometric_overlap_validation"}
