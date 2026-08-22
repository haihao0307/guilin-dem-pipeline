#!/usr/bin/env python3
"""Deterministic habitat-aware ecology and agriculture compiler for DEM v0.4."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, MutableMapping, Sequence

SCHEMA_VERSION = "dem_ecology_release@0.4.0"
AGRICULTURE_NONE = 0
AGRICULTURE_PADDY = 1
AGRICULTURE_VEGETABLE_GREEN = 2
AGRICULTURE_VEGETABLE_BLUE = 3
AGRICULTURE_DRYLAND_MAIZE = 4
AGRICULTURE_DRYLAND_ROOT = 5
AGRICULTURE_ORCHARD = 6
AGRICULTURE_FALLOW = 7
AGRICULTURE_HARVESTED = 8
AGRICULTURE_NAMES = {
    0: "none",
    1: "paddy_rice",
    2: "vegetable_leaf_green",
    3: "vegetable_blue_green",
    4: "dryland_maize",
    5: "dryland_root_crop",
    6: "orchard",
    7: "fallow",
    8: "harvested",
}
LAND_FORBIDDEN_FOR_AGRICULTURE = {0, 1, 6, 7, 8}


@dataclass(frozen=True)
class EcologyConfig:
    seed: int = 1944
    minimum_active_prototypes: int = 18
    ensure_catalog_coverage: bool = True
    tree_base_probability: float = 0.42
    shrub_base_probability: float = 0.24
    bamboo_base_probability: float = 0.36
    field_block_size_cells: int = 10
    bund_width_cells: int = 1
    orchard_spacing_cells: int = 3
    max_instances_per_cell: int = 1


class EcologyCompileError(ValueError):
    pass


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def hash01(seed: int, layer: str, global_col: int, global_row: int, salt: int = 0) -> float:
    payload = f"{seed}:{layer}:{global_col}:{global_row}:{salt}".encode("utf-8")
    digest = hashlib.blake2b(payload, digest_size=8).digest()
    return int.from_bytes(digest, "little") / float(2**64 - 1)


def stable_id(seed: int, layer: str, global_col: int, global_row: int, salt: str) -> str:
    payload = f"{seed}:{layer}:{global_col}:{global_row}:{salt}".encode("utf-8")
    return hashlib.blake2b(payload, digest_size=12).hexdigest()


def _required_field(fields: Mapping[str, Any], name: str, size: int) -> list[Any]:
    value = fields.get(name)
    if not isinstance(value, list) or len(value) != size:
        raise EcologyCompileError(f"terrain field {name!r} must be a list of length {size}")
    return value


def _optional_field(
    fields: Mapping[str, Any], name: str, size: int, default: float
) -> list[float]:
    value = fields.get(name)
    if value is None:
        return [default] * size
    if not isinstance(value, list) or len(value) != size:
        raise EcologyCompileError(f"optional terrain field {name!r} has invalid length")
    return [default if item is None else float(item) for item in value]


def _prototype_map(knowledge: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    prototypes = knowledge.get("prototypes")
    if not isinstance(prototypes, list):
        raise EcologyCompileError("knowledge.prototypes must be a list")
    result: dict[str, Mapping[str, Any]] = {}
    for prototype in prototypes:
        if not isinstance(prototype, Mapping):
            raise EcologyCompileError("each prototype must be an object")
        prototype_id = str(prototype.get("id", ""))
        if not prototype_id or prototype_id in result:
            raise EcologyCompileError("prototype IDs must be non-empty and unique")
        result[prototype_id] = prototype
    if len(result) < 18:
        raise EcologyCompileError("at least 18 declared prototypes are required")
    return result


def moisture_index(distance_to_water_m: float, landform: int, slope_deg: float) -> float:
    water_term = math.exp(-max(distance_to_water_m, 0.0) / 420.0)
    landform_bonus = {1: 0.35, 2: 0.30, 3: 0.18, 4: 0.08}.get(landform, 0.0)
    slope_penalty = min(max(slope_deg, 0.0) / 90.0, 1.0) * 0.18
    return min(1.0, max(0.0, 0.12 + 0.70 * water_term + landform_bonus - slope_penalty))


def field_pattern_at_global_cell(
    global_col: int,
    global_row: int,
    cell_size_m: float,
    orientation_deg: float,
    row_spacing_m: float,
    phase_seed: float,
) -> float:
    angle = math.radians(orientation_deg)
    x_m = (global_col + 0.5) * cell_size_m
    y_m = (global_row + 0.5) * cell_size_m
    projected = x_m * math.cos(angle) + y_m * math.sin(angle)
    spacing = max(row_spacing_m, 0.01)
    return ((projected / spacing) + phase_seed) % 1.0


def _matches_prototype(
    prototype: Mapping[str, Any],
    *,
    landform: int,
    slope_deg: float,
    distance_to_water_m: float,
    moisture: float,
    distance_to_settlement_m: float,
    agriculture_class: int,
    hard_excluded: bool,
    active_bank: bool,
    rock_core: bool,
) -> bool:
    if hard_excluded or rock_core or active_bank:
        return False
    kind = str(prototype.get("kind", "tree"))
    if agriculture_class and kind != "fruit_tree":
        return False
    if kind == "fruit_tree" and agriculture_class != AGRICULTURE_ORCHARD:
        return False
    habitat = prototype.get("habitat", {})
    allowed_landforms = {int(value) for value in habitat.get("landform_classes", [])}
    if allowed_landforms and landform not in allowed_landforms:
        return False
    slope_range = habitat.get("slope_deg", [0.0, 90.0])
    water_range = habitat.get("distance_to_water_m", [0.0, 1e12])
    moisture_range = habitat.get("moisture", [0.0, 1.0])
    settlement_range = habitat.get("distance_to_settlement_m", [0.0, 1e12])
    return (
        float(slope_range[0]) <= slope_deg <= float(slope_range[1])
        and float(water_range[0]) <= distance_to_water_m <= float(water_range[1])
        and float(moisture_range[0]) <= moisture <= float(moisture_range[1])
        and float(settlement_range[0]) <= distance_to_settlement_m <= float(settlement_range[1])
    )


def _agriculture_suitability(
    *,
    landform: int,
    slope_deg: float,
    distance_to_water_m: float,
    distance_to_settlement_m: float,
    drains_to_water: bool,
    hard_excluded: bool,
    active_bank: bool,
    rock_core: bool,
) -> dict[int, float]:
    scores = {key: 0.0 for key in AGRICULTURE_NAMES}
    if hard_excluded or active_bank or rock_core or landform in LAND_FORBIDDEN_FOR_AGRICULTURE:
        return scores
    if landform in {2, 3, 4} and slope_deg <= 5.5 and distance_to_water_m <= 360.0 and drains_to_water:
        scores[AGRICULTURE_PADDY] = 1.0 - min(slope_deg / 5.5, 1.0) * 0.35 - min(distance_to_water_m / 360.0, 1.0) * 0.20
    if landform in {2, 3, 4} and slope_deg <= 6.5 and distance_to_settlement_m <= 360.0:
        base = 0.74 - min(distance_to_settlement_m / 360.0, 1.0) * 0.28
        scores[AGRICULTURE_VEGETABLE_GREEN] = base
        scores[AGRICULTURE_VEGETABLE_BLUE] = base * 0.96
    if landform in {3, 4, 5} and slope_deg <= 13.0 and distance_to_water_m >= 100.0:
        scores[AGRICULTURE_DRYLAND_MAIZE] = 0.62 - min(slope_deg / 13.0, 1.0) * 0.20
        scores[AGRICULTURE_DRYLAND_ROOT] = 0.59 - min(slope_deg / 13.0, 1.0) * 0.18
    if landform in {3, 4, 5} and 1.0 <= slope_deg <= 18.0 and 70.0 <= distance_to_water_m <= 900.0 and distance_to_settlement_m <= 1600.0:
        scores[AGRICULTURE_ORCHARD] = 0.67 - min(abs(slope_deg - 8.0) / 18.0, 1.0) * 0.20
    if landform in {2, 3, 4} and slope_deg <= 8.0:
        scores[AGRICULTURE_FALLOW] = 0.35
        scores[AGRICULTURE_HARVESTED] = 0.33
    return scores


def _select_agriculture(
    scores: Mapping[int, float], seed: int, global_col: int, global_row: int
) -> int:
    ranked: list[tuple[float, int]] = []
    for agriculture_class, score in scores.items():
        if agriculture_class == AGRICULTURE_NONE or score <= 0:
            continue
        variation = 0.82 + 0.36 * hash01(seed, "agriculture-choice", global_col, global_row, agriculture_class)
        ranked.append((score * variation, agriculture_class))
    if not ranked:
        return AGRICULTURE_NONE
    best_score, best_class = max(ranked, key=lambda item: (item[0], -item[1]))
    occupancy = hash01(seed, "agriculture-occupancy", global_col, global_row)
    threshold = 0.50 if best_class == AGRICULTURE_PADDY else 0.57
    return best_class if best_score >= threshold and occupancy <= best_score else AGRICULTURE_NONE


def _field_properties(seed: int, global_col: int, global_row: int, block_size: int) -> tuple[str, float, float]:
    block_x = math.floor(global_col / block_size)
    block_y = math.floor(global_row / block_size)
    field_id = stable_id(seed, "field-block", block_x, block_y, "field")
    orientation = hash01(seed, "field-orientation", block_x, block_y) * 180.0
    phase = hash01(seed, "field-phase", block_x, block_y)
    return field_id, orientation, phase


def _instance_from_prototype(
    prototype: Mapping[str, Any],
    *,
    seed: int,
    global_col: int,
    global_row: int,
    local_index: int,
    cell_size_m: float,
    moisture: float,
    landform: int,
    distance_to_water_m: float,
) -> dict[str, Any]:
    prototype_id = str(prototype["id"])
    jitter_x = hash01(seed, prototype_id + ":jx", global_col, global_row) - 0.5
    jitter_y = hash01(seed, prototype_id + ":jy", global_col, global_row) - 0.5
    scale_range = prototype.get("scale_range", [0.85, 1.15])
    scale = float(scale_range[0]) + (float(scale_range[1]) - float(scale_range[0])) * hash01(seed, prototype_id + ":scale", global_col, global_row)
    palette = prototype.get("palette", ["#477a35"])
    palette_index = min(len(palette) - 1, int(hash01(seed, prototype_id + ":palette", global_col, global_row) * len(palette)))
    height_range = prototype.get("height_m", [2.0, 8.0])
    height_m = float(height_range[0]) + (float(height_range[1]) - float(height_range[0])) * hash01(seed, prototype_id + ":height", global_col, global_row)
    return {
        "id": stable_id(seed, "instance", global_col, global_row, prototype_id),
        "prototype_id": prototype_id,
        "kind": prototype.get("kind", "tree"),
        "global_col": global_col,
        "global_row": global_row,
        "local_cell_index": local_index,
        "x_m": round((global_col + 0.5 + jitter_x * 0.64) * cell_size_m, 4),
        "y_m": round((global_row + 0.5 + jitter_y * 0.64) * cell_size_m, 4),
        "rotation_deg": round(hash01(seed, prototype_id + ":rot", global_col, global_row) * 360.0, 4),
        "scale": round(scale, 5),
        "height_m": round(height_m * scale, 4),
        "palette_index": palette_index,
        "moisture": round(moisture, 5),
        "landform_class": landform,
        "distance_to_water_m": round(distance_to_water_m, 4),
    }


def compile_ecology_agriculture(
    terrain_release: Mapping[str, Any],
    knowledge: Mapping[str, Any],
    agriculture_config: Mapping[str, Any],
    config: EcologyConfig | None = None,
) -> dict[str, Any]:
    config = config or EcologyConfig()
    prototypes = _prototype_map(knowledge)
    terrain_manifest = terrain_release.get("manifest", {})
    grid = terrain_manifest.get("grid", {})
    width = int(grid.get("width", 0))
    height = int(grid.get("height", 0))
    cell_size_m = float(grid.get("cell_size_m", 0.0))
    origin_col = int(grid.get("origin_col", 0))
    origin_row = int(grid.get("origin_row", 0))
    size = width * height
    if width < 2 or height < 2 or cell_size_m <= 0:
        raise EcologyCompileError("invalid terrain grid contract")
    fields = terrain_release.get("fields")
    if not isinstance(fields, Mapping):
        raise EcologyCompileError("terrain release must contain fields")
    water = [int(bool(value)) for value in _required_field(fields, "permanent_water_mask", size)]
    active_bank = [int(bool(value)) for value in _required_field(fields, "active_bank_mask", size)]
    hard_exclusion = [int(bool(value)) for value in _required_field(fields, "hard_exclusion_mask", size)]
    rock_core = [int(bool(value)) for value in _required_field(fields, "karst_rock_core_mask", size)]
    landform = [int(value) for value in _required_field(fields, "landform_class", size)]
    slope = [float(value) for value in _required_field(fields, "slope_deg", size)]
    distance_to_water = _optional_field(fields, "distance_to_water_m", size, 1e9)
    drains_to_water = [int(bool(value)) for value in _required_field(fields, "drains_to_permanent_water", size)]
    distance_to_settlement = _optional_field(fields, "distance_to_settlement_m", size, 900.0)

    agriculture_class = [AGRICULTURE_NONE] * size
    field_id: list[str | None] = [None] * size
    field_orientation = [0.0] * size
    field_phase = [0.0] * size
    row_phase = [0.0] * size
    crop_palette_index = [0] * size
    palette_count = max(1, len(agriculture_config.get("crop_palettes", [])))
    for idx in range(size):
        row, col = divmod(idx, width)
        global_col = origin_col + col
        global_row = origin_row + row
        scores = _agriculture_suitability(
            landform=landform[idx],
            slope_deg=slope[idx],
            distance_to_water_m=distance_to_water[idx],
            distance_to_settlement_m=distance_to_settlement[idx],
            drains_to_water=bool(drains_to_water[idx]),
            hard_excluded=bool(hard_exclusion[idx] or water[idx]),
            active_bank=bool(active_bank[idx]),
            rock_core=bool(rock_core[idx]),
        )
        selected = _select_agriculture(scores, config.seed, global_col, global_row)
        agriculture_class[idx] = selected
        if selected:
            fid, orientation, phase = _field_properties(config.seed, global_col, global_row, config.field_block_size_cells)
            field_id[idx] = fid
            field_orientation[idx] = round(orientation, 5)
            field_phase[idx] = round(phase, 6)
            spacing_by_class = {
                AGRICULTURE_PADDY: 0.32,
                AGRICULTURE_VEGETABLE_GREEN: 0.45,
                AGRICULTURE_VEGETABLE_BLUE: 0.42,
                AGRICULTURE_DRYLAND_MAIZE: 0.75,
                AGRICULTURE_DRYLAND_ROOT: 0.58,
                AGRICULTURE_ORCHARD: cell_size_m * config.orchard_spacing_cells,
                AGRICULTURE_FALLOW: 1.2,
                AGRICULTURE_HARVESTED: 0.35,
            }.get(selected, 0.5)
            row_phase[idx] = round(field_pattern_at_global_cell(global_col, global_row, cell_size_m, orientation, spacing_by_class, phase), 6)
            crop_palette_index[idx] = int(hash01(config.seed, "crop-palette", global_col, global_row, selected) * palette_count) % palette_count

    bund_mask = [0] * size
    for idx, selected in enumerate(agriculture_class):
        if not selected:
            continue
        row, col = divmod(idx, width)
        neighbour_indices = []
        if col > 0:
            neighbour_indices.append(idx - 1)
        if col + 1 < width:
            neighbour_indices.append(idx + 1)
        if row > 0:
            neighbour_indices.append(idx - width)
        if row + 1 < height:
            neighbour_indices.append(idx + width)
        if any(agriculture_class[n] != selected or field_id[n] != field_id[idx] for n in neighbour_indices):
            bund_mask[idx] = 1

    instances: list[dict[str, Any]] = []
    eligible_by_prototype: dict[str, list[tuple[float, int]]] = {prototype_id: [] for prototype_id in prototypes}
    occupied_cells: set[int] = set()
    for idx in range(size):
        row, col = divmod(idx, width)
        global_col = origin_col + col
        global_row = origin_row + row
        moisture = moisture_index(distance_to_water[idx], landform[idx], slope[idx])
        eligible: list[tuple[float, Mapping[str, Any]]] = []
        for prototype_id, prototype in prototypes.items():
            if not _matches_prototype(
                prototype,
                landform=landform[idx],
                slope_deg=slope[idx],
                distance_to_water_m=distance_to_water[idx],
                moisture=moisture,
                distance_to_settlement_m=distance_to_settlement[idx],
                agriculture_class=agriculture_class[idx],
                hard_excluded=bool(hard_exclusion[idx] or water[idx]),
                active_bank=bool(active_bank[idx]),
                rock_core=bool(rock_core[idx]),
            ):
                continue
            preference = float(prototype.get("occurrence_weight", 0.5))
            score = preference * (0.76 + 0.48 * hash01(config.seed, "prototype-score:" + prototype_id, global_col, global_row))
            eligible.append((score, prototype))
            eligible_by_prototype[prototype_id].append((score, idx))
        if not eligible:
            continue
        score, selected_prototype = max(eligible, key=lambda item: (item[0], str(item[1]["id"])))
        kind = str(selected_prototype.get("kind", "tree"))
        probability = {"tree": config.tree_base_probability, "shrub": config.shrub_base_probability, "bamboo": config.bamboo_base_probability, "fruit_tree": 0.82}.get(kind, 0.25)
        if kind == "fruit_tree":
            spacing = max(config.orchard_spacing_cells, 1)
            row_key = math.floor(global_row / spacing)
            col_key = math.floor(global_col / spacing)
            missing_row = hash01(config.seed, "orchard-missing-row", 0, row_key) < 0.08
            missing_tree = hash01(config.seed, "orchard-missing-tree", col_key, row_key) < 0.12
            on_grid = global_col % spacing == 0 and global_row % spacing == 0
            place = on_grid and not missing_row and not missing_tree
        else:
            place = hash01(config.seed, "placement:" + str(selected_prototype["id"]), global_col, global_row) <= min(0.96, probability * max(0.35, score))
        if not place:
            continue
        instances.append(_instance_from_prototype(selected_prototype, seed=config.seed, global_col=global_col, global_row=global_row, local_index=idx, cell_size_m=cell_size_m, moisture=moisture, landform=landform[idx], distance_to_water_m=distance_to_water[idx]))
        occupied_cells.add(idx)

    active_prototypes = {str(instance["prototype_id"]) for instance in instances}
    if config.ensure_catalog_coverage and len(active_prototypes) < config.minimum_active_prototypes:
        missing = [prototype_id for prototype_id in sorted(prototypes) if prototype_id not in active_prototypes]
        for prototype_id in missing:
            candidates = sorted(eligible_by_prototype[prototype_id], key=lambda item: (-item[0], item[1]))
            selected_index = next((candidate_index for _, candidate_index in candidates if candidate_index not in occupied_cells), None)
            if selected_index is None:
                continue
            row, col = divmod(selected_index, width)
            global_col = origin_col + col
            global_row = origin_row + row
            moisture = moisture_index(distance_to_water[selected_index], landform[selected_index], slope[selected_index])
            instances.append(_instance_from_prototype(prototypes[prototype_id], seed=config.seed, global_col=global_col, global_row=global_row, local_index=selected_index, cell_size_m=cell_size_m, moisture=moisture, landform=landform[selected_index], distance_to_water_m=distance_to_water[selected_index]))
            occupied_cells.add(selected_index)
            active_prototypes.add(prototype_id)
            if len(active_prototypes) >= config.minimum_active_prototypes:
                break

    instances.sort(key=lambda item: item["id"])
    active_prototypes = {str(instance["prototype_id"]) for instance in instances}
    fields_out = {
        "agriculture_class": agriculture_class,
        "field_id": field_id,
        "field_orientation_deg": field_orientation,
        "field_phase": field_phase,
        "row_phase": row_phase,
        "bund_mask": bund_mask,
        "crop_palette_index": crop_palette_index,
    }
    validation = {
        "water_instance_count": sum(1 for instance in instances if water[int(instance["local_cell_index"])]),
        "hard_exclusion_instance_count": sum(1 for instance in instances if hard_exclusion[int(instance["local_cell_index"])]),
        "agriculture_forbidden_cell_count": sum(1 for idx, selected in enumerate(agriculture_class) if selected and (water[idx] or active_bank[idx] or hard_exclusion[idx] or rock_core[idx] or landform[idx] in LAND_FORBIDDEN_FOR_AGRICULTURE)),
        "undeclared_prototype_instance_count": sum(1 for instance in instances if instance["prototype_id"] not in prototypes),
        "declared_prototype_count": len(prototypes),
        "active_prototype_count": len(active_prototypes),
        "minimum_active_prototypes": config.minimum_active_prototypes,
        "active_prototypes": sorted(active_prototypes),
    }
    release: MutableMapping[str, Any] = {
        "schema": SCHEMA_VERSION,
        "terrain_release_sha256": terrain_manifest.get("release_sha256"),
        "grid": {"width": width, "height": height, "cell_size_m": cell_size_m, "origin_col": origin_col, "origin_row": origin_row, "crs": grid.get("crs", "EPSG:32649")},
        "config": {"seed": config.seed, "minimum_active_prototypes": config.minimum_active_prototypes, "ensure_catalog_coverage": config.ensure_catalog_coverage, "field_block_size_cells": config.field_block_size_cells, "orchard_spacing_cells": config.orchard_spacing_cells},
        "knowledge_sha256": canonical_sha256(knowledge),
        "agriculture_config_sha256": canonical_sha256(agriculture_config),
        "field_checksums": {name: canonical_sha256(values) for name, values in sorted(fields_out.items())},
        "instance_checksum": canonical_sha256(instances),
        "statistics": {"instance_count": len(instances), "agriculture_cell_counts": {AGRICULTURE_NAMES[key]: agriculture_class.count(key) for key in sorted(AGRICULTURE_NAMES)}, "bund_cell_count": sum(bund_mask)},
        "validation": validation,
        "fields": fields_out,
        "instances": instances,
    }
    release["release_sha256"] = canonical_sha256(release)
    return dict(release)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--terrain-release", required=True, type=Path)
    parser.add_argument("--knowledge", required=True, type=Path)
    parser.add_argument("--agriculture-config", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=1944)
    parser.add_argument("--minimum-active-prototypes", type=int, default=18)
    parser.add_argument("--no-ensure-catalog-coverage", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    terrain_release = json.loads(args.terrain_release.read_text(encoding="utf-8"))
    knowledge = json.loads(args.knowledge.read_text(encoding="utf-8"))
    agriculture_config = json.loads(args.agriculture_config.read_text(encoding="utf-8"))
    release = compile_ecology_agriculture(
        terrain_release,
        knowledge,
        agriculture_config,
        EcologyConfig(seed=args.seed, minimum_active_prototypes=args.minimum_active_prototypes, ensure_catalog_coverage=not args.no_ensure_catalog_coverage),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(release, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "release_sha256": release["release_sha256"], "statistics": release["statistics"], "validation": release["validation"]}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
