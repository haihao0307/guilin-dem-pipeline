from __future__ import annotations

"""R07-P13 browser gate profile.

P13 preserves the complete P12 geometry and visual QA contract, then adds a
hard runtime assertion that the species has entered production through the
Palau-only evidence gate.  Regional admission and local site placement remain
separate facts.
"""

import json
import sys
from pathlib import Path


SOURCE = Path(__file__).with_name("coral_r07_massive_p12_browser_qa.py")
wrapper = SOURCE.read_text(encoding="utf-8")
exec_line = 'exec(compile(code, str(SOURCE), "exec"), {"__name__": "__main__", "__file__": str(SOURCE)})'
if exec_line not in wrapper:
    raise RuntimeError("P13 QA insertion point missing")

injection = r'''
p13_needle = "assert qa.get('palauArchipelagoOccurrenceEvidence') == 'NOAA_NCEI_CONFIRMED' and qa.get('localSitePlacementEvidence') == 'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND' and qa.get('ecologicalPlacementReady') is False, initial"
p13_replacement = p13_needle + "\n        assert qa.get('palauOccurrenceStatus') == 'CONFIRMED_PALAU' and qa.get('palauOnlyProductionEligible') is True, initial\n        assert qa.get('productionAdmission') == 'PALAU_ONLY_ADMITTED' and qa.get('palauEvidenceAuthority') == 'NOAA_NCEI', initial\n        assert qa.get('palauEvidenceDatasetId') == 'noaa-coral-19702' and qa.get('localSitePlacementReady') is False, initial\n        assert initial['build'].get('version') == 'R07-P13', initial\n        assert initial['build'].get('palauOccurrenceStatus') == 'CONFIRMED_PALAU' and initial['build'].get('palauOnlyProductionEligible') is True, initial\n        assert initial['build'].get('productionAdmission') == 'PALAU_ONLY_ADMITTED' and initial['build'].get('localSitePlacementReady') is False, initial"
if p13_needle not in code:
    raise RuntimeError("P13 runtime Palau assertion marker missing")
code = code.replace(p13_needle, p13_replacement, 1)
exec(compile(code, str(SOURCE), "exec"), {"__name__": "__main__", "__file__": str(SOURCE)})
'''.strip()
wrapper = wrapper.replace(exec_line, injection, 1)
exec(compile(wrapper, str(SOURCE), "exec"), {"__name__": "__main__", "__file__": str(SOURCE)})

root = Path(sys.argv[1])
path = root / "BUILD_R07_P00.json"
build = json.loads(path.read_text(encoding="utf-8"))
build.setdefault("functionalGates", {}).update(
    {
        "palauOnlyProductionMode": True,
        "palauSpeciesOccurrenceConfirmed": True,
        "speciesLevelEvidence": True,
        "noaaNceiDatasetGate": True,
        "nonPalauSpeciesRejected": True,
        "genericIndoPacificEvidenceRejected": True,
        "localSitePlacementSeparate": True,
    }
)
path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
