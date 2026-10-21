#!/usr/bin/env python3
"""Actual AA resource/scheduling tests. No local-browser fallback or user-GPU claims."""
import argparse, json, pathlib, time, traceback
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--url',required=True);ap.add_argument('--output',required=True);args=ap.parse_args();out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
A='window.__IMPLICIT_BUILDING__';G='window.__GPU_RECOVERY__';Q='window.__MATERIAL_QUALITY__'
r={'status':'running','scope':'actual normal cold initialization, independent RGBA8 first use, strict presentation completion, cancellation and restoration','coverage':'headless Chromium ANGLE SwiftShader, not the user GPU or iOS','tests':{},'failures':[],'screenshots':[]}
def save():(out/'material-lifecycle.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def check(value,message):
 if not value:raise AssertionError(message)
def state(p):return p.evaluate(G+'.snapshot()')
def quality(p):return p.evaluate(Q+'.snapshot()')
def settled(p):return p.evaluate(A+'.awaitSettled({timeoutMs:90000})')
def start(p,request):p.evaluate('request=>{window.__qualityResult=window.__MATERIAL_QUALITY__.render(request).then(value=>({ok:true,value}),e=>({ok:false,name:e.name,message:e.message}));}',request)
def capture(p,name):p.screenshot(path=str(out/(name+'.png')));r['screenshots'].append(name+'.png')
AUDIT="""window.__INIT_AUDIT__={finish:0,readPixels:0};for(const name of ['finish','readPixels']){const f=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){window.__INIT_AUDIT__[name]++;return f.apply(this,args);};}"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 def scenario(name,fn):
  context=browser.new_context(viewport={'width':1280,'height':900});p=context.new_page();p.set_default_timeout(90000);p.add_init_script(AUDIT);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));d={'errors':errors};r['tests'][name]=d;started=time.monotonic();save()
  try:
   p.goto(args.url+'?gpu-test=1',wait_until='networkidle',timeout=90000);p.wait_for_function(A+'?.apiAvailable',timeout=90000);d['apiAvailable']=state(p);p.wait_for_function(A+'.ready',timeout=90000);d['coldSettled']=settled(p);d['cold']=state(p);d['coldAudit']=p.evaluate('window.__INIT_AUDIT__');check(d['coldAudit']=={'finish':0,'readPixels':0},'ordinary cold path must not block with finish/readback');check(d['cold']['initialization']['budgetMs']==60000 and d['cold']['maxWaitMs']==15000,'separate budgets retained');fn(p,d);check(not errors,'no uncaught page errors');d['status']='passed'
  except Exception as e:
   d['status']='failed';d['failure']=str(e);d['traceback']=traceback.format_exc();r['failures'].append(name)
   try:d['lastState']=state(p);d['lastQuality']=quality(p);capture(p,name+'-failure')
   except Exception as capture_error:d['captureError']=str(capture_error)
  finally:d['wallSeconds']=time.monotonic()-started;save();context.close();print(name,d['status'],d['wallSeconds'],flush=True)
 def aa_after_qa(p,d):
  p.evaluate(A+'.probe([[0,0,0]])');before=p.evaluate(A+'.scheduling()');check(before['lastDispatch']['revision']!=before['revision'] and before['pendingCallbacks']==0,'QA leaves deliberate display invalidation');d['beforeAA']=before
  start(p,{'width':320,'height':240,'samplesPerAxis':2,'tileSide':64});duplicate=p.evaluate('async()=>{try{await window.__MATERIAL_QUALITY__.render({width:32,height:24});return null;}catch(e){return e.message;}}');check(bool(duplicate),'overlapping quality request rejected');d['duplicateRejected']=duplicate
  first=p.evaluate('window.__qualityResult');check(first['ok'],'320 AA completes after QA invalidation: '+str(first));d['AA320']=first['value'];check(d['AA320']['initialization']['reused'] is False,'first RGBA8 use independently initialized');check(d['AA320']['initialization']['pixelCount']==1 and d['AA320']['initialization']['fenceElapsedMs'] is not None,'actual one-pixel FBO fence completed');check(d['AA320']['maxTileFenceMs']<15000,'ordinary tile budget not extended');d['after320']=settled(p);capture(p,'aa320-after-explicit-qa')
  start(p,{'width':640,'height':480,'samplesPerAxis':2,'tileSide':64});second=p.evaluate('window.__qualityResult');check(second['ok'],'640 AA completes: '+str(second));d['AA640']=second['value'];check(d['AA640']['initialization']['reused'] is True,'same program and RGBA8 domain reuse initialization');check(d['AA640']['maxTileFenceMs']<15000,'640 tiles remain within ordinary budget');d['after640']=settled(p);check(d['after640']['resolution']=={'width':640,'height':480},'full requested final resolution');capture(p,'aa640-reused-offscreen-domain')
 scenario('aa-after-qa-drain-320-640',aa_after_qa)
 def cancellation_and_loss(p,d):
  start(p,{'width':320,'height':240,'samplesPerAxis':2});p.wait_for_function(Q+".snapshot().job?.status==='initializing'",timeout=10000);d['initializing']=quality(p);t=time.monotonic();p.evaluate(Q+'.cancel()');cancelled=p.evaluate('window.__qualityResult');d['cancelWallSeconds']=time.monotonic()-t;check(not cancelled['ok'] and cancelled['name']=='AbortError','cancel rejects initialization job');d['cancelled']=quality(p);check(d['cancelled']['job']['done']==0,'no partial tiles counted');check(d['cancelWallSeconds']<5,'cancel is responsive, not a blocking readback');p.wait_for_function(G+'.snapshot().pendingFence===false',timeout=70000);settled(p);capture(p,'cancelled-offscreen-previous-complete-frame')
  p.evaluate(A+'.setCase("kcc-hosted")');p.wait_for_function(A+'.ready',timeout=90000);settled(p);d['beforeLoss']=state(p);start(p,{'width':320,'height':240,'samplesPerAxis':2});p.wait_for_function(Q+".snapshot().job?.status==='initializing'",timeout=10000);p.evaluate(G+'.test.loseContext("now")');interrupted=p.evaluate('window.__qualityResult');check(not interrupted['ok'] and interrupted['name']=='AbortError','loss rejects pending quality job');p.wait_for_timeout(100);p.evaluate(G+'.test.restoreContext()');p.wait_for_function(A+'.ready',timeout=90000);settled(p);d['restored']=state(p);check(d['restored']['generation']>d['beforeLoss']['generation'],'new context generation');check(d['restored']['resources']['qualityInitialization']['required'] is True,'restoration cannot reuse old RGBA8 initialization');start(p,{'width':64,'height':48,'samplesPerAxis':2});fresh=p.evaluate('window.__qualityResult');check(fresh['ok'],'quality work after full rebuild');check(fresh['value']['initialization']['reused'] is False,'fresh FBO domain actually initialized');d['postRestoreAA']=fresh['value'];capture(p,'fresh-offscreen-domain-after-restoration')
 scenario('offscreen-cancel-and-loss-restoration',cancellation_and_loss)
 browser.close()
r['status']='passed_actual_material_lifecycle_checks' if not r['failures'] else 'failed';save();print(json.dumps({'status':r['status'],'failures':r['failures'],'screenshots':len(r['screenshots'])}));raise SystemExit(1 if r['failures'] else 0)
