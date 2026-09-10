from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Checkpoint:
    name: str
    independent: bool
    semantic_equivalence: Literal["proven", "unknown", "rejected"]
    same_cycle_support: bool
    available: bool


def eligible(checkpoint: Checkpoint) -> bool:
    return (
        checkpoint.available
        and checkpoint.independent
        and checkpoint.semantic_equivalence == "proven"
        and checkpoint.same_cycle_support
    )


# Locked NOAA-EMC/HRRR v4.1.20 source signatures.
CALC_EFFECTRAD_ARGS = {
    "t1d", "p1d", "qv1d", "qc1d", "nc1d", "qi1d", "ni1d", "qs1d"
}
POST_EFFR_ARGS = {
    "pmid", "t", "q", "qqw", "qqi", "qqr", "f_rimef", "nlice", "nrain",
    "qqs", "qqg", "qqnr", "qqni", "mp_opt", "species"
}

checks = []

self_replay = Checkpoint("self_replay", False, "proven", True, True)
checks.append((
    "self replay is self-consistency, not an independent checkpoint",
    not eligible(self_replay),
))

post_effr = Checkpoint("hrrr_wrfpost_EFFR", True, "unknown", True, True)
checks.append((
    "independent post EFFR is not authentication while semantic equivalence is unknown",
    not eligible(post_effr),
))

checks.append((
    "calc_effectRad and post EFFR have materially different input signatures",
    CALC_EFFECTRAD_ARGS != POST_EFFR_ARGS and bool(POST_EFFR_ARGS - CALC_EFFECTRAD_ARGS),
))

operational_state = Checkpoint(
    "operational_re_cloud_state", True, "proven", True, True
)
checks.append((
    "an independently emitted exact-runtime source-model-state checkpoint can qualify",
    eligible(operational_state),
))

same_name_only = Checkpoint("same_name_only", True, "unknown", True, True)
checks.append((
    "same variable name or unit without derivation equivalence is insufficient",
    not eligible(same_name_only),
))

rrfs_field = Checkpoint("RRFS_cleffr", True, "proven", False, True)
checks.append((
    "a later RRFS Thompson effective-radius field cannot authenticate HRRRv4",
    not eligible(rrfs_field),
))

public_hrrr_re = Checkpoint(
    "public_HRRR_native_effective_radius", True, "proven", True, False
)
checks.append((
    "an effective-radius field absent from the inspected public HRRR native product cannot checkpoint",
    not eligible(public_hrrr_re),
))

real_input_executed = False
eligible_observed_checkpoints = [self_replay, post_effr, rrfs_field, public_hrrr_re]
independent_checkpoint_matched = any(eligible(c) for c in eligible_observed_checkpoints)
status = "source_callpath_authenticated"
if real_input_executed:
    status = "real_input_executed"
if real_input_executed and independent_checkpoint_matched:
    status = "runtime_authenticated"
checks.append((
    "authentication status cannot advance without actual input execution plus a matched eligible checkpoint",
    status == "source_callpath_authenticated",
))

passed = sum(ok for _, ok in checks)
for label, ok in checks:
    print(("PASS" if ok else "FAIL") + ": " + label)
print(f"RESULT: {passed}/{len(checks)} PASS")

if passed != len(checks):
    raise SystemExit(1)
