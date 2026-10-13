// Complete accepted R02 bench construction; authored longer stock is explicit.
// Source frame X = length/grain, Y = up, Z = front/back. No mesh or texture.
export function stationBenchMembers({deck=.85,length=3.4,seat=.46}={}){
 if(![deck,length,seat].every(Number.isFinite)||length<=.56||seat<=.1)throw Error('Invalid bench construction');
 const a=[];
 for(let k=0;k<5;k++)a.push({id:'seat-slat-'+k,type:'box',center:[0,deck+seat,-.27+k*.115],size:[length,.038,.096],materialRole:'aged-wood',stock:'seat',slat:k,grainOffset:[0,0,k*.115]});
 for(let k=0;k<5;k++)a.push({id:'back-slat-'+k,type:'box',center:[0,deck+seat+.10+k*.10,.28+k*.012],size:[length,.075,.033],materialRole:'aged-wood',stock:'back',slat:k,grainOffset:[0,k*.10,0]});
 const beam=(id,a0,b,width,depth)=>a.push({id,type:'beam',a:a0,b,width,depth,materialRole:'cast-iron'});
 for(const s of[-1,1]){const x=s*(length/2-.28);beam('front-leg-'+s,[x,deck+.03,-.25],[x,deck+seat-.03,-.18],.044,.048);beam('rear-leg-'+s,[x,deck+.03,.30],[x,deck+seat+.70,.35],.046,.052);beam('seat-support-'+s,[x,deck+seat-.03,-.3],[x,deck+seat-.03,.33],.055,.04);}
 return a;
}
const f=x=>Math.abs(x)<1e-14?'0.':Number.isInteger(x)?x+'.':String(x),v=a=>'vec3<f32>('+a.map(f).join(',')+')';
export function stationBenchWGSL(options={}){
 const parts=stationBenchMembers(options);
 // Do not choose a nominal slat then add displacement. Every possible timber
 // member competes with its own stock coordinates and the common state first.
 let s='fn completeBenchTimber(worldP:vec3<f32>,p:vec3<f32>,stockBase:f32,roleBase:f32)->HitField{var h=HitField(1e5,4u,p,138.,1e5,vec3<f32>(1.),0.);var best=1e5;let st=resolveStationState(worldP);var q=vec3<f32>(0.);var d=0.;var candidate=h;var physical=0.;\n';
 for(const m of parts.filter(x=>x.type==='box')){
  const back=m.stock==='back';s+=`// ${m.id}: physical member, shared ${m.stock} stock\nq=p-${v(m.center)};d=box(q,${v(m.size.map(x=>x/2))});candidate=HitField(d,4u,q,roleBase+${back?'1.':'0.'},d,${v(m.size.map(x=>x/2))},(stockBase*2.+${back?'1.':'0.'})*8.+${f(m.slat)});physical=stationCandidatePhysicalDistance(candidate,worldP,st);if(physical<best){best=physical;h=candidate;}\n`;
 }
 s+='return h;}\nfn completeBenchIron(p:vec3<f32>)->ColumnMemberHit{var h=ColumnMemberHit(1e5,-1.);var d=0.;\n';
 for(const[i,m]of parts.filter(x=>x.type==='beam').entries())s+=`// ${m.id}: source cast leg or load-bearing seat crosspiece\nd=memberBeam(p,${v(m.a)},${v(m.b)},${f(m.width)},${f(m.depth)});if(d<h.d){h=ColumnMemberHit(d,${f(i)});}\n`;
 return s+'return h;}\n';
}

