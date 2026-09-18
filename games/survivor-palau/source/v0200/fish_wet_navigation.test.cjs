const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/fish_wet_navigation.js','utf8'),ctx);
const make=ctx.createFishWetNavigation;
const fish=()=>({id:'fish-01',length:.55,phase:0,anchor:[0,0],pos:[0,0,0],yaw:Math.PI/2});
const copy=v=>JSON.parse(JSON.stringify(v));
function run(label,fn){fn();console.log('PASS '+label);}
run('original thin-water clamp counterexample is unavailable, not underground',()=>{
 const f=fish(),n=make({floor:()=>0,water:()=>.20}),s=n.initialize(f,0);
 assert.equal(s.status,'unavailable');assert.match(s.reason,/no-safe-spawn/);
});
run('connected slope retreat stays submerged and moves continuously offshore',()=>{
 const f=fish(),n=make({floor:x=>-.2-.20*x,water:(x,z,t)=>.75-.012*t}),s=n.initialize(f,0);
 const initial=s.pos[0];
 for(let i=1;i<=900;i++){
  const before=[...s.pos],yaw=s.yaw;n.advance(f,s,i*.1);
  assert.equal(s.status,'swimming',`${i}: ${s.reason}`);
  assert(n.inspect(f,s,i*.1).safe,`unsafe at ${i}`);
  assert(Math.hypot(...s.pos.map((v,k)=>v-before[k]))<.112,'teleport');
  assert(Math.abs(Math.atan2(Math.sin(s.yaw-yaw),Math.cos(s.yaw-yaw)))<=.1800001,'instant turn');
 }
 assert(s.pos[0]>initial+3,'did not retreat to deeper water');
});
run('swept fish body does not cross a solid wall',()=>{
 const f=fish(),n=make({floor:()=>-2,water:()=>0,blocked:(x,y,z,r)=>x+r>1&&x-r<1.2}),s=n.initialize(f,0);
 for(let i=1;i<=400;i++){n.advance(f,s,i*.1);assert(s.pos[0]+.98*f.length+.025<=1+1e-8);assert(n.inspect(f,s).safe);}
});
run('fixed steps give same trajectory at 20 and 60 fps',()=>{
 const env={floor:x=>-1-.04*x,water:(x,z,t)=>.1+.05*Math.sin(t*.1)},f=fish(),n=make(env),a=n.initialize(f,0),b=n.initialize(f,0);
 for(let i=1;i<=400;i++)n.advance(f,a,i/20);
 for(let i=1;i<=1200;i++)n.advance(f,b,i/60);
 assert(Math.hypot(...a.pos.map((v,k)=>v-b.pos[k]))<1e-9);assert(Math.abs(a.yaw-b.yaw)<1e-9);
});
run('JSON save and restore preserves navigation and partial timestep',()=>{
 const env={floor:x=>-1-.04*x,water:()=>0},f=fish(),n=make(env),a=n.initialize(f,0);
 n.advance(f,a,3.37);const b=n.initialize(f,3.37,copy(a));assert.equal(b.initialization,'restored');
 assert.deepEqual(copy(b.pos),copy(a.pos));n.advance(f,a,15);n.advance(f,b,15);
 assert.deepEqual(copy(b.pos),copy(a.pos));assert.equal(b.yaw,a.yaw);
});
run('180 second rest jump processes all steps without respawning',()=>{
 const f=fish(),n=make({floor:()=>-2,water:()=>0}),a=n.initialize(f,0),b=n.initialize(f,0);
 n.advance(f,a,180);for(let i=1;i<=1800;i++)n.advance(f,b,i*.1);
 assert.equal(a.status,'swimming');assert(Math.abs(a.simTime-180)<1e-8);
 assert.deepEqual(copy(a.pos),copy(b.pos));
});
run('sudden dry water, invalid input and encirclement are explicit failures',()=>{
 const f=fish();let level=0,blocked=false;const n=make({floor:()=>-2,water:()=>level,blocked:()=>blocked});
 const s=n.initialize(f,0),p=copy(s.pos);level=-4;n.advance(f,s,.1);
 assert.equal(s.status,'stranded');assert.deepEqual(copy(s.pos),p);assert(!n.inspect(f,s).safe);
 const restored=n.initialize(f,.1,copy(s));assert.equal(restored.status,'stranded');assert.deepEqual(copy(restored.pos),p);
 level=NaN;n.advance(f,s,.2);assert.equal(s.status,'unavailable');
 level=0;const b=n.initialize(f,0);blocked=true;n.advance(f,b,.1);assert.equal(b.status,'stranded');
 assert.equal(n.initialize(f,0,{version:123}).status,'unavailable');
 const bad=n.initialize(f,0,{version:123,pos:[7,-1,8],yaw:.8});assert.deepEqual(copy(bad.pos),[7,-1,8]);
});
run('pause is motionless and reverse time cannot silently reset',()=>{
 const f=fish(),n=make({floor:()=>-2,water:()=>0}),s=n.initialize(f,1),before=JSON.stringify(s);
 n.advance(f,s,1);assert.equal(JSON.stringify(s),before);n.advance(f,s,0);assert.equal(s.status,'unavailable');
});
run('a safely enclosed fish remains visible while waiting and turning',()=>{
 const f=fish();let enclosed=false;const n=make({floor:()=>-2,water:()=>0,blocked:(x,y,z,r)=>enclosed&&Math.hypot(x,z-.85)>.001});
 const s=n.initialize(f,0);enclosed=true;const p=copy(s.pos),yaw=s.yaw;n.advance(f,s,.1);
 assert.equal(s.status,'swimming');assert.equal(s.reason,'waiting-for-turn');assert(n.inspect(f,s).safe);
 assert.deepEqual(copy(s.pos),p);assert(Math.abs(s.yaw-yaw)<=.1800001);
});
run('inspect handles absent state and revalidates water during fractional steps',()=>{
 const f=fish();let level=0;const n=make({floor:()=>-2,water:()=>level}),s=n.initialize(f,0),p=copy(s.pos);
 assert.equal(n.inspect(f,undefined).safe,false);n.advance(f,s,.04);assert(n.inspect(f,s).safe);assert.equal(s.simTime,0);
 level=-4;n.advance(f,s,.07);assert.equal(s.status,'stranded');assert.equal(n.inspect(f,s).safe,false);
 assert.equal(s.simTime,0);assert.deepEqual(copy(s.pos),p);assert(Math.abs(s.remainder-.07)<1e-9);
});
