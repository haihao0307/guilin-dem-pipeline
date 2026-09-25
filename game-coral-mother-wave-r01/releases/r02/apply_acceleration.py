from pathlib import Path
import hashlib
p=Path('game-coral-mother-wave-r01/index.html')
old='fc1eecfb282b5803e011a31144feccfd3f770cb11b9ca03352ebbc99173da231'
new='6fede6c39377042604f128eba80b986dd5a4672b8835b492105a87b70393a921'
b=p.read_bytes();sha=hashlib.sha256(b).hexdigest()
if sha==new:
    print('Already applied',sha)
    raise SystemExit(0)
assert sha==old, 'Unexpected live version; stop for reconciliation'
s=b.decode()
helper=r'''
// Conservative analytic ray entry: reject empty rays before evaluating the full field.
float raySphere(vec3 p,vec3 d,vec3 c,float r){vec3 o=p-c;float A=dot(d,d),B=dot(o,d),C=dot(o,o)-r*r;if(C<=0.)return 0.;float h=B*B-A*C;if(h<0.)return 1e20;float t=(-B-sqrt(h))/A;return t>=0.?t:1e20;}
float rayCapsule(vec3 p,vec3 d,vec3 a,vec3 b,float r){vec3 v=b-a,o=p-a;float L=dot(v,v);if(L<1e-10)return raySphere(p,d,a,r);float ov=dot(o,v)/L,dv=dot(d,v)/L;if(length(o-v*clamp(ov,0.,1.))<=r)return 0.;vec3 u=o-v*ov,w=d-v*dv;float A=dot(w,w),B=dot(u,w),C=dot(u,u)-r*r;float hit=min(raySphere(p,d,a,r),raySphere(p,d,b,r)),h=B*B-A*C;if(A>1e-10&&h>=0.){float t=(-B-sqrt(h))/A,y=ov+t*dv;if(t>=0.&&y>=0.&&y<=1.)hit=min(hit,t);}return hit;}
vec2 rayBox(vec3 p,vec3 d,vec3 c,vec3 r){vec3 inv=(step(vec3(0.),d)*2.-1.)/max(abs(d),vec3(1e-9)),a=(c-r-p)*inv,b=(c+r-p)*inv,lo=min(a,b),hi=max(a,b);return vec2(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));}
float firstPossibleHit(vec3 ro,vec3 rd){vec3 p=(ro-vec3(0.,.055,0.))/shapeScale+shapeOffset,d=rd/shapeScale;float hit=1e20;for(int g=0;g<40;g++){if(g>=groupCount)break;vec2 box=rayBox(p,d,bounds[g].xyz,boxes[g].xyz+vec3(.035));if(box.y<max(0.,box.x)||box.x>hit)continue;vec4 f=planes[g];vec3 o=vec3(p.x*f.x+p.z*f.y,p.y,(-p.x*f.y+p.z*f.x)*f.z),v=vec3(d.x*f.x+d.z*f.y,d.y,(-d.x*f.y+d.z*f.x)*f.z);for(int j=0;j<8;j++){if(j>=ranges[g].y)break;int idx=ranges[g].x+j;vec4 a=texelFetch(dataTex,ivec2(0,idx),0),b=texelFetch(dataTex,ivec2(1,idx),0);hit=min(hit,rayCapsule(o,v,a.xyz,b.xyz,max(a.w,b.w)+.012+.026*f.z));}}return hit;}
'''
assert 'float firstPossibleHit' not in s
s=s.replace('vec3 hash3(vec3 p)',helper+'\nvec3 hash3(vec3 p)')
s=s.replace('float t=max(0.,-bb-sqrt(hh)),farT=-bb+sqrt(hh);bool yes=false;','float t=max(max(0.,-bb-sqrt(hh)),firstPossibleHit(ro,rd)),farT=-bb+sqrt(hh);if(t>farT)discard;bool yes=false;')
s=s.replace('.replace("texelFetch(dataTex,ivec2(0,idx),0)","A[idx]").replace("texelFetch(dataTex,ivec2(1,idx),0)","B[idx]")','.replaceAll("texelFetch(dataTex,ivec2(0,idx),0)","A[idx]").replaceAll("texelFetch(dataTex,ivec2(1,idx),0)","B[idx]")')
s=s.replace('let gpuFence=null;function render(){if(gpuFence){let status=gl.clientWaitSync(gpuFence,0,0);if(status===gl.TIMEOUT_EXPIRED)return false;gl.deleteSync(gpuFence);gpuFence=null;}resize();','''let gpuFence=null,completedFrames=0,renderedTime=-1,renderedMode='',pendingTime=-1,pendingMode='',contextLost=false;
function settleGpu(){if(contextLost||gl.isContextLost())return false;if(!gpuFence)return true;let status=gl.clientWaitSync(gpuFence,0,0);if(status===gl.TIMEOUT_EXPIRED)return false;if(status===gl.WAIT_FAILED){contextLost=true;fail('图形计算未能完成，请重新加载。');return false;}gl.deleteSync(gpuFence);gpuFence=null;completedFrames=frameCount;renderedTime=pendingTime;renderedMode=pendingMode;window.__coralReady=true;$('loading').style.display='none';return true;}
function render(){if(!settleGpu())return false;resize();''')
s=s.replace("frameCount++;$('loading').style.display='none';window.__coralReady=true;gpuFence=","frameCount++;pendingTime=time;pendingMode=mode;gpuFence=")
s=s.replace('function fail(m){','function fail(m){window.__coralReady=false;')
s=s.replace('function loop(now){','function loop(now){settleGpu();if(contextLost)return;')
s=s.replace("e.preventDefault();playing=false;fail('图形上下文中断","e.preventDefault();contextLost=true;playing=false;fail('图形上下文中断")
s=s.replace('frameCount,drawMs,settings:','frameCount,completedFrames,renderedTime,renderedMode,contextLost:contextLost||gl.isContextLost(),drawMs,settings:')
b=s.encode();assert hashlib.sha256(b).hexdigest()==new, 'Patch output does not match locally tested bytes'
p.write_bytes(b)
for name in ['acceleration-patch.b64','acceleration-full.b64']:
    q=p.parent/'releases/r02'/name
    if q.exists() and q.stat().st_size<500:q.unlink()
print('Verified accelerated page',len(b),new)
