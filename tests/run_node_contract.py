"""Run frontend numeric contract tests. Does not perform browser rasterization."""
from __future__ import annotations
import argparse,hashlib,json,socket,subprocess,sys,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'pipeline'))
from canonical_elevation_store import CanonicalElevationStore

def main()->int:
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--site',type=Path,required=True)
    p.add_argument('--payload',type=Path,required=True);p.add_argument('--evidence',type=Path,required=True)
    a=p.parse_args();a.evidence.mkdir(parents=True,exist_ok=True)
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    with (a.evidence/'http.log').open('wb') as log:
        server=subprocess.Popen([sys.executable,str(ROOT/'tests/range_static_server.py'),'--root',str(a.site),'--port',str(port)],stdout=log,stderr=subprocess.STDOUT)
        try:
            url=f'http://127.0.0.1:{port}/guilin/'
            for _ in range(100):
                try:
                    with urllib.request.urlopen(url,timeout=2):break
                except Exception:time.sleep(.1)
            else:raise RuntimeError('Test server unavailable')
            dest=a.evidence/'FRONTEND_NUMERIC_CONTRACT.json'
            subprocess.run(['node',str(ROOT/'tests/node_runtime_contract.cjs'),str(ROOT/'viewer/app.js'),url,str(dest)],check=True,timeout=120)
            result=json.loads(dest.read_text(encoding='utf-8'))
            with CanonicalElevationStore(a.payload/'canonical/CANONICAL_ELEVATION_MANIFEST.json') as store:
                for item in result['patches']:
                    w=item['window'];v=store.read_aoi_window(w['startColumn'],w['startRow'],w['width'],w['height'])
                    expected=hashlib.sha256(v.astype('<i2').tobytes()).hexdigest()
                    if expected!=item['sha256']:raise RuntimeError('Independent reader mismatch: '+item['anchor'])
                    item['independent_python_reader_sha256']=expected;item['independent_reader_match']=True
            result['independent_python_reader_passed']=True
            result['compared_sample_count']=sum(x['samples'] for x in result['patches'])
            dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            print(json.dumps({'passed':True,'compared_samples':result['compared_sample_count'],'real_browser':False}))
        finally:
            server.terminate()
            try:server.wait(timeout=5)
            except subprocess.TimeoutExpired:server.kill()
    return 0
if __name__=='__main__':raise SystemExit(main())
