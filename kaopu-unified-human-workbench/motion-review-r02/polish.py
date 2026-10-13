from pathlib import Path
import re
P=Path(__file__).resolve().parent
def one(s,a,b):
    assert s.count(a)==1,(a[:90],s.count(a))
    return s.replace(a,b)
p=P/'Workbench.mjs';s=p.read_text()
if 'R02 monotonic wall-clock' not in s:
    s=one(s,'tick(now){this.raf=requestAnimationFrame(t=>this.tick(t));const dt=now-this.last;','tick(now){this.raf=requestAnimationFrame(t=>this.tick(t));now=performance.now();/* R02 monotonic wall-clock */const dt=Math.max(0,now-this.last);')
    s=one(s,'(now-this.playAnchor)/1000*this.speed','Math.max(0,now-this.playAnchor)/1000*this.speed')
    s=one(s,'this.apply(0);this.status(', 'this.apply(0);this.view(this.angle);this.status(')
    p.write_text(s)
p=P/'verify.cjs';s=p.read_text()
if "captureMethod:'actual synchronous WebGL canvas" not in s:
    s=one(s,"const report={version:'MOTION-REVIEW-R02',","const report={version:'MOTION-REVIEW-R02',captureMethod:'actual synchronous WebGL canvas PNG, not compositor or physical-phone screenshot',")
    a="const c=await context.newCDPSession(p),x=await bounded(c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true}),30000,name);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(x.data,'base64'));await c.detach();"
    b="const png=await bounded(p.evaluate(()=>{const v=motionReview.viewer;v.render();v.renderer.getContext().finish();return v.renderer.domElement.toDataURL('image/png');}),45000,name+' actual canvas');assert(png.startsWith('data:image/png;base64,'),'Actual canvas capture missing');fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png.split(',')[1],'base64'));"
    s=one(s,a,b);p.write_text(s)
print('R02 clock and camera corrected; visual evidence is actual WebGL canvas output')
