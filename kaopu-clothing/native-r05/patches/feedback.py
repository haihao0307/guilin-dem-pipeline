from pathlib import Path
import json
p=Path('kaopu-clothing/native-r05')
f=p/'source/template.html';s=f.read_text()
old='const g=this.gl,tm=performance.now();g.bindTransformFeedback(g.TRANSFORM_FEEDBACK,this.feedback);g.enable(g.RASTERIZER_DISCARD);'
new='const g=this.gl,tm=performance.now();g.bindVertexArray(this.vao);g.bindBuffer(g.ARRAY_BUFFER,null);g.bindTransformFeedback(g.TRANSFORM_FEEDBACK,this.feedback);g.enable(g.RASTERIZER_DISCARD);'
assert s.count(old)==1
f.write_text(s.replace(old,new))
q=p/'source/browser_ci.py';t=q.read_text()
t=t.replace("'httpRequests':[]}","'httpRequests':[],'warnings':[]}")
t=t.replace("page.on('pageerror',lambda e:report['errors'].append(str(e)))","page.on('pageerror',lambda e:report['errors'].append(str(e)))\n  page.on('console',lambda m:report['warnings'].append(m.text) if m.type=='warning' else None)")
oldpix="let bright=0;for(let i=0;i<a.length;i+=4)if(a[i]>30||a[i+1]>30||a[i+2]>30)bright++;return {error:g.getError(),bright,total:a.length/4};"
newpix="let bright=0,left=0,right=0;for(let i=0;i<a.length;i+=4)if(a[i]>30||a[i+1]>30||a[i+2]>30){bright++;if((i/4)%g.drawingBufferWidth<g.drawingBufferWidth/2)left++;else right++;}return {error:g.getError(),bright,left,right,total:a.length/4};"
assert t.count(oldpix)==1
t=t.replace(oldpix,newpix)
t=t.replace("pixels['error']==0 and pixels['bright']/pixels['total']>.02","pixels['error']==0 and pixels['bright']/pixels['total']>.02 and min(pixels['left'],pixels['right'])/pixels['total']>.01")
q.write_text(t)
(p/'FEEDBACK_REGRESSION.json').write_text(json.dumps({'firstRun':43702360169,'observed':'right cloth missing; GL_INVALID_OPERATION 1282','cause':'last surface buffer remained bound to ARRAY_BUFFER while used as transform feedback output','fix':'bind input VAO and clear generic ARRAY_BUFFER before capture','test':'existing GL error and pixel test retained; require visible pixels in BOTH halves','status':'pending rerun'},indent=2))
