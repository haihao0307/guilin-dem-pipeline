"""CI-only fixture fetcher. Reads frozen existing assets; no TIFF or remote write."""
from pathlib import Path
import hashlib,json,shutil,urllib.request
ROOT=Path(__file__).resolve().parent
BASE='d0c6b02979829bb5876026967910eda012e4951f'
RELEASE='https://github.com/haihao0307/guilin-dem-pipeline/releases/download/guilin-canonical-elevation-store-12p5m-v1/'
MANIFEST_SHA='1c20ea78351a7827a033c7a4eef6176f5939efdc16abf436ba95863e34c34e78'

def fetch(url,p,expected=None,expected_size=None):
 p.parent.mkdir(parents=True,exist_ok=True)
 def identity():
  digest=hashlib.sha256()
  with p.open('rb') as f:
   while b:=f.read(4<<20):digest.update(b)
  return digest.hexdigest()
 if not p.exists():
  request=urllib.request.Request(url,headers={'User-Agent':'GuilinStorageOnlyQA/1.0'})
  with urllib.request.urlopen(request,timeout=180) as response,p.open('xb') as out:
   total=0
   while b:=response.read(1<<20):
    total+=len(b)
    assert total <= (expected_size or 2*1024*1024),'Unexpected payload size'
    out.write(b)
 assert expected_size is None or p.stat().st_size==expected_size
 digest=identity();assert expected is None or digest==expected,(p,digest,expected)
 return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':digest}

def main():
 (ROOT/'reports').mkdir(exist_ok=True)
 records=[]
 records.append(fetch(RELEASE+'CANONICAL_ELEVATION_MANIFEST.json',ROOT/'CANONICAL_ELEVATION_MANIFEST.json',MANIFEST_SHA,999668))
 m=json.loads((ROOT/'CANONICAL_ELEVATION_MANIFEST.json').read_text())
 store=ROOT/'payload/guilin-elevation-store-v1';store.mkdir(parents=True,exist_ok=True)
 for s in m['physical_shards']['shards']:
  records.append(fetch(RELEASE+s['file'].split('/')[-1],store/s['file'],s['sha256'],s['bytes']))
 shutil.copy2(ROOT/'CANONICAL_ELEVATION_MANIFEST.json',store/'CANONICAL_ELEVATION_MANIFEST.json')
 for c in m['chunks']:
  with (store/c['shard']).open('rb') as f:f.seek(c['shard_byte_offset']);b=f.read(c['bytes'])
  assert len(b)==c['bytes'] and hashlib.sha256(b).hexdigest()==c['sha256']
 baseline=ROOT/'baseline/guilin';candidate=ROOT/'candidate/guilin'
 assets=[]
 for file,key in [('overview-direct-samples-manifest.json','asset'),('osm-waterways-manifest.json','segments'),('osm-waterways-manifest.json','nodes')]:
  item=json.loads((baseline/'data'/file).read_text())[key];assets.append(('data/'+item['file'],item['sha256'],item['bytes']))
 assets.append(('styles.css','5011c78091716d6ea7fbeec55d7276c307c5cbf0eac03b8a8d40487c775626e1',5626))
 for rel,sha,size in assets:
  records.append(fetch(f'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/{BASE}/guilin/{rel}',baseline/rel,sha,size))
 for p in baseline.rglob('*'):
  if p.is_file() and p.name not in {'app.js','index.html'}:
   q=candidate/p.relative_to(baseline);q.parent.mkdir(parents=True,exist_ok=True)
   if not q.exists():shutil.copy2(p,q)
   assert q.read_bytes()==p.read_bytes(),'Protected asset changed'
 original=(baseline/'app.js').read_text()
 expected=original.replace("  const NATIVE_TILE_RUNTIME_BASE_URL = '../guilin-truth-data/native/';", "  const canonicalTileSource = globalThis.createGuilinCanonicalTileSource({baseUrl: '../guilin-elevation-store-v1/'});")
 expected=expected.replace('      const buffer = await fetchBinary(`${NATIVE_TILE_RUNTIME_BASE_URL}${tile.file}`);','      const buffer = await canonicalTileSource.loadTile(tile);')
 assert (candidate/'app.js').read_text()==expected,'App changed beyond two loader lines'
 versions=json.loads((ROOT/'candidate/ASSET_VERSIONS.json').read_text())
 assert versions['canonical_manifest_sha256']==MANIFEST_SHA
 assert hashlib.sha256((candidate/versions['adapter_file']).read_bytes()).hexdigest()==versions['adapter_sha256']
 assert hashlib.sha256((candidate/'app.js').read_bytes()).hexdigest()==versions['app_sha256']
 assert versions['adapter_file']==f"canonical-tile-source.{versions['adapter_sha256'][:12]}.js"
 assert versions['app_query']=='storage='+versions['app_sha256'][:12]
 old_index=(baseline/'index.html').read_text()
 scripts=f"  <script src=\"{versions['adapter_file']}\" defer></script>\n  <script src=\"app.js?{versions['app_query']}\" defer></script>"
 expected=old_index.replace('  <script src="app.js" defer></script>',scripts)
 assert (candidate/'index.html').read_text()==expected,'Index changed beyond versioned adapter/app scripts'
 result={'passed':True,'baseline_commit':BASE,'canonical_7_shard_and_840_chunk_sha_verified':True,'protected_runtime_assets_byte_identical':True,
         'candidate_app_diff_exactly_two_loader_lines':True,'no_tiff_downloaded':True,'records':records}
 (ROOT/'reports/CI_FIXTURE_VERIFY.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items() if k!='records'},indent=2))

if __name__=='__main__':main()
