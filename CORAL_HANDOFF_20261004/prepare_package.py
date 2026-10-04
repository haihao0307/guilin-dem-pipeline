from pathlib import Path
import base64,gzip,hashlib,json
p=Path(__file__).resolve().parent
# Validate the log before any large archive work.
a=[(p/'knowledge'/('master-%02d.b64'%i)).read_text().strip() for i in range(3)]
t=a[2]
if 'VVC30vUK55czb' in t:
 x=t.index('VVC30vUK55czb');y=t.index('VVC30vUK18Y',x);t=t[:x]+t[y:]
if 'SPwsTq3' in t:
 x=t.index('SPwsTq3');y=t.index('SPwsq6',x);t=t[:x]+t[y:]
a[2]=t
b=gzip.decompress(base64.b64decode(''.join(a),validate=True))
assert len(b)==37088 and hashlib.sha256(b).hexdigest()=='b466be4fe17c23463cd8d085ea44c927ed8b11e36770d4a9d4fb2734f91a6f84'
print('MASTER_LOG_EXACT',len(b),hashlib.sha256(b).hexdigest(),flush=True)
s=(p/'package.py').read_text()
s=s.replace("git('ls-tree','-r','-l','-z',ref)","git('ls-tree','-r','-z',ref)")
s=s.replace("mode,kind,blob,size=meta.decode().split()","mode,kind,blob=meta.decode().split();size='0'")
s=s.replace("allrows=tree(SOURCE)","""req=Request('https://api.github.com/repos/'+REPO+'/git/trees/'+SOURCE+'?recursive=1',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'User-Agent':'Coral-Handoff'})
with urlopen(req,timeout=60) as rr: rawtree=json.load(rr)
assert not rawtree.get('truncated'),'Tree metadata truncated; do not silently omit entries'
allrows=[{'path':r['path'],'mode':r['mode'],'type':r['type'],'blob':r['sha'],'bytes':r.get('size',0)} for r in rawtree['tree'] if r['type']=='blob']""")
s=s.replace("export(SOURCE,paths,OUT/'snapshot/site',SOURCE)","""# Checkout batches missing selected blobs instead of lazily fetching the whole repository.
directory_roots=[root for root in roots if any(r['path'].startswith(root+'/') for r in allrows)]
git('sparse-checkout','add',*directory_roots)
export(SOURCE,paths,OUT/'snapshot/site',SOURCE)""")
s=s.replace("stdout=subprocess.PIPE,stderr=subprocess.PIPE)","stdout=subprocess.PIPE,stderr=None)")
s=s.replace("err=proc.stderr.read().decode(errors='replace');rc=proc.wait()","err='';rc=proc.wait()")
s=s.replace("for name in ['README.md','HANDOFF_STATE.json']:","for name in ['README.md','HANDOFF_STATE.json','ORIGINAL_MATERIALS.json']:")
(p/'package-execute.py').write_text(s)
print('Selected-source archive prepared; no application file changed.',flush=True)
