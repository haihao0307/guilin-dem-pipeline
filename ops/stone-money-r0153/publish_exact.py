#!/usr/bin/env python3
from pathlib import Path
import argparse,base64,hashlib,json,os,time,urllib.request
REPO='haihao0307/guilin-dem-pipeline';TARGET='stone-money-island/index.html';PUBLIC='https://haihao0307.github.io/guilin-dem-pipeline/stone-money-island/';EXPECTED='5d3167af1127a9a9f2eeaa47957158312060e0bff114020befec6703bc88001c';SIZE=956838;ALLOWED={'e66d23c3c679c9fd28fdc9149e701279ba1b3b7d','92d0af603824251300638ac568ba5783e343f624','9d3bc7b0e9a2300fc55f5a0929baad8fec85bdcd'}
def h(b):return hashlib.sha256(b).hexdigest()
def gb(b):return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
def api(path,method='GET',data=None):
 t=os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN');
 if not t:raise RuntimeError('runner token absent')
 q=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,method=method,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+t,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'SMI-R0153-publisher'})
 with urllib.request.urlopen(q,timeout=60) as r:
  b=r.read();return json.loads(b) if b else {}
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True);b=a.source.read_bytes();proof={'sourceSHA256':h(b),'sourceBytes':len(b),'shareAllowed':False,'deployed':False,'publicBrowserPassed':False}
 try:
  if len(b)!=SIZE or h(b)!=EXPECTED:raise RuntimeError('source identity mismatch')
  current=api('contents/'+TARGET+'?ref=gh-pages');actual=gb(b)
  if current['sha'] not in ALLOWED:raise RuntimeError('target changed unexpectedly: '+current['sha'])
  if current['sha']!=actual:
   r=api('contents/'+TARGET,'PUT',{'branch':'gh-pages','sha':current['sha'],'message':'fix(stone-money-island): publish R015.3 real 3D full package','content':base64.b64encode(b).decode()});proof['commitSHA']=r['commit']['sha']
  check=api('contents/'+TARGET+'?ref=gh-pages');assert check['sha']==actual;proof['repositoryWrite']=True;proof['gitBlob']=actual
  try:api('pages/builds','POST',{})
  except Exception as e:proof['pagesBuildRequestNote']=str(e)
  url=PUBLIC+'?v=R0153-'+EXPECTED[:12]
  for _ in range(60):
   try:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),timeout=25) as r:body=r.read();code=r.status
    if code==200 and h(body)==EXPECTED:break
   except Exception as e:proof['lastHTTPError']=str(e)
   time.sleep(10)
  else:raise RuntimeError('public exact bytes not available')
  proof.update(deployed=True,httpStatus=200,publicURL=url,publicSHA256=h(body),state='PUBLIC_BYTES_VERIFIED')
 except Exception as e:proof['state']='BLOCKED';proof['error']=type(e).__name__+': '+str(e);raise
 finally:(a.out/'PUBLICATION_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2));print(json.dumps(proof,ensure_ascii=False))
if __name__=='__main__':main()
