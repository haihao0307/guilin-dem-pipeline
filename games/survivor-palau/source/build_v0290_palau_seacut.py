from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "games/survivor-palau/releases/v0.2.8/index.html"
OUT_DIR = ROOT / "games/survivor-palau/releases/v0.2.9"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"V0.2.9 patch target missing: {label}")
    return source.replace(old, new, 1)


source = SRC.read_text(encoding="utf-8")
source_sha = sha256(source)

source = source.replace("Stone Money Island — Survivor Palau · V0.2.8", "Stone Money Island — Survivor Palau · V0.2.9")
source = source.replace("stone-money-island-0.2.8-arch-reveal", "stone-money-island-0.2.9-palau-seacut")
source = source.replace("第一章 · 岸边求生 V0.2.8", "第一章 · 岸边求生 V0.2.9")
source = source.replace("archGeometry:'dissolved-mushroom-rock-island-v028-revealed'", "archGeometry:'dissolved-mushroom-rock-island-v028-revealed',palauSeaCut:'v029-steep-waterline-neck-base-flare'")

old_defs = "KARST_ROCKS.push([-83,34,9.6,19.0,8.1,911],[76,-53,8.1,15.7,7.0,937],[112,23,7.0,13.2,6.0,953],"
new_defs = "KARST_ROCKS.push([-83,34,7.8,20.8,7.0,911],[76,-53,12.4,15.4,9.7,937],[109,20,7.4,16.5,6.5,953],[120,27,5.9,12.7,5.1,959],"
source = replace_once(source, old_defs, new_defs, "three primary Palau karst forms")

old_profile = """   const foot=isKarst&&uy<-.24?mix(.24,.64,smooth(-1.0,-.24,uy)):(uy<-.58?.90+(uy+.58)*.07:1);
   const shoulder=isKarst?1.0+.22*smooth(-.24,.10,uy)*(1.0-smooth(.44,.80,uy)):1.0;
   const crownTaper=isKarst?mix(1.04,.66,smooth(.52,1.0,uy)):1.0;
   const wallFlute=isKarst?1.0+.045*Math.sin(Math.atan2(uz,ux)*7.0+seed*.13)*(1.0-smooth(.62,1.0,uy)):1.0;"""
new_profile = """   const seaUy=isKarst?clamp((waterLevel(0,SURFACE)-cy)/(sy*Math.max(radius,.55))-.018,-.70,-.27):-.45;
   const seaAz=Math.atan2(uz,ux);
   const cutY=seaUy+.030*Math.sin(seaAz*3.0+seed*.071)+.014*Math.sin(seaAz*7.0-seed*.037);
   // A short transition makes the waterline cut steep.  The neck stays narrow
   // below it, then opens gradually again at the submerged foot.
   const aboveCut=isKarst?smooth(cutY-.020,cutY+.030,uy):1.0;
   const bottomFlare=isKarst?1.0-smooth(-.98,Math.min(-.66,cutY-.24),uy):0.0;
   const neckProfile=isKarst?(.46+.21*bottomFlare):1.0;
   const foot=isKarst?mix(neckProfile,1.0,aboveCut):(uy<-.58?.90+(uy+.58)*.07:1);
   const shoulder=isKarst?1.0+.22*smooth(cutY+.025,.10,uy)*(1.0-smooth(.44,.80,uy)):1.0;
   const crownTaper=isKarst?mix(1.04,.66,smooth(.52,1.0,uy)):1.0;
   const wallFlute=isKarst?1.0+.045*Math.sin(seaAz*7.0+seed*.13)*(1.0-smooth(.62,1.0,uy)):1.0;"""
source = replace_once(source, old_profile, new_profile, "karst sea-cut profile")

source = replace_once(
    source,
    "karstMushroomProfile:true,cloudVisibilityV2:true",
    "karstMushroomProfile:true,palauSeaCutProfileV029:true,threeLandscapeMotherForms:true,cloudVisibilityV2:true",
    "qa flags",
)

source = replace_once(
    source,
    '<button id="smiAerial">全岛</button><button id="smiArchView">拱门</button>',
    '<button id="smiAerial">全岛</button><button id="smiKarstView">礁岛</button><button id="smiArchView">拱门</button>',
    "karst review button",
)
source = replace_once(
    source,
    "let s=state(),mode='menu',cameraMode='player',loaded=null,clock=0",
    "let s=state(),mode='menu',cameraMode=new URLSearchParams(location.search).has('karstReview')?'karst':'player',loaded=null,clock=0",
    "review camera initial state",
)
source = replace_once(
    source,
    "if(cameraMode==='aerial'){camera.eye=[0,190,240];camera.target=[0,-5,0];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=46*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,90000);return true;}if(cameraMode==='arch')",
    "if(cameraMode==='aerial'){camera.eye=[0,190,240];camera.target=[0,-5,0];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=46*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,90000);return true;}if(cameraMode==='karst'){camera.eye=[2,54,188];camera.target=[31,7,8];camera.forward=norm(sub(camera.target,camera.eye));camera.right=norm(cross(camera.forward,[0,1,0]));camera.up=cross(camera.right,camera.forward);camera.fov=54*Math.PI/180;host.lookAt(camera.view,camera.eye,camera.target,[0,1,0]);host.perspective(camera.proj,camera.fov,aspect,.15,90000);return true;}if(cameraMode==='arch')",
    "karst review camera",
)
source = replace_once(
    source,
    "$('smiAerial').onclick=()=>{cameraMode=cameraMode==='aerial'?'player':'aerial';$('smiAerial').textContent=cameraMode==='aerial'?'返回人物':'全岛';};$('smiArchView').onclick",
    "$('smiAerial').onclick=()=>{cameraMode=cameraMode==='aerial'?'player':'aerial';$('smiAerial').textContent=cameraMode==='aerial'?'返回人物':'全岛';};$('smiKarstView').onclick=()=>{cameraMode=cameraMode==='karst'?'player':'karst';$('smiKarstView').textContent=cameraMode==='karst'?'返回人物':'礁岛';};$('smiArchView').onclick",
    "karst review handler",
)
source = replace_once(
    source,
    "setCameraMode:m=>{cameraMode=['player','aerial','arch','fish'].includes(m)?m:'player';}",
    "setCameraMode:m=>{cameraMode=['player','aerial','karst','arch','fish'].includes(m)?m:'player';}",
    "karst camera api",
)

review_hook = """
if(new URLSearchParams(location.search).has('karstReview')){
 const beginKarstReview=()=>{
  if(host.ready()){
   if(mode==='menu')start(false);
   cameraMode='karst';
   const button=$('smiKarstView');if(button)button.textContent='返回人物';
  }else setTimeout(beginKarstReview,120);
 };
 setTimeout(beginKarstReview,120);
}
"""
source = replace_once(
    source,
    "ui();rebuildStatic();locateFish(0);config.fireEnabled=false;config.smokeVisible=false;config.paused=false;",
    "ui();rebuildStatic();locateFish(0);config.fireEnabled=false;config.smokeVisible=false;config.paused=false;" + review_hook,
    "automatic karst review mode",
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")
report = {
    "schema": "STONE_MONEY_ISLAND_V029_PALAU_SEA_CUT",
    "source": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": sha256(source),
    "landscapeSource": {
        "line": "Landscape Mother R2.5 steep lower sea-cut",
        "forms": [
            {"id": "P1", "role": "high-slender", "position": [-83, 34]},
            {"id": "P2", "role": "broad-thick", "position": [76, -53]},
            {"id": "P3", "role": "offset-paired", "position": [[109, 20], [120, 27]]},
        ],
    },
    "profile": {
        "waterlineCoupled": True,
        "steepInwardCut": True,
        "descendingNarrowNeck": True,
        "gradualSubmergedBaseFlare": True,
        "azimuthVariation": True,
    },
    "review": {"query": "karstReview=1", "cameraButton": "礁岛"},
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
