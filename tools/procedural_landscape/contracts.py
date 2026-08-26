"""Shared schema and branch-registry validation."""
from pathlib import Path
from typing import Any

REGISTRY = Path("skills/dem-procedural-landscape/BRANCH_REGISTRY.json")
SCHEMA_DIR = Path("skills/dem-procedural-landscape/schemas")
EXPECTED_SCHEMAS = {
    "branch-registry-v2.schema.json",
    "project-binding-v2.schema.json",
    "layer-manifest-v2.schema.json",
    "qa-release-v2.schema.json",
}
REQUIRED_ACTIVE_BRANCHES = {
    "terrain-geomorphology",
    "water-system",
    "ecology-agriculture",
    "historical-reconstruction",
    "runtime-publication",
}


def validate_schemas(validation: Any) -> None:
    present = {path.name for path in (validation.root / SCHEMA_DIR).glob("*.schema.json")}
    for filename in sorted(EXPECTED_SCHEMAS - present):
        validation.add("SCHEMA_MISSING", SCHEMA_DIR / filename, "Required schema is missing.")
    for filename in sorted(EXPECTED_SCHEMAS & present):
        relative = SCHEMA_DIR / filename
        document = validation.load(relative)
        if document and (
            document.get("$schema") != "https://json-schema.org/draft/2020-12/schema"
            or not document.get("$id")
            or document.get("type") != "object"
        ):
            validation.add("SCHEMA_CONTRACT", relative, "Draft 2020-12 object schema is required.")


def validate_registry(validation: Any) -> tuple[dict[str, dict[str, Any]], str]:
    document = validation.load(REGISTRY) or {}
    skill = document.get("skill") if isinstance(document.get("skill"), dict) else {}
    governance = document.get("governance") if isinstance(document.get("governance"), dict) else {}
    if document.get("schema") != "dem_procedural_landscape_branch_registry@2.0.0":
        validation.add("REGISTRY_SCHEMA", REGISTRY, "Registry must use v2.0.0.")
    if skill.get("id") != "dem-procedural-landscape":
        validation.add("SKILL_ID", REGISTRY, "Invalid skill id.")
    if skill.get("version") != "0.2.0":
        validation.add("SKILL_VERSION", REGISTRY, "Skill version must be 0.2.0.")
    if skill.get("controllerAlias") != "小王":
        validation.add("CONTROLLER_ALIAS", REGISTRY, "Controller alias must be 小王.")
    for key in (
        "userVisualApprovalRequired",
        "githubIsAuthoritativeBridge",
        "codexIsDownstreamExecutor",
        "truthLayersReadOnly",
        "failClosed",
    ):
        if governance.get(key) is not True:
            validation.add("GOVERNANCE_GATE", REGISTRY, f"governance.{key} must be true.")
    validation.require_file(governance.get("doctrinePath"), REGISTRY, "governance.doctrinePath")

    branches: dict[str, dict[str, Any]] = {}
    for group in ("referenceBranches", "activeBranches"):
        entries = document.get(group)
        if not isinstance(entries, list):
            validation.add("BRANCH_LIST", REGISTRY, f"{group} must be an array.")
            continue
        for entry in entries:
            branch_id = entry.get("id") if isinstance(entry, dict) else None
            if not isinstance(branch_id, str):
                validation.add("BRANCH_ID", REGISTRY, f"{group} contains an invalid entry.")
                continue
            if branch_id in branches:
                validation.add("BRANCH_DUPLICATE", REGISTRY, f"Duplicate branch id: {branch_id}")
                continue
            branches[branch_id] = entry
            validation.require_file(entry.get("skillPath"), REGISTRY, f"{branch_id}.skillPath")

    active_ids = {
        entry.get("id")
        for entry in document.get("activeBranches", [])
        if isinstance(entry, dict)
    }
    missing = REQUIRED_ACTIVE_BRANCHES - active_ids
    if missing:
        validation.add("ACTIVE_BRANCH_REQUIRED", REGISTRY, ", ".join(sorted(missing)))

    rules = document.get("globalRules") if isinstance(document.get("globalRules"), dict) else {}
    expected = {
        "defaultOutputGridM": 12.5,
        "no30mFinalFallback": True,
        "noSyntheticGapFill": True,
        "noTruthOverwrite": True,
        "proceduralFieldsRequireParentMask": True,
        "historicalLayersSeparate": True,
        "visualLayersSeparate": True,
        "verticalScale": "1:1",
        "controllerVisualApprovalRequired": True,
        "browserQaRequired": True,
        "rollbackRequired": True,
    }
    for key, value in expected.items():
        if rules.get(key) != value:
            validation.add("GLOBAL_RULE_GATE", REGISTRY, f"globalRules.{key} must equal {value!r}.")
    validation.branch_count = len(branches)
    return branches, str(skill.get("version") or "")
