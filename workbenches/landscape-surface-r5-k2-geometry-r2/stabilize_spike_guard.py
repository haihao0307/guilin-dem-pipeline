from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2"
HTML = DIR / "index.html"
BUILD = DIR / "build.json"
s = HTML.read_text(encoding="utf-8")

old = "let antiSpikeAdjustedVertices=0,maxAntiSpikeCorrectionM=0,antiSpikePasses=0;\nfor(let pass=0;pass<3;pass++){let av=neighborAverages(P0),Q=new Float32Array(P0),moved=0;for(let i=0;i<count;i++){if(gate[i]<.08||!av.w[i])continue;let k=i*3,ax=av.sx[i]/av.w[i],ay=av.sy[i]/av.w[i],az=av.sz[i]/av.w[i],depth=ay-P0[k+1],down=smooth(.04,.72,-N0[k+1]),tip=smooth(.10,.92,depth),f=spikeGuard*down*tip*(.50-pass*.07);if(f<=1e-5)continue;let nx=P0[k]+(ax-P0[k])*f*.20,ny=P0[k+1]+depth*f,nz=P0[k+2]+(az-P0[k+2])*f*.20,dr=Math.hypot(nx-P0[k],ny-P0[k+1],nz-P0[k+2]);Q[k]=nx;Q[k+1]=ny;Q[k+2]=nz;moved++;maxAntiSpikeCorrectionM=Math.max(maxAntiSpikeCorrectionM,dr)}if(!moved)break;if(flipCount(Q,P0)>0)break;P0=Q;N0=W.normals(P0,I);antiSpikeAdjustedVertices+=moved;antiSpikePasses++}"
new = "let antiSpikeAdjustedVertices=0,maxAntiSpikeCorrectionM=0,antiSpikePasses=0,antiSpikeRejectedTrials=0,antiSpikeSkippedUnsafeVertices=0;\nconst spikeScale=new Float32Array(count);spikeScale.fill(Infinity);function spikeMin(i,v){if(Number.isFinite(v)&&v>1e-8&&v<spikeScale[i])spikeScale[i]=v}for(let q=0;q<I.length;q+=3){let a=I[q],b=I[q+1],c=I[q+2],A=a*3,B=b*3,C=c*3,ab=Math.hypot(P0[A]-P0[B],P0[A+1]-P0[B+1],P0[A+2]-P0[B+2]),bc=Math.hypot(P0[B]-P0[C],P0[B+1]-P0[C+1],P0[B+2]-P0[C+2]),ca=Math.hypot(P0[C]-P0[A],P0[C+1]-P0[A+1],P0[C+2]-P0[A+2]),ux=P0[B]-P0[A],uy=P0[B+1]-P0[A+1],uz=P0[B+2]-P0[A+2],vx=P0[C]-P0[A],vy=P0[C+1]-P0[A+1],vz=P0[C+2]-P0[A+2],area2=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx);spikeMin(a,Math.min(ab,ca,area2/Math.max(bc,1e-9)));spikeMin(b,Math.min(ab,bc,area2/Math.max(ca,1e-9)));spikeMin(c,Math.min(bc,ca,area2/Math.max(ab,1e-9)))}for(let i=0;i<count;i++)if(!Number.isFinite(spikeScale[i]))spikeScale[i]=0;\nfor(let pass=0;pass<3;pass++){let av=neighborAverages(P0),accepted=null,acceptedMoved=0,acceptedMax=0;for(let gain of [.75,.48,.30,.18]){let Q=new Float32Array(P0),moved=0,trialMax=0;for(let i=0;i<count;i++){if(gate[i]<.08||!av.w[i])continue;if(spikeScale[i]<.035){if(pass===0&&gain===.75)antiSpikeSkippedUnsafeVertices++;continue}let k=i*3,ax=av.sx[i]/av.w[i],ay=av.sy[i]/av.w[i],az=av.sz[i]/av.w[i],depth=ay-P0[k+1],down=smooth(.015,.58,-N0[k+1]),tip=smooth(.025,.38,depth);if(depth<=0||down<=0||tip<=0)continue;let cap=spikeScale[i]*(.018+.004*pass),dy=Math.min(depth*spikeGuard*down*tip*gain,cap);if(dy<.00015)continue;let ratio=dy/Math.max(depth,1e-6),nx=P0[k]+(ax-P0[k])*ratio*.08,ny=P0[k+1]+dy,nz=P0[k+2]+(az-P0[k+2])*ratio*.08,dr=Math.hypot(nx-P0[k],ny-P0[k+1],nz-P0[k+2]);Q[k]=nx;Q[k+1]=ny;Q[k+2]=nz;moved++;trialMax=Math.max(trialMax,dr)}if(!moved)continue;if(flipCount(Q,P0)===0){accepted=Q;acceptedMoved=moved;acceptedMax=trialMax;break}antiSpikeRejectedTrials++}if(!accepted)break;P0=accepted;N0=W.normals(P0,I);antiSpikeAdjustedVertices+=acceptedMoved;maxAntiSpikeCorrectionM=Math.max(maxAntiSpikeCorrectionM,acceptedMax);antiSpikePasses++}"
assert old in s, "anti-spike block missing"
s = s.replace(old, new, 1)
old_report = "antiSpikeAdjustedVertices,maxAntiSpikeCorrectionM,antiSpikePasses,baseTriangleFlipCount"
new_report = "antiSpikeAdjustedVertices,maxAntiSpikeCorrectionM,antiSpikePasses,antiSpikeRejectedTrials,antiSpikeSkippedUnsafeVertices,baseTriangleFlipCount"
assert old_report in s
s = s.replace(old_report, new_report, 1)
raw = s.encode("utf-8")
HTML.write_bytes(raw)
b = json.loads(BUILD.read_text(encoding="utf-8"))
b["candidateSha256"] = hashlib.sha256(raw).hexdigest()
b["candidateBytes"] = len(raw)
b["geometry"]["antiSpikeStabilization"] = "precompute per-vertex edge/altitude safety scale; skip unsafe micro-triangles; bounded upward tip correction capped to 1.8-2.6% local scale; accept only zero-flip trial"
BUILD.write_text(json.dumps(b, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"spikeGuardStabilized": True, "candidateSha256": b["candidateSha256"], "candidateBytes": b["candidateBytes"]}, ensure_ascii=False))
