"""Project binding, layer and status validation."""
from pathlib import Path
from typing import Any

try:
    from tools.procedural_landscape.contracts import REGISTRY
except ModuleNotFoundError:
    from contracts import REGISTRY

STATUS = Path("web/procedural-landscape-skill/status.json")
DELTA_ROLES = {"historical-delta", "procedural-delta", "visual-delta"}


def validate_binding(validation: Any, relative: Path, branches: dict, version: str) -> None:
    document = validation.load(relative)
    if not document:
        return
    project = document.get("project") if isinstance(document.get("project"), dict) else {}
    project_id = project.get("id")
    folder = relative.parts[1]
    if not isinstance(project_id, str) or not project_id:
        validation.add("PROJECT_ID", relative, "project.id is required.")
        return
    skill = document.get("skill") if isinstance(document.get("skill"), dict) else {}
    if (skill.get("id"), skill.get("version")) != ("dem-procedural-landscape", version):
        validation.add("BINDING_SKILL", relative, "Binding skill id or version differs from registry.")
    if skill.get("ref") != "skill/dem-procedural-landscape-v010" or skill.get("registryPath") != str(REGISTRY):
        validation.add("BINDING_REF", relative, "Binding ref or registry path is invalid.")

    active = document.get("activeBranches")
    if not isinstance(active, list) or not active:
        validation.add("BINDING_BRANCHES", relative, "activeBranches must be non-empty.")
    else:
        seen: set[str] = set()
        for entry in active:
            branch_id = entry.get("id") if isinstance(entry, dict) else None
            if not isinstance(branch_id, str):
                validation.add("BINDING_BRANCH_ID", relative, "Binding branch id is missing.")
                continue
            if branch_id in seen:
                validation.add("BINDING_BRANCH_DUPLICATE", relative, branch_id)
            seen.add(branch_id)
            registered = branches.get(branch_id)
            if not registered:
                validation.add("BINDING_BRANCH_UNKNOWN", relative, branch_id)
            elif entry.get("skillPath") != registered.get("skillPath"):
                validation.add("BINDING_BRANCH_PATH", relative, branch_id)

    truth_sources = document.get("truthSources")
    if not isinstance(truth_sources, list) or not truth_sources:
        validation.add("TRUTH_SOURCE_REQUIRED", relative, "truthSources must be non-empty.")
    else:
        for source in truth_sources:
            if not isinstance(source, dict):
                validation.add("TRUTH_SOURCE_TYPE", relative, "Truth source must be an object.")
                continue
            if source.get("projectId") != project_id:
                validation.add("PROJECT_DATA_LEAK", relative, "Truth source projectId differs from binding project.")
            source_path = source.get("path")
            if isinstance(source_path, str) and source_path.startswith("projects/"):
                parts = Path(source_path).parts
                if len(parts) > 1 and parts[1] != folder:
                    validation.add("PROJECT_PATH_LEAK", relative, f"Cross-project source path: {source_path}")
            if source.get("immutable") is not True:
                validation.add("TRUTH_MUTABLE", relative, "Truth source must be immutable.")
            if source.get("nativeSurveyClaim") is not False:
                validation.add("NATIVE_SURVEY_CLAIM", relative, "nativeSurveyClaim must be false.")
            if source.get("outputGridMeters") == 30 or source.get("resolutionMeters") == 30:
                validation.add("FINAL_30M_FALLBACK", relative, "30 m data cannot be a final production source.")

    constraints = document.get("constraints") if isinstance(document.get("constraints"), dict) else {}
    for key, value in {
        "no30mFinalFallback": True,
        "noSyntheticGapFill": True,
        "noTruthOverwrite": True,
        "verticalScale": "1:1",
        "projectDataIsolation": True,
    }.items():
        if constraints.get(key) != value:
            validation.add("CONSTRAINT_GATE", relative, f"constraints.{key} must equal {value!r}.")

    historical = document.get("historicalOutput")
    if isinstance(historical, dict) and historical.get("enabled"):
        if historical.get("native1mSurveyClaim") is not False:
            validation.add("HISTORICAL_1M_CLAIM", relative, "Historical 1 m output cannot claim native survey resolution.")
        if historical.get("targetOutputGridMeters") == 1 and historical.get("label") not in {
            "1米历史增强地形",
            "1米历史重建地形",
        }:
            validation.add("HISTORICAL_1M_LABEL", relative, "Historical 1 m label is invalid.")

    release = document.get("release") if isinstance(document.get("release"), dict) else {}
    required_gates = ("browserQaRequired", "rollbackRequired", "controllerVisualApprovalRequired")
    if any(release.get(key) is not True for key in required_gates):
        validation.add("RELEASE_GATES", relative, "Browser QA, rollback and visual approval must be required.")
    public = release.get("publicReleaseApproved") is True or release.get("status") in {"approved", "published"}
    if public:
        stages = {
            entry.get("id"): entry.get("status")
            for entry in document.get("stages", [])
            if isinstance(entry, dict)
        }
        if stages.get("browser-qa") not in {"approved", "published"}:
            validation.add("PUBLIC_BROWSER_QA", relative, "Public release lacks approved browser QA.")
        if release.get("rollbackVerified") is not True:
            validation.add("PUBLIC_ROLLBACK", relative, "Public release lacks verified rollback.")
        if release.get("controllerVisualApproval") != "approved":
            validation.add("PUBLIC_VISUAL_APPROVAL", relative, "Public release lacks visual approval.")


def validate_layers(validation: Any) -> None:
    for path in sorted(validation.root.glob("projects/**/*.layer.json")):
        relative = path.relative_to(validation.root)
        document = validation.load(relative)
        if not document:
            continue
        validation.layer_count += 1
        role = document.get("layerRole")
        if role == "truth":
            protection = document.get("truthProtection") if isinstance(document.get("truthProtection"), dict) else {}
            if protection.get("mutable") is not False or protection.get("sourceChecksumRequired") is not True:
                validation.add("TRUTH_PROTECTION", relative, "Truth layer must be immutable and checksum-gated.")
        if role in DELTA_ROLES:
            if not document.get("parentMask"):
                validation.add("PARENT_MASK_REQUIRED", relative, "Delta layer requires a parent mask.")
            delta = document.get("delta") if isinstance(document.get("delta"), dict) else {}
            if delta.get("reversible") is not True or "maxAbsDelta" not in delta or "rollbackValue" not in delta:
                validation.add("DELTA_ROLLBACK", relative, "Delta must be bounded and reversible.")


def validate_status(validation: Any) -> None:
    if not (validation.root / STATUS).is_file():
        return
    document = validation.load(STATUS)
    if not document:
        return
    skill = document.get("skill") if isinstance(document.get("skill"), dict) else {}
    quality = document.get("quality") if isinstance(document.get("quality"), dict) else {}
    release = document.get("release") if isinstance(document.get("release"), dict) else {}
    if document.get("schemaVersion") != "2.0.0" or document.get("documentType") != "dem-procedural-landscape-foundation-status":
        validation.add("STATUS_CONTRACT", STATUS, "Status contract is invalid.")
    if (skill.get("controllerAlias"), skill.get("version")) != ("小华", "0.2.0"):
        validation.add("STATUS_SKILL", STATUS, "Status skill identity is invalid.")
    if quality.get("truthDataModified") is not False:
        validation.add("STATUS_TRUTH_MODIFIED", STATUS, "Foundation work must not modify truth data.")
    if release.get("publicReleaseApproved") is not False:
        validation.add("STATUS_PUBLIC_RELEASE", STATUS, "Foundation status cannot claim public approval.")
    html = validation.root / "web/procedural-landscape-skill/index.html"
    if html.is_file():
        text = html.read_text(encoding="utf-8")
        for token in ("程序化地貌生产线", 'id="embedded-status"', "data-status-root"):
            if token not in text:
                validation.add("STATUS_PAGE_TOKEN", html, f"Missing page token: {token}")
