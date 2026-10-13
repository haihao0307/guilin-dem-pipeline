// Complete accepted R02 tower construction. This emits semantic parameters only,
// never teacher vertices, triangles, mesh objects or sampled textures.
// Tower centre is local zero; exterior placement belongs to the common site.
export function clockTowerMembers({width=6.2}={}){if(!Number.isFinite(width)||width<5||width>8)throw Error('Invalid tower width');const parts=[],clockHands=[];
 const emit=(id,shape,role,feature,color)=>{parts.push({id,shape,surface:{role,feature,color,component:id,metricFrame:{origin:shape.center||shape.a||[0,0,0]},ageYears:35,rainExposure:feature.includes('cornice')?.7:.35,wetness:.10,repairFraction:.2}});};
 const box=(id,c,d,role='masonry-trim',feature='cut-stone-course',color)=>emit(id,{type:'box',center:c,size:d},role,feature,color);
 const beam=(id,a,b,w,d,role='masonry-trim',feature='linear-moulding')=>emit(id,{type:'beam',a,b,width:w,depth:d},role,feature);
 const cylinder=(id,c,r,h,role='masonry-trim',rt=r,seg=32)=>emit(id,{type:'cylinder',center:c,radius:r,radiusTop:rt,height:h,segments:seg},role,'turned-profile');
 const sphere=(id,c,r,scale,role)=>emit(id,{type:'sphere',center:c,radius:r,scale,segments:24},role,'dome-profile');
 function arch(id,c,r,w,d,axis='x',role='masonry-trim'){emit(id,{type:'arch-band',center:c,radius:r,width:w,depth:d,axis},role,'voussoir-arch');}
 function column(id,x,z,bottom,height,r=.41){
  box(id+'-plinth',[x,bottom+.14,z],[r*2.55,.28,r*2.55]);cylinder(id+'-base',[x,bottom+.35,z],r*1.2,.16);
  emit(id+'-shaft',{type:'fluted-column',center:[x,bottom+.47+height/2,z],radius:r,height,flutes:20,depth:.022,segments:80},'masonry-trim','fluted-stone-column');
  cylinder(id+'-neck',[x,bottom+height+.53,z],r*1.12,.15);cylinder(id+'-capital',[x,bottom+height+.72,z],r*1.1,.24,'masonry-trim',r*1.4);
  box(id+'-abacus',[x,bottom+height+.91,z],[r*3,.16,r*3]);
 }
 // Original clock tower proportions: solid shaft, four clock faces, open belfry, dome.
 const tx=0,tz=0,w=width,shaftTop=28.6;
 box('clock-base',[tx,.65,tz],[w+1.25,1.30,w+1.25]);box('clock-shaft',[tx,(shaftTop+1.3)/2,tz],[w-.28,shaftTop-1.3,w-.28],'tower-brick','tower-masonry');
 for(const sx of [-1,1])for(const sz of [-1,1]){
  box('tower-pilaster-'+sx+'-'+sz,[tx+sx*(w/2-.20),14.9,tz+sz*(w/2-.20)],[.56,27.1,.56]);
  for(let y=1.6;y<shaftTop;y+=1.24)box('tower-quoin-'+sx+'-'+sz+'-'+y,[tx+sx*(w/2-.14),y,tz+sz*(w/2-.14)],[.70,.13,.70]);
 }
 for(const[y,ww,hh]of [[8.1,w+.4,.32],[18.9,w+.55,.38],[28.6,w+1.0,.45],[29.05,w+.68,.3],[31.0,w+.20,.38],[38.2,w+.28,.35],[39.1,w+.12,.30]])box('tower-cornice-'+y,[tx,y,tz],[ww,hh,ww]);
 for(let face=0;face<4;face++){
  const angle=face*Math.PI/2,normal=[Math.sin(angle),0,Math.cos(angle)],at=[tx+normal[0]*(w/2+.20),25.0,tz+normal[2]*(w/2+.20)],axis=face%2?'x':'z';
  emit('clock-dial-'+face,{type:'disc',center:at,radius:1.36,axis,reverse:face>=2},'clock-face','enamel-clock-dial');
  emit('clock-dial-rim-'+face,{type:'ring',center:at.map((v,i)=>v+normal[i]*.045),radius:1.39,tube:.075,segments:64,axis},'masonry-trim','clock-rim');
  for(let i=0;i<60;i++){const a=i*Math.PI/30,r=i%5?1.22:1.17,l=i%5?.07:.20;const u=Math.sin(a)*r,v=Math.cos(a)*r;const a3=axis==='z'?[at[0]+u,at[1]+v,at[2]+normal[2]*.03]:[at[0]+normal[0]*.03,at[1]+v,at[2]+u];emit('clock-tick-'+face+'-'+i,{type:'oriented-box',center:a3,size:axis==='z'?[i%5?.023:.065,l,.026]:[.026,l,i%5?.023:.065],rotation:axis==='z'?[0,0,-a]:[a,0,0]},'clock-ink','dial-index');}
  clockHands.push({face,center:at,axis,normal});
  // Narrow louvred opening directly above each clock, with complete jambs.
  for(let i=-1;i<=1;i++){const c=axis==='z'?[tx+i*.53,27.62,tz+normal[2]*(w/2+.02)]:[tx+normal[0]*(w/2+.02),27.62,tz+i*.53];box('tower-clock-vent-'+face+'-'+i,c,axis==='z'?[.30,1.0,.13]:[.13,1,.30],'structural-iron','louvre-shadow');}
 }
 box('tower-belfry-base',[tx,30.1,tz],[w-.9,1.4,w-.9]);
 for(const sx of [-1,1])for(const sz of [-1,1]){column('belfry-column-'+sx+'-'+sz,tx+sx*(w/2-.85),tz+sz*(w/2-.85),31.2,5.6,.27);}
 for(let face=0;face<4;face++){
  const n=[Math.sin(face*Math.PI/2),0,Math.cos(face*Math.PI/2)],axis=face%2?'x':'z',c=[tx+n[0]*(w/2-.78),34.8,tz+n[2]*(w/2-.78)];arch('belfry-arch-'+face,c,1.63,.24,.40,axis);
  for(let i=0;i<7;i++){const a=axis==='z'?[tx-1.22,32+i*.45,c[2]]:[c[0],32+i*.45,tz-1.22],b=axis==='z'?[tx+1.22,32+i*.45,c[2]]:[c[0],32+i*.45,tz+1.22];beam('belfry-louvre-'+face+'-'+i,a,b,.16,.16,'structural-iron','belfry-louvre');}
 }
 sphere('tower-dome',[tx,39.0,tz],2.62,[1,1.10,1],'roof-copper');cylinder('dome-crown',[tx,41.85,tz],.23,.7,'roof-copper',.16);cylinder('tower-finial',[tx,43.1,tz],.055,2.0,'brass',.022,12);

 return{parts,clockHands};
}
const f=x=>Math.abs(x)<1e-13?'0.':Number.isInteger(x)?x+'.':String(x),v=a=>'vec3<f32>('+a.map(f).join(',')+')';
function field(s){const q=s.center?`(p-${v(s.center)})`:'p';
 if(s.type==='box')return`box(${q},${v(s.size.map(n=>n/2))})`;
 if(s.type==='beam')return`memberBeam(p,${v(s.a)},${v(s.b)},${f(s.width)},${f(s.depth)})`;
 if(s.type==='cylinder')return`memberCone(${q},${f(s.radius)},${f(s.radiusTop??s.radius)},${f(s.height)},0u)`;
 if(s.type==='fluted-column')return`cyl(${q},${f(s.radius)}-${f(s.depth)}*(.5+.5*cos(atan2(${q}.z,${q}.x)*${f(s.flutes)})),${f(s.height/2)})`;
 const plane=s.axis==='x'?`${q}.zyx`:q;
 if(s.type==='ring')return`length(vec2<f32>(length(${plane}.xy)-${f(s.radius)},${plane}.z))-${f(s.tube)}`;
 if(s.type==='arch-band')return`max(max(length(${plane}.xy)-${f(s.radius+s.width)},${f(s.radius)}-length(${plane}.xy)),max(-${plane}.y,abs(${plane}.z)-${f(s.depth/2)}))`;
 if(s.type==='disc')return`max(length(${plane}.xy)-${f(s.radius)},abs(${plane}.z)-.006)`;
 if(s.type==='sphere')return`max(abs(length(${q}/${v(s.scale)})-${f(s.radius)})-.0006,-${q}.y)`;
 throw Error('Missing implicit tower primitive '+s.type);
}
export function clockTowerWGSL(options={}){
 const {parts}=clockTowerMembers(options),width=options.width??6.2;
 // The source half ellipsoid had no sheet gauge. The explicit native sheet is
 // 1.2mm in radial level-set coordinates (1.2–1.32mm normal thickness), authored
 // pending copper material calibration. It is one solid, never an extra skin.
 const groups={stone:'masonry-trim',brick:'tower-brick',iron:'structural-iron',copper:'roof-copper',brass:'brass',dial:'clock-face'};let text='';
 for(const[name,role]of Object.entries(groups)){
  text+=`fn completeTower${name}(p:vec3<f32>)->ColumnMemberHit{var h=ColumnMemberHit(1e5,-1.);var d=0.;\n`;
  for(const[i,m]of parts.entries()){if(m.surface.role!==role||m.id.startsWith('tower-quoin-'))continue;text+=`// ${m.id}: ${role}, ${m.surface.feature}\nd=${field(m.shape)};if(d<h.d){h=ColumnMemberHit(d,${f(i)});}\n`;}
  if(name==='stone')text+=`// All88 source corner quoins: nearest of22 equal rows and four corners is exact.\nlet q=vec3<f32>(abs(p.x)-${f(width/2-.14)},rep(p.y-1.6,1.24,0.,21.),abs(p.z)-${f(width/2-.14)});d=box(q,vec3<f32>(.35,.065,.35));if(d<h.d){h=ColumnMemberHit(d,1000.+clamp(round((p.y-1.6)/1.24),0.,21.));}\n`;
  text+='return h;}\n';
 }
 text+=`// Source60 dial indices, never a twelve-spoke sinusoid surrogate.
fn completeTowerDialIndices(q:vec3<f32>)->ColumnMemberHit{var h=ColumnMemberHit(1e5,-1.);for(var i=0u;i<60u;i++){let a=f32(i)*3.14159265359/30.;let minor=i%5u!=0u;let r=select(1.17,1.22,minor);let p=q-vec3<f32>(sin(a)*r,cos(a)*r,.03);let rotated=vec3<f32>(cos(a)*p.x-sin(a)*p.y,sin(a)*p.x+cos(a)*p.y,p.z);let d=box(rotated,vec3<f32>(select(.0325,.0115,minor),select(.10,.035,minor),.013));if(d<h.d){h=ColumnMemberHit(d,f32(i));}}return h;}
fn completeTowerHand(q:vec3<f32>,angle:f32,minute:bool)->f32{let c=cos(angle);let s=sin(angle);let p=vec3<f32>(c*q.x-s*q.y,s*q.x+c*q.y,q.z);return box(p-vec3<f32>(0.,select(.31,.44,minute),select(0.,.025,minute)),vec3<f32>(select(.045,.0275,minute),select(.385,.51,minute),.0125));}
`;
 return text;
}

