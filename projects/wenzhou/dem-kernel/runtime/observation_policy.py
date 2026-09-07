#!/usr/bin/env python3
"""Candidate observation-band policy for the isolated Wenzhou DEM kernel.

The policy converts one explicit precision request into a conservative set of
CDF 5/3 detail levels that may be omitted for an observation reconstruction.
It never changes canonical coefficients and it does not claim calibration on a
real Wenzhou DEM window.  Physical, interaction, story and safety requests can
all demand finer spacing than the visual request.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from pathlib import Path
import sys
from typing import Any, Mapping, Sequence


TRANSFORM_DIR = Path(__file__).resolve().parents[1] / "transform"
if str(TRANSFORM_DIR) not in sys.path:
    sys.path.insert(0, str(TRANSFORM_DIR))

from reversible_cdf53 import EncodedGrid, reconstruct_with_zeroed_details  # noqa: E402


POLICY_ID = "wenzhou-dem-observation-policy/r1-candidate"
DEFAULT_BASE_SPACING_M = 12.5
DEFAULT_VISUAL_ERROR_FRACTION = 0.5


class PrecisionRequestError(ValueError):
    """Raised when an observation precision request is invalid."""


@dataclass(frozen=True)
class PrecisionRequest:
    """Independent precision requests expressed as maximum sample spacing.

    ``pixel_footprint_m`` is the current approximate metres represented by one
    screen pixel at the queried ground position.  The visual candidate spacing
    is ``pixel_footprint_m * visual_error_fraction``.  Optional domain requests
    are direct maximum spacings in metres.  The smallest positive spacing wins.

    ``force_truth`` disables all detail-band removal.  It is intended for exact
    truth queries, protected control points and any task whose evidence contract
    requires the full transformed sample grid.
    """

    pixel_footprint_m: float
    visual_error_fraction: float = DEFAULT_VISUAL_ERROR_FRACTION
    interaction_spacing_m: float | None = None
    physics_spacing_m: float | None = None
    story_spacing_m: float | None = None
    safety_spacing_m: float | None = None
    force_truth: bool = False
    task: str = "visual"


@dataclass(frozen=True)
class BandSelection:
    """Result of one candidate observation-band decision."""

    policy_id: str
    task: str
    base_spacing_m: float
    available_detail_levels: int
    requested_spacing_m: Mapping[str, float]
    governing_domain: str
    governing_spacing_m: float
    selected_nominal_spacing_m: float
    zero_detail_levels: tuple[int, ...]
    retained_detail_levels: tuple[int, ...]
    force_truth: bool
    nodata_guarded: bool
    calibration_status: str

    def to_json_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["requested_spacing_m"] = dict(self.requested_spacing_m)
        result["zero_detail_levels"] = list(self.zero_detail_levels)
        result["retained_detail_levels"] = list(self.retained_detail_levels)
        return result


def _finite_positive(name: str, value: float) -> float:
    number = float(value)
    if not math.isfinite(number) or number <= 0.0:
        raise PrecisionRequestError(f"{name} must be finite and greater than zero")
    return number


def validate_request(request: PrecisionRequest) -> PrecisionRequest:
    """Validate all request units and return the immutable request."""

    _finite_positive("pixel_footprint_m", request.pixel_footprint_m)
    fraction = _finite_positive(
        "visual_error_fraction", request.visual_error_fraction
    )
    if fraction > 1.0:
        raise PrecisionRequestError("visual_error_fraction must not exceed 1.0")

    for name in (
        "interaction_spacing_m",
        "physics_spacing_m",
        "story_spacing_m",
        "safety_spacing_m",
    ):
        value = getattr(request, name)
        if value is not None:
            _finite_positive(name, value)

    if not isinstance(request.task, str) or not request.task.strip():
        raise PrecisionRequestError("task must be a non-empty string")
    return request


def _requested_spacings(request: PrecisionRequest) -> dict[str, float]:
    values: dict[str, float] = {
        "visual": float(request.pixel_footprint_m)
        * float(request.visual_error_fraction)
    }
    optional = {
        "interaction": request.interaction_spacing_m,
        "physics": request.physics_spacing_m,
        "story": request.story_spacing_m,
        "safety": request.safety_spacing_m,
    }
    for name, value in optional.items():
        if value is not None:
            values[name] = float(value)
    return values


def _zero_count_for_spacing(
    *,
    governing_spacing_m: float,
    base_spacing_m: float,
    available_detail_levels: int,
) -> int:
    """Choose the coarsest dyadic spacing that does not exceed the request."""

    zero_count = 0
    tolerance = max(1.0, governing_spacing_m) * 1e-12
    while zero_count < available_detail_levels:
        next_spacing = base_spacing_m * (2.0 ** (zero_count + 1))
        if next_spacing > governing_spacing_m + tolerance:
            break
        zero_count += 1
    return zero_count


def select_visible_bands(
    request: PrecisionRequest,
    *,
    available_detail_levels: int,
    base_spacing_m: float = DEFAULT_BASE_SPACING_M,
    contains_nodata: bool = False,
) -> BandSelection:
    """Select removable detail levels without modifying the world identity.

    Level zero is the finest detail level.  Only a contiguous prefix of finest
    levels can be removed by this R1 policy.  This gives a monotonic dyadic
    observation spacing and avoids arbitrary holes in the frequency hierarchy.
    """

    validate_request(request)
    base = _finite_positive("base_spacing_m", base_spacing_m)
    level_count = int(available_detail_levels)
    if level_count < 0:
        raise PrecisionRequestError("available_detail_levels must be non-negative")

    requested = _requested_spacings(request)
    nodata_guarded = bool(contains_nodata) and not request.force_truth
    if request.force_truth:
        governing_domain = "force_truth"
        governing_spacing = base
        zero_count = 0
    elif nodata_guarded:
        # The current canonical container fills NoData samples with zero before
        # transformation. Exact round trips are safe, while removing detail
        # bands can pull that artificial zero into neighbouring valid heights.
        # R1 therefore keeps all bands in any masked transform tile.
        governing_domain = "nodata_guard"
        governing_spacing = base
        zero_count = 0
    else:
        governing_domain, governing_spacing = min(
            requested.items(), key=lambda item: (item[1], item[0])
        )
        governing_spacing = max(base, float(governing_spacing))
        zero_count = _zero_count_for_spacing(
            governing_spacing_m=governing_spacing,
            base_spacing_m=base,
            available_detail_levels=level_count,
        )

    zero_levels = tuple(range(zero_count))
    retained_levels = tuple(range(zero_count, level_count))
    selected_spacing = base * (2.0**zero_count)
    return BandSelection(
        policy_id=POLICY_ID,
        task=request.task.strip(),
        base_spacing_m=base,
        available_detail_levels=level_count,
        requested_spacing_m=requested,
        governing_domain=governing_domain,
        governing_spacing_m=governing_spacing,
        selected_nominal_spacing_m=selected_spacing,
        zero_detail_levels=zero_levels,
        retained_detail_levels=retained_levels,
        force_truth=bool(request.force_truth),
        nodata_guarded=nodata_guarded,
        calibration_status="generated_fixture_only_real_wenzhou_calibration_pending",
    )


def reconstruct_for_request(
    encoded: EncodedGrid,
    request: PrecisionRequest,
    *,
    base_spacing_m: float = DEFAULT_BASE_SPACING_M,
):
    """Return one observation reconstruction and its explicit band decision."""

    selection = select_visible_bands(
        request,
        available_detail_levels=len(encoded.level_shapes),
        base_spacing_m=base_spacing_m,
        contains_nodata=bool(encoded.nodata_mask.any()),
    )
    grid = reconstruct_with_zeroed_details(
        encoded, selection.zero_detail_levels
    )
    return grid, selection


def select_visible_bands_from_dict(
    request: Mapping[str, Any],
    *,
    available_detail_levels: int,
    base_spacing_m: float = DEFAULT_BASE_SPACING_M,
) -> BandSelection:
    """JSON-friendly wrapper with strict field names."""

    allowed = {
        "pixel_footprint_m",
        "visual_error_fraction",
        "interaction_spacing_m",
        "physics_spacing_m",
        "story_spacing_m",
        "safety_spacing_m",
        "force_truth",
        "task",
    }
    unknown = sorted(set(request) - allowed)
    if unknown:
        raise PrecisionRequestError(f"unknown precision request fields: {unknown}")
    return select_visible_bands(
        PrecisionRequest(**dict(request)),
        available_detail_levels=available_detail_levels,
        base_spacing_m=base_spacing_m,
    )


__all__ = [
    "BandSelection",
    "DEFAULT_BASE_SPACING_M",
    "DEFAULT_VISUAL_ERROR_FRACTION",
    "POLICY_ID",
    "PrecisionRequest",
    "PrecisionRequestError",
    "reconstruct_for_request",
    "select_visible_bands",
    "select_visible_bands_from_dict",
    "validate_request",
]
