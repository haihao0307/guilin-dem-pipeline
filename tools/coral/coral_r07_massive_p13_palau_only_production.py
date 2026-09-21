from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


RELEASE_ID = "CORAL_R07_P13_PALAU_ONLY_PORITES_LUTEA"
NOAA_SOURCE = "https://www.ncei.noaa.gov/metadata/geoportal/rest/metadata/item/noaa-coral-19702/html"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    require(count == 1, f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r07_massive_p13_palau_only_production.py <build-dir>")
    root = Path(sys.argv[1])
    index_path = root / "index.html"
    build_path = root / "BUILD_R07_P00.json"
    classification_path = root / "NOAA_CLASSIFICATION.json"
    evidence_path = root / "PALAU_OCCURRENCE_EVIDENCE.json"
    for path in (index_path, build_path, classification_path, evidence_path):
        require(path.is_file(), f"required P12 baseline file missing: {path}")

    html = index_path.read_text(encoding="utf-8")
    require("R07-P12" in html and "NOAA_NCEI_CONFIRMED" in html, "unexpected P12 baseline")
    require("Porites lutea" in html, "P12 species marker missing")

    visible_replacements = {
        "NOAA Massive Coral P12": "NOAA Massive Coral P13 · Palau Only",
        "Massive Coral P12": "Massive Coral P13 · Palau Only",
        "R07-P12": "R07-P13",
        "version:'R07-P12'": "version:'R07-P13'",
        "Porites lutea · NOAA Hard / stony coral → Massive coral · morphology prototype":
            "Porites lutea · Palau-verified · NOAA Hard / stony coral → Massive coral",
        "P12 淘汰经纬表皮网格，改用均匀测地半球三角网，消除穹顶附近的长条三角形和方向性拉丝。Poisson 杯坑、杯缘、共享壁与隔片继续沿真实法线进入同一连续表面；RGB 主色保持统一。NOAA NCEI 已确认其存在于帕劳群岛 Ulong Channel；Airai 本地投放仍待证。":
            "P13 启用帕劳限定生产门禁。Porites lutea 的帕劳群岛出现记录由 NOAA NCEI 的 Ulong Channel 物种级数据确认，因此允许继续生产；其他地区资料不再作为出现或外观真值。测地半球、Poisson 杯坑、杯缘、共享壁与法线位移保持 P12 几何合同。Airai / Stone Money Island 的具体微生境投放仍独立待审。",
        "Massive 是 NOAA 生长形态，不是物种。NOAA NCEI 已确认 Porites lutea 样本来自帕劳群岛 Ulong Channel（7.2859°N, 134.2503°E，12 m）；Stone Money Island / Airai 的局地投放仍为 UNRESOLVED。":
            "帕劳限定门禁：NOAA NCEI 已在帕劳群岛 Ulong Channel（7.2859°N, 134.2503°E，12 m）确认 Porites lutea；本物种已获帕劳资产生产准入。Massive 仍只是 NOAA 生长形态；Airai / Stone Money Island 的局地投放保持独立待审。",
        "assetStatus:'morphology prototype'": "assetStatus:'palau-verified-species-morphology-candidate'",
    }
    for old, new in visible_replacements.items():
        require(old in html, f"P13 source marker missing: {old[:80]}")
        html = html.replace(old, new)

    gate_fields = (
        "palauOccurrenceStatus:'CONFIRMED_PALAU',palauOnlyProductionEligible:true,"
        "productionAdmission:'PALAU_ONLY_ADMITTED',palauEvidenceAuthority:'NOAA_NCEI',"
        "palauEvidenceDatasetId:'noaa-coral-19702',localSitePlacementReady:false,"
    )
    qa_old = "localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',ecologicalPlacementReady:false"
    qa_new = gate_fields + qa_old
    html = replace_once(html, qa_old, qa_new, "P13 QA Palau gate")

    build_old = "localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',baseCapOrientation:'downward'"
    build_new = gate_fields + build_old
    html = replace_once(html, build_old, build_new, "P13 Build Palau gate")

    marker = r'''
<script id="r07-p13-palau-only-production-gate">
window.__CORAL_R07_PALAU_ONLY__={
  ready:true,version:'R07-P13',productionMode:'PALAU_ONLY',species:'Porites lutea',
  palauOccurrenceStatus:'CONFIRMED_PALAU',palauOnlyProductionEligible:true,
  productionAdmission:'PALAU_ONLY_ADMITTED',evidenceAuthority:'NOAA_NCEI',
  evidenceDatasetId:'noaa-coral-19702',evidenceSite:'Ulong Channel',
  nonPalauSpeciesRejected:true,genericIndoPacificEvidenceRejected:true,
  localSitePlacementReady:false,visualAcceptance:false,productionReady:false
};
</script>
'''.strip()
    html = replace_once(html, "</body>", marker + "\n</body>", "P13 runtime gate marker")
    require(html.count("palauOnlyProductionEligible:true") >= 3, "P13 eligibility markers incomplete")
    require(html.count("productionAdmission:'PALAU_ONLY_ADMITTED'") >= 3, "P13 admission markers incomplete")
    require("assetStatus:'morphology prototype'" not in html, "stale morphology-only status remains")
    index_path.write_text(html, encoding="utf-8")

    build = json.loads(build_path.read_text(encoding="utf-8"))
    build["schema"] = "CORAL_MOTHER_R07_MASSIVE_P13_BUILD"
    build["releaseId"] = RELEASE_ID
    build["bytes"] = len(html.encode("utf-8"))
    build["sha256"] = hashlib.sha256(html.encode("utf-8")).hexdigest()
    classification = build.setdefault("classification", {})
    classification.update(
        {
            "scientificName": "Porites lutea",
            "candidateSpecies": "Porites lutea",
            "assetStatus": "Palau-verified species / morphology candidate",
            "productionRegion": "Republic of Palau",
            "palauOccurrenceStatus": "CONFIRMED_PALAU",
            "palauOnlyProductionEligible": True,
            "productionAdmission": "PALAU_ONLY_ADMITTED",
            "palauEvidenceAuthority": "NOAA NCEI",
            "palauEvidenceDatasetId": "noaa-coral-19702",
            "palauEvidenceDoi": "10.25921/775a-rz50",
            "palauEvidenceSourceUrl": NOAA_SOURCE,
            "localSitePlacementReady": False,
            "localSitePlacementEvidence": "UNRESOLVED_AIRAI_STONE_MONEY_ISLAND",
            "ecologicalPlacementReady": False,
        }
    )
    build["palauOnlyGate"] = {
        "enabled": True,
        "minimumOccurrenceStatus": "CONFIRMED_PALAU",
        "speciesLevelNameRequired": True,
        "nonPalauSpeciesRejected": True,
        "genericIndoPacificEvidenceRejected": True,
        "otherRegionOnlyEvidenceRejected": True,
        "localSiteEvidenceSeparate": True,
    }
    build["supersedes"] = {
        "releaseId": "CORAL_R07_P12_NOAA_MASSIVE_PORITES_GEODESIC_SURFACE",
        "reason": "P13 keeps the validated P12 geometry and adds a hard Palau-only species-production contract.",
    }
    build["visualAcceptance"] = False
    build["productionReady"] = False
    build["ecologicalPlacementReady"] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    classification_doc = json.loads(classification_path.read_text(encoding="utf-8"))
    classification_doc.update(
        {
            "schema": "CORAL_NOAA_CLASSIFICATION_PALAU_ONLY_V1",
            "scientificName": "Porites lutea",
            "candidateSpecies": "Porites lutea",
            "assetStatus": "Palau-verified species / morphology candidate",
            "productionRegion": "Republic of Palau",
            "palauOccurrenceStatus": "CONFIRMED_PALAU",
            "palauOnlyProductionEligible": True,
            "productionAdmission": "PALAU_ONLY_ADMITTED",
            "palauEvidenceAuthority": "NOAA NCEI",
            "palauEvidenceDatasetId": "noaa-coral-19702",
            "palauEvidenceDoi": "10.25921/775a-rz50",
            "palauEvidenceSourceUrl": NOAA_SOURCE,
            "localSitePlacementReady": False,
            "localSitePlacementEvidence": "UNRESOLVED_AIRAI_STONE_MONEY_ISLAND",
            "ecologicalPlacementReady": False,
        }
    )
    classification_path.write_text(json.dumps(classification_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    evidence.update(
        {
            "schema": "CORAL_PALAU_OCCURRENCE_EVIDENCE_V2",
            "regionalStatus": "CONFIRMED_PALAU",
            "productionAdmission": "PALAU_ONLY_ADMITTED",
            "palauAssetLibraryEligible": True,
            "speciesLevelIdentification": True,
            "evidenceAuthorityCode": "NOAA_NCEI",
            "otherRegionEvidenceUsedForAdmission": False,
            "genericIndoPacificEvidenceUsedForAdmission": False,
            "localSitePlacementReady": False,
            "localGameSiteStatus": "UNRESOLVED",
            "ecologicalPlacementReady": False,
        }
    )
    evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    (root / "P13_PALAU_ONLY_ZH.md").write_text(
        "# Coral Mother R07-P13｜帕劳限定生产准入\n\n"
        "- 物种：`Porites lutea`。\n"
        "- NOAA：`Hard / stony coral → Massive coral`。\n"
        "- 帕劳证据：NOAA NCEI `noaa-coral-19702`，Ulong Channel，7.2859°N / 134.2503°E，12 m。\n"
        "- `palauOccurrenceStatus=CONFIRMED_PALAU`。\n"
        "- `palauOnlyProductionEligible=true`。\n"
        "- `productionAdmission=PALAU_ONLY_ADMITTED`。\n"
        "- 非帕劳、仅通用 Indo-Pacific、仅其他地区的证据不得进入生产准入。\n"
        "- P13 保留 P12 测地半球与 Poisson 珊瑚杯几何。\n"
        "- Airai / Stone Money Island 局地投放仍单独待审。\n"
        "- `visualAcceptance=false`；`productionReady=false`。\n",
        encoding="utf-8",
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
