// Analytic reconstruction of every member of the accepted R02 cast-iron column.
// Source: frozen station-recipe.mjs column(), f31df978916876205355664593b0299f027188ad.
// Template coordinates are the frozen source frame (X along-track, Z across).
// completeCastColumn transforms the current station query back by a proper rotation.
// Parameterized construction only: no vertices, triangles, imported geometry or images.
const V=(x,y,z)=>[x,y,z];
export function castColumnMembers({deck=.85,eave=9.25}={}){
 if(![deck,eave].every(Number.isFinite)||eave-deck<2)throw Error('Invalid cast column datums');
 const a=[],add=(id,shape)=>a.push({id,materialRole:'cast-iron',...shape});
 add('foot',{type:'box',center:V(0,deck+.12,0),size:V(.83,.24,.83)});
 add('plinth',{type:'cone',center:V(0,deck+.46,0),bottomRadius:.34,topRadius:.25,height:.44,sides:8});
 add('shaft',{type:'flute',center:V(0,(deck+.66+eave-.45)/2,0),radius:.215,height:eave-.45-deck-.66,flutes:12,depth:.012});
 for(const[i,dy]of[.70,1.48,3.1,eave-deck-.72].entries()){
  add('collar-'+i,{type:'cylinder',center:V(0,deck+dy,0),radius:.26,height:.135});
  add('collar-edge-'+i,{type:'torus',center:V(0,deck+dy+.082,0),radius:.258,tube:.023});
  for(let j=0;j<4;j++){const angle=j*Math.PI/2,n=V(Math.cos(angle),0,Math.sin(angle));add('bolt-'+i+'-'+j,{type:'hex',center:n.map((v,k)=>k===1?deck+dy:v*.266),direction:n,radius:.044,depth:.027});}
 }
 add('neck',{type:'cylinder',center:V(0,eave-.31,0),radius:.29,height:.18});
 add('capital',{type:'cone',center:V(0,eave-.10,0),bottomRadius:.29,topRadius:.46,height:.27,sides:12});
 add('abacus',{type:'box',center:V(0,eave+.075,0),size:V(.96,.12,.70)});
 for(const sign of[-1,1])add('branch-'+sign,{type:'beam',a:V(0,eave-.45,0),b:V(0,eave+.5,sign*.70),width:.12,depth:.18});
 return a;
}
const f=x=>Math.abs(x)<1e-14?'0.':Number.isInteger(x)?x+'.':String(x),v=a=>'vec3<f32>('+a.map(f).join(',')+')';
const HELPERS=String.raw`
struct ColumnMemberHit{d:f32,member:f32,}
fn memberSegment2(p:vec2<f32>,a:vec2<f32>,b:vec2<f32>)->f32{let v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
fn memberCone(p:vec3<f32>,r0:f32,r1:f32,h:f32,sides:u32)->f32{
 if(sides>=3u){let ap=cos(3.14159265359/f32(sides));let slope=(r1-r0)*ap/h;var d=abs(p.y)-h*.5;for(var k=0u;k<sides;k++){let angle=(f32(k)+.5)*6.28318530718/f32(sides);d=max(d,(dot(p.xz,vec2<f32>(sin(angle),cos(angle)))-r0*ap-slope*(p.y+h*.5))/sqrt(1.+slope*slope));}return d;}
 let q=vec2<f32>(length(p.xz),p.y);let side=memberSegment2(q,vec2<f32>(r0,-h*.5),vec2<f32>(r1,h*.5));
 let bottom=length(vec2<f32>(max(q.x-r0,0.),q.y+h*.5));let top=length(vec2<f32>(max(q.x-r1,0.),q.y-h*.5));
 let inside=abs(q.y)<=h*.5&&q.x<=mix(r0,r1,(q.y+h*.5)/h);return min(side,min(bottom,top))*select(1.,-1.,inside);
}
// Same orientation as Quaternion.setFromUnitVectors(+Y,direction) in R02.
fn memberBeamFrame(p:vec3<f32>,center:vec3<f32>,axis:vec3<f32>)->vec3<f32>{let w=normalize(axis);var u=vec3<f32>(-1.,0.,0.);if(w.y>-.999999){u=vec3<f32>(1.-w.x*w.x/(1.+w.y),-w.x,-w.z*w.x/(1.+w.y));}let v=cross(u,w);let q=p-center;return vec3<f32>(dot(q,u),dot(q,w),dot(q,v));}
fn memberBeam(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>,width:f32,depth:f32)->f32{return box(memberBeamFrame(p,(a+b)*.5,b-a),vec3<f32>(width*.5,length(b-a)*.5,depth*.5));}
fn memberHex(p:vec3<f32>,axis:vec3<f32>,r:f32,depth:f32)->f32{let q=memberBeamFrame(p,vec3<f32>(0.),axis);var side=-1e5;for(var k=0u;k<6u;k++){let a=(f32(k)+.5)*1.0471975512;side=max(side,dot(q.xz,vec2<f32>(sin(a),cos(a)))-r*.8660254038);}let d=vec2<f32>(side,abs(q.y)-depth*.5);return min(max(d.x,d.y),0.)+length(max(d,vec2<f32>(0.)));}
`;
export function castColumnWGSL(options={}){
 const parts=castColumnMembers(options);let text=HELPERS+'\nfn completeCastColumn(stationP:vec3<f32>)->ColumnMemberHit{let p=vec3<f32>(-stationP.z,stationP.y,stationP.x);var h=ColumnMemberHit(1e5,-1.);var d=0.;\n';
 for(const[i,s]of parts.entries()){
  const p=s.center?'(p-'+v(s.center)+')':'p';let d;
  if(s.type==='box')d=`box(${p},${v(s.size.map(x=>x/2))})`;
  else if(s.type==='cylinder')d=`cyl(${p},${f(s.radius)},${f(s.height/2)})`;
  else if(s.type==='cone')d=`memberCone(${p},${f(s.bottomRadius)},${f(s.topRadius)},${f(s.height)},${s.sides||0}u)`;
  else if(s.type==='flute')d=`cyl(${p},${f(s.radius)}-${f(s.depth)}*(.5+.5*cos(atan2(p.z,p.x)*${f(s.flutes)})),${f(s.height/2)})`;
  else if(s.type==='torus')d=`length(vec2<f32>(length(p.xz)-${f(s.radius)},p.y-${f(s.center[1])}))-${f(s.tube)}`;
  else if(s.type==='hex')d=`memberHex(${p},${v(s.direction)},${f(s.radius)},${f(s.depth)})`;
  else if(s.type==='beam')d=`memberBeam(p,${v(s.a)},${v(s.b)},${f(s.width)},${f(s.depth)})`;
  else throw Error('Unbound column member '+s.id);
  text+=`// ${s.id}: complete cast-iron member ${i}\nd=${d};if(d<h.d){h=ColumnMemberHit(d,${f(i)});}\n`;
 }
 return text+'return h;}\n';
}
export const CAST_COLUMN_WGSL=castColumnWGSL();
