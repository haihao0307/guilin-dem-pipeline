"""Build a probe around the hash-verified, unchanged original F13 payload."""
from pathlib import Path
import argparse
import hashlib
import json

parser = argparse.ArgumentParser()
parser.add_argument("original_loader", type=Path)
parser.add_argument("--out", type=Path, default=Path(__file__).with_name("public.html"))
args = parser.parse_args()
original = args.original_loader.read_bytes()
expected = "d27160db8057f6d6a22bc0565ef4c03da995cfc54bd5cb1f8b2ecb2f458daaaf"
if hashlib.sha256(original).hexdigest() != expected:
    raise ValueError("The original F13 loader does not match the pinned source")
source = original.decode("utf-8")
inspector = Path(__file__).with_name("inspector.js").read_text()
step_anchor = 'step:async(s=1/60)=>{if(!j0.ready||j0.busy)throw Error("Integration not ready");return M1&&j0.physics?M1.update(s):I1.playing&&I1.advance(s*j0.speed),I1.updateAttachments(),bs(),s4(),j0.frames++,ic()}'
step_copy = step_anchor.replace("step:", "_stepNoReport:", 1).replace(",ic()}", "}")
anchor = "const source=new TextDecoder().decode(bytes);document.open();document.write(source);document.close();"
if source.count(anchor) != 1:
    raise ValueError("F13 loader anchor drift; inspect the original source before rebuilding")
replacement = "let source=new TextDecoder().decode(bytes);const anchor='window.hairF13={report:ic,';if(source.split(anchor).length!==2)throw Error('F13 probe anchor drift');source=source.replace(anchor,'window.hairF13={_raw:()=>({viewer:f2,model:ys,fibers:u8,motion:I1,dynamics:M1}),report:ic,');"
replacement += "const stepAnchor=" + json.dumps(step_anchor) + ";if(source.split(stepAnchor).length!==2)throw Error('F13 step anchor drift');source=source.replace(stepAnchor," + json.dumps(step_copy + ",") + "+stepAnchor);"
replacement += "source=source.replace('</body>',()=>'<scr'+'ipt>'+"
replacement += json.dumps(inspector, ensure_ascii=True) + "+'</scr'+'ipt></body>');document.open();document.write(source);document.close();"
replacement = replacement.replace("</script", "<\\/script")
source = source.replace(anchor, replacement).replace("<title>参考发型 · 发丝与动作 / F13</title>", "<title>人物整合性能初筛 R01 · 身体与头发</title>")
args.out.write_text(source)
print(json.dumps({"loaderSHA256": hashlib.sha256(original).hexdigest(), "probeSHA256": hashlib.sha256(source.encode()).hexdigest(), "bytes": len(source.encode())}))
