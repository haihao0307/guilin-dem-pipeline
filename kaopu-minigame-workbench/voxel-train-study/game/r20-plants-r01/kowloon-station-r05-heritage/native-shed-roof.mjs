// Complete R02 panel and purlin construction in the current station frame.
// Panels are analytic bounded slab fields, never sampled triangle surfaces.
export function shedRoofMembers({span=20,eave=9.25,radius=12.8,bay=7.5}={}){
 const half=span/2,cy=eave-Math.sqrt(radius*radius-half*half),y=x=>cy+Math.sqrt(Math.max(0,radius*radius-x*x));
 const panels=[];for(let i=0;i<20;i++){if(i===9||i===10)continue;const x0=-half+i*span/20,x1=-half+(i+1)*span/20;panels.push({id:'panel-'+i,x0,x1,y0:y(x0)+.08,y1:y(x1)+.08,thickness:.035,axialLength:bay,materialRole:'roof-metal'});}
 const purlins=Array.from({length:9},(_,i)=>{const x=-half+i*span/8;return{id:'purlin-'+i,x,y:y(x)-.10,widthX:.14,heightY:.075,axialLength:bay,materialRole:'structural-iron'};});
 return{panels,purlins,cy};
}
const f=x=>{const value=Math.abs(x)<1e-14?'0.':Number.isInteger(x)?x+'.':String(x);return x<0?'('+value+')':value;};
export function shedRoofWGSL(options={}){
 const r=shedRoofMembers(options);let s='fn completeBarrelPanel(p:vec3<f32>)->ColumnMemberHit{var h=ColumnMemberHit(1e5,-1.);var d=0.;\n';
 for(const[i,m]of r.panels.entries()){const slope=(m.y1-m.y0)/(m.x1-m.x0),intercept=m.y0-slope*m.x0,norm=Math.hypot(1,slope);s+=`// ${m.id}: 35mm vertical assembly depth, same physical panel/material\nlet top${i}=${f(slope)}*p.x+${f(intercept)};d=max(max((p.y-top${i})/${f(norm)},(top${i}-${f(m.thickness)}-p.y)/${f(norm)}),max(${f(m.x0)}-p.x,p.x-${f(m.x1)}));if(d<h.d){h=ColumnMemberHit(d,${f(i)});}\n`;}
 s+='return h;}\nfn completePurlins(p:vec3<f32>,halfLength:f32)->ColumnMemberHit{var h=ColumnMemberHit(1e5,-1.);var d=0.;\n';
 for(const[i,m]of r.purlins.entries())s+=`// ${m.id}: full longitudinal load-bearing member\nd=box(p-vec3<f32>(${f(m.x)},${f(m.y)},0.),vec3<f32>(${f(m.widthX/2)},${f(m.heightY/2)},halfLength));if(d<h.d){h=ColumnMemberHit(d,${f(i)});}\n`;
 return s+'return h;}\n';
}

