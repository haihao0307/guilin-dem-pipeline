#!/usr/bin/env python3
"""Source-bound R015.2 publisher. Never replaces terrain or fills absent inputs."""
from __future__ import annotations
import argparse, base64, gzip, hashlib, json, os, re, time
import urllib.request, urllib.parse
from pathlib import Path

REPO='haihao0307/guilin-dem-pipeline'
TARGET='stone-money-island/index.html'
PUBLIC='https://haihao0307.github.io/guilin-dem-pipeline/stone-money-island/'
EXPECTED='b345c852adeb814340297301eb8df5acb67460666cdc15b18f69ee80cf5f5328'
PREVIOUS='e66d23c3c679c9fd28fdc9149e701279ba1b3b7d'
EXPECTED_SIZE=933638

def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def validate(b: bytes) -> dict:
    if len(b)!=EXPECTED_SIZE or sha(b)!=EXPECTED:
        raise ValueError('Complete candidate identity differs; no publication allowed')
    text=b.decode('utf-8')
    meta=json.loads(re.search(r'<script id="meta"[^>]*>(.*?)</script>',text,re.S)[1])
    payloads={}
    for name,body in re.findall(r'<script id="data-([^"]+)"[^>]*>(.*?)</script>',text,re.S):
        raw=gzip.decompress(base64.b64decode(body,validate=True))
        spec=meta['assets'][name]
        if len(raw)!=spec['rawBytes'] or sha(raw)!=spec['sha256']:
            raise ValueError('Data identity mismatch: '+name)
        payloads[name]={'bytes':len(raw),'sha256':sha(raw)}
    if set(payloads)!=set(meta['assets']) or len(payloads)!=10:
        raise ValueError('A required source payload is absent')
    if 'SMI_DIAGNOSTICS' not in text or 'SMI_BOOT' not in text:
        raise ValueError('Missing runtime verification interface')
    return {'sourceSHA256':sha(b),'sourceBytes':len(b),'payloadCount':len(payloads),'payloads':payloads}

def api(path: str, method='GET', data=None):
    token=os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if not token: raise RuntimeError('Runner token is absent; no authentication inference')
    headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'SMI-exact-publisher','X-GitHub-Api-Version':'2022-11-28'}
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,headers=headers,method=method,data=None if data is None else json.dumps(data).encode())
    with urllib.request.urlopen(req,timeout=45) as r:
        body=r.read()
        return json.loads(body) if body else {}

def acquire(config: dict, local: Path|None) -> bytes:
    if local: return local.read_bytes()
    url=config.get('sourceUrl','')
    if not url: raise RuntimeError('SOURCE_TRANSFER_REQUIRED: complete HTML not yet reachable by runner')
    u=urllib.parse.urlparse(url)
    allowed=('dropbox.com','dropboxusercontent.com','githubusercontent.com','github.com')
    if u.scheme!='https' or not any(u.hostname==h or (u.hostname or '').endswith('.'+h) for h in allowed):
        raise ValueError('Source URL is not an approved HTTPS file host')
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'SMI-exact-publisher'}),timeout=60) as r:
        data=r.read(EXPECTED_SIZE+1)
    return data

def browser_check(url: str, out: Path, surface: str) -> dict:
    from playwright.sync_api import sync_playwright
    checks=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for label,w,h in [('desktop',1440,1000),('mobile_emulation',390,844)]:
            ctx=browser.new_context(viewport={'width':w,'height':h},has_touch=label=='mobile_emulation',device_scale_factor=1)
            page=ctx.new_page(); errors=[]; failed=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
            page.on('requestfailed',lambda e:failed.append(e.url))
            page.goto(url,wait_until='load',timeout=60000)
            page.wait_for_function("typeof SMI_BOOT!=='undefined' && ['ready','failed'].includes(SMI_BOOT.state)",timeout=60000)
            snap=page.evaluate('SMI_DIAGNOSTICS.snapshot()')
            assert snap['boot']['state']=='ready' and snap['boot']['loaded']==10 and snap['boot']['firstFrame'],snap
            assert snap['state']['ex']==1,snap
            gpu=page.evaluate('SMI_DIAGNOSTICS.checkCoreGPU()')
            reef=page.evaluate('SMI_DIAGNOSTICS.checkReefTexture()')
            assert gpu['rawMismatch']==0 and gpu['maxCoordinateErrorM']<.001 and gpu['webglError']==0,gpu
            assert all(x['rgbaMismatch']==0 for x in reef['layers']) and reef['webglError']==0,reef
            page.locator('#top').click();page.wait_for_timeout(150)
            axes=page.evaluate("(()=>{let d=SMI_DIAGNOSTICS,q=d.snapshot().query;return {o:d.geoProject(q.E,q.N),e:d.geoProject(q.E+100,q.N),n:d.geoProject(q.E,q.N+100)}})()")
            assert axes['e'][0]>axes['o'][0] and axes['n'][1]<axes['o'][1],axes
            for option in ['benthic','off','geomorphic']:page.locator('#reefMode').select_option(option)
            for key in ['showCore','showContext','showBathy','showSoundings','showAnchor','showWire','uncertaintyTint','hideWater']:
                old=page.locator('#'+key).is_checked();page.locator('#'+key).set_checked(not old);page.locator('#'+key).set_checked(old)
            page.locator('#anchor').click();page.locator('#north').click()
            box=page.locator('#stage').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
            old=page.evaluate('SMI_DIAGNOSTICS.snapshot().state.yaw')
            page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+45,y+15,steps=8);page.mouse.up();page.wait_for_timeout(200)
            assert abs(page.evaluate('SMI_DIAGNOSTICS.snapshot().state.yaw')-old)>.1
            if label=='mobile_emulation':
                cdp=ctx.new_cdp_session(page);old=page.evaluate('SMI_DIAGNOSTICS.snapshot().state.dist')
                def touch(kind,pts):
                    cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':i+1,'x':a,'y':b} for i,(a,b) in enumerate(pts)]})
                touch('touchStart',[(x-30,y),(x+30,y)]);touch('touchMove',[(x-60,y),(x+60,y)]);touch('touchEnd',[]);page.wait_for_timeout(200)
                assert page.evaluate('SMI_DIAGNOSTICS.snapshot().state.dist')<old*.85
            page.locator('#north').click();page.wait_for_timeout(150)
            page.screenshot(path=str(out/(surface+'_'+label+'.png')))
            assert not errors and not failed,(errors,failed)
            checks.append({'viewport':label,'width':w,'height':h,'boot':snap['boot'],'coreGPU':gpu,'reefGPU':reef,'axes':axes,'errors':errors,'failedRequests':failed})
            ctx.close()
        browser.close()
    return {'surface':surface,'url':url,'checks':checks,'passed':True,'realIPhoneTested':False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source-file',type=Path);ap.add_argument('--config',type=Path,default=Path('publication-input.json'));ap.add_argument('--out',type=Path,default=Path('publication-evidence'));ap.add_argument('--publish',action='store_true');args=ap.parse_args()
    out=args.out;out.mkdir(parents=True,exist_ok=True)
    receipt={'sourceSHA256':EXPECTED,'shareAllowed':False,'deployed':False,'publicBrowserPassed':False,'visualAcceptance':False,'productionReady':False,'realIPhoneTested':False}
    try:
        config=json.loads(args.config.read_text()) if args.config.exists() else {}
        b=acquire(config,args.source_file);receipt.update(validate(b));print('EXACT_SOURCE_VALIDATED',len(b),'ALL_10_PAYLOADS',flush=True)
        target=out/'index.html';target.write_bytes(b)
        if not args.publish:
            receipt['state']='SOURCE_VALIDATED_NOT_PUBLISHED';return
        before=api('contents/'+TARGET+'?ref=gh-pages')
        actual=hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
        if before['sha'] not in (PREVIOUS,actual):raise RuntimeError('Target changed since inspection; refusing overwrite: '+before['sha'])
        receipt['fileBrowser']=browser_check(target.resolve().as_uri(),out,'file')
        if before['sha']!=actual:
            result=api('contents/'+TARGET,'PUT',{'branch':'gh-pages','sha':before['sha'],'message':'fix(stone-money-island): publish hash-locked R015.2 real 3D workbench','content':base64.b64encode(b).decode()})
            receipt['commitSHA']=result['commit']['sha']
        else:receipt['alreadyCommitted']=True
        check=api('contents/'+TARGET+'?ref=gh-pages')
        assert check['sha']==actual,'Published Git object mismatch'
        receipt['repositoryWrite']=True;receipt['gitBlob']=actual
        try:api('pages/builds','POST',{})
        except Exception as e:receipt['buildRequestError']=str(e)
        url=PUBLIC+'?v=R0152-'+EXPECTED[:12]
        for _ in range(45):
            try:
                with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),timeout=20) as response:
                    body=response.read();code=response.status
                if code==200 and sha(body)==EXPECTED:break
            except Exception as e:receipt['lastHTTPError']=str(e)
            time.sleep(12)
        else:raise RuntimeError('Public URL has not returned the exact candidate; no share permission')
        receipt.update(deployed=True,httpStatus=200,publicSHA256=sha(body),publicURL=url)
        receipt['publicBrowser']=browser_check(url,out,'https');receipt['publicBrowserPassed']=True;receipt['shareAllowed']=True;receipt['state']='PUBLIC_BROWSER_VERIFIED'
    except Exception as e:
        receipt['state']='BLOCKED';receipt['error']=type(e).__name__+': '+str(e);raise
    finally:
        (out/'PUBLICATION_PROOF.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2));print(json.dumps(receipt,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
