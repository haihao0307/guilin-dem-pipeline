from pathlib import Path
import urllib.request, hashlib, json, time
ROOT=Path(__file__).resolve().parents[1]
dest=ROOT/'evidence/land-polygons-split-4326.zip'
url='https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip'
head=urllib.request.urlopen(urllib.request.Request(url,method='HEAD'),timeout=30)
length=int(head.headers['Content-Length']); etag=head.headers.get('ETag');modified=head.headers.get('Last-Modified')
start=time.perf_counter();offset=dest.stat().st_size if dest.exists() else 0
while offset<length:
    headers={'User-Agent':'WenzhouTerrainResearch/3.1 (regional coastline extraction)'}
    if offset:headers.update({'Range':f'bytes={offset}-','If-Range':etag})
    try:
      with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=40) as r:
        if offset and r.status!=206:raise RuntimeError('Cannot safely resume changed archive')
        if r.headers.get('ETag')!=etag:raise RuntimeError('Source changed during transfer')
        with dest.open('ab' if offset else 'wb') as f:
          last=offset
          while chunk:=r.read(1024*1024):
            f.write(chunk);offset+=len(chunk)
            if offset-last>=100*1024*1024:
              print(f'{offset}/{length} bytes',flush=True);last=offset
    except (TimeoutError,ConnectionError,OSError) as error:
      offset=dest.stat().st_size if dest.exists() else 0
      print('Transfer interrupted; verified-source resume at',offset,type(error).__name__,flush=True)
      if time.perf_counter()-start>900:raise
assert dest.stat().st_size==length
with dest.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
record={'url':url,'sourcePage':'https://osmdata.openstreetmap.de/data/land-polygons.html','bytes':length,'sha256':sha,'etag':etag,'lastModified':modified,'retrievedAtUtc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'license':'ODbL 1.0','attribution':'OpenStreetMap contributors; coastline polygon processing by FOSSGIS','use':'Global ingestion source only; publish only regional geometry, not this archive'}
(ROOT/'evidence/LAND_SOURCE_LOCK.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(record),flush=True)
