/** ET11 transfer of the eye laboratory's METHODS, not its identity mesh.
 * Source: ET08 independent curves, ET09 section fields, ET10 tissue coordinates.
 * All sizes are relative to the current generator's measured eyelid width.
 * Not a claim of measured individual anatomy or tissue mechanics. */
export const KNOWLEDGE_VERSION='kaopu/eye-knowledge@1';
export const smooth01=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function makeSpline(nodes){
 const n=nodes.length,h=[],d=[],m=[];
 if(n<2||nodes[0][0]!==0||nodes[n-1][0]!==1)throw Error('Contour endpoints must span [0,1]');
 for(let i=0;i<n-1;i++){h[i]=nodes[i+1][0]-nodes[i][0];if(h[i]<=0)throw Error('Unordered contour nodes');d[i]=(nodes[i+1][1]-nodes[i][1])/h[i];}
 m[0]=d[0];m[n-1]=d[n-2];
 for(let i=1;i<n-1;i++){
  if(d[i-1]*d[i]<=0)m[i]=0;
  else{const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];m[i]=(a+b)/(a/d[i-1]+b/d[i]);}
 }
 return s=>{s=Math.max(0,Math.min(1,s));let i=0;while(i<n-2&&s>nodes[i+1][0])i++;const t=(s-nodes[i][0])/h[i],t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*nodes[i][1]+(t3-2*t2+t)*h[i]*m[i]+(-2*t3+3*t2)*nodes[i+1][1]+(t3-t2)*h[i]*m[i+1];};
}
export function sectionOffset({distance,upper,temporal,scale,opening,brow,lid}){
 const d=distance/scale,s=temporal,g=(x,w)=>Math.exp(-(x*x)/(w*w)),arc=Math.pow(Math.max(0,4*s*(1-s)),.7);
 if(upper){
  const free=.00026*g(d,.00072),plate=.00016*g(d-.00175,.0014),fold=-.00025*g(d-(.0038+.00045*s),.0011);
  const arch=.00092*g(d-.010,.0037)-.00026*g(d-.0068,.0022);
  return scale*arc*((free+plate+fold)*opening*lid+arch*brow);
 }
 return scale*arc*opening*lid*(.00014*g(d,.00066)+.00010*g(d-.0013,.0010)-.00015*g(d-.0047-.0018*s,.0020));
}
