#!/usr/bin/env python3
import html, json, pathlib, re, sys

dom=pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
cpu=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
m=re.search(r'<pre id="result">(.*?)</pre>',dom,re.DOTALL)
if not m:
    e=re.search(r'<pre id="error">(.*?)</pre>',dom,re.DOTALL)
    raise SystemExit(html.unescape(e.group(1)) if e else "result node missing")
r=json.loads(html.unescape(m.group(1)))
g=r["webgl2"]
expected={k:[v[k] for v in cpu["vectors"]] for k in ("f32ClosedBits","top24Bits","mantissa23Bits")}
checks={
    "webgl2-available":g["available"],
    "closed-exact-cpu-match":g["f32ClosedBits"]==expected["f32ClosedBits"],
    "top24-exact-cpu-match":g["top24Bits"]==expected["top24Bits"],
    "mantissa23-exact-cpu-match":g["mantissa23Bits"]==expected["mantissa23Bits"],
    "closed-upper-endpoint-reproduced":g["f32ClosedBits"][-1]=="0x3f800000",
    "half-open-candidates-stay-below-one":g["top24Bits"][-1]=="0x3f7fffff" and g["mantissa23Bits"][-1]=="0x3f7ffffe",
}
r["expected"]=expected
r["checks"]=[{"id":k,"pass":bool(v)} for k,v in checks.items()]
r["summary"]={"checks":len(checks),"passed":sum(map(bool,checks.values())),"failed":sum(not v for v in checks.values()),"status":"pass" if all(checks.values()) else "fail"}
pathlib.Path(sys.argv[3]).write_text(json.dumps(r,indent=2)+"\n",encoding="utf-8")
if not all(checks.values()):
    print(json.dumps(r,indent=2))
    raise SystemExit(json.dumps(r["summary"]))
