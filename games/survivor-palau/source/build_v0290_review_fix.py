from pathlib import Path
import json
import runpy

ROOT = Path(__file__).resolve().parents[3]
BASE_BUILDER = ROOT / "games/survivor-palau/source/build_v0290_palau_seacut.py"
OUT = ROOT / "games/survivor-palau/releases/v0.2.9/index.html"
BUILD = ROOT / "games/survivor-palau/releases/v0.2.9/build.json"

runpy.run_path(str(BASE_BUILDER), run_name="__main__")
source = OUT.read_text(encoding="utf-8")
old = """if(new URLSearchParams(location.search).has('karstReview')){
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
new = """if(new URLSearchParams(location.search).has('karstReview')){
 let karstReviewAttempts=0;
 const beginKarstReview=()=>{
  karstReviewAttempts++;
  if(mode==='menu')start(false);
  cameraMode='karst';
  const button=$('smiKarstView');if(button)button.textContent='返回人物';
  if(mode==='play'){
   document.body.dataset.karstReviewReady='true';
  }else if(karstReviewAttempts<240){
   setTimeout(beginKarstReview,250);
  }
 };
 setTimeout(beginKarstReview,250);
}
"""
if old not in source:
    raise RuntimeError("V0.2.9 review hook not found")
source = source.replace(old, new, 1)
OUT.write_text(source, encoding="utf-8")
report = json.loads(BUILD.read_text(encoding="utf-8"))
report["review"]["retryStart"] = True
report["review"]["runtimeMarker"] = "data-karst-review-ready"
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
