"""Prepare the R012 viewer/build from the exact tested R011 source branch."""
from pathlib import Path
import json
import subprocess
import sys


HERE = Path(__file__).parent
R011 = HERE.parent / "web-r011"


def replace_once(text, old, new, name):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{name}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


def prepare_main():
    source = (R011 / "main.mjs").read_text(encoding="utf-8")
    source = "import {installRemainingFinStudy} from './otherfins.mjs';\n" + source
    source = replace_once(source, "from './pectoral.mjs'", "from '../web-r011/pectoral.mjs'", "R011 pectoral module")
    source = replace_once(source, "let regionTool=null,boundaryTool=null,headTool=null,featureTool=null,oralTool=null,tailTool=null,pectoralTool=null;", "let regionTool=null,boundaryTool=null,headTool=null,featureTool=null,oralTool=null,tailTool=null,pectoralTool=null,otherFinTool=null;", "tool registry")
    count = source.count("pectoralTool?.update();")
    if count != 2:
        raise RuntimeError(f"animation update: expected two anchors, found {count}")
    source = source.replace("pectoralTool?.update();", "pectoralTool?.update();otherFinTool?.update();")
    source = replace_once(source, "clearOther(){tailTool.hide();oralTool.clear(false);", "clearOther(){otherFinTool?.hide();tailTool.hide();oralTool.clear(false);", "pectoral overlay exclusion")
    anchor = "window.FISH_STRUCTURAL={"
    setup = """let otherFinClock=null;
otherFinTool=installRemainingFinStudy({compiled,meshes,state,qa,scenes,cam,controls,preset,regionTool,getSurfaces:()=>surfaces,readSurface,
 clearOther(){pectoralTool.hide();tailTool.hide();oralTool.clear(false);featureTool.hide();headTool.clear();boundaryTool.clear();regionTool.restore();},
 beginExact(){otherFinClock={time:state.time,rest:state.rest,play:state.play,modes:oralModes()};state.play=false;},
 seekExact:oralSeek,
 endExact(){actions.forEach(a=>a.reset());oralRestoreModes(otherFinClock.modes);at(otherFinClock.time,otherFinClock.rest);state.play=otherFinClock.play;otherFinClock=null;},
 jumpExact(t){const modes=oralModes();oralSeek(t,false);oralRestoreModes(modes);}
});
"""
    source = replace_once(source, anchor, setup + anchor, "R012 module installation")
    source = source.replace("FISH_PECTORAL_R011", "FISH_REMAINING_FINS_R012").replace("R011</span>", "R012</span>")
    (HERE / "main.mjs").write_text(source, encoding="utf-8")


def build_script():
    source = '''"""Build the standalone R012 page; retain original source precision."""
from pathlib import Path
import base64, hashlib, json, os

HERE=Path(__file__).parent
OUT=Path("dist/fish-mother-yellowfin")
SHA=lambda value:hashlib.sha256(value).hexdigest()

def build():
 OUT.mkdir(parents=True,exist_ok=True)
 source=Path("apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/source-workspace/source/tuna_fish_4k.glb").read_bytes()
 assert SHA(source)=="5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe"
 prefix=(HERE/"boot.html").read_text(encoding="utf-8").replace("__BUILD_SHA__",os.environ.get("GITHUB_SHA","local")).replace("__SOURCE_BYTES__",str(len(source)))
 assert len(prefix.encode())<16384 and 'id="fish-boot-title"' in prefix
 path=OUT/"index.html";chunk_bytes=786432;roundtrip=hashlib.sha256();chunks=0
 with path.open("w",encoding="utf-8",newline="") as page:
  page.write(prefix)
  for offset in range(0,len(source),chunk_bytes):
   value=base64.b64encode(source[offset:offset+chunk_bytes]).decode("ascii");roundtrip.update(base64.b64decode(value,validate=True))
   page.write('<script type="application/octet-stream" data-fish-chunk="source" data-index="'+str(chunks)+'">'+value+'</script><script>FISH_BOOT.chunk(document.currentScript.previousElementSibling);document.currentScript.remove();</script>\\n');chunks+=1
  entries=[("canonicalPackage","canonical-r004/teacher-package.json"),("surfaceRegions","parts-r005/parts.json"),("boundaryEvidence","boundary-r006/boundary-evidence.json"),("headEvidence","head-r007/head-evidence.json"),("featureEvidence","feature-r008/feature-evidence.json"),("oralEvidence","oral-r009/oral-evidence.json"),("tailEvidence","tail-r010/tail-evidence.json"),("pectoralEvidence","pectoral-r011/pectoral-evidence.json"),("otherFinEvidence","remaining-fins-r012/remaining-fin-evidence.json")]
  for element,relative in entries:
   value=(OUT/relative).read_text(encoding="utf-8").replace("<","\\\\u003c");json.loads(value);page.write('<script id="'+element+'" type="application/json">'+value+'</script>')
  fields=(OUT/"canonical-r004/teacher-fields.bin").read_bytes();page.write('<script id="canonicalFields" type="application/octet-stream">'+base64.b64encode(fields).decode("ascii")+'</script>')
  runtime=(HERE/"bundle.js").read_text(encoding="utf-8").replace("</script","<\\\\/script");page.write('<script type="module">'+runtime+'</script></body></html>')
 assert roundtrip.hexdigest()==SHA(source) and chunks==75
 body=path.read_bytes()
 assert b'id="teacher"' not in body
 result={"version":"FISH_REMAINING_FINS_R012","buildSha":os.environ.get("GITHUB_SHA","local"),"bytes":len(body),"sha256":SHA(body),"sourceGlbSha256":SHA(source),"sourceBytes":len(source),"sourceChunkBytes":chunk_bytes,"sourceChunks":chunks,"sourceChunkRoundtripHashMatches":True,"bootPrefixBytes":len(prefix.encode()),"visibleHtmlBeforeSource":True,"boundedBase64Decode":True,"fullSourceAtobRemoved":True,"sourcePrecisionChanged":False,"originalPngBytesEmbedded":True,"runtimeEmbedded":True,"externalRuntimeDependencies":0,"standalone":True,"productionReady":False,"independentReconstruction":False,"manualVisualAcceptance":False}
 (OUT/"BUILD_MANIFEST.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
 print("R012_BUILD",json.dumps(result),flush=True)

if __name__=="__main__":build()
'''
    (HERE / "build.py").write_text(source, encoding="utf-8")


def prepare_regression():
    source = (R011 / "qa_regression.mjs").read_text(encoding="utf-8").replace("FISH_PECTORAL_R011", "FISH_REMAINING_FINS_R012")
    anchor = " result.initial=initial;"
    block = r''' result.otherFinStudy=await page.evaluate(()=>window.FISHQA.otherFinStudy);assert(result.otherFinStudy.version==='FISH_REMAINING_FINS_R012'&&result.otherFinStudy.samples===209&&result.otherFinStudy.patchIds.length===7,'remaining source fin inventory mismatch');
 result.otherFinAudit=await page.evaluate(()=>window.FISH_OTHER_FINS.audit());console.log('OTHER_FIN_AUDIT',JSON.stringify(result.otherFinAudit));assert(result.otherFinAudit.passed&&result.otherFinAudit.clampedTimes===209&&result.otherFinAudit.comparedRuntimes===2,'remaining source fin / teacher / candidate parity failed');
 result.otherFinSelections=[];for(const id of result.otherFinStudy.patchIds){await page.selectOption('#otherFinSelect',id);await page.locator('#otherFinFocus').click();const current=await page.evaluate(()=>window.FISHQA.otherFinCurrent);assert(current.id===id,'source fin did not become active');await page.locator('#otherFinIsolate').click();const isolated=await page.evaluate(()=>({enabled:window.FISHQA.regionIsolated,part:window.FISHQA.regionSelected,triangles:window.FISHQA.regionRenderedTriangles,expected:window.FISH_REGIONS.data.parts.find(x=>x.id===window.FISHQA.otherFinCurrent.id).sourceTriangles.length}));assert(isolated.enabled&&isolated.part===id&&isolated.triangles===isolated.expected,'isolated fin is not its original source patch');if(['dorsal_front','pelvic_l','finlets_d'].includes(id)){await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,'r012-'+id+'-isolated.png')});}await page.locator('#otherFinIsolate').click();result.otherFinSelections.push({id,sourceTriangles:result.otherFinStudy.sourceTriangles[id],sourcePatchSurfaceArea:current.metrics.sourcePatchSurfaceArea,sourceVertex:current.sourceVertex});}
 await page.selectOption('#otherFinSelect','pelvic_l');await page.locator('#otherFinMin').click();let row=await page.evaluate(()=>({selected:window.FISHQA.otherFinSelectedSample,current:window.FISHQA.otherFinCurrent,expected:window.FISH_OTHER_FINS.data.samples[window.FISHQA.otherFinSelectedSample.index].patches.find(x=>x.id==='pelvic_l')}));assert(row.selected.kind==='min'&&Math.abs(row.current.metrics[row.selected.key]-row.expected.metrics[row.selected.key])<1e-6,'minimum source fin sample was not selected');await page.locator('#otherFinMax').click();row=await page.evaluate(()=>({selected:window.FISHQA.otherFinSelectedSample,current:window.FISHQA.otherFinCurrent,expected:window.FISH_OTHER_FINS.data.samples[window.FISHQA.otherFinSelectedSample.index].patches.find(x=>x.id==='pelvic_l')}));assert(row.selected.kind==='max'&&Math.abs(row.current.metrics[row.selected.key]-row.expected.metrics[row.selected.key])<1e-6,'maximum source fin sample was not selected');
 await page.locator('#otherFinTrail').click();await page.evaluate(()=>window.FISH.setTime(.75));assert(await page.evaluate(()=>Math.abs(window.FISHQA.otherFinCurrent.time-.75)<1e-6&&window.FISH_OTHER_FINS.state.trail),'fin probes did not follow the original Swim');await page.selectOption('#tailSelect','upper');assert(await page.evaluate(()=>!window.FISHQA.otherFinEnabled&&window.FISHQA.tailEnabled),'fin/tail overlays conflict');await page.locator('#tailClear').click();await page.selectOption('#otherFinSelect','pelvic_r');await page.locator('#otherFinClear').click();assert(await page.evaluate(()=>!window.FISHQA.otherFinEnabled&&window.FISH.meshes[1].every((m,i)=>m.material.opacity===window.FISH.meshes[0][i].material.opacity)),'fin restore changed the original material');result.otherFinAdditivePass=true;
'''
    source = replace_once(source, anchor, block + anchor, "regression insertion")
    mobile_anchor = "await page.locator('#toolsBtn').click();"
    mobile = "await page.selectOption('#otherFinSelect','pelvic_r');await page.locator('#otherFinMax').click();assert(await page.evaluate(()=>window.FISHQA.otherFinEnabled&&window.FISHQA.otherFinCurrent.id==='pelvic_r'),'mobile remaining fin controls failed');await page.locator('#otherFinClear').click();"
    source = replace_once(source, mobile_anchor, mobile_anchor + mobile, "mobile regression insertion")
    (HERE / "qa_regression.mjs").write_text(source, encoding="utf-8")
    openfix = (R011 / "qa_openfix.mjs").read_text(encoding="utf-8").replace("FISH_PECTORAL_R011", "FISH_REMAINING_FINS_R012")
    (HERE / "qa_openfix.mjs").write_text(openfix, encoding="utf-8")


def delivery_script():
    previous = (R011 / "delivery.py").read_text(encoding="utf-8")
    previous = previous.replace("VERSION='FISH_PECTORAL_R011'", "VERSION='FISH_REMAINING_FINS_R012'")
    previous = previous.replace("PREVIOUS='b8f772de881fa0342d2dd0c243e98617211a63ac'", "PREVIOUS='a40cb964bd484deedb8901721fc4813ea021bc91'")
    previous = previous.replace("['FISH_TAIL_R010',VERSION]", "['FISH_PECTORAL_R011',VERSION]")
    previous = previous.replace("b'FISH_TAIL_R010'", "b'FISH_PECTORAL_R011'")
    previous = previous.replace("archive=PUB/'r010'", "archive=PUB/'r011'")
    previous = previous.replace("Await exact public R011 verification", "Await exact public R012 verification")
    previous = previous.replace("Fish R011 source-pectoral study; preserve R010 and other Mothers", "Fish R012 remaining original fin study; preserve R011 and other Mothers")
    previous = previous.replace("Fish R011 exact-public paired-fin and inherited regression receipt", "Fish R012 exact-public remaining-fin and inherited regression receipt")
    previous = previous.replace("?v=r011", "?v=r012")
    previous = previous.replace("'pectoralAudit']", "'pectoralAudit','otherFinAudit']")
    previous = previous.replace("q['pectoralAdditivePass'] and q['errors']", "q['pectoralAdditivePass'] and q['otherFinAdditivePass'] and q['errors']")
    previous = previous.replace("R011_PUBLIC_VERIFIED", "R012_PUBLIC_VERIFIED")
    for old, new in [("r011-pectoral-both", "r012-dorsal_front-isolated"), ("r011-pectoral_l-isolated", "r012-pelvic_l-isolated"), ("r011-pectoral_r-isolated", "r012-finlets_d-isolated"), ("r011-pectoral-trails", "r012-finlets_v-isolated"), ("PECTORAL_INSPECTION.json", "REMAINING_FIN_INSPECTION.json")]:
        previous = previous.replace(old, new)
    previous = previous.replace("'pectoralStudy','pectoralAudit','pectoralSelections','pectoralAdditivePass'", "'pectoralStudy','pectoralAudit','pectoralSelections','pectoralAdditivePass','otherFinStudy','otherFinAudit','otherFinSelections','otherFinAdditivePass'")
    (HERE / "delivery.py").write_text(previous, encoding="utf-8")


def boot_file():
    source = (R011 / "boot.html").read_text(encoding="utf-8")
    source = source.replace("FISH_PECTORAL_R011", "FISH_REMAINING_FINS_R012").replace("R011", "R012").replace("r011", "r012")
    (HERE / "boot.html").write_text(source, encoding="utf-8")


def main():
    subprocess.run([sys.executable, str(R011 / "prepare_r011.py")], check=True)
    prepare_main()
    build_script()
    prepare_regression()
    delivery_script()
    boot_file()
    print("R012_PREPARED: R011 runtime retained; seven remaining source fin patches added")


if __name__ == "__main__":
    main()

