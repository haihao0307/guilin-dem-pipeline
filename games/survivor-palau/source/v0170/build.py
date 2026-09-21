"""Build Palau V0.1.7.0 from the preserved V0.1.6.0 source pipeline.

This slice integrates the R2 pilot-survival story contract and replaces timer-only fishing
with a visible surface-observation loop. The frozen V0.1.4.1 production release and the
V0.1.5/V0.1.6 candidates are never overwritten.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path.cwd()
D = Path(__file__).resolve().parent
V0160_BUILD = ROOT / "games/survivor-palau/source/v0160/build.py"
subprocess.run([sys.executable, str(V0160_BUILD)], check=True)
BASE = ROOT / "games/survivor-palau/releases/v0.1.6.0/index.html"
if len(sys.argv) > 1:
    BASE = Path(sys.argv[1])
s = BASE.read_text()
assert "const VERSION='palau-survival-0.1.6.0-reef-islands'" in s
base_hash = hashlib.sha256(s.encode()).hexdigest()


def once(old: str, new: str, label: str) -> None:
    global s
    count = s.count(old)
    assert count == 1, f"{label}: expected one occurrence, found {count}"
    s = s.replace(old, new, 1)


s = s.replace("V0.1.6.0", "V0.1.7.0")
s = s.replace("palau-survival-0.1.6.0-reef-islands", "palau-survival-0.1.7.0-pilot-survival")
s = s.replace("palau-survival-v0160-reef-islands", "palau-survival-v0170-pilot-survival")
once('<script type="module">', (D / 'interface.html').read_text() + '<script type="module">', 'interface injection')
once('function frame(now){', (D / 'survival.mjs').read_text() + '\nfunction frame(now){', 'survival injection')

# Lifecycle: create, dispose, draw, update and install the new production geometry/runtime.
once(
    '[terrainGeo,rocksGeo,ringGeo,logsGeo,vegetationGeo,canoeGeo,reefDecorGeo]',
    '[terrainGeo,rocksGeo,ringGeo,logsGeo,vegetationGeo,canoeGeo,reefDecorGeo,survivalGeo,surfaceFishGeo,surfaceGearGeo]',
    'geometry disposal',
)
once(
    'vegetationGeo=palauForestMesh();reefDecorGeo=buildReefDecor();canoeGeo=canoeMesh(gl);',
    'vegetationGeo=palauForestMesh();reefDecorGeo=buildReefDecor();survivalGeo=buildSurvivalProps();surfaceFishGeo=buildSurfaceFish();surfaceGearGeo=buildSurfaceGear();canoeGeo=canoeMesh(gl);',
    'geometry creation',
)
once(
    'drawSolid(canoeGeo,sun,canoeModel());if(reefDecorGeo)drawSolid(reefDecorGeo,sun);if(tackleGeo)drawSolid(tackleGeo,sun);',
    'drawSolid(canoeGeo,sun,canoeModel());if(reefDecorGeo)drawSolid(reefDecorGeo,sun);if(survivalGeo)drawSolid(survivalGeo,sun);if(surfaceFishGeo)drawSolid(surfaceFishGeo,sun);if(surfaceGearGeo)drawSolid(surfaceGearGeo,sun);if(tackleGeo)drawSolid(tackleGeo,sun);',
    'geometry draw',
)
once(
    ' updateFishing(elapsed);\n updateCamera(canvas.width/canvas.height);',
    ' updateFishing(elapsed);\n if(updatePilotSurvival(elapsed))changed=true;\n updateCamera(canvas.width/canvas.height);',
    'frame update',
)
once(
    'installCamera();installCanoeGame();installPalauHUD();',
    'installCamera();installCanoeGame();installPalauHUD();installPilotSurvival();',
    'runtime install',
)

# Existing handline remains the physical line/reel implementation, but its decision source is
# now the visible fish runtime rather than a fixed waiting timer.
once(
    'function beginFishing(){\n const point=chooseFishingTarget();',
    'function beginFishing(){\n if(!pilotCanStartFishing())return false;\n const point=chooseFishingTarget();',
    'limited gear start gate',
)
once(
    "FISH.target=point;FISH.progress=0;FISH.tension=.18;FISH.attempt++;fishPhase('ready');",
    "FISH.target=point;FISH.progress=0;FISH.tension=.18;FISH.attempt++;pilotOnCast(point);fishPhase('ready');",
    'consume initial bait',
)
once(
    "qa.view='fishing';opaqueDirty=true;return true;",
    "qa.view='fishing';opaqueDirty=true;pilotAfterFishingCamera(point);return true;",
    'surface observation camera',
)
once(
    "if(['ready','caught','missed','broken'].includes(FISH.phase)){FISH.progress=0;FISH.tension=.18;fishPhase('cast');return;}",
    "if(['ready','caught','missed','broken'].includes(FISH.phase)){if(FISH.phase!=='ready'&&!pilotCanRecast())return;if(FISH.phase!=='ready')pilotOnRecast();FISH.progress=0;FISH.tension=.18;fishPhase('cast');return;}",
    'limited gear recast gate',
)
once(
    "else if(FISH.phase==='waiting'&&FISH.time>3.4+(FISH.attempt%3)*.8)fishPhase('bite');",
    "else if(FISH.phase==='waiting'&&pilotFishReadyToBite())fishPhase('bite');",
    'visible fish bite gate',
)
once(
    "if(FISH.tension>=1||FISH.time>45)fishPhase('broken');\n  else if(FISH.progress>=1){FISH.catches++;fishPhase('caught');qa.catchesAwarded=FISH.catches;}",
    "if(FISH.tension>=1||FISH.time>45){pilotOnLineBroken();fishPhase('broken');}\n  else if(FISH.progress>=1){FISH.catches++;pilotOnCatch();fishPhase('caught');qa.catchesAwarded=FISH.catches;}",
    'gear loss and catch bridge',
)
once(
    "land[1]=waveAt(land[0],land[2],physicalTime,config).eta+.12+(FISH.phase==='cast'?Math.sin(t*Math.PI)*3:0)-(FISH.phase==='bite'?.23:0);",
    "land[1]=waveAt(land[0],land[2],physicalTime,config).eta+pilotLineEndOffset(t)+(FISH.phase==='cast'?Math.sin(t*Math.PI)*3:0)-(FISH.phase==='bite'?.18:0);",
    'underwater visible bait',
)

OUT = ROOT / "games/survivor-palau/releases/v0.1.7.0"
if len(sys.argv) > 2:
    OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "index.html").write_text(s)
meta = {
    "version": "0.1.7.0",
    "storyPackage": "PALAU_1944_PILOT_SURVIVAL_FULL_PACKAGE_R2",
    "historicalPrototypeDate": "1944-11-21",
    "sourceBaseSHA256": base_hash,
    "outputSHA256": hashlib.sha256(s.encode()).hexdigest(),
    "sourceModified": True,
    "interactive3D": True,
    "staticImageSubstitute": False,
    "surfaceObservation": True,
    "visibleFishRuntime": True,
    "visibleBaitAndHook": True,
    "shortSnorkelWaveInteraction": True,
    "limitedFishingGear": True,
    "autoCatch": False,
    "elasticSpear": False,
    "hawaiianSling": False,
    "mechanicalSpeargun": False,
    "verifiedFG1RaftReleaseAnimation": False,
    "visualAcceptancePending": True,
    "productionReady": False,
    "browserPassed": False,
    "shareAllowed": False,
    "pending": [
        "FG-1 raft stowage/release evidence",
        "full ditching and player-body animation",
        "species-validated Palau fish ecology",
        "wood-spear stage",
        "freediving stage",
        "physical iPhone/Safari thermal and frame-pacing test",
        "user visual acceptance",
    ],
}
(OUT / "BUILD.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
print(str(OUT / "index.html"), len(s.encode()), meta["outputSHA256"])
