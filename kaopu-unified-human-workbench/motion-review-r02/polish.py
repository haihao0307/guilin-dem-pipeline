from pathlib import Path
P=Path(__file__).resolve().parent
def one(s,a,b):
    assert s.count(a)==1,(a[:90],s.count(a))
    return s.replace(a,b)
p=P/'Workbench.mjs';s=p.read_text()
if 'R02 monotonic wall-clock' not in s:
    s=one(s,'tick(now){this.raf=requestAnimationFrame(t=>this.tick(t));const dt=now-this.last;','tick(now){this.raf=requestAnimationFrame(t=>this.tick(t));now=performance.now();/* R02 monotonic wall-clock */const dt=Math.max(0,now-this.last);')
    s=one(s,'(now-this.playAnchor)/1000*this.speed','Math.max(0,now-this.playAnchor)/1000*this.speed')
    s=one(s,'this.apply(0);this.status(', 'this.apply(0);this.view(this.angle);this.status(')
if 'R02 authored relaxed digits' not in s:
    s=one(s,'notify:x=>this.status(x)});','notify:x=>this.status(x),decorate:frame=>this.thumb.repair(frame,row,0)});/* R02 authored relaxed digits, not measured finger capture */')
    s=one(s,"this.selection=row;this.transition=null;", "this.selection=row;this.transition=null;$('mr-hand-side').disabled=!(row.kind==='hand'&&['fist','open','pinch','reach-turn'].includes(row.task));$('mr-thumb').disabled=!(['boxing','excerpt'].includes(row.kind)||row.kind==='hand'&&row.task==='fist');")
    s=one(s,'双手和拳击','双手和拳击') if '双手和拳击' in s else s
p.write_text(s)
p=P/'CapturedCycles.mjs';s=p.read_text()
if 'decorate=x=>x' not in s:
    s=one(s,'notify=()=>{}}={}','notify=()=>{},decorate=x=>x}={}')
    s=one(s,'const result=ctl.evaluate(i/source.fps);','const result=decorate(ctl.evaluate(i/source.fps));')
p.write_text(s)
p=P/'verify.cjs';s=p.read_text()
if "captureMethod:'actual synchronous WebGL canvas" not in s:
    s=one(s,"const report={version:'MOTION-REVIEW-R02',","const report={version:'MOTION-REVIEW-R02',captureMethod:'actual synchronous WebGL canvas PNG, not compositor or physical-phone screenshot',")
    a="const c=await context.newCDPSession(p),x=await bounded(c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true}),30000,name);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(x.data,'base64'));await c.detach();"
    b="const png=await bounded(p.evaluate(()=>{const v=motionReview.viewer;v.render();v.renderer.getContext().finish();return v.renderer.domElement.toDataURL('image/png');}),45000,name+' actual canvas');assert(png.startsWith('data:image/png;base64,'),'Actual canvas capture missing');fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png.split(',')[1],'base64'));"
    s=one(s,a,b)
if 'mobileRenderVerified:false' not in s:
    # Prior attempt's desktop images and runtime checks passed, but resized GPU
    # readback hung. Do not relabel that screenshot as passed. This scope is
    # explicitly DOM layout/controls only; desktop canvas coverage remains.
    s=one(s,"await shot('mobile-viewport',null,.4,'three');", "report.mobileScope={mobileRenderVerified:false,physicalPhoneTested:false,layoutAndControlOnly:true,reason:'prior software GPU resize-readback timeout; not claimed as a passing mobile render'};")
p.write_text(s)
print('R02 clock/camera and relaxed digits; desktop actual-canvas evidence, mobile layout only')
