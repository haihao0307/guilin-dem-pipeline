"""Download pinned official QA dependencies, no user inputs."""
import hashlib,json,sys,urllib.request
from pathlib import Path
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
for name,entry in json.loads(Path(__file__).with_name('public-assets.json').read_text()).items():
    data=urllib.request.urlopen(entry['url'],timeout=90).read()
    assert len(data)==entry['bytes'],name
    assert hashlib.sha256(data).hexdigest()==entry['sha256'],name
    (root/name).write_bytes(data)
    print(name,len(data),'SHA-256 verified')
