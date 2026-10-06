import concurrent.futures,hashlib,json,pathlib,time,urllib.request,urllib.error
root=pathlib.Path(__file__).resolve().parent
expected=json.loads((root/'public-expected.json').read_text())
base=expected['base_url'];commit=expected['production_commit'];out=pathlib.Path('train-public-hashes.json')
def check(item):
 path,digest=item;url=base+path+'?release='+commit
 try:
  req=urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-ReadOnly-Public-QA/1.0'})
  with urllib.request.urlopen(req,timeout=45) as response:data=response.read();status=response.status
  got=hashlib.sha256(data).hexdigest();return {'path':path,'status':status,'bytes':len(data),'sha256':got,'expected':digest,'matched':got==digest}
 except urllib.error.HTTPError as e:return {'path':path,'status':e.code,'matched':False}
 except Exception as e:return {'path':path,'error':str(e),'matched':False}
start=time.monotonic()
while True:
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:results=list(pool.map(check,expected['files'].items()))
 report={'production_commit':commit,'base_url':base,'matched':sum(r['matched']for r in results),'total':len(results),'files':results};out.write_text(json.dumps(report,indent=2));print(json.dumps({'matched':report['matched'],'total':report['total'],'elapsed':round(time.monotonic()-start,1)}),flush=True)
 if report['matched']==report['total']:break
 if any(r.get('status')in [401,403]for r in results):raise SystemExit('Public read denied; no alternate route attempted')
 if time.monotonic()-start>420:raise SystemExit('Pages did not serve all expected release bytes in the verification window')
 time.sleep(15)
