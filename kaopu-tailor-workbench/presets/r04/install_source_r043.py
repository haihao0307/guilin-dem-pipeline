"""One-time checksum-locked source transport; never execute incomplete payloads."""
from pathlib import Path
import base64,gzip,hashlib,json
P=Path(__file__).resolve().parent
expected=['ea21a492031640378cdf980baaa9ede55e177d437ccccee7a58f09b177c77801','c20fcf5001ce701253d24909dd7ac6fcc11fd25b9eb4520bd84e498843eb997a','1a902e9c83a4a0ab48f64416abdbc9375826ef97366653fcb9a64d2e76d2a54e','c126f341956ddfa9039ae73011ffe0b94bcd46915eda0c03fcfbd2fd4b3e1e5b','ebe15f98a54cd28a8f720f667a6dda41e253f821d94b98dcdc54f2c50298338e','1c962acc3a1594dc9784aa4833de8ea114a64e8203e45436926af0247b2292ea','2c9653a3958666ed81d39d3e7180ae1771a406e8ae2adb2da2ffd5f1f254fbde','3546cf763a8d73696f67c26f45dc9dcb870ec0353a5a2649d362e56ecf4130f1','7747b26f12e9d77dc9932929e0fc7efd0aa5824d10de106013d4049e3aa2cc75','0492afb87c4a1a7737c981a2d0f3acf71460037ed1abc5bb6386abfc191b839b','410fb09fa1f77717e22e1d63a683bbd7b4cf3a3ada0f1748aeafc48ba079674c','bbede35be7e93a1b70c035ebb9120fff82f1bd2a6b785bb6bbdf0f06159d935a','f203929970c87cd786d579284a438f96d60c8334124a6698b0e55cc31860a9eb','8d9140b34e4671a4adfc1cb3b3002233a02d7037ad650224d698a63e1517c40c','578cd8ebbc3f1bd1c2ca150bbe82603ac645f1e577b0a72282207baa61453f13','21331c3ee0fd7a93e295b1b0695b20fc2ab9caf689342e22cc29c51dbadf3a89','f2e5850afb1f2137ce64fc7deac57a6e6e75b4eea30b5b89064a1638640f1ea0','927384e195df5c8aeddf9560df04e5ba3b34eec4bb5a85f70e66043529003fc2']
chunks=[]
for i,sha in enumerate(expected):
 raw=(P/'r043-payload'/f'{i:02}.txt').read_text().strip().encode()
 assert hashlib.sha256(raw).hexdigest()==sha,('Source transfer mismatch',i,len(raw),hashlib.sha256(raw).hexdigest())
 chunks.append(raw)
raw=base64.b64decode(b''.join(chunks),validate=True)
assert hashlib.sha256(raw).hexdigest()=='acb3541b6348ccb84e14efdfc8cdc53ac5e76385e8731a759918975626a35c13'
files=json.loads(gzip.decompress(raw))
allowed={'source-repair-r043.mjs','outfits-r043.mjs','parameters-r043.mjs','card-state-r043.mjs','app.mjs','index.html','style.css','build_r043.py','correctives/r043/extensions.cpp','correctives/r043/fit-support.mjs','correctives/r043/tick.inc.mjs','correctives/r043/variant.inc.mjs','correctives/r043/build_kernel.py','audit_parameters_r043.py','audit_conditional_r043.py','node_solve_r043.mjs','prepare_node_r043.py','batch_r043.py','collect_results_r043.py','qa_r043.py','test_source_r043.mjs','NOTES_R043_ZH.md'}
assert set(files)==allowed
for name,text in files.items():
 path=P/name;assert path.resolve().is_relative_to(P)
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
(P/'r043-source-0.b64').unlink(missing_ok=True)
(P/'SOURCE_TRANSPORT_R043.json').write_text(json.dumps({'verified':True,'payloadSHA256':hashlib.sha256(raw).hexdigest(),'files':{n:hashlib.sha256((P/n).read_bytes()).hexdigest() for n in files}},indent=2))
print('SOURCE_SHA256_VERIFIED',len(files),flush=True)
