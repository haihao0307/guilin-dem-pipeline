/** Same R02 Voronoi algorithm with scalar vector helpers; original summation order. */
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>((0+a[0]*b[0])+a[1]*b[1])+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]);
export function closestTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(dot(cross,cross)<1e-32)return closestDegenerate(p,a,b,c);const ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);let w;
 if(d1<=0&&d2<=0)w=[1,0,0];else{const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
 if(d3>=0&&d4<=d3)w=[0,1,0];else{const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);w=[1-v,v,0];}else{const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
 if(d6>=0&&d5<=d6)w=[0,0,1];else{const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0){const v=d2/(d2-d6);w=[1-v,0,v];}else{const va=d3*d6-d5*d4;
 if(va<=0&&d4-d3>=0&&d5-d6>=0){const v=(d4-d3)/((d4-d3)+(d5-d6));w=[0,1-v,v];}else{const total=va+vb+vc;if(Math.abs(total)<1e-30)return closestDegenerate(p,a,b,c);const v=vb/total,u=vc/total;w=[1-v-u,v,u];}}}}}}
 const q=[a[0]*w[0]+b[0]*w[1]+c[0]*w[2],a[1]*w[0]+b[1]*w[1]+c[1]*w[2],a[2]*w[0]+b[2]*w[1]+c[2]*w[2]];return {point:q,barycentric:w,distance:len(sub(q,p))};
}
function closestDegenerate(p,a,b,c){let best;for(const [i,j] of [[0,1],[1,2],[2,0]]){const v=[a,b,c],d=sub(v[j],v[i]),t=Math.max(0,Math.min(1,dot(sub(p,v[i]),d)/(dot(d,d)||1))),q=add(v[i],mul(d,t)),distance=len(sub(q,p));if(!best||distance<best.distance){const w=[0,0,0];w[i]=1-t;w[j]=t;best={point:q,barycentric:w,distance};}}return best;}
