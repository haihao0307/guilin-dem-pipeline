"""A regenerated adapter may not silently pretend to be the fixed tested bytes."""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parent.parent
expected={'map-indices.u32':'ea3e4cf8c0b23712b1ff01980504bc151342caab40e584372cfae5407abdcefd','map-bary.f32':'83a7075c4690cfe8591ef81ca539b0c187812645ac813dc2ee9598ce1f3abdcf'}
rows={n:{'expected':s,'actual':hashlib.sha256((R/'body-adapter'/n).read_bytes()).hexdigest()}for n,s in expected.items()}
passed=all(r['expected']==r['actual']for r in rows.values());(R/'research/body-map-rebuild.json').write_text(json.dumps({'byteExact':passed,'files':rows},indent=2));print(rows);assert passed,'Body map regeneration differs; inspect actual arrays, never relax the fingerprint'
