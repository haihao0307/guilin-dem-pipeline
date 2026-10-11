// Fictional, metre-authored station composition. All dimensions remain recipes.
// No mesh data, photo, façade image or sampled external model is stored here.
export function terminalArchitecture(plan){
 const parts=[],anchors=[],clockHands=[],s=plan.score,stone='#c8b990',brick='#8b5b46',ivory='#e3d6b0';
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
 const hall=plan.hall,x0=hall.min[0],x1=hall.max[0],z0=hall.min[2],z1=hall.max[2],xc=(x0+x1)/2,zc=(z0+z1)/2,hallY=s.platform.top;
 // The real concourse is an unobstructed hall behind the train-buffer line.
 box('terminal-cross-concourse',[(plan.front+x0)/2,hallY/2,zc],[x0-plan.front,hallY,z1-z0],'platform-stone','cross-platform-terminal-apron');
 box('concourse-foundation',[xc,hallY/2,zc],[x1-x0,hallY,z1-z0],'platform-stone','ground-bearing-floor');
 for(let z=z0+.8;z<z1;z+=2.1)box('hall-floor-joint-'+z.toFixed(1),[xc,hallY+.009,z],[x1-x0-.6,.012,.018],'masonry-joint','floor-expansion-joint');
 const bays=8,step=(z1-z0)/bays;
 for(const [side,x]of [['sea',x1],['rail',x0]]){
  for(let i=0;i<=bays;i++){
   const z=z0+i*step;box(side+'-wall-pier-'+i,[x,5.65,z],[.70,9.10,1.25],'hall-brick','sheltered-masonry-pier');
   for(const dz of [-.51,.51])box(side+'-stone-edge-'+i+'-'+dz,[x+(side==='sea'?.40:-.40),5.65,z+dz],[.16,9.25,.18]);
   box(side+'-pier-base-'+i,[x,1.53,z],[1.12,.74,1.5]);box(side+'-pier-cap-'+i,[x,10.18,z],[1.1,.28,1.58]);
  }
  for(let i=0;i<bays;i++){
   const z=z0+(i+.5)*step,r=(step-1.1)/2,ay=6.35;
   arch(side+'-arch-'+i,[x,ay,z],r,.30,.77,'x');
   box(side+'-spandrel-'+i,[x,10.31,z],[.68,1.32,step-1.1],'hall-brick','sheltered-spandrel');
   // Iron framed upper fanlight, actual open lower door rather than a black quad.
   if(side==='sea'){
    for(let q=-2;q<=2;q++)beam(side+'-fanlight-bar-'+i+'-'+q,[x+.08,ay,z+q*.72],[x+.08,ay+Math.sqrt(Math.max(0,(r-.17)**2-(q*.72)**2)),z+q*.72],.026,.033,'structural-iron','fanlight-glazing-bar');
    beam(side+'-transom-'+i,[x+.08,ay,z-r+.16],[x+.08,ay,z+r-.16],.065,.055,'structural-iron');
    if(i!==3&&i!==4){box(side+'-lower-sill-'+i,[x,3.15,z],[.78,.22,step-1.15]);box(side+'-lower-wall-'+i,[x,2.13,z],[.65,1.85,step-1.15],'hall-brick','wall-below-window');}
   }
  }
  for(const[y,t,over]of [[10.96,.25,.40],[11.32,.22,.62],[11.58,.14,.78]])box(side+'-cornice-'+y,[x,y,zc],[.74+over,t,z1-z0+1.25]);
 }
 // Tall roof silhouette stays subordinate to the independent clock tower.
 emit('hall-roof-west',{type:'roof-panel',corners:[[x0-.65,11.8,z0-.55],[xc,14.1,z0-.55],[xc,14.1,z1+.55],[x0-.65,11.8,z1+.55]],thickness:.13},'roof-metal','slate-roof');
 emit('hall-roof-east',{type:'roof-panel',corners:[[xc,14.1,z0-.55],[x1+.65,11.8,z0-.55],[x1+.65,11.8,z1+.55],[xc,14.1,z1+.55]],thickness:.13},'roof-metal','slate-roof');
 beam('hall-roof-ridge',[xc,14.14,z0-.6],[xc,14.14,z1+.6],.16,.21,'roof-metal');
 // Roadside entrance portico. The pediment is geometry with a real oculus.
 const front=z1+.9;
 for(let i=0;i<4;i++)column('portico-'+i,x0+1.55+i*(x1-x0-3.1)/3,front,hallY,7.9,.44);
 for(const[y,t,w]of [[10.18,.50,16.9],[10.55,.20,17.25],[10.84,.17,17.55]])box('portico-entablature-'+y,[xc,y,front],[w,t,1.46]);
 emit('road-pediment',{type:'triangle-prism',center:[xc,10.98,front],width:17.6,rise:4.0,depth:.68,axis:'z'},'hall-brick','pediment-field');
 for(const sign of [-1,1])beam('pediment-rake-'+sign,[xc,15.02,front+.40],[xc+sign*9,10.98,front+.40],.27,.38);
 emit('pediment-oculus-ring',{type:'ring',center:[xc,12.55,front+.46],radius:.72,tube:.12,segments:40,axis:'z'},'masonry-trim','circular-window-arch');
 emit('pediment-oculus',{type:'disc',center:[xc,12.55,front+.47],radius:.58,axis:'z'},'window-glass','oculus-glazing');
 for(const sign of [-1,1]){box('entrance-return-'+sign,[xc+sign*7.3,5.55,z1],[1.55,8.9,1.0],'hall-brick','portico-return');for(let y=1.5;y<10;y+=.62)box('return-band-'+sign+'-'+y,[xc+sign*7.32,y,z1+.54],[1.62,.10,.14]);}
 for(let i=0;i<4;i++)box('hall-entry-step-'+i,[xc,hallY-(i+.5)*.22,front+1.45+i*.37],[15.8,.22,.42],'platform-stone','entrance-stair');
 anchors.push({id:'hall-title',text:'九龍  KOWLOON',at:[xc,10.22,front+.77],axis:'z',height:.47});
 // Low pierced parapets: repeated openings are formed by posts, never dark paint.
 for(const x of [x0-.15,x1+.15])for(let z=z0;z<z1;z+=1.25){box('parapet-post-'+x+'-'+z,[x,12.35,z],[.36,1.1,.22]);for(const y of [11.88,12.89])box('parapet-rail-'+x+'-'+z+'-'+y,[x,y,z+.60],[.42,.14,1.34]);}
 // Original clock tower proportions: solid shaft, four clock faces, open belfry, dome.
 const tb=plan.tower,tx=(tb.min[0]+tb.max[0])/2,tz=(tb.min[2]+tb.max[2])/2,w=s.tower.footprint,shaftTop=28.6;
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
 // Quay edge and original paved station apron; harbour is beyond the short end.
 const quay=plan.quay;box('quay-ground',[(quay.min[0]+quay.max[0])/2,-.13,zc+1],[quay.max[0]-quay.min[0],.40,z1-z0+18],'platform-stone','sea-quay');
 box('quay-seawall',[quay.max[0]-.2,-1.4,zc],[.75,2.5,z1-z0+18],'quay-stone','wave-bearing-seawall');
 for(let z=z0-6;z<z1+9;z+=2.8){cylinder('quay-bollard-'+z,[quay.max[0]-.7,.5,z],.11,1.0,'cast-iron',.09,12);}
 const road=plan.road;box('station-road',[(road.min[0]+road.max[0])/2,-.03,(road.min[2]+road.max[2])/2],[road.max[0]-road.min[0],.12,road.max[2]-road.min[2]],'road','road-surface');
 box('station-road-walk',[(road.min[0]+road.max[0])/2,.20,road.min[2]-2.4],[road.max[0]-road.min[0],.40,4.8],'platform-stone','outside-pedestrian-promenade');
 for(let x=road.min[0]+3;x<road.max[0];x+=5)box('road-line-'+x,[x,.037,(road.min[2]+road.max[2])/2],[2.5,.008,.12],'paint-cream','road-line');
 const pier=plan.pier;box('pier-deck',[(pier.min[0]+pier.max[0])/2,.40,(pier.min[2]+pier.max[2])/2],[pier.max[0]-pier.min[0],.34,6],'platform-stone','pier-slab');
 for(let x=pier.min[0]+2;x<pier.max[0];x+=4)for(const sign of[-1,1])cylinder('pier-pile-'+x+'-'+sign,[x,-1.4,tz+sign*2.3],.27,4,'quay-stone');
 return{parts,anchors,clockHands,proof:{architecture:'original-fictional-Kowloon-hall-and-clock-tower',historicalOneToOne:false,doors:'actual-open-arcades',hotel:'relationship-only-no-high-rise',parts:parts.length}};
}
