import json,hashlib,os,time,threading,http.server,socketserver,functools,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=Path(os.environ.get('MOTION_QA_OUT',ROOT/'qa/browser'));OUT.mkdir(parents=True,exist_ok=True)
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT.parent));server=socketserver.TCPServer(('127.0.0.1',0),handler);threading.Thread(target=server.serve_forever,daemon=True).start();url=os.environ.get('MOTION_QA_URL') or f'http://127.0.0.1:{server.server_address[1]}/kaopu-animal-learning/#animal-learning/video-motion-silhouette';source_url=url.split('#')[0];public_verification=None
request_audit=[True];overview_verification=None;pixel_checks=[];checks=[];errors=[];external=[];engine=os.environ.get('MOTION_ENGINE','chromium')
def check(name,fn):fn();checks.append({'name':name,'status':'passed'})
def yes(x,msg='assertion failed'):
 if not x:raise AssertionError(msg)
def main():
 global public_verification,overview_verification
 if os.environ.get('MOTION_QA_URL'):
  with urllib.request.urlopen(urllib.request.Request(source_url,headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-Animal-Public-QA/1.0'}),timeout=60) as response:actual=response.read();http_status=response.status
  yes(actual==(ROOT/'index.html').read_bytes(),'Public HTML differs from exact tested candidate')
  public_verification={'url':source_url,'status':http_status,'exactBytes':True,'productionCommit':os.environ.get('MOTION_PUBLIC_COMMIT'),'sha256':hashlib.sha256(actual).hexdigest()}
 with sync_playwright() as p:
  browser=getattr(p,engine).launch();ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:external.append(r.url) if request_audit[0] and r.url.startswith('http') and r.url!=source_url and '127.0.0.1' not in r.url else None)
  page.goto(url);page.locator('#vm-sample').click();expect(page.locator('#vm-status')).to_contain_text('样例已就绪',timeout=20000)
  page.screenshot(path=str(OUT/'sample-initial.png'),full_page=False)
  q=lambda sel:page.locator(sel)
  ev=lambda code:page.evaluate("()=>{const s=document.querySelector('#animal-learning').shadowRoot;"+code+"}")
  reference=json.loads((ROOT/'tests/muybridge-frame-reference.json').read_text())['frames']
  def verify_pixels(i):
   page.wait_for_timeout(100)
   observed=ev("const c=document.createElement('canvas');c.width=30;c.height=20;const x=c.getContext('2d');x.drawImage(s.querySelector('#vm-video'),0,0,30,20);const d=x.getImageData(0,0,30,20).data;return Array.from({length:600},(_,i)=>d[i*4]*.2126+d[i*4+1]*.7152+d[i*4+2]*.0722)")
   distances=[sum(abs(a-b) for a,b in zip(observed,frame))/600 for frame in reference];nearest=min(range(15),key=lambda j:distances[j]);pixel_checks.append({'requestedFrame':i,'nearestSourceFrame':nearest,'meanAbsoluteGrayError':distances[i]})
   yes(nearest==i,'Visible video frame does not match original GIF: '+str(pixel_checks[-1]))
  check('initial image matches original source frame 0',lambda:verify_pixels(0))
  check('sample decodes at original 300x200 and 1.5 seconds',lambda:yes(ev("const v=s.querySelector('#vm-video');return v.videoWidth===300&&v.videoHeight===200&&Math.abs(v.duration-1.5)<.01")))
  check('15 saved true-image keyframes shown',lambda:yes(q('#vm-timeline button').count()==15))
  check('side mapping remains unresolved',lambda:yes(q('#vm-sides').input_value()=='unresolved'))
  check('video and rig desktop panes are visible side-by-side',lambda:yes(ev("const a=s.querySelector('.vm-frame').getBoundingClientRect(),b=s.querySelector('#vm-rig').getBoundingClientRect(),c=s.querySelector('.vm-controls').getBoundingClientRect();return a.width>300&&b.width>300&&b.x>a.right-1&&c.x>b.right-1")))
  check('1440x900 viewport retains views timeline and metrics without document scrolling',lambda:yes(ev("return ['#vm-frame','#vm-rig','#vm-scrub','#vm-timeline','#vm-metrics'].every(id=>{const r=s.querySelector(id).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})&&document.documentElement.scrollHeight<=innerHeight+1")))

  for i in range(1,15):
   q('#vm-next').click();expect(q('#vm-time')).to_have_text(f'{i/10:.3f} s');check('decoded frame '+str(i)+' aligned with source time',lambda:yes('人工关键帧' in q('#vm-metrics').inner_text()));check('visible pixels match original source frame '+str(i),lambda:verify_pixels(i))
  check('full keyframe labels remain readable and selected end key scrolls into view',lambda:yes(ev("const t=s.querySelector('#vm-timeline'),a=t.querySelector('[data-current=true]'),r=a.getBoundingClientRect(),b=t.getBoundingClientRect();return a.scrollWidth<=a.clientWidth+1&&r.left>=b.left-1&&r.right<=b.right+1")))
  q('#vm-next').click();page.wait_for_timeout(100);check('next frame clamps to last decoded source frame',lambda:yes(q('#vm-time').inner_text()=='1.400 s'))
  q('#vm-prev').click();expect(q('#vm-time')).to_have_text('1.300 s')
  q('#vm-timeline button').first.click();expect(q('#vm-time')).to_have_text('0.000 s')
  q('#vm-joint').select_option('nose');q('#vm-dx').fill('3');q('#vm-dy').fill('4');q('#vm-z').fill('60');q('#vm-apply').click();check('projection residual reacts to XY edits',lambda:yes('最大：5.00 px' in q('#vm-metrics').inner_text()))
  check('scrolling XYZ parameters keeps video and timeline within viewport',lambda:yes(ev("const c=s.querySelector('.vm-controls'),a=s.querySelector('#vm-apply').getBoundingClientRect(),v=s.querySelector('#vm-frame').getBoundingClientRect(),t=s.querySelector('#vm-scrub').getBoundingClientRect();return c.scrollTop>0&&a.bottom<=innerHeight&&v.top>=0&&v.bottom<=innerHeight&&t.bottom<=innerHeight")))
  q('#vm-orbit').click();page.screenshot(path=str(OUT/'sample-3d-depth.png'),full_page=False)
  q('.vm-controls details summary').first.click()
  with page.expect_download() as d:q('#vm-export').click()
  file=OUT/'roundtrip.json';d.value.save_as(file);doc=json.loads(file.read_text());check('export has manually edited XYZ and rig',lambda:yes(doc['frames'][0]['points']['nose']['z']==60 and abs(doc['rig']['frames'][0]['points']['nose']['z']-.2)<1e-8))
  check('export has no false inferred depth or original model claims',lambda:yes(not any(doc['claims'].values())))
  q('#vm-delete').click();check('deleting current key removes one frame',lambda:yes(q('#vm-timeline button').count()==14))
  q('#vm-import').set_input_files(str(file));expect(q('#vm-status')).to_contain_text('记录已恢复');check('same-video JSON roundtrip restores keyframes',lambda:yes(q('#vm-timeline button').count()==15))
  bad=dict(doc);bad['media']=dict(doc['media'],sha256='0'*64);badfile=OUT/'wrong-video.json';badfile.write_text(json.dumps(bad));q('#vm-import').set_input_files(str(badfile));expect(q('#vm-status')).to_contain_text('不属于当前视频');check('wrong video hash refuses restore without data loss',lambda:yes(q('#vm-timeline button').count()==15))
  q('#vm-joint').select_option('fore_b_tip');q('#vm-visibility').select_option('occluded');q('#vm-mark').click();check('occlusion explicitly recorded without fabricated point',lambda:yes(q('#vm-visibility').input_value()=='occluded'))
  q('#vm-joint').select_option('nose');overlay=q('#vm-overlay');box=overlay.bounding_box();overlay.click(position={'x':box['width']*.5,'y':box['height']*.5});check('clicking resized video uses original pixel dimensions',lambda:yes('已记录可见表面代理点' in q('#vm-status').inner_text()))
  with page.expect_download() as d:q('#vm-export').click()
  file2=OUT/'clicked.json';d.value.save_as(file2);c=json.loads(file2.read_text());point=c['frames'][0]['points']['nose'];check('original-space click exact within one source pixel',lambda:yes(abs(point['x']-150)<1 and abs(point['y']-100)<1))
  q('#vm-rate').select_option('0.5');q('#vm-play').click();page.wait_for_timeout(500);q('#vm-play').click();check('half-speed playback advances decoded clock',lambda:yes(ev("const v=s.querySelector('#vm-video');return v.paused&&v.playbackRate===.5&&v.currentTime>.1&&v.currentTime<.6")))
  # Route away during active media and return: no old media resurrects.
  page.evaluate("location.hash='#animal-learning/annotate'");q('#image-file').wait_for();page.go_back();q('#vm-file').wait_for();check('leaving route cleans video and resets local state',lambda:yes(q('#vm-frame').is_hidden()))
  q('#vm-file').set_input_files(str(ROOT/'assets/muybridge-horse.webm'));expect(q('#vm-status')).to_contain_text('视频已载入');check('local file import is independent from sample annotation',lambda:yes(q('#vm-timeline button').count()==0))
  q('#vm-record').click();check('local decoded frame can be authored',lambda:yes(q('#vm-timeline button').count()==1))
  for _ in range(4):q('#vm-next').click();page.wait_for_timeout(100)
  check('manual fps mismatch still progresses requested timeline',lambda:yes(float(q('#vm-time').inner_text().split()[0])>=.1))
  # Rapid repeat sample opens must not attach stale decode to newer state.
  q('#vm-sample').dblclick();expect(page.locator('#vm-status')).to_contain_text('样例已就绪',timeout=20000);check('repeated import settles to one sample',lambda:yes(q('#vm-timeline button').count()==15))
  page.set_viewport_size({'width':2048,'height':1080});page.wait_for_timeout(100);page.screenshot(path=str(OUT/'sample-wide-desktop.png'),full_page=False)
  check('2048x1080 viewport retains both views and full timeline',lambda:yes(ev("return ['#vm-frame','#vm-rig','#vm-timeline','#vm-metrics'].every(id=>s.querySelector(id).getBoundingClientRect().bottom<=innerHeight)&&document.documentElement.scrollHeight<=innerHeight+1")))
  for route in ['home','overview','annotate','obj','rapid-pattern-reid','4dequine-motion-appearance','animallift-canonical-fur']:
   page.evaluate('(r)=>location.hash="#animal-learning/"+r',route);page.wait_for_timeout(100);check('legacy route retained '+route,lambda:yes(q('.overview-return').is_visible()))
  page.evaluate("location.hash='#animal-learning/home'");q('[data-open="video-motion-silhouette"]').click();q('#vm-sample').wait_for();check('existing animal overview action card opens exact original route',lambda:yes(page.url.endswith('#animal-learning/video-motion-silhouette')))
  if os.environ.get('MOTION_OVERVIEW_URL'):
   request_audit[0]=False
   overview_url=os.environ['MOTION_OVERVIEW_URL'];expected=(ROOT.parent/'kaopu-human-overview/index.html').read_bytes()
   with urllib.request.urlopen(overview_url,timeout=60) as response:actual=response.read();http_status=response.status
   yes(actual==expected,'Overview differs from exact tested animal-entry patch');overview_verification={'url':overview_url,'status':http_status,'exactBytes':True,'sha256':hashlib.sha256(actual).hexdigest()}
   page.goto(overview_url);page.locator('a[href="../kaopu-animal-learning/#animal-learning/video-motion-silhouette"]').click();q('#vm-sample').wait_for();check('original unified overview links directly to working animal action route',lambda:yes(page.url.endswith('#animal-learning/video-motion-silhouette')))
   q('.overview-return').click();page.locator('#animals-heading').wait_for();check('animal action returns to original unified overview',lambda:yes(page.locator('a[href="../kaopu-animal-learning/#animal-learning/video-motion-silhouette"]').count()==1))
  check('no uncaught browser exceptions',lambda:yes(not errors,str(errors)));check('no outbound uploads or media requests',lambda:yes(not external,str(external)));browser.close()
try:
 main();result='passed'
except Exception as e:
 result='failed';errors.append(repr(e));raise
finally:
 server.shutdown();(OUT/'MOTION_BROWSER.json').write_text(json.dumps({'engine':engine,'status':result,'checks':checks,'passed':len(checks),'errors':errors,'externalRequests':external,'networkAuditScope':'Animal media workflow before requested overview-navigation checks','sourcePixelChecks':pixel_checks,'publicVerification':public_verification,'overviewVerification':overview_verification,'htmlSHA256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'commit':os.environ.get('GITHUB_SHA'),'scope':'Real desktop browser; original source animation, local files, authored points and uncalibrated 3D skeleton; no model inference'},ensure_ascii=False,indent=2)+'\n')
