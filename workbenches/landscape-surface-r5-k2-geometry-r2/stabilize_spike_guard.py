from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2"
HTML = DIR / "index.html"
BUILD = DIR / "build.json"
s = HTML.read_text(encoding="utf-8")

old = "let antiSpikeAdjustedVertices=0,maxAntiSpikeCorrectionM=0,antiSpikePasses=0;\nfor(let pass=0;pass<3;pass++){let av=neighborAverages(P0),Q=new Float32Array(P0),moved=0;for(let i=0;i<count;i++){if(gate[i]<.08||!av.w[i])continue;let k=i*3,ax=av.sx[i]/av.w[i],ay=av.sy[i]/av.w[i],az=av.sz[i]/av.w[i],depth=ay-P0[k+1],down=smooth(.04,.72,-N0[k+1]),tip=smooth(.10,.92,depth),f=spikeGuard*down*tip*(.50-pass*.07);if(f<=1e-5)continue;let nx=P0[k]+(ax-P0[k])*f*.20,ny=P0[k+1]+depth*f,nz=P0[k+2]+(az-P0[k+2])*f*.20,dr=Math.hypot(nx-P0[k],ny-P0[k+1],nz-P0[k+2]);Q[k]=nx;Q[k+1]=ny;Q[k+2]=nz;moved++;maxAntiSpikeCorrectionM=Math.max(maxAntiSpikeCorrectionM,dr)}if(!moved)break;if(flipCount(Q,P0)>0)break;P0=Q;N0=W.normals(P0,I);antiSpikeAdjustedVertices+=moved;antiSpikePasses++}"
new = "let antiSpikeAdjustedVertices=0,maxAntiSpikeCorrectionM=0,antiSpikePasses=0,antiSpikeRejectedTrials=0;\nfor(let pass=0;pass<3;pass++){let av=neighborAverages(P0),accepted=null,acceptedMoved=0,acceptedMax=0;for(let gain of [.20,.12,.07,.035]){let Q=new Float32Array(P0),moved=0,trialMax=0;for(let i=0;i<count;i++){if(gate[i]<.08||!av.w[i])continue;let k=i*3,ax=av.sx[i]/av.w[i],ay=av.sy[i]/av.w[i],az=av.sz[i]/av.w[i],depth=ay-P0[k+1],down=smooth(.02,.62,-N0[k+1]),tip=smooth(.035,.48,depth),f=spikeGuard*down*tip*gain;if(f<=1e-6)continue;let nx=P0[k]+(ax-P0[k])*f*.12,ny=P0[k+1]+depth*f,nz=P0[k+2]+(az-P0[k+2])*f*.12,dr=Math.hypot(nx-P0[k],ny-P0[k+1],nz-P0[k+2]);Q[k]=nx;Q[k+1]=ny;Q[k+2]=nz;moved++;trialMax=Math.max(trialMax,dr)}if(!moved)continue;if(flipCount(Q,P0)===0){accepted=Q;acceptedMoved=moved;acceptedMax=trialMax;break}antiSpikeRejectedTrials++}if(!accepted)break;P0=accepted;N0=W.normals(P0,I);antiSpikeAdjustedVertices+=acceptedMoved;maxAntiSpikeCorrectionM=Math.max(maxAntiSpikeCorrectionM,acceptedMax);antiSpikePasses++}"
assert old in s, "anti-spike block missing"
s = s.replace(old, new, 1)
old_report = "antiSpikeAdjustedVertices,maxAntiSpikeCorrectionM,antiSpikePasses,baseTriangleFlipCount"
new_report = "antiSpikeAdjustedVertices,maxAntiSpikeCorrectionM,antiSpikePasses,antiSpikeRejectedTrials,baseTriangleFlipCount"
assert old_report in s
s = s.replace(old_report, new_report, 1)
raw = s.encode("utf-8")
HTML.write_bytes(raw)
b = json.loads(BUILD.read_text(encoding="utf-8"))
b["candidateSha256"] = hashlib.sha256(raw).hexdigest()
b["candidateBytes"] = len(raw)
b["geometry"]["antiSpikeStabilization"] = "adaptive one-ring downward-tip correction gains 0.20/0.12/0.07/0.035; accept only zero-flip trial"
BUILD.write_text(json.dumps(b, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"spikeGuardStabilized": True, "candidateSha256": b["candidateSha256"], "candidateBytes": b["candidateBytes"]}, ensure_ascii=False))
