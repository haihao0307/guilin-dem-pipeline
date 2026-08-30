from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one occurrence, found {count}")
    return text.replace(old, new, 1)


def patch_wrapper() -> None:
    path = ROOT / "pipeline" / "distill_online_runtime.py"
    path.write_text(
        "from __future__ import annotations\n\n"
        "from distill_online_runtime_v6 import main\n\n"
        "if __name__ == '__main__':\n"
        "    raise SystemExit(main())\n",
        encoding="utf-8",
    )


def patch_viewer() -> None:
    path = ROOT / "viewer" / "app.js"
    text = path.read_text(encoding="utf-8")
    marker = "const WATERWAY_STYLE_PROFILE = 'longitudinal-flow-taper-v4';"
    replacement = marker + "\n  const HYDROLOGY_SEMANTIC_REVISION = 'li-gui-connected-bankfull-v6';"
    if "HYDROLOGY_SEMANTIC_REVISION" not in text:
        text = replace_once(text, marker, replacement, "viewer semantic marker")

    pattern = re.compile(
        r"float ordinaryHalfWidth\(float classValue,float sourceWidth,float progress\)\{.*?\n\}"
        r"\nfloat halfWidthPixels\(float classValue,float mainstemCode,float sourceWidth,float progress\)\{.*?\n\}",
        re.DOTALL,
    )
    width_function = """float ordinaryHalfWidth(float classValue,float sourceWidth,float progress){
  float metres=max(1.5,sourceWidth);
  float physicalHalf=metres*0.01225*uZoomScale*uEmphasis*uPixelRatio;
  float classFloor=classValue<0.5?0.16:(classValue<1.5?0.10:0.11);
  return max(classFloor*uPixelRatio,physicalHalf);
}
float halfWidthPixels(float classValue,float mainstemCode,float sourceWidth,float progress){
  float ordinary=ordinaryHalfWidth(classValue,sourceWidth,progress);
  float p=pow(clamp(progress,0.0,1.0),1.20);
  float mainFloor=mix(0.20,0.28,p)*uPixelRatio;
  float physicalHalf=max(1.5,sourceWidth)*0.01225*uZoomScale*uEmphasis*uPixelRatio;
  return mix(ordinary,max(mainFloor,physicalHalf),step(0.5,mainstemCode));
}"""
    text, count = pattern.subn(width_function, text)
    if count != 2:
        raise RuntimeError(f"viewer width functions: expected two replacements, found {count}")

    qa_marker = "future_flow_animation_ready: true,"
    if "hydrology_semantic_revision" not in text:
        text = replace_once(
            text,
            qa_marker,
            qa_marker + "\n      hydrology_semantic_revision: HYDROLOGY_SEMANTIC_REVISION,",
            "viewer QA semantic revision",
        )
    path.write_text(text, encoding="utf-8")


def patch_workflow() -> None:
    path = ROOT / ".github" / "workflows" / "guilin-online-full-map.yml"
    text = path.read_text(encoding="utf-8")
    if "pipeline/distill_online_runtime_v6.py" not in text:
        text = replace_once(
            text,
            "      - pipeline/distill_online_runtime.py\n",
            "      - pipeline/distill_online_runtime.py\n      - pipeline/distill_online_runtime_v6.py\n",
            "workflow push path",
        )
        text = replace_once(
            text,
            "            pipeline/distill_online_runtime.py \\\n",
            "            pipeline/distill_online_runtime.py \\\n            pipeline/distill_online_runtime_v6.py \\\n",
            "workflow py_compile",
        )
    text = text.replace(
        "assert receipt['runtime_profile']=='knowledge-indexed-first-load-v1'",
        "assert receipt['runtime_profile']=='knowledge-indexed-connected-routes-v6'",
    )
    semantic_assertions = """          assert receipt['semantic_qa']['li_continues_south_of_yangshuo'] is True
          assert receipt['semantic_qa']['flow_progress_inversion_count']==0
          assert receipt['semantic_qa']['flow_distance_inversion_count']==0
          assert receipt['route_selection']['downstream_closure_failure_count']==0
          assert receipt['route_selection']['segment_level_random_sampling'] is False
          assert manifest['direction']['li_gui_continuity']['connected'] is True
          assert manifest['direction']['li_gui_continuity']['continues_south_of_yangshuo'] is True
          assert manifest['topology']['runtime_route_fragment_count']==0
"""
    anchor = "          assert knowledge['runtime']['full_truth_downloaded_on_page_open'] is False\n"
    if "li_continues_south_of_yangshuo" not in text:
        text = replace_once(text, anchor, anchor + semantic_assertions, "workflow semantic assertions")
    path.write_text(text, encoding="utf-8")


def patch_contract() -> None:
    path = ROOT / "contracts" / "GUILIN_DISTILLED_RUNTIME_CONTRACT_V1.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["revision"] = "2026-08-30-r3-li-gui-connected-v6"
    payload["hydrology"]["semantic_revision"] = "li-gui-connected-bankfull-v6"
    payload["hydrology"]["li_gui_mainstem_must_continue_south_of_yangshuo"] = True
    payload["hydrology"]["mainstem_progress_must_run_upstream_to_downstream"] = True
    payload["hydrology"]["mainstem_width_unit"] = "metres"
    payload["hydrology"]["mainstem_width_model"] = "continuous bankfull width from headwater to downstream"
    payload["hydrology"]["minor_waterway_selection"] = "complete source-to-outlet or source-to-mainstem routes"
    payload["hydrology"]["segment_level_random_sampling_allowed"] = False
    payload["hydrology"]["runtime_route_fragment_count_maximum"] = 0
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_knowledge_contract() -> None:
    path = ROOT / "knowledge" / "GUILIN_HYDROLOGY_SEMANTICS_V6.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": "guilin-hydrology-semantics/v6",
        "status": "ACTIVE_REVIEW_CANDIDATE",
        "mainstems": {
            "li_gui": {
                "upstream": "north of Guilin",
                "downstream": "south through Yangshuo and onward into the Gui River corridor",
                "must_continue_south_of_yangshuo": True,
                "progress": "0 upstream to 1 downstream",
                "width": "physical bankfull metres, continuous and increasing downstream",
                "colour": "light upstream to dark downstream",
            },
            "xiang": {"progress": "0 upstream to 1 downstream"},
            "zi": {"progress": "0 upstream to 1 downstream"},
        },
        "minor_routes": {
            "selection_unit": "complete connected route",
            "downstream_closure_required": True,
            "segment_level_sampling": False,
            "fragment_count_maximum": 0,
        },
        "immutable_rules": {
            "centerline_coordinates_mutated": False,
            "manual_centerline_added": False,
            "synthetic_gap_line_added": False,
            "lake_surface_asset_count": 0,
            "reservoir_surface_asset_count": 0,
        },
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    patch_wrapper()
    patch_viewer()
    patch_workflow()
    patch_contract()
    write_knowledge_contract()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
