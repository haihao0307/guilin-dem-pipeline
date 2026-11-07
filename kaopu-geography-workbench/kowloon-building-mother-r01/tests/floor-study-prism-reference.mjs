/** Test-only exact excerpt of the existing authored prism-distance evaluator. */
const copy=x=>structuredClone(x),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),len=a=>Math.hypot(...a),finite=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function inLoop(p,loop){let inside=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[j],b=loop[i];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function signedPlan(p,loops){let d2=Infinity;for(const loop of loops)for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[j],b=loop[i],ab=sub(b,a),t=clamp(dot(sub(p,a),ab)/dot(ab,ab),0,1);d2=Math.min(d2,dot(sub(p,add(a,mul(ab,t))),sub(p,add(a,mul(ab,t)))));}const inside=inLoop(p,loops[0])&&!loops.slice(1).some(l=>inLoop(p,l));return Math.sqrt(d2)*(inside?-1:1);}
function localPoint(p,r){const q=sub(p,r.origin);return [dot(q,r.u),dot(q,r.v),dot(q,r.w)];}
function prismDistance(r,p){const q=localPoint(p,r),a=signedPlan(q.slice(0,2),r.loops),b=Math.abs(q[2]-(r.range[0]+r.range[1])/2)-(r.range[1]-r.range[0])/2;return Math.hypot(Math.max(a,0),Math.max(b,0))+Math.min(Math.max(a,b),0);}
export {localPoint,prismDistance};
