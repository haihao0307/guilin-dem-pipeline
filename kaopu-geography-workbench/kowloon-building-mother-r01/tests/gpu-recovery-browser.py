#!/usr/bin/env python3
"""Actual WebGL cold-start/loss/recovery QA. Injected failures are NOT the user's diagnosed root cause."""
import argparse, hashlib, json, pathlib, time, traceback, urllib.request
from playwright.sync_api import sync_playwright
P=pathlib.Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser(); ap.add_argument('--url',required=True); ap.add_argument('--output',required=True); args=ap.parse_args()
out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
A='window.__IMPLICIT_BUILDING__'; G='window.__GPU_RECOVERY__'
r={'url':args.url,'status':'running','scope':'isolated synchronization, resource lifecycle and sampling budget; no object geometry change','userDeviceRootCause':'not established by controlled injections','frozenR06FullAcceptance':'FAILED_KNOWN_ONE_UNRESOLVED_GRAZING_PIXEL','tests':{},'failures':[],'screenshots':[],'hashes':{},'deviceCoverage':'headless Chromium ANGLE SwiftShader only; not the user GPU or iOS'}
def save(): (out/'results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def check(ok,label,data=None):
 if not ok: raise AssertionError(label+(': '+json.dumps(data,ensure_ascii=False)[:1000] if data is not None else ''))
base=args.url.rsplit('/',1)[0]+'/'
for p in [P/'gpu-recovery-r01.html',*sorted((P/'gpu-recovery-r01').glob('*')),*sorted((P/'r07').glob('*.mjs'))]:
 if not p.is_file():continue
 rel=str(p.relative_to(P));got=hashlib.sha256(urllib.request.urlopen(base+rel+'?qa='+str(time.time_ns()),timeout=60).read()).hexdigest();expected=hashlib.sha256(p.read_bytes()).hexdigest();check(got==expected,'runtime hash '+rel);r['hashes'][rel]=got
AUDIT="""window.__GL_AUDIT__={buffers:0,indexDraws:0,drawCounts:[],programs:0,textures:0,vaos:0,framebuffers:0,fences:0,contextLossEvents:0,contextRestoredEvents:0};for(const [name,kind] of [['createBuffer','buffers'],['drawElements','indexDraws'],['createProgram','programs'],['createTexture','textures'],['createVertexArray','vaos'],['createFramebuffer','framebuffers'],['fenceSync','fences']]){const f=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){window.__GL_AUDIT__[kind]++;return f.apply(this,args);};}const f=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(mode,first,count){window.__GL_AUDIT__.drawCounts.push(count);return f.call(this,mode,first,count);};addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('view');c.addEventListener('webglcontextlost',()=>window.__GL_AUDIT__.contextLossEvents++);c.addEventListener('webglcontextrestored',()=>window.__GL_AUDIT__.contextRestoredEvents++);});"""
def compact_audit(p):
 x=p.evaluate('window.__GL_AUDIT__');x['drawCalls']=len(x['drawCounts']);x['drawCounts']=sorted(set(x['drawCounts']));return x
def snap(p):return p.evaluate(G+'.snapshot()')
def settled(p):return p.evaluate(A+'.awaitSettled({timeoutMs:90000})')
def budget(s,max_pixels=17920):
 d=s['currentResolution'];check(d['width']*d['height']<=max_pixels,'total pixel budget',d);check(d['width']<=160 and d['height']<=160 if max_pixels==17920 else True,'two-axis cap',d);check(s['automaticQualityPromotion'] is False,'no silent quality promotion')
def capture(p,name):
 p.screenshot(path=str(out/(name+'.png')));r['screenshots'].append(name+'.png');save()
def stable_scene(p):return p.evaluate("""()=>{const a=window.__IMPLICIT_BUILDING__,s=a.snapshot();return {caseId:s.caseId,config:s.config,hosted:s.hosted?.edits,options:s.renderOptions,counts:s.counts,queries:[[0,0,0],[1,2,3],[-1,1,.5]].map(q=>a.query(q))};}""")
def small_parity(p):return p.evaluate(A+'.parity('+A+'.probePoints().slice(0,24))')
def restore(p):
 p.wait_for_function(G+".snapshot().state==='lost'",timeout=10000);p.wait_for_timeout(100);p.evaluate(G+'.test.restoreContext()');p.wait_for_function(G+".snapshot().state==='active'&&"+G+'.snapshot().lastCompletedGeneration==='+G+'.snapshot().generation',timeout=90000);return settled(p)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 def scenario(name,fn,viewport=None,test_hooks=True):
  print('BEGIN',name,flush=True);t=time.monotonic();ctx=browser.new_context(viewport=viewport or {'width':1440,'height':1000},device_scale_factor=1);p=ctx.new_page();p.set_default_timeout(60000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.add_init_script(AUDIT);d={'injected':test_hooks,'errors':errors};r['tests'][name]=d;save()
  try:
   p.goto(args.url+('?gpu-test=1' if test_hooks else ''),wait_until='networkidle',timeout=90000);p.wait_for_function(A+'?.ready',timeout=90000);settled(p);d['coldStart']=snap(p);budget(d['coldStart']);fn(p,d);d['audit']=compact_audit(p);check(d['audit']['buffers']==0 and d['audit']['indexDraws']==0 and d['audit']['drawCounts']==[3],'ray plumbing only, no object buffers',d['audit']);check(not errors,'uncaught page errors',errors);d['status']='passed'
  except Exception as e:
   d['status']='failed';d['failure']=str(e);d['traceback']=traceback.format_exc();r['failures'].append(name)
   try:d['lastState']=snap(p);capture(p,name+'-failure')
   except Exception as capture_error:d['captureError']=str(capture_error)
   print('FAILED',name,str(e),flush=True)
  finally:d['elapsedWallSeconds']=time.monotonic()-t;save();ctx.close();print('END',name,d['status'],d['elapsedWallSeconds'],flush=True)
 def cold_cases(p,d):
  check(p.evaluate(G+'.test===undefined'),'test hooks absent from normal URL');d['cases']={}
  for case,key in [('lowrise','residentialWindow'),('kcc','unitDoor'),('warehouse','personnelDoor')]:
   p.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id+"-hosted")',case);p.evaluate('(key)=>window.__IMPLICIT_BUILDING__.selectHostedComponent(key)',key);frame=settled(p);s=snap(p);budget(s);d['cases'][case]={'frame':frame,'state':s,'closed':stable_scene(p)};capture(p,'cold-'+case+'-closed')
   p.evaluate('key=>window.__IMPLICIT_BUILDING__.applyHosted(key,{openT:1})',key);settled(p);capture(p,'cold-'+case+'-open');d['cases'][case]['open']=stable_scene(p)
   parity=small_parity(p);d['cases'][case]['parity']=parity;check(parity['passed'],case+' unchanged field parity',parity);p.evaluate(A+'.resumeViewport()');settled(p)
  d['beforeIdle']=snap(p);p.wait_for_timeout(700);d['afterIdle']=snap(p);budget(d['afterIdle']);check(d['afterIdle']['stats']['submitted']==d['beforeIdle']['stats']['submitted'],'no idle background HD work')
 scenario('normal-cold-three-cases',cold_cases,test_hooks=False)
 def loss_test(phase,case='lowrise-hosted',edit=True):
  def run(p,d):
   p.evaluate('(id)=>window.__IMPLICIT_BUILDING__.setCase(id)',case)
   if edit:p.evaluate(A+'.applyHosted("residentialWindow",{openT:.45,frameDepth:.13})')
   settled(p);d['before']=stable_scene(p);d['beforeLifecycle']=snap(p);d['beforeAudit']=compact_audit(p)
   p.evaluate('phase=>window.__GPU_RECOVERY__.test.loseContext(phase)',phase)
   p.wait_for_function(G+".snapshot().state==='lost'",timeout=15000);d['lost']=snap(p);check(not d['lost']['pendingFence'],'lost context drops stale fence');capture(p,'loss-'+phase+'-'+case)
   rejected=p.evaluate('async()=>{try{await window.__IMPLICIT_BUILDING__.awaitSettled();return false;}catch(e){return {name:e.name,message:e.message};}}');check(bool(rejected),'settle rejects while lost');d['rejectedWait']=rejected
   d['restoredFrame']=restore(p);d['after']=stable_scene(p);d['afterLifecycle']=snap(p);d['afterAudit']=compact_audit(p);check(d['after']==d['before'],'camera, applied parameters and function scene retained');check(d['afterLifecycle']['resourceEpoch']>d['beforeLifecycle']['resourceEpoch'],'fresh epoch');check(d['afterLifecycle']['resourceRebuilds']==1 and d['afterLifecycle']['recoveryAttempts']==1,'one actual rebuild');budget(d['afterLifecycle']);check(d['afterAudit']['programs']>d['beforeAudit']['programs'] and d['afterAudit']['textures']>d['beforeAudit']['textures'] and d['afterAudit']['vaos']>d['beforeAudit']['vaos'],'fresh program/texture/VAO allocation');check(d['afterAudit']['contextLossEvents']>=1 and d['afterAudit']['contextRestoredEvents']>=1,'actual WebGL context events');capture(p,'restored-'+phase+'-'+case)
   d['parityAfterRestore']=small_parity(p);check(d['parityAfterRestore']['passed'],'GPU field query after fresh resources',d['parityAfterRestore']);p.evaluate(A+'.resumeViewport()');settled(p)
  return run
 scenario('loss-before-draw-retains-window',loss_test('before-draw'))
 scenario('loss-after-fence-retains-window',loss_test('after-fence'))
 scenario('loss-after-fence-mrt-design',loss_test('after-fence','design',False))
 def invalid_fence(p,d):
  d['before']=stable_scene(p);p.evaluate(G+'.test.invalidateNextFence()');p.wait_for_function(G+".snapshot().state==='failed'",timeout=10000);d['failed']=snap(p);f=d['failed']['lastFailure'];check(f['reason']=='wait-failed-invalid-sync','WAIT_FAILED classified separately',f);check(f['contextLost'] is False and f['syncValid'] is False,'live invalid-sync evidence',f);check(d['failed']['recoveryAttempts']==0,'no automatic live-context retry');capture(p,'invalid-fence-stopped');p.evaluate(G+'.retry()');settled(p);d['recovered']=snap(p);check(d['recovered']['recoveryAttempts']==1 and d['recovered']['state']=='active','bounded manual rebuild');check(stable_scene(p)==d['before'],'live-retry retains scene');budget(d['recovered']);capture(p,'invalid-fence-manual-recovery')
 scenario('invalid-live-fence-not-timeout',invalid_fence)
 def failed_restore(p,d):
  p.evaluate(G+'.test.failNextRestore();'+G+'.test.loseContext("now")');p.wait_for_function(G+".snapshot().state==='lost'");p.wait_for_timeout(100);p.evaluate(G+'.test.restoreContext()');p.wait_for_function(G+".snapshot().state==='failed'",timeout=10000);d['state']=snap(p);check(d['state']['recoveryAttempts']==1,'failed rebuild counts attempt');check(not d['state']['pendingFence'] and not d['state']['pendingHealthPoll'],'failed rebuild has no polling work');before=d['state']['stats'];p.wait_for_timeout(500);check(snap(p)['stats']==before,'failed rebuild does not retry');capture(p,'restore-failure-clear-message')
 scenario('rebuild-failure-stops-once',failed_restore)
 def second_loss(p,d):
  p.evaluate(G+'.test.loseContext("now")');restore(p);p.evaluate(G+'.test.loseContext("now")');p.wait_for_function(G+".snapshot().state==='lost'");p.wait_for_timeout(100);p.evaluate(G+'.test.restoreContext()');p.wait_for_function(G+".snapshot().state==='failed'",timeout=10000);d['state']=snap(p);check(d['state']['recoveryAttempts']==1 and d['state']['resourceRebuilds']==1,'second loss cannot rebuild without limit');check(not d['state']['pendingFence'],'second loss stops stale fence');capture(p,'second-loss-budget-exhausted')
 scenario('second-loss-bounded',second_loss)
 def stale_case(p,d):
  d['before']=stable_scene(p);gate=p.evaluate(G+'.test.pauseNextCaseLoad()');p.evaluate('()=>{window.__delayedCase=window.__IMPLICIT_BUILDING__.setCase("warehouse-hosted").then(()=>({resolved:true}),e=>({rejected:true,name:e.name,message:e.message}));}')
  p.evaluate(G+'.test.loseContext("now")');d['restored']=restore(p);p.evaluate('(id)=>window.__GPU_RECOVERY__.test.releaseCaseLoad(id)',gate);d['pendingResult']=p.evaluate('window.__delayedCase');p.wait_for_timeout(100);check(d['pendingResult'].get('rejected'),'stale async case rejected');check(stable_scene(p)==d['before'],'old asynchronous case cannot replace restored scene');capture(p,'stale-case-cancelled')
 scenario('stale-async-case-cancelled',stale_case)
 def portrait(p,d):
  d['portrait']=snap(p);budget(d['portrait']);check(p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'no horizontal CSS overflow');capture(p,'portrait-conservative')
  rejected=p.evaluate('()=>{try{window.__GPU_RECOVERY__.requestQuality("high");return false;}catch(e){return e.message;}}');check(bool(rejected),'high sampling cannot skip staged request');d['highSkipRejected']=rejected
  p.evaluate(G+'.requestQuality("medium")');settled(p);d['medium']=snap(p);budget(d['medium'],71680);check(d['medium']['currentResolution']['width']<=320 and d['medium']['currentResolution']['height']<=320,'medium two-axis cap');capture(p,'portrait-explicit-medium')
  p.evaluate(G+'.requestQuality("conservative")');settled(p);p.evaluate(G+'.test.loseContext("now")');restore(p);d['restored']=snap(p);budget(d['restored']);p.wait_for_timeout(700);budget(snap(p));d['layoutOnly']='desktop CSS portrait; not iOS hardware'
 scenario('portrait-and-staged-sampling',portrait,{'width':390,'height':844})
 def cancel_initialization(p,d):
  p.evaluate(A+'.setCase("kcc-hosted")');d['initializing']=snap(p);check(d['initializing']['state']=='initializing','new program has separate initialization state');check(d['initializing']['initialization']['budgetMs']==60000 and d['initializing']['initialization']['ordinaryFrameBudgetMs']==15000,'initialization and frame budgets separate');p.evaluate(G+'.cancelInitialization()');d['cancelled']=snap(p);check(d['cancelled']['state']=='failed' and d['cancelled']['lastFailure']['reason']=='initialization-cancelled','explicit initialization cancellation is terminal');check(p.evaluate(A+'.ready') is False,'cancelled initialization never reports ready');capture(p,'initialization-explicit-cancel')
 scenario('new-program-initialization-cancellable',cancel_initialization)

 browser.close()
r['status']='passed_bounded_controlled_gpu_lifecycle_checks' if not r['failures'] else 'failed';save();print(json.dumps({'status':r['status'],'scenarios':len(r['tests']),'failures':r['failures'],'screenshots':len(r['screenshots'])},ensure_ascii=False));raise SystemExit(0 if not r['failures'] else 1)
