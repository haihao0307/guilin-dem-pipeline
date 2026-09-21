"""Build Palau V0.1.7.2 observation-visual candidate from the V0.1.7.0 playable source.

The technical handline rules remain unchanged. This pass removes the opaque 3D eyecups,
reframes an already-active observation camera when fishing begins, and brings the early
handline target into a visually readable but still non-automatic range.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path.cwd()
D = Path(__file__).resolve().parent
V0170_BUILD = ROOT / 'games/survivor-palau/source/v0170/build.py'
subprocess.run([sys.executable, str(V0170_BUILD)], check=True)
BASE = ROOT / 'games/survivor-palau/releases/v0.1.7.0/index.html'
if len(sys.argv) > 1:
    BASE = Path(sys.argv[1])
s = BASE.read_text()
assert "const VERSION='palau-survival-0.1.7.0-pilot-survival'" in s
base_hash = hashlib.sha256(s.encode()).hexdigest()


def once(old: str, new: str, label: str) -> None:
    global s
    count = s.count(old)
    assert count == 1, f'{label}: expected one occurrence, found {count}'
    s = s.replace(old, new, 1)


s = s.replace('V0.1.7.0', 'V0.1.7.2')
s = s.replace('palau-survival-0.1.7.0-pilot-survival', 'palau-survival-0.1.7.2-observation-visual')
s = s.replace('palau-survival-v0170-pilot-survival', 'palau-survival-v0172-observation-visual')
once('<script type="module">', (D / 'interface.html').read_text() + '<script type="module">', 'visual interface injection')
once('function frame(now){', (D / 'visual.mjs').read_text() + '\nfunction frame(now){', 'visual telemetry injection')

# Remove the two opaque near-camera ellipsoids and their solid bridge. A thin SVG rim replaces them.
once(
    " pilotOrientedEllipsoid(g,left,fx,fz,.018,.052,.070,10,3,4,8);pilotOrientedEllipsoid(g,right,fx,fz,.018,.052,.070,10,4,4,8);\n g.tube([left[0]+rx*.06,left[1],left[2]+rz*.06],[right[0]-rx*.06,right[1],right[2]-rz*.06],.012,9,6);",
    " // V0172: the worn goggle rim is screen-space and transparent; no solid eyecup may cover the view.",
    'remove opaque eyecups',
)

# Starting handline while already observing previously retained the old 23 m fishing camera.
# Re-derive the water-level camera around the actual bait point instead.
once(
    "const o=SURVIVAL.observation;if(o.active&&point){o.focusX=point.x;o.focusZ=point.z;o.behaviorClockMs=performance.now();return true}",
    "const o=SURVIVAL.observation;if(o.active&&point){o.focusX=point.x;o.focusZ=point.z;const focusWater=waveAt(o.focusX,o.focusZ,physicalTime,config).eta;pilotDeriveCamera([o.anchorX,o.bobY-.055,o.anchorZ],[o.focusX,focusWater-.72,o.focusZ]);o.lastYaw=camera.yaw;o.lastPitch=camera.pitch;o.behaviorClockMs=performance.now();opaqueDirty=true;return true}",
    'active observation camera reframe',
)
once("target=[o.focusX,focusWater-.82,o.focusZ]", "target=[o.focusX,focusWater-.72,o.focusZ]", 'initial observation aim depth')
once(
    "o.anchorX=CANOE_STATE.x+Math.sin(side)*2.35;o.anchorZ=CANOE_STATE.z+Math.cos(side)*2.35;",
    "o.anchorX=CANOE_STATE.x+Math.sin(side)*4.2;o.anchorZ=CANOE_STATE.z+Math.cos(side)*4.2;",
    'clear canoe from observation view',
)

# Early handline begins at the floating player's hand, not at a retained canoe rod. The target is
# selected directly ahead of the current observation pose, preserving the same depth and reef gates.
start = s.index('function chooseFishingTarget(){')
end = s.index('\nfunction beginFishing(){', start)
choose_target = '''function chooseFishingTarget(){
 const o=SURVIVAL.observation,surface=!!o.active,ox=surface?o.anchorX:CANOE_STATE.x,oz=surface?o.anchorZ:CANOE_STATE.z;
 let baseYaw=CANOE_STATE.yaw;if(surface){const fx=o.focusX-ox,fz=o.focusZ-oz;if(Math.hypot(fx,fz)>.2)baseYaw=Math.atan2(fx,fz);}
 for(const off of [0,.35,-.35,.7,-.7,1.2,-1.2,Math.PI]){const a=baseYaw+off,x=ox+Math.sin(a)*7.5,z=oz+Math.cos(a)*7.5;let clear=true;for(let i=1;i<=10;i++){const px=mix(ox,x,i/10),pz=mix(oz,z,i/10);if(rockField.sample(px,pz)>.15||bedHeight(px,pz)>waterLevel(physicalTime)-.1){clear=false;break;}}if(clear&&waterLevel(physicalTime)-bedHeight(x,z)>.65&&rockField.sample(x,z)<0)return{x,z};}
 return null;
}'''
s = s[:start] + choose_target + s[end:]

# Surface observation uses a bare handline entering the water close to the camera. Retaining the
# canoe-mounted rod in this view placed a giant hull and rod across the evidence frame and contradicted
# the locked one-hand-controls-line posture.
tackle_start = s.index('function buildTackle(){')
tackle_end = s.index('\nfunction updateFishing(', tackle_start)
tackle = '''function buildTackle(){
 if(!FISH.target||FISH.phase==='closed')return;
 const g=new PalauGeometry(),o=SURVIVAL.observation,surface=!!o.active,sx=surface?o.anchorX:CANOE_STATE.x,sz=surface?o.anchorZ:CANOE_STATE.z;
 const a=surface?Math.atan2(FISH.target.x-sx,FISH.target.z-sz):CANOE_STATE.yaw,dx=Math.sin(a),dz=Math.cos(a),water=waveAt(sx,sz,physicalTime,config).eta;
 let tip;if(surface){tip=[sx+dx*.28,water-.04,sz+dz*.28];}else{const root=[sx+dx,water+.28,sz+dz];tip=[sx+dx*3.1,water+2.6,sz+dz*3.1];g.tube(root,tip,.027,6,6);}
 const t=FISH.phase==='ready'?0:FISH.phase==='cast'?smooth(0,1,FISH.time):1,progress=FISH.phase==='caught'?1:FISH.phase==='reel'?FISH.progress:0;
 const startPoint=surface?[sx+dx*.55,water-.08,sz+dz*.55]:[sx+dx*3,water+.12,sz+dz*3];
 const land=[mix(startPoint[0],FISH.target.x,t)*(1-progress)+tip[0]*progress,0,mix(startPoint[2],FISH.target.z,t)*(1-progress)+tip[2]*progress];
 land[1]=waveAt(land[0],land[2],physicalTime,config).eta+pilotLineEndOffset(t)+(FISH.phase==='cast'?Math.sin(t*Math.PI)*(surface?1.2:3):0)-(FISH.phase==='bite'?.18:0);
 let p=tip;for(let i=1;i<=14;i++){const f=i/14,q=tip.map((v,k)=>mix(v,land[k],f));q[1]-=Math.sin(f*Math.PI)*(surface?.22:.36);g.tube(p,q,.012,10,4);p=q;}
 g.sphere(...land,.085,.14,.085,11,0,5,8);
 if(FISH.phase==='caught'){const cx=sx+dx*.42,cz=sz+dz*.42,cy=water+(surface?.06:.62);g.sphere(cx,cy,cz,.16,.12,.43,8,31,6,10);const rx=dz,rz=-dx,k=g.v.length/7;g.vertex([cx-dx*.28,cy,cz-dz*.28],8);g.vertex([cx-dx*.52+rx*.18,cy,cz-dz*.52+rz*.18],8);g.vertex([cx-dx*.52-rx*.18,cy,cz-dz*.52-rz*.18],8);g.tri(k,k+1,k+2);g.tri(k,k+2,k+1);}
 if(tackleGeo)disposeGeo(tackleGeo);tackleGeo=g.upload();opaqueDirty=true;
}'''
s = s[:tackle_start] + tackle + s[tackle_end:]

# Keep the thin overlay state coupled to the same authoritative observation state.
once(
    "const card=document.getElementById('observeCard'),button=document.getElementById('actionObserve');if(card)card.hidden=!o.active;if(button){button.classList.toggle('active',o.active);button.textContent=o.active?'退出观察':'水面观察'}",
    "const card=document.getElementById('observeCard'),button=document.getElementById('actionObserve'),lens=document.getElementById('pilotLensOverlay');if(card)card.hidden=!o.active;if(lens){lens.hidden=!o.active;pilotSyncObservationLens();}if(button){button.classList.toggle('active',o.active);button.textContent=o.active?'退出观察':'水面观察'}",
    'lens overlay lifecycle',
)
once(
    "set('observeHelp',submerged?'先松开贴近观察，等管口离水并排出少量进水。':`目标鱼距饵 ${Math.min(99,SURVIVAL.fishing.candidateDistanceM).toFixed(1)} m · ${o.calm>.55?'动作稳定，鱼在靠近':'减少转头和大幅划水'}`);",
    "const rangeText=SURVIVAL.fishing.candidateDistanceM<90?`目标鱼距饵 ${SURVIVAL.fishing.candidateDistanceM.toFixed(1)} m`:'尚未放下饵钩';set('observeHelp',submerged?'先松开贴近观察，等管口离水并排出少量进水。':`${rangeText} · ${o.calm>.55?'动作稳定，鱼在靠近':'减少转头和大幅划水'}`);",
    'honest pre-cast range text',
)
once(
    'installCamera();installCanoeGame();installPalauHUD();installPilotSurvival();',
    'installCamera();installCanoeGame();installPalauHUD();installPilotSurvival();installPilotObservationVisual();',
    'visual runtime install',
)

OUT = ROOT / 'games/survivor-palau/releases/v0.1.7.2'
if len(sys.argv) > 2:
    OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'index.html').write_text(s)
meta = {
    'version': '0.1.7.2',
    'sourceBaseSHA256': base_hash,
    'outputSHA256': hashlib.sha256(s.encode()).hexdigest(),
    'sourceModified': True,
    'interactive3D': True,
    'staticImageSubstitute': False,
    'technicalBaseline': '0.1.7.0 handline QA',
    'thinScreenSpaceGoggleFrame': True,
    'solidGoggleOccluders': 0,
    'handlineTargetRangeM': 7.5,
    'observationLateralOffsetM': 4.2,
    'activeObservationCameraReframed': True,
    'surfaceHandlineOrigin': True,
    'canoeRodRemovedFromSurfaceObservation': True,
    'autoCatch': False,
    'elasticSpear': False,
    'hawaiianSling': False,
    'mechanicalSpeargun': False,
    'visualAcceptancePending': True,
    'productionReady': False,
    'browserPassed': False,
    'shareAllowed': False,
    'pending': [
        'browser visual-readability QA',
        'physical iPhone/Safari thermal and frame-pacing test',
        'user visual acceptance',
        'species-validated Palau fish ecology',
        'wood-spear stage',
    ],
}
(OUT / 'BUILD.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
print(str(OUT / 'index.html'), len(s.encode()), meta['outputSHA256'])
