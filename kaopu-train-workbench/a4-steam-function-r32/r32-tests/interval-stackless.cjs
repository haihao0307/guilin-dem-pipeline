'use strict';
// Test candidate only. Exact dyadic left-first traversal without indexed float arrays.
// Each node recomputes its bounds using the same rounded midpoint sequence as the
// legacy stack; it does NOT use t+(end-t)*fraction. Valid model chord depth < 30.
const glsl=`float rootA=t,rootB=end;int depth=0;int address=0;bool allDone=false;
for(int i=0;i<4096;i++){
 if(allDone)break;
 float a=rootA,b=rootB;
 for(int bit=29;bit>=0;bit--){if(bit<depth){float mid=(a+b)*.5;if(((address>>bit)&1)==0)b=mid;else a=mid;}}
 vec3 pa=eye+rd*a,pb=eye+rd*b;bool descend=false;
 if(!(min(pa.x,pb.x)>cutX)){
  vec2 rr=ranges(min(pa,pb),max(pa,pb));
  if(!(rr.x>0.)){
   if(b-a<0.0005){float mid=(a+b)*.5;vec3 pm=eye+rd*mid;if(pm.x<=cutX&&field(pm)<=0.0005){hit=mid;break;}}
   else{descend=true;}
  }
 }
 if(descend&&depth<30){address*=2;depth++;continue;}
 for(int climb=0;climb<31;climb++){if(depth==0){allDone=true;break;}if((address&1)==0){address++;break;}address>>=1;depth--;}
}`;
const midpoint=(a,b,F)=>F(F(a+b)*F(.5));
function legacy(start,end,inspect,F=Math.fround){const a=[F(start)],b=[F(end)],trace=[];let top=1,hit=null;for(let i=0;i<4096;i++){if(!top)break;top--;const lo=a[top],hi=b[top],answer=inspect(lo,hi);trace.push([lo,hi,answer]);if(answer==='hit'){hit=midpoint(lo,hi,F);break}if(answer==='split'){const m=midpoint(lo,hi,F);if(top<30){a[top]=m;b[top++]=hi;a[top]=lo;b[top++]=m;}}}return{trace,hit};}
function stackless(start,end,inspect,F=Math.fround){start=F(start);end=F(end);const trace=[];let address=0,depth=0,done=false,hit=null,maxDepth=0;for(let i=0;i<4096;i++){if(done)break;let lo=start,hi=end;for(let bit=29;bit>=0;bit--)if(bit<depth){const m=midpoint(lo,hi,F);if(((address>>bit)&1)===0)hi=m;else lo=m}const answer=inspect(lo,hi);trace.push([lo,hi,answer]);maxDepth=Math.max(maxDepth,depth);if(answer==='hit'){hit=midpoint(lo,hi,F);break}if(answer==='split'&&depth<30){address*=2;depth++;continue}for(let climb=0;climb<31;climb++){if(depth===0){done=true;break}if((address&1)===0){address++;break}address>>=1;depth--;}}return{trace,hit,maxDepth};}
module.exports={glsl,legacy,stackless,midpoint};
