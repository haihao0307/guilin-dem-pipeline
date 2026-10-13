// Restored accepted R02 Warren truss, expressed in the R04 station frame.
// Source source-Z becomes current X; beam width/depth are swapped accordingly,
// retaining real section orientation rather than copying numerical labels only.
export function archTrussMembers({span=20,eave=9.25,radius=12.8,depth=.72,segments=24}={}){
 if(![span,eave,radius,depth].every(Number.isFinite)||radius<=span/2||depth<=0||segments!==24)throw Error('Invalid accepted truss parameters');
 const half=span/2,cy=eave-Math.sqrt(radius*radius-half*half),parts=[];
 const point=(t,drop=0)=>{const x=-half+span*t;return[x,cy+Math.sqrt(Math.max(0,radius*radius-x*x))-drop,0];};
 const beam=(id,a,b,axialWidth,inPlaneDepth)=>parts.push({id,type:'beam',a,b,width:inPlaneDepth,depth:axialWidth,sourceSection:{width:axialWidth,depth:inPlaneDepth},materialRole:'structural-iron'});
 for(let i=0;i<segments;i++){
  const a=point(i/segments),b=point((i+1)/segments),c=point(i/segments,depth),d=point((i+1)/segments,depth);
  beam('upper-'+i,a,b,.115,.18);beam('lower-'+i,c,d,.10,.16);
  beam('web-'+i,i%2?a:c,i%2?d:b,.062,.065);
  if(i%2===0)beam('vertical-'+i,a,c,.055,.06);
 }
 return parts;
}
const f=x=>Math.abs(x)<1e-14?'0.':Number.isInteger(x)?x+'.':String(x),v=a=>'vec3<f32>('+a.map(f).join(',')+')';
export function archTrussWGSL(options={}){
 let s='fn completeWarrenTruss(p:vec3<f32>)->ColumnMemberHit{var h=ColumnMemberHit(1e5,-1.);var d=0.;\n';
 for(const[i,m]of archTrussMembers(options).entries())s+=`// ${m.id}: accepted real section (${m.sourceSection.width}m axial, ${m.sourceSection.depth}m in-plane)\nd=memberBeam(p,${v(m.a)},${v(m.b)},${f(m.width)},${f(m.depth)});if(d<h.d){h=ColumnMemberHit(d,${f(i)});}\n`;
 return s+'return h;}\n';
}
