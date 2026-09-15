"""Validate the R024 rice organ and lifecycle structure contract.

The contract separates documented species-level morphology from management
transitions and from still-unmeasured Honghe cultivar parameters.  It does not
generate geometry or promote generic dimensions into a regional profile.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse


STAGE_ORDER = (
    "nursery",
    "lifting_seedlings",
    "transplanted",
    "establishment",
    "tillering",
    "stem_elongation",
    "panicle_initiation",
    "booting",
    "heading",
    "flowering",
    "grain_filling",
    "maturity",
    "harvest",
    "stubble",
)

REQUIRED_SOURCE_IDS = {
    "AU_OGTR_RICE_BIOLOGY_2005_2021",
    "UNESCO_ICOMOS_HONGHE_2013",
}

ALLOWED_SOURCE_HOSTS = {"www.ogtr.gov.au", "whc.unesco.org"}

EXPECTED_SOURCE_URLS = {
    "AU_OGTR_RICE_BIOLOGY_2005_2021":
        "https://www.ogtr.gov.au/sites/default/files/files/2021-07/the_biology_of_rice.pdf",
    "UNESCO_ICOMOS_HONGHE_2013": "https://whc.unesco.org/document/151777",
}

REQUIRED_UNAVAILABLE_SOURCE_IDS = {
    "IRRI_MANUAL_TRANSPLANTING",
    "IRRI_TRANSPLANTING",
    "IRRI_GROWTH_STAGES",
}

REQUIRED_FACT_IDS = {
    "rice.typical_grass_architecture",
    "rice.tiller_hierarchy",
    "rice.leaf_anatomy",
    "rice.panicle_spikelet_floret",
    "rice.vegetative_growth",
    "rice.panicle_initiation_and_boot",
    "rice.heading_and_flowering",
    "rice.grain_ripening",
    "rice.cultivar_variability",
    "honghe.red_rice_diversity",
}

REQUIRED_REGIONAL_PARAMETERS = {
    "cultivar_identity",
    "calendar_days_by_stage",
    "seedling_age_days",
    "seedlings_per_hill",
    "row_spacing_m",
    "hill_spacing_m",
    "planting_depth_m",
    "planting_angle_degrees",
    "hill_count_per_m2",
    "missing_hill_rate",
    "repair_rate",
    "field_water_depth_m_by_stage",
    "plant_height_m_by_stage",
    "tiller_count_by_stage",
    "culm_diameter_m_by_stage",
    "internode_length_m_by_stage",
    "leaf_length_m_by_stage",
    "leaf_width_m_by_stage",
    "panicle_length_m_by_stage",
    "grain_dimensions_m",
    "stubble_height_m",
    "lodging_rate_by_stage",
    "wind_response_coefficients_by_stage",
    "color_palette_by_stage",
}

REQUIRED_SHORTCUT_BANS = {
    "single_geometry_scaled_across_stages",
    "color_only_stage_substitution",
    "cone_rice_proxy",
    "generic_green_tuft",
    "regional_numbers_without_measurement",
}

REQUIRED_STRUCTURE_FIELDS = {
    "stand_context",
    "root_state",
    "culm_state",
    "tiller_state",
    "leaf_state",
    "flag_leaf_state",
    "panicle_state",
    "spikelet_state",
    "grain_state",
    "cut_state",
}

REQUIRED_FIELD_RESPONSE_FIELDS = {
    "color_basis",
    "water_relation",
    "wind_response_driver",
}

REQUIRED_MODEL_FIELDS = {
    "stage",
    "phase",
    "basis",
    "model_status",
    "geometry_family_id",
    "topology_tokens",
    "structure",
    "visible_organs",
    "hidden_organs",
    "events",
    "evidence_refs",
    "field_response",
    "regional_numeric_profile_ref",
    "geometry_ready",
}

EXPECTED_PHASE = {
    "nursery": "establishment_management",
    "lifting_seedlings": "establishment_management",
    "transplanted": "establishment_management",
    "establishment": "establishment_management",
    "tillering": "vegetative",
    "stem_elongation": "vegetative",
    "panicle_initiation": "reproductive",
    "booting": "reproductive",
    "heading": "reproductive",
    "flowering": "reproductive",
    "grain_filling": "ripening",
    "maturity": "ripening",
    "harvest": "post_crop_management",
    "stubble": "post_crop_management",
}

EXPECTED_BASIS = {
    "nursery": "contractual_management_transition_with_documented_seedling_anatomy",
    "lifting_seedlings": "contractual_management_transition",
    "transplanted": "contractual_management_transition",
    "establishment": "contractual_management_transition",
    "tillering": "documented_species_morphology",
    "stem_elongation": "documented_species_morphology",
    "panicle_initiation": "documented_species_morphology",
    "booting": "documented_species_morphology",
    "heading": "documented_species_morphology",
    "flowering": "documented_species_morphology",
    "grain_filling": "documented_species_morphology",
    "maturity": "documented_species_morphology",
    "harvest": "contractual_management_transition_with_documented_maturity",
    "stubble": "contractual_management_transition",
}

# Each stage must preserve the event that makes it structurally distinct.  The
# values are categorical: they do not imply a regional measurement or duration.
EXPECTED_MARKERS = {
    "nursery": {
        "stand_context": "seedlings_rooted_in_nursery_medium",
        "panicle_state": "absent",
        "grain_state": "absent",
    },
    "lifting_seedlings": {
        "stand_context": "lifted_seedling_batch",
        "root_state": "lifted_from_growth_medium_extent_unmeasured",
        "cut_state": "nursery_soil_contact_broken_not_culm_cut",
    },
    "transplanted": {
        "stand_context": "newly_inserted_field_hills",
        "root_state": "inserted_seedling_roots_disturbance_unmeasured",
        "panicle_state": "absent",
    },
    "establishment": {
        "stand_context": "field_hills_in_rooting_recovery",
        "root_state": "field_root_anchorage_developing_extent_unmeasured",
        "panicle_state": "absent",
    },
    "tillering": {
        "tiller_state": "basal_primary_then_higher_order_tillers",
        "panicle_state": "absent",
        "grain_state": "absent",
    },
    "stem_elongation": {
        "culm_state": "internodes_beginning_to_elongate",
        "panicle_state": "not_externally_visible_state_requires_stage_observation",
    },
    "panicle_initiation": {
        "panicle_state": "initiated_at_tiller_growing_tip_hidden",
        "flag_leaf_state": "developing_before_heading",
    },
    "booting": {
        "panicle_state": "developing_inside_flag_leaf_sheath",
        "flag_leaf_state": "sheath_encloses_panicle",
    },
    "heading": {
        "panicle_state": "partially_or_fully_emerged_from_flag_leaf_sheath",
        "spikelet_state": "borne_on_emerged_panicle_flowering_not_required",
    },
    "flowering": {
        "panicle_state": "emerged_with_opening_florets",
        "spikelet_state": "florets_opening_stamens_or_anthers_exposed",
    },
    "grain_filling": {
        "panicle_state": "emerged_green_and_bending_with_developing_grain",
        "grain_state": "fertilized_ovary_filling_milk_to_dough",
    },
    "maturity": {
        "grain_state": "hard_and_dry",
        "leaf_state": "advanced_senescence_yellowing_and_drying",
    },
    "harvest": {
        "panicle_state": "detached_or_removed_from_standing_crop",
        "cut_state": "harvest_severance_or_removal_form_unresolved",
    },
    "stubble": {
        "panicle_state": "absent_from_remaining_cut_culms",
        "cut_state": "cut_culm_bases_remain_height_unresolved",
    },
}

EXPECTED_TOPOLOGY_MARKER = {
    "nursery": "nursery_root_medium_contact",
    "lifting_seedlings": "broken_root_medium_contact",
    "transplanted": "discrete_inserted_hills",
    "establishment": "rooted_recovering_hills",
    "tillering": "basal_tiller_branches",
    "stem_elongation": "elongated_culm_internodes",
    "panicle_initiation": "hidden_apical_panicle",
    "booting": "panicle_within_flag_sheath",
    "heading": "panicle_crosses_flag_sheath_opening",
    "flowering": "open_florets_and_exserted_stamens",
    "grain_filling": "filled_spikelets_and_bending_panicle",
    "maturity": "hard_grain_on_senescent_stand",
    "harvest": "severed_or_removed_crop_components",
    "stubble": "cut_culm_ends_without_panicles",
}


def _mapping(value, label):
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _string_list(value, label, *, nonempty=True):
    if not isinstance(value, list) or (nonempty and not value):
        raise ValueError(f"{label} must be a nonempty array")
    if any(not isinstance(item, str) or not item for item in value):
        raise ValueError(f"{label} must contain nonempty strings")
    if len(value) != len(set(value)):
        raise ValueError(f"{label} contains duplicates")
    return value


def validate_rice_lifecycle(contract):
    """Return a deterministic summary or raise ``ValueError``."""

    if not isinstance(contract, dict):
        raise ValueError("rice lifecycle contract must be an object")
    if contract.get("contract_id") != "rice_lifecycle_r024":
        raise ValueError("unexpected rice lifecycle contract identity")
    if contract.get("species") != "Oryza sativa":
        raise ValueError("R024 contract is scoped to Oryza sativa")

    sources = _mapping(contract.get("source_locks"), "source_locks")
    if set(sources) != REQUIRED_SOURCE_IDS:
        raise ValueError("source lock set is incomplete")
    for source_id, source in sources.items():
        source = _mapping(source, f"source_locks.{source_id}")
        if source.get("retrieval_status") != "read":
            raise ValueError(f"locked source was not read: {source_id}")
        url = source.get("url")
        if (url != EXPECTED_SOURCE_URLS[source_id] or
                urlparse(url).hostname not in ALLOWED_SOURCE_HOSTS):
            raise ValueError(f"unapproved source host: {source_id}")

    unavailable_ids = set()
    for index, target in enumerate(contract.get("unavailable_source_targets", [])):
        target = _mapping(target, f"unavailable_source_targets[{index}]")
        source_id = target.get("source_id")
        if not isinstance(source_id, str) or not source_id:
            raise ValueError("unavailable target requires source_id")
        if source_id in unavailable_ids:
            raise ValueError(f"duplicate unavailable source target: {source_id}")
        unavailable_ids.add(source_id)
        if target.get("retrieval_status") != "timeout_at_access":
            raise ValueError(f"unavailable target status changed: {source_id}")
        if target.get("usable_as_evidence") is not False:
            raise ValueError(f"unread source cannot support evidence: {source_id}")
    if unavailable_ids != REQUIRED_UNAVAILABLE_SOURCE_IDS:
        raise ValueError("unavailable source target set is incomplete")

    facts = contract.get("documented_facts")
    if not isinstance(facts, list) or not facts:
        raise ValueError("documented_facts must be a nonempty array")
    fact_by_id = {}
    for index, fact in enumerate(facts):
        fact = _mapping(fact, f"documented_facts[{index}]")
        fact_id = fact.get("fact_id")
        if not isinstance(fact_id, str) or not fact_id or fact_id in fact_by_id:
            raise ValueError("documented fact identities must be unique")
        if fact.get("source_id") not in sources:
            if fact.get("source_id") in unavailable_ids:
                raise ValueError("unavailable source cited as evidence")
            raise ValueError(f"fact is not bound to a locked source: {fact_id}")
        if fact.get("kind") != "documented":
            raise ValueError(f"fact must remain documented: {fact_id}")
        if not fact.get("claim") or not fact.get("locator"):
            raise ValueError(f"fact is incomplete: {fact_id}")
        fact_by_id[fact_id] = fact
    if set(fact_by_id) != REQUIRED_FACT_IDS:
        raise ValueError("documented fact set is incomplete")

    scope_refs = _string_list(contract.get("scope_evidence_refs"), "scope_evidence_refs")
    if not set(scope_refs) <= set(fact_by_id):
        raise ValueError("scope evidence reference is unresolved")

    stage_order = contract.get("stage_order")
    if stage_order != list(STAGE_ORDER):
        raise ValueError("stage order must preserve all fourteen R024 states")
    models = _mapping(contract.get("stage_models"), "stage_models")
    if set(models) != set(STAGE_ORDER):
        raise ValueError("stage model set must match stage order")

    evidence_used = set(scope_refs)
    geometry_families = set()
    topology_signatures = set()
    structure_signatures = set()
    response_signatures = set()
    for stage in STAGE_ORDER:
        model = _mapping(models[stage], f"stage_models.{stage}")
        if set(model) != REQUIRED_MODEL_FIELDS:
            raise ValueError(f"stage model fields are incomplete or unsupported: {stage}")
        if model.get("stage") != stage:
            raise ValueError(f"stage identity mismatch: {stage}")
        if model.get("phase") != EXPECTED_PHASE[stage]:
            raise ValueError(f"stage phase mismatch: {stage}")
        if model.get("basis") != EXPECTED_BASIS[stage]:
            raise ValueError(f"stage evidence basis mismatch: {stage}")
        if model.get("model_status") != "contract_only_no_geometry":
            raise ValueError(f"stage model status overclaims geometry: {stage}")
        if model.get("geometry_ready") is not False:
            raise ValueError(f"stage geometry cannot be ready in R024: {stage}")
        if model.get("regional_numeric_profile_ref") != "unresolved_regional_parameters":
            raise ValueError(f"stage numeric profile boundary missing: {stage}")

        family = model.get("geometry_family_id")
        if not isinstance(family, str) or not family:
            raise ValueError(f"geometry family required: {stage}")
        if family in geometry_families:
            raise ValueError("one geometry family cannot stand in for multiple stages")
        geometry_families.add(family)

        tokens = _string_list(model.get("topology_tokens"), f"{stage}.topology_tokens")
        if EXPECTED_TOPOLOGY_MARKER[stage] not in tokens:
            raise ValueError(f"stage topology event missing: {stage}")
        topology_signature = tuple(sorted(tokens))
        if topology_signature in topology_signatures:
            raise ValueError("stage topology signatures must be independent")
        topology_signatures.add(topology_signature)

        structure = _mapping(model.get("structure"), f"{stage}.structure")
        if set(structure) != REQUIRED_STRUCTURE_FIELDS:
            raise ValueError(f"stage structure fields incomplete: {stage}")
        if any(not isinstance(value, str) or not value for value in structure.values()):
            raise ValueError(f"stage structure values must be categorical strings: {stage}")
        for key, expected in EXPECTED_MARKERS[stage].items():
            if structure.get(key) != expected:
                raise ValueError(f"stage structural marker mismatch: {stage}.{key}")
        structure_signature = json.dumps(structure, sort_keys=True, separators=(",", ":"))
        if structure_signature in structure_signatures:
            raise ValueError("stage structures must not be scale-or-color duplicates")
        structure_signatures.add(structure_signature)

        response = _mapping(model.get("field_response"), f"{stage}.field_response")
        if set(response) != REQUIRED_FIELD_RESPONSE_FIELDS:
            raise ValueError(f"field response fields incomplete: {stage}")
        if any(not isinstance(value, str) or not value for value in response.values()):
            raise ValueError(f"field response values must be categorical strings: {stage}")
        response_signature = json.dumps(response, sort_keys=True, separators=(",", ":"))
        if response_signature in response_signatures:
            raise ValueError("color, water, and wind response must remain stage-specific")
        response_signatures.add(response_signature)

        visible = set(_string_list(model.get("visible_organs"), f"{stage}.visible_organs"))
        hidden = set(_string_list(model.get("hidden_organs"), f"{stage}.hidden_organs", nonempty=False))
        if visible & hidden:
            raise ValueError(f"organ cannot be both visible and hidden: {stage}")
        _string_list(model.get("events"), f"{stage}.events")
        refs = _string_list(model.get("evidence_refs"), f"{stage}.evidence_refs")
        if not set(refs) <= set(fact_by_id):
            raise ValueError(f"stage evidence reference is unresolved: {stage}")
        evidence_used.update(refs)

    if evidence_used != set(fact_by_id):
        raise ValueError("every documented fact must constrain scope or a stage")

    regional = _mapping(
        contract.get("unresolved_regional_parameters"),
        "unresolved_regional_parameters",
    )
    if set(regional) != REQUIRED_REGIONAL_PARAMETERS:
        raise ValueError("regional parameter unknown set is incomplete")
    if any(value is not None for value in regional.values()):
        raise ValueError("unmeasured regional rice parameters must remain null")
    requirements = _mapping(
        contract.get("measurement_requirements"), "measurement_requirements"
    )
    if set(requirements) != REQUIRED_REGIONAL_PARAMETERS:
        raise ValueError("every regional parameter requires a measurement rule")
    if any(not isinstance(value, str) or not value for value in requirements.values()):
        raise ValueError("measurement requirements must be explicit")

    shortcuts = contract.get("prohibited_shortcuts")
    if not isinstance(shortcuts, list) or set(shortcuts) != REQUIRED_SHORTCUT_BANS:
        raise ValueError("required lifecycle shortcut bans are incomplete")

    gate = _mapping(contract.get("production_gate"), "production_gate")
    if gate.get("species_stage_contract_complete") is not True:
        raise ValueError("R024 species-stage contract must be marked complete")
    for key in (
        "regional_numeric_profile_complete",
        "geometry_assets_complete",
        "ready_for_structural_truth_workbench",
        "ready_for_public_candidate",
        "visualAcceptance",
        "productionReady",
    ):
        if gate.get(key) is not False:
            raise ValueError(f"R024 cannot grant production clearance: {key}")

    return {
        "ok": True,
        "contract_id": contract["contract_id"],
        "stage_count": len(STAGE_ORDER),
        "documented_fact_count": len(fact_by_id),
        "locked_source_count": len(sources),
        "unavailable_source_target_count": len(unavailable_ids),
        "independent_geometry_family_count": len(geometry_families),
        "independent_topology_signature_count": len(topology_signatures),
        "independent_structure_signature_count": len(structure_signatures),
        "unresolved_regional_parameter_count": len(regional),
        "regional_geometry_ready": False,
    }


def load_and_validate(path):
    return validate_rice_lifecycle(json.loads(Path(path).read_text()))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: rice_morphology.py RICE_LIFECYCLE_CONTRACT.json")
    print(json.dumps(load_and_validate(sys.argv[1]), indent=2))
