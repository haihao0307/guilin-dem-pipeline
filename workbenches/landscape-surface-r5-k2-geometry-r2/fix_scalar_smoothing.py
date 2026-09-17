from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2"
HTML = DIR / "index.html"
BUILD = DIR / "build.json"
s = HTML.read_text(encoding="utf-8")
old = "function smoothDisplacement(src){let av=neighborAverages(src),out=new Float32Array(src);for(let i=0;i<count;i++){if(gate[i]<1e-7||!av.w[i]){out[i]=0;continue}let avg=av.sx[i]/av.w[i],v=src[i]*(1-smoothing)+avg*smoothing,down=smooth(.04,.72,-N0[i*3+1]);if(v>0)v*=1-.91*spikeGuard*down;out[i]=clamp(v,-capAt(i),capAt(i))}return out}"
new = "function neighborScalar(V){let sum=new Float64Array(count),w=new Uint16Array(count);function add(a,b){sum[a]+=V[b];w[a]++}for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2];add(a,b);add(a,c);add(b,a);add(b,c);add(c,a);add(c,b)}return{sum,w}}\nfunction smoothDisplacement(src){let av=neighborScalar(src),out=new Float32Array(src);for(let i=0;i<count;i++){if(gate[i]<1e-7||!av.w[i]){out[i]=0;continue}let avg=av.sum[i]/av.w[i],v=src[i]*(1-smoothing)+avg*smoothing,down=smooth(.04,.72,-N0[i*3+1]);if(v>0)v*=1-.91*spikeGuard*down;out[i]=clamp(v,-capAt(i),capAt(i))}return out}"
assert old in s, "scalar smoothing integration point missing"
raw = s.replace(old, new, 1).encode("utf-8")
HTML.write_bytes(raw)
b = json.loads(BUILD.read_text(encoding="utf-8"))
b["candidateSha256"] = hashlib.sha256(raw).hexdigest()
b["candidateBytes"] = len(raw)
BUILD.write_text(json.dumps(b, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"scalarSmoothingFixed": True, "candidateSha256": b["candidateSha256"], "candidateBytes": b["candidateBytes"]}))
