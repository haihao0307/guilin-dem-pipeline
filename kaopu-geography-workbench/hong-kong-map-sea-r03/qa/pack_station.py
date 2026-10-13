from pathlib import Path
import gzip,base64,json,numpy as np
R=Path(__file__).resolve().parents[1];P=R/'station-integration';B=P/'baked'
m=json.loads((P/'MESH_MANIFEST.json').read_text());receipt=json.loads((B/'receipt.json').read_text())
assert receipt.get('status')=='passed',receipt
v=m['vertexCount'];flags=np.fromfile(B/'failure-flags.u16',dtype='<u2');assert len(flags)==v and not flags.any()
files={'positions':P/'mesh-positions.f32','normals':P/'mesh-normals.f32','indices':P/'mesh-indices.u32','colors':B/'colors.f32','roughness':B/'roughness.f32','geometryDistance':B/'geometry-distance.f32'}
out={k:base64.b64encode(gzip.compress(p.read_bytes(),mtime=0)).decode() for k,p in files.items()}
out['metadata']={'sourceCommit':m['sourceCommit'],'vertexCount':v,'triangleCount':m['triangleCount'],'componentCount':len(m['groups']),'deferred':m['deferred'],'constructionSamplingMaxResidualM':m['maxConstructionFieldResidualM'],'materialSampling':'Original frozen B function queried at actual component sample positions; finite footprint parameter, not a mathematically exact area average','displacement':'One-step normal correction from original level-set; approximate for non-unit fields','sourceMotherMutated':False,'samplerReceipt':receipt}
(P/'baked-map-station.json').write_text(json.dumps(out,separators=(',',':')))
print('packed station',v,m['triangleCount'])
