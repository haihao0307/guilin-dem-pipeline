/* Ocean Life Mother N02. Independently authored interactive prototype.
   Parameters below are authored candidates, NOT specimen fits or Palau measurements.
   A single shared body function is configured by recipes; simulation and view are separate. */
const LifeCore=(()=>{'use strict';
const TAU=2*Math.PI, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const recipes=[
 {id:'disc-gold',name:'金蓝高体',shape:0,palette:0,depth:.31,width:.105,tail:.25,dorsal:.17,length:.72,cruise:.28,role:'resident'},
 {id:'band-snout',name:'长吻带纹',shape:1,palette:1,depth:.30,width:.09,tail:.21,dorsal:.23,length:.66,cruise:.24,role:'resident'},
 {id:'fusiform',name:'银蓝梭形',shape:2,palette:2,depth:.14,width:.09,tail:.28,dorsal:.09,length:.78,cruise:.65,role:'school'},
 {id:'orange-small',name:'橙白短体',shape:0,palette:3,depth:.24,width:.11,tail:.21,dorsal:.10,length:.44,cruise:.25,role:'resident'},
 {id:'teal-pattern',name:'青绿网纹',shape:3,palette:4,depth:.235,width:.125,tail:.21,dorsal:.13,length:.68,cruise:.32,role:'resident'},
 {id:'blue-yellow',name:'蓝黄月尾',shape:0,palette:5,depth:.28,width:.085,tail:.25,dorsal:.15,length:.66,cruise:.34,role:'school'},
 {id:'box-spots',name:'箱形斑点',shape:4,palette:6,depth:.205,width:.15,tail:.19,dorsal:.06,length:.50,cruise:.18,role:'resident'},
 {id:'violet-lines',name:'紫金细带',shape:0,palette:7,depth:.30,width:.09,tail:.21,dorsal:.13,length:.58,cruise:.30,role:'school'}
];
// Same sand field in both visual and habitat code. Lipschitz gradient bound < .09.
const bed=(x,z)=>-2.55+.12*Math.sin(.5*x)+.08*Math.cos(.6*z)+.015*x;
const corals=[
 {id:0,x:-3.3,z:1.1,r:.83,type:0,palette:0},
 {id:1,x:.2,z:1.2,r:.72,type:1,palette:1},
 {id:2,x:3.3,z:-.7,r:1.0,type:2,palette:2},
 {id:3,x:-1.3,z:-2.1,r:.82,type:0,palette:3},
 {id:4,x:4.3,z:2.0,r:.53,type:0,palette:1},
 {id:5,x:-4.4,z:-2.5,r:.80,type:2,palette:3}
].map(c=>({...c,y:bed(c.x,c.z)+c.r*.50}));
const lower=(x,z,r)=>bed(x,z)+.10*r+r+.055, upper=r=>1.15-r-.06;
function safe(x,y,z,r){if(![x,y,z,r].every(Number.isFinite)||r<=0)return false;
 if(Math.abs(x)>7.2-r||Math.abs(z)>4.6-r||y<lower(x,z,r)||y>upper(r))return false;
 return !corals.some(c=>Math.hypot(x-c.x,(y-c.y)*.96,z-c.z)<r+c.r*1.10);
}
function create(count=24,seed=4907){
 if(!Number.isInteger(count)||count<1||count>72)throw Error('Count must be 1..72');
 let rng=seed>>>0;const random=()=>{rng=(1664525*rng+1013904223)>>>0;return rng/4294967296};
 const fish=[];for(let i=0;i<count;i++){const k=i%recipes.length,p=recipes[k],length=p.length*(.83+.28*random()),radius=.80*length;
 let x,y,z,tries=0;do{x=(random()-.5)*11.5;z=(random()-.5)*6.8;y=-.92+random()*1.20;if(++tries>2000)throw Error('No valid spawn');}while(!safe(x,y,z,radius)||fish.some(f=>Math.hypot(x-f.x,y-f.y,z-f.z)<radius+f.r));
 const yaw=(random()-.5)*TAU;fish.push({id:i,recipe:k,x,y,z,home:[x,y,z],yaw,length,r:radius,v:p.cruise,phase:random()*TAU,state:'cruise',calm:0,fleeEvents:0,returns:0,energy:1});}
 return{version:'OLM-N02-20260919',time:0,fish,observer:null,metrics:{steps:0,rejected:0,invalid:0,neighborChecks:0,flees:0,returns:0},seed};
}
function disturb(world,position){if(position!==null&&(!Array.isArray(position)||position.length!==3||position.some(x=>!Number.isFinite(x))))throw Error('Observer requires finite xyz');world.observer=position&&position.slice();}
function step(w,dt){
 if(!Number.isFinite(dt)||dt<=0||dt>1/30+1e-9)throw Error('Step must be (0,1/30]');
 const snapshots=w.fish.map(f=>({...f})),cellSize=2.2,cells=new Map();
 function key(x,z){return Math.floor(x/cellSize)+','+Math.floor(z/cellSize);}
 snapshots.forEach(f=>{const k=key(f.x,f.z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(f)});
 for(const f of w.fish){const p=recipes[f.recipe];let tx,tz,ty=f.home[1],speed=p.cruise;
 const threat=w.observer,td=threat?Math.hypot(f.x-threat[0],f.y-threat[1],f.z-threat[2]):Infinity;
 if(td<2.6){if(f.state!=='flee'){f.fleeEvents++;w.metrics.flees++;}f.state='flee';f.calm=0;
  const d=Math.hypot(f.x-threat[0],f.z-threat[2])||.001;tx=f.x+4*(f.x-threat[0])/d;tz=f.z+4*(f.z-threat[2])/d;speed=p.cruise*2.4;
 }else{
  if(f.state==='flee'||f.state==='alert'){f.calm+=dt;f.state=f.calm<1.6?'alert':'return';}
  if(f.state==='return'){tx=f.home[0];tz=f.home[2];speed=p.cruise*1.25;if(Math.hypot(f.x-tx,f.z-tz)<.40){f.state='cruise';f.returns++;w.metrics.returns++;}}
  else if(f.state==='alert'){tx=f.x+Math.cos(f.yaw);tz=f.z+Math.sin(f.yaw);speed*=.7;}
  else if(p.role==='resident'){tx=f.home[0]+.8*Math.cos(w.time*.12+f.id);tz=f.home[2]+.65*Math.sin(w.time*.14+f.id);}
  else{tx=3.8*Math.cos(w.time*.08+f.recipe*.15);tz=2.0*Math.sin(w.time*.08+f.recipe*.15);ty=-.3+.17*Math.sin(f.id+w.time*.2);}
 }
 let ax=tx-f.x,az=tz-f.z;const cx=Math.floor(f.x/cellSize),cz=Math.floor(f.z/cellSize),near=[];
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const n of cells.get((cx+dx)+','+(cz+dz))||[]){if(n.id===f.id)continue;w.metrics.neighborChecks++;const d=Math.hypot(f.x-n.x,f.z-n.z,f.y-n.y);if(d<2.2)near.push({n,d});}
 near.sort((a,b)=>a.d-b.d);
 for(const {n,d}of near.slice(0,6)){
  const gap=f.r+n.r+.15;if(d<gap){ax+=(f.x-n.x)/(d||.01)*(gap-d)*5;az+=(f.z-n.z)/(d||.01)*(gap-d)*5;}
  if(p.role==='school'&&recipes[n.recipe].role==='school'&&f.state!=='flee'){ax+=(n.x-f.x)*.12+Math.cos(n.yaw)*.10;az+=(n.z-f.z)*.12+Math.sin(n.yaw)*.10;}
 }
 for(const c of corals){const x=f.x-c.x,z=f.z-c.z,d=Math.hypot(x,z),gap=f.r+c.r*1.10+.9;if(d<gap&&f.y<c.y+c.r+f.r){ax+=x/(d||.01)*(gap-d)*4;az+=z/(d||.01)*(gap-d)*4;}}
 if(Math.abs(f.x)>5.7)ax-=Math.sign(f.x)*(Math.abs(f.x)-5.7)*8;
 if(Math.abs(f.z)>3.3)az-=Math.sign(f.z)*(Math.abs(f.z)-3.3)*8;
 const target=Math.atan2(az,ax),delta=Math.atan2(Math.sin(target-f.yaw),Math.cos(target-f.yaw));
 f.yaw+=clamp(delta,-1.6*dt,1.6*dt);f.v+=clamp(speed-f.v,-.75*dt,.75*dt);
 const x=f.x+Math.cos(f.yaw)*f.v*dt,z=f.z+Math.sin(f.yaw)*f.v*dt,y=f.y+clamp(ty-f.y,-.20*dt,.20*dt);
 if(safe(x,y,z,f.r)){f.x=x;f.y=y;f.z=z;}else{w.metrics.rejected++;f.v=Math.max(.03,f.v-.9*dt);f.yaw+=.5*dt;}
 // Authored frequency for uncalibrated recipes. N01's tuna regression is NOT used indiscriminately.
 f.phase+=(.75+f.v/f.length*1.30)*TAU*dt;
 if(!safe(f.x,f.y,f.z,f.r))w.metrics.invalid++;
 }
 w.time+=dt;w.metrics.steps++;
}
function snapshot(w){return JSON.parse(JSON.stringify(w));}
return{recipes,corals,bed,lower,upper,safe,create,step,disturb,snapshot};})();
if(typeof module!=='undefined')module.exports=LifeCore;
