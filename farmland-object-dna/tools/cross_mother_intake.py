"""Validate R025 Xiaoma TLO and Guilin DEM intake boundaries.

This module validates a fixed-source receipt and one candidate TLO checkpoint.
It never reads moving branches at runtime, samples terrain, or treats the
synthetic Landscape R6 review object as elevation truth.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


XIAOMA_COMMIT = "a4e1b79298205f37dd09b5c63cbcfbe88912e6f9"
LANDSCAPE_COMMIT = "a77819b949f79f77601e612d6b30fc22873931f7"
CANONICAL_RELEASE_COMMIT = "e4906653b705712edb610ee31f91716f18922369"

XIAOMA_PATH_ROOT = (
    "docs/mother_coordination/handoffs/"
    "xiaoma-tlo-dna-v0.1-20260908/"
)

REQUIRED_XIAOMA_FILES = {
    XIAOMA_PATH_ROOT + "01_TLO_DNA_CORE_R0_1.md": {
        "git_blob_sha1": "2a88c44fbf9013877dad52d4352edc126496ce9e",
        "content_sha256":
            "b2d183761e99fd8cf4045e386ba50384d86961a9da1607a7248823bcae474e03",
    },
    XIAOMA_PATH_ROOT + "02_TLO_COMMUNICATION_CONTRACT_R0_1.md": {
        "git_blob_sha1": "a183b3b3843daff06d32be62acdffaaae352d4f0",
        "content_sha256":
            "56396a3b129f97d8e4973d2181ff46c9abb54b4c75a58f80affcf9e2889fcce3",
    },
    XIAOMA_PATH_ROOT + "03_WORLD_KERNEL_AND_OBJECT_DNA_BRIDGE.md": {
        "git_blob_sha1": "0ac4c39ccf6a412a35721297e6135a0bf4ad2be4",
        "content_sha256":
            "f8c2e329bcb85c7d67fd53188a007d122b36a0427488d20d70eca3f4ed2c9e50",
    },
    XIAOMA_PATH_ROOT + "05_TLO_SCHEMA_DRAFT_R0_1.json": {
        "git_blob_sha1": "0615787f289e591ce04aca481e8a7711cd902a01",
        "content_sha256":
            "ca4a5f57288c39b6f27b84502c0e5defe971ce23448ea939969d475185d9ea08",
    },
    XIAOMA_PATH_ROOT + "06_SOURCE_LOCKS.json": {
        "git_blob_sha1": "5b113d3a035d716080cda0d13c8d6fad52324067",
        "content_sha256":
            "3e2e3f0fffa03fbf5d1d150239662af132ab19c989564f4246376d19e4c780cc",
    },
    XIAOMA_PATH_ROOT + "07_UNRESOLVED_AND_DO_NOT_INVENT.md": {
        "git_blob_sha1": "4fd74a39efcdc5143cdca7bce8f70640cd44f054",
        "content_sha256":
            "4633fb31ee8b59de6107ee874d0e15344a5258163c74e984e82a2ab794e47fab",
    },
}

REQUIRED_DEM_FILES = {
    "contracts/CANONICAL_DEM_IDENTITY.json": {
        "git_blob_sha1": "ea2e888d0f69a1d6386ae6d98630b025dafb4004",
        "content_sha256":
            "12983f691d31bff62c6b109396a4c4aef3ef0458ca621da1cfe0dc62237cbfae",
    },
    "contracts/DATA_ASSET_CATALOG.json": {
        "git_blob_sha1": "216def174049739b08c1b6cd66ca09137b2b4409",
        "content_sha256":
            "708703e9d01d9413be2fe79f28bc8710ced4498a4b07fb1946bcd31ae86d1c59",
    },
    "truth/NATIVE_ELEVATION_MANIFEST.json": {
        "git_blob_sha1": "13da00090749d108973ee0afd107fdcd26b0db42",
        "content_sha256":
            "7c06d0f7a6c082a97bdd4fb947038ec9ff81cb83e9782ccd991b3600c3a7068c",
    },
    "truth/AOI_ACCEPTED.geojson": {
        "git_blob_sha1": "5cb759ef1ae400b1a7ffde8d5cc45dd8d8d2eceb",
        "content_sha256":
            "a31cb904a44c7f7db1df3cab2c8eea99b133ce665221d12fb9549d7348d38ce8",
    },
    "truth/OSM_HYDROLOGY_IMMUTABLE.geojson": {
        "git_blob_sha1": "c00174242b68106cec9febcf24e0b94464b3727c",
        "content_sha256":
            "be3e8e67f625fa87c843e2d7ea423c48b98e750c6912cae8cf3863df6ae6d4df",
    },
    "knowledge/terrain-hydrology/shared/distilled/GAEA_TERRAIN_FIELD_GRAPH_V100.md": {
        "git_blob_sha1": "16ceb18b6a22b58acb04121c90167f70502da9af",
        "content_sha256":
            "0d3111ac2d5d1bf3628e3e8bc24beafe3e8e84821a5af1655c24436ee56358cf",
    },
    "skills/dem-procedural-landscape/branches/gaea-terrain-field-graph/"
    "references/truth-boundaries.md": {
        "git_blob_sha1": "d3d4bae4b5d5a9c1b5a6ed035b0f34b4d5f63a39",
        "content_sha256":
            "512667d3e15a2f52427fbbb8c8c2b5d2f02d7b36c01c7e463b59fabb5d01bca4",
    },
    "workbenches/landscape-karst-kaopu-r6/QA.json": {
        "git_blob_sha1": "7ef381307a3759100601ba740649f2b024cd178e",
        "content_sha256":
            "c44da616f21ef3a7c205405ff0241f627350632fa5363121499eda912da79e72",
    },
}

REQUIRED_TLO_STATUS = {
    "user-confirmed",
    "source-confirmed",
    "inferred",
    "candidate",
    "unknown",
}

REQUIRED_TIME_FIELDS = {
    "recorded_at",
    "world_time",
    "valid_from",
    "valid_to",
    "event_time",
    "source_version_time",
}

REQUIRED_LOCATION_FIELDS = {
    "reference_frame",
    "position",
    "orientation",
    "container_ref",
    "uncertainty",
    "source_ref",
}

REQUIRED_OBJECT_FIELDS = {
    "object_id",
    "object_type",
    "object_dna_ref",
    "state_ref",
    "relations",
    "evidence_ref",
}

REQUIRED_UNFROZEN_TLO_PARTS = {
    "file_extension",
    "binary_or_text_container",
    "chunk_and_index_layout",
    "compression_codec",
    "streaming_protocol",
    "global_location_contract",
    "event_encoding",
    "relation_ontology",
}

MAY_PROVIDE = {
    "guilin_aoi_and_crs_context",
    "guilin_macro_terrain_samples_after_asset_import",
    "macro_slope_and_aspect_at_source_resolution",
    "immutable_linear_hydrology_reference",
    "canonical_elevation_identity_and_hashes",
}

MUST_NOT_PROVIDE = {
    "field_boundary_survey",
    "bund_or_terrace_section",
    "channel_section",
    "inlet_or_outlet_invert_survey",
    "centimeter_water_depth_truth",
    "honghe_terrain",
    "honghe_component_dimensions",
    "regional_rice_morphology",
}

REQUIRED_CHECKPOINT_UNKNOWNS = {
    "parcel_site",
    "parcel_boundary",
    "terrain_sample_window",
    "field_microtopography",
    "bund_sections",
    "channel_sections",
    "water_control_elevations",
}


def _mapping(value, label):
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _string_list(value, label, *, nonempty=True):
    if not isinstance(value, list) or (nonempty and not value):
        raise ValueError(f"{label} must be an array")
    if any(not isinstance(item, str) or not item for item in value):
        raise ValueError(f"{label} must contain nonempty strings")
    if len(value) != len(set(value)):
        raise ValueError(f"{label} contains duplicates")
    return value


def _validate_blob_lock(lock, expected_commit, expected_blobs, label):
    lock = _mapping(lock, label)
    if lock.get("commit") != expected_commit:
        raise ValueError(f"{label} commit lock changed")
    files = lock.get("files")
    if not isinstance(files, list) or not files:
        raise ValueError(f"{label} files are required")
    actual = {}
    for index, item in enumerate(files):
        item = _mapping(item, f"{label}.files[{index}]")
        path = item.get("path")
        if not isinstance(path, str) or not path or path in actual:
            raise ValueError(f"{label} paths must be unique")
        if item.get("retrieval_status") != "read":
            raise ValueError(f"{label} source was not read: {path}")
        actual[path] = {
            "git_blob_sha1": item.get("git_blob_sha1"),
            "content_sha256": item.get("content_sha256"),
        }
    if actual != expected_blobs:
        raise ValueError(f"{label} file hash locks changed")


def validate_xiaoma_dem_intake(contract):
    """Validate source identities, TLO adoption, and DEM authority limits."""

    if not isinstance(contract, dict):
        raise ValueError("cross-Mother intake must be an object")
    if contract.get("contract_id") != "xiaoma_tlo_guilin_dem_intake_r025":
        raise ValueError("unexpected cross-Mother intake identity")
    if contract.get("status") != \
            "fixed_source_receipt_complete_numeric_terrain_not_connected":
        raise ValueError("cross-Mother intake status changed")
    if contract.get("received_at") != "2026-09-11":
        raise ValueError("cross-Mother intake receipt date changed")

    portal = _mapping(contract.get("portal_receipt"), "portal_receipt")
    if portal.get("attachment_sha256") != \
            "a05c277569279a06f3e401dff7f6c7692ad83126ed0218aa4be36ae42415c31a":
        raise ValueError("user-supplied portal receipt hash changed")
    if portal.get("attachment_bytes") != 119:
        raise ValueError("user-supplied portal receipt byte count changed")
    if portal.get("urls") != [
        "https://guilin-dem-terrain.sunhaihao.chatgpt.site",
        "https://guilin-dem-terrain.sunhaihao.chatgpt.site/guilin/gaea-proof",
    ]:
        raise ValueError("portal URL receipt changed")
    if (portal.get("access_status") != "authentication_required_content_not_read" or
            portal.get("usable_as_evidence") is not False):
        raise ValueError("unread portal content cannot be evidence")

    locks = _mapping(contract.get("git_source_locks"), "git_source_locks")
    if set(locks) != {"xiaoma_tlo", "landscape_dem"}:
        raise ValueError("git source lock set is incomplete")
    _validate_blob_lock(
        locks["xiaoma_tlo"], XIAOMA_COMMIT, REQUIRED_XIAOMA_FILES, "xiaoma_tlo"
    )
    _validate_blob_lock(
        locks["landscape_dem"], LANDSCAPE_COMMIT, REQUIRED_DEM_FILES, "landscape_dem"
    )
    if locks["xiaoma_tlo"].get("commit_time") != "2026-09-08T09:08:02+08:00":
        raise ValueError("Xiaoma TLO source-version time changed")
    if locks["landscape_dem"].get("commit_time") != "2026-09-10T04:41:44+08:00":
        raise ValueError("Landscape DEM source-version time changed")
    if locks["landscape_dem"].get("canonical_release_commit") != CANONICAL_RELEASE_COMMIT:
        raise ValueError("canonical Guilin release commit changed")
    if locks["landscape_dem"].get("canonical_release_tag") != \
            "guilin-native-12p5m-single-truth-v001":
        raise ValueError("canonical Guilin release tag changed")

    tlo = _mapping(contract.get("tlo_candidate_adoption"), "tlo_candidate_adoption")
    if tlo.get("source_status") != "discussion_draft_not_frozen":
        raise ValueError("TLO cannot be promoted from a discussion draft")
    if tlo.get("farmland_status") != "interface_checkpoint_candidate_not_core_schema":
        raise ValueError("R025 must not freeze TLO into the Farmland core schema")
    if tlo.get("meaning") != {
        "T": "Time",
        "L": "Location",
        "O": "Object identity and Object DNA reference, not a mesh",
    }:
        raise ValueError("TLO meaning changed")
    if tlo.get("coordinate_order") != ["t", "x", "y", "z"]:
        raise ValueError("TLO coordinate order changed")
    if (tlo.get("world_dimensions") != 4 or
            tlo.get("object_is_fifth_geometric_dimension") is not False):
        raise ValueError("TLO dimension semantics changed")
    if set(tlo.get("required_status_labels", [])) != REQUIRED_TLO_STATUS:
        raise ValueError("TLO status labels are incomplete")
    if set(tlo.get("time_fields", [])) != REQUIRED_TIME_FIELDS:
        raise ValueError("TLO time fields are incomplete")
    if set(tlo.get("location_fields", [])) != REQUIRED_LOCATION_FIELDS:
        raise ValueError("TLO location fields are incomplete")
    if set(tlo.get("object_fields", [])) != REQUIRED_OBJECT_FIELDS:
        raise ValueError("TLO object fields are incomplete")
    if set(tlo.get("unfrozen_parts", [])) != REQUIRED_UNFROZEN_TLO_PARTS:
        raise ValueError("TLO unresolved parts must remain explicit")
    if (tlo.get("moving_branch_name_is_sufficient_evidence") is not False or
            tlo.get("camera_or_renderer_changes_object_identity") is not False or
            tlo.get("render_output_is_world_truth") is not False):
        raise ValueError("TLO identity or evidence boundary was relaxed")
    if tlo.get("checkpoint_protocol") != \
            "conversation_to_markdown_checkpoint_to_reread_to_continue":
        raise ValueError("TLO checkpoint protocol changed")

    dem = _mapping(contract.get("guilin_dem_identity"), "guilin_dem_identity")
    expected_source = {
        "file": "guilin_raw_union_12_5m.tif",
        "bytes": 124348471,
        "sha256": "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4",
        "crs": "EPSG:32649",
        "grid": [17408, 18867],
        "resolution_m": [12.5, 12.5],
        "dtype": "int16",
        "nodata": 0,
        "read_only": True,
    }
    if dem.get("status") != "sole_authoritative":
        raise ValueError("Guilin DEM authority status changed")
    if dem.get("source") != expected_source:
        raise ValueError("canonical Guilin DEM source identity changed")
    expected_aoi = {
        "status": "ACCEPTED",
        "geometry_sha256": "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80",
        "bounds_epsg32649": [380331.8, 2705928.1, 530128.2, 2926987.2],
    }
    if dem.get("aoi") != expected_aoi:
        raise ValueError("canonical Guilin AOI identity changed")
    expected_tiling = {
        "rows": 9,
        "columns": 6,
        "tile_count": 54,
        "stored_grid": [2048, 2048],
        "stride_samples": [2047, 2047],
        "shared_edge_samples": 1,
        "encoding": "int16-little-endian-raw-elevation-m",
        "resampling": "none",
        "gap_fill": False,
        "fallback_30m": False,
        "source_elevation_modified_m": 0.0,
    }
    if dem.get("tiling") != expected_tiling:
        raise ValueError("canonical Guilin tiling contract changed")
    expected_tile = {
        "id": "native-r05-c01",
        "file": "native-r05-c01-2048x2048-i16.bin",
        "sha256": "90e06ee19f43257b2b61a2bee529f0ae308b4f614f6320c1a2f5356c7335a4bd",
        "source_sample_center_bounds_epsg32649": [
            405931.25, 2773456.25, 431518.75, 2799043.75,
        ],
        "native_nodata_sample_count": 1462,
        "elevation_range_m": [92, 480],
        "anchor_ids": ["guilin", "yangtang"],
    }
    if dem.get("guilin_anchor_tile") != expected_tile:
        raise ValueError("Guilin anchor tile identity changed")
    if dem.get("immutable_hydrology") != {
        "file": "truth/OSM_HYDROLOGY_IMMUTABLE.geojson",
        "bytes": 5832414,
        "sha256": "be3e8e67f625fa87c843e2d7ea423c48b98e750c6912cae8cf3863df6ae6d4df",
    }:
        raise ValueError("immutable hydrology identity changed")

    authority = _mapping(contract.get("authority_boundary"), "authority_boundary")
    if set(authority.get("may_provide", [])) != MAY_PROVIDE:
        raise ValueError("DEM allowed-output boundary changed")
    if set(authority.get("must_not_provide", [])) != MUST_NOT_PROVIDE:
        raise ValueError("DEM prohibited-output boundary changed")
    required_false = (
        "numeric_tile_bytes_present_in_farmland_branch",
        "terrain_sample_read_in_r025",
        "guilin_query_adapter_implemented",
        "dem_resolves_field_components",
        "honghe_inside_guilin_aoi",
        "honghe_profile_may_use_guilin_dem",
        "synthetic_landscape_r6_used_as_terrain_truth",
    )
    for key in required_false:
        if authority.get(key) is not False:
            raise ValueError(f"cross-Mother authority overclaim: {key}")
    if authority.get("minimum_additional_inputs") != [
        "selected parcel location inside the intended regional AOI",
        "accessible canonical numeric terrain samples for that location",
        "field-scale survey or higher-resolution microtopography",
        "surveyed bund channel inlet outlet and water-control elevations",
    ]:
        raise ValueError("minimum additional terrain inputs changed")

    separation = _mapping(
        contract.get("honghe_separation_evidence"), "honghe_separation_evidence"
    )
    if separation != {
        "source": "https://whc.unesco.org/en/list/1111/",
        "retrieval_status": "read",
        "official_coordinate": "N23 5 35.8 E102 46 47.93",
        "official_region": "southern Yunnan",
        "guilin_dem_region": "Guilin accepted AOI in EPSG:32649",
        "same_regional_terrain_asset": False,
    }:
        raise ValueError("Guilin and Honghe regional separation changed")

    excluded = _mapping(contract.get("excluded_visual_candidate"), "excluded_visual_candidate")
    if (excluded.get("id") != "landscape-karst-kaopu-r6" or
            excluded.get("synthetic") is not True or
            excluded.get("truthApproved") is not False or
            excluded.get("visualApproved") is not False or
            excluded.get("productionReady") is not False or
            excluded.get("usable_as_dem_truth") is not False):
        raise ValueError("synthetic Landscape R6 cannot become DEM truth")

    gate = _mapping(contract.get("production_gate"), "production_gate")
    if gate.get("source_receipt_complete") is not True:
        raise ValueError("R025 source receipt must be complete")
    for key in (
        "numeric_terrain_connected",
        "field_scale_terrain_complete",
        "honghe_terrain_complete",
        "ready_for_regional_geometry",
        "ready_for_structural_truth_workbench",
        "ready_for_public_candidate",
        "visualAcceptance",
        "productionReady",
    ):
        if gate.get(key) is not False:
            raise ValueError(f"R025 cannot grant production clearance: {key}")

    return {
        "ok": True,
        "contract_id": contract["contract_id"],
        "xiaoma_locked_file_count": len(REQUIRED_XIAOMA_FILES),
        "dem_locked_file_count": len(REQUIRED_DEM_FILES),
        "canonical_dem_crs": dem["source"]["crs"],
        "canonical_dem_spacing_m": tuple(dem["source"]["resolution_m"]),
        "canonical_dem_tile_count": dem["tiling"]["tile_count"],
        "portal_content_read": False,
        "numeric_terrain_connected": False,
        "field_scale_terrain_ready": False,
        "honghe_terrain_ready": False,
    }


def validate_tlo_checkpoint(checkpoint, contract):
    """Validate an explicit-unknown Farmland checkpoint against R025."""

    validate_xiaoma_dem_intake(contract)
    if not isinstance(checkpoint, dict):
        raise ValueError("TLO checkpoint must be an object")
    if checkpoint.get("schema") != "farmland-tlo-checkpoint/r025-candidate":
        raise ValueError("unexpected Farmland TLO checkpoint schema")
    if checkpoint.get("schema_status") != "candidate_not_frozen":
        raise ValueError("candidate TLO checkpoint cannot be marked frozen")

    time = _mapping(checkpoint.get("T"), "checkpoint.T")
    if set(time) != REQUIRED_TIME_FIELDS | {"time_state"}:
        raise ValueError("checkpoint time fields are incomplete")
    if not isinstance(time.get("recorded_at"), str) or not time["recorded_at"]:
        raise ValueError("checkpoint recorded_at is required")
    if time.get("time_state") != "world_and_event_time_not_sampled":
        raise ValueError("checkpoint time state changed")
    if any(time.get(key) is not None for key in (
            "world_time", "valid_from", "valid_to", "event_time")):
        raise ValueError("unsampled checkpoint times must remain null")
    if time.get("source_version_time") != {
        "xiaoma_tlo": "2026-09-08T09:08:02+08:00",
        "landscape_lock": "2026-09-10T04:41:44+08:00",
        "canonical_dem": "2026-08-29T10:24:51Z",
    }:
        raise ValueError("checkpoint source-version time changed")

    location = _mapping(checkpoint.get("L"), "checkpoint.L")
    if set(location) != REQUIRED_LOCATION_FIELDS | {"position_status", "region_profile"}:
        raise ValueError("checkpoint location fields are incomplete")
    if location.get("reference_frame") != "EPSG:32649":
        raise ValueError("checkpoint must preserve canonical Guilin CRS")
    if location.get("position") is not None or location.get("orientation") is not None:
        raise ValueError("unselected parcel position and orientation must remain null")
    if location.get("position_status") != "parcel_not_selected":
        raise ValueError("checkpoint parcel position status changed")
    if location.get("container_ref") != "guilin-native-12p5m-single-truth-v001:accepted-aoi":
        raise ValueError("checkpoint AOI container changed")
    if location.get("source_ref") != "xiaoma_tlo_guilin_dem_intake_r025":
        raise ValueError("checkpoint location source changed")
    if location.get("region_profile") != "guilin_only_pending_site_selection":
        raise ValueError("checkpoint cannot silently become a Honghe location")
    if not isinstance(location.get("uncertainty"), str) or not location["uncertainty"]:
        raise ValueError("checkpoint location uncertainty is required")

    obj = _mapping(checkpoint.get("O"), "checkpoint.O")
    if set(obj) != REQUIRED_OBJECT_FIELDS | {
        "statement", "status", "unknowns", "next_question",
    }:
        raise ValueError("checkpoint object fields are incomplete")
    for key in ("object_id", "object_type", "object_dna_ref", "state_ref",
                "evidence_ref", "statement", "next_question"):
        if not isinstance(obj.get(key), str) or not obj[key]:
            raise ValueError(f"checkpoint object field is empty: {key}")
    if obj.get("object_id") != "farmland-context:guilin-parcel-unselected:r025":
        raise ValueError("checkpoint object identity changed")
    if obj.get("object_type") != "farmland_system_context_candidate":
        raise ValueError("checkpoint object type changed")
    if obj.get("object_dna_ref") != "farmland-object-dna/OBJECT_DNA_CONTRACT.md":
        raise ValueError("checkpoint Object DNA reference changed")
    if obj.get("state_ref") != \
            "farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/" \
            "XIAOMA_TLO_DEM_INTAKE.json":
        raise ValueError("checkpoint state reference changed")
    if obj.get("evidence_ref") != obj.get("state_ref"):
        raise ValueError("checkpoint evidence must point to the fixed intake")
    if obj.get("status") != "candidate":
        raise ValueError("checkpoint status must remain candidate")
    if set(_string_list(obj.get("unknowns"), "checkpoint.O.unknowns")) != \
            REQUIRED_CHECKPOINT_UNKNOWNS:
        raise ValueError("checkpoint terrain unknowns are incomplete")
    if obj.get("relations") != [
        {
            "type": "terrain_authority",
            "target": "guilin-native-12p5m-single-truth-v001",
            "status": "source-confirmed",
            "evidence_ref": "XIAOMA_TLO_DEM_INTAKE.json#guilin_dem_identity",
        },
        {
            "type": "separate_regional_profile",
            "target": "honghe-hani-rice-terraces",
            "status": "source-confirmed",
            "evidence_ref": "XIAOMA_TLO_DEM_INTAKE.json#honghe_separation_evidence",
        },
    ]:
        raise ValueError("checkpoint object relations are incomplete")
    if checkpoint.get("gates") != {
        "terrain_query_ready": False,
        "field_scale_geometry_ready": False,
        "honghe_profile_attached": False,
        "visualAcceptance": False,
        "productionReady": False,
    }:
        raise ValueError("checkpoint gates must remain closed")

    return {
        "ok": True,
        "schema": checkpoint["schema"],
        "object_id": obj["object_id"],
        "explicit_unknown_count": len(obj["unknowns"]),
        "world_time_known": False,
        "parcel_position_known": False,
        "terrain_query_ready": False,
    }


def load_json(path):
    return json.loads(Path(path).read_text())


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        raise SystemExit(
            "usage: cross_mother_intake.py XIAOMA_TLO_DEM_INTAKE.json "
            "[FARMLAND_TLO_CHECKPOINT.json]"
        )
    loaded_contract = load_json(sys.argv[1])
    result = {"intake": validate_xiaoma_dem_intake(loaded_contract)}
    if len(sys.argv) == 3:
        result["checkpoint"] = validate_tlo_checkpoint(
            load_json(sys.argv[2]), loaded_contract
        )
    print(json.dumps(result, indent=2))
